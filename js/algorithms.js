// algorithms.js — MFAgent, MBAgent, SRAgent classes

import { STATES, N_STATES, ACTIONS, oneHot, softmax, sampleAction } from './task.js';

const GAMMA = 0.9;
const BETA = 5;

// ─── Model-Free Agent ──────────────────────────────────────────────────────────

export class MFAgent {
  constructor() {
    this.alpha = 0.3;
    this.reset();
  }

  reset() {
    // Q values at choice state (per action)
    this.Q_choice = { red: 0, green: 0 };
    // Q values at planet states (scalar expected value)
    this.Q_planet = { red: 0, green: 0 }; // red planet = index 1, green planet = index 2
    this.lastUpdate = null;
  }

  /**
   * Run a full two-step trial.
   * planetKey: 'red' | 'green' (which planet was visited)
   * reward: number
   * returns { action, planetKey, reward, updates }
   */
  selectAction() {
    return sampleAction(softmax(this.Q_choice, BETA));
  }

  update(action, planetKey, reward) {
    const alpha = this.alpha;
    const gamma = GAMMA;

    const oldQplanet = this.Q_planet[planetKey];
    const oldQchoice = this.Q_choice[action];

    // Step 1: update planet Q value
    const deltaplanet = reward - oldQplanet;
    this.Q_planet[planetKey] += alpha * deltaplanet;

    // Step 2: update choice Q value with two-step TD
    const tdTarget = reward + gamma * this.Q_planet[planetKey];
    const deltachoice = tdTarget - oldQchoice;
    this.Q_choice[action] += alpha * deltachoice;

    this.lastUpdate = {
      planetKey,
      action,
      reward,
      oldQplanet,
      newQplanet: this.Q_planet[planetKey],
      deltaplanet,
      oldQchoice,
      newQchoice: this.Q_choice[action],
      deltachoice,
    };

    return this.lastUpdate;
  }

  getQValues() {
    return { red: this.Q_choice.red, green: this.Q_choice.green };
  }

  getPreferredAction() {
    return this.Q_choice.red >= this.Q_choice.green ? 'red' : 'green';
  }

  getDisplayData() {
    return {
      Q_choice: { ...this.Q_choice },
      Q_planet: { ...this.Q_planet },
    };
  }
}

// ─── Model-Based Agent ─────────────────────────────────────────────────────────

export class MBAgent {
  constructor() {
    this.alpha_T = 0.5;
    this.alpha_R = 0.3;
    this.reset();
  }

  reset() {
    // T[planet][outcome]: probability that planet leads to outcome
    this.T = {
      red: { apple: 0.5, salad: 0.5 },
      green: { apple: 0.5, salad: 0.5 },
    };
    // R[outcome]: expected reward for each outcome
    this.R = { apple: 0, salad: 0 };
    this.lastUpdate = null;
  }

  selectAction() {
    const Q = this._computeQ();
    return sampleAction(softmax(Q, BETA));
  }

  _computeQ() {
    const g2 = GAMMA * GAMMA;
    const Qred = g2 * (this.T.red.apple * this.R.apple + this.T.red.salad * this.R.salad);
    const Qgreen = g2 * (this.T.green.apple * this.R.apple + this.T.green.salad * this.R.salad);
    return { red: Qred, green: Qgreen };
  }

  /**
   * Update from planet observation.
   * planetKey: 'red' | 'green'
   * outcomeKey: 'apple' | 'salad'
   * reward: number
   */
  update(planetKey, outcomeKey, reward) {
    const alpha_T = this.alpha_T;
    const alpha_R = this.alpha_R;
    const otherOutcome = outcomeKey === 'apple' ? 'salad' : 'apple';

    const oldT = this.T[planetKey][outcomeKey];
    const oldR = this.R[outcomeKey];

    // Update transition model
    this.T[planetKey][outcomeKey] += alpha_T * (1 - this.T[planetKey][outcomeKey]);
    this.T[planetKey][otherOutcome] = 1 - this.T[planetKey][outcomeKey];

    // Update reward model
    this.R[outcomeKey] += alpha_R * (reward - this.R[outcomeKey]);

    this.lastUpdate = {
      planetKey,
      outcomeKey,
      reward,
      oldT,
      newT: this.T[planetKey][outcomeKey],
      oldR,
      newR: this.R[outcomeKey],
    };

    return this.lastUpdate;
  }

  getQValues() {
    return this._computeQ();
  }

  getPreferredAction() {
    const Q = this._computeQ();
    return Q.red >= Q.green ? 'red' : 'green';
  }

  getDisplayData() {
    return {
      T: {
        red: { ...this.T.red },
        green: { ...this.T.green },
      },
      R: { ...this.R },
      Q: this._computeQ(),
    };
  }
}

// ─── Successor Representation Agent ───────────────────────────────────────────

export class SRAgent {
  constructor() {
    this.alpha_SR = 0.3;
    this.alpha_w = 0.3;
    this.reset();
  }

  reset() {
    // Per-action M vectors from S_choice (length N_STATES each)
    // M_red: occupancy when taking red rocket from choice
    this.M_red = oneHot(STATES.S_CHOICE).slice();    // e[0]
    this.M_green = oneHot(STATES.S_CHOICE).slice();  // e[0]

    // M vectors from planet states
    this.M_planet_red = oneHot(STATES.S_RED_PLANET).slice();   // e[1]
    this.M_planet_green = oneHot(STATES.S_GREEN_PLANET).slice(); // e[2]

    // Reward weights per state
    this.w = new Float32Array(N_STATES);

    this.lastUpdate = null;
    this.lastUpdatedRows = [];
  }

  selectAction() {
    const Q = this._computeQ();
    return sampleAction(softmax(Q, BETA));
  }

  _dot(a, b) {
    let sum = 0;
    for (let i = 0; i < N_STATES; i++) sum += a[i] * b[i];
    return sum;
  }

  _computeQ() {
    return {
      red: this._dot(this.M_red, this.w),
      green: this._dot(this.M_green, this.w),
    };
  }

  /**
   * Update SR when taking rocket action from S_choice.
   * action: 'red' | 'green'
   */
  updateFromChoice(action) {
    const alpha = this.alpha_SR;
    const gamma = GAMMA;
    const e0 = oneHot(STATES.S_CHOICE);

    if (action === 'red') {
      // M_red ← M_red + α * (e[0] + γ * M_planet_red − M_red)
      const oldM = this.M_red.slice();
      for (let i = 0; i < N_STATES; i++) {
        this.M_red[i] += alpha * (e0[i] + gamma * this.M_planet_red[i] - this.M_red[i]);
      }
      this.lastUpdatedRows = [0];
      return { row: 'M_red', oldM, newM: this.M_red.slice() };
    } else {
      const oldM = this.M_green.slice();
      for (let i = 0; i < N_STATES; i++) {
        this.M_green[i] += alpha * (e0[i] + gamma * this.M_planet_green[i] - this.M_green[i]);
      }
      this.lastUpdatedRows = [1];
      return { row: 'M_green', oldM, newM: this.M_green.slice() };
    }
  }

  /**
   * Update SR when at a planet state transitioning to terminal.
   * planetKey: 'red' | 'green'
   * terminalState: STATES.S_APPLE or STATES.S_SALAD
   */
  updateFromPlanet(planetKey, terminalState) {
    const alpha = this.alpha_SR;
    const gamma = GAMMA;

    if (planetKey === 'red') {
      const ePlanet = oneHot(STATES.S_RED_PLANET);   // e[1]
      const eTerminal = oneHot(terminalState);
      const oldM = this.M_planet_red.slice();
      for (let i = 0; i < N_STATES; i++) {
        this.M_planet_red[i] += alpha * (ePlanet[i] + gamma * eTerminal[i] - this.M_planet_red[i]);
      }
      this.lastUpdatedRows = [2];
      return { row: 'M_planet_red', oldM, newM: this.M_planet_red.slice() };
    } else {
      const ePlanet = oneHot(STATES.S_GREEN_PLANET);  // e[2]
      const eTerminal = oneHot(terminalState);
      const oldM = this.M_planet_green.slice();
      for (let i = 0; i < N_STATES; i++) {
        this.M_planet_green[i] += alpha * (ePlanet[i] + gamma * eTerminal[i] - this.M_planet_green[i]);
      }
      this.lastUpdatedRows = [3];
      return { row: 'M_planet_green', oldM, newM: this.M_planet_green.slice() };
    }
  }

  /**
   * Update reward weights.
   * terminalState: STATES.S_APPLE or STATES.S_SALAD
   * reward: number
   */
  updateW(terminalState, reward) {
    const alpha = this.alpha_w;
    const oldW = this.w.slice();
    this.w[terminalState] += alpha * (reward - this.w[terminalState]);

    this.lastUpdate = {
      terminalState,
      reward,
      oldW,
      newW: this.w.slice(),
    };

    return this.lastUpdate;
  }

  getQValues() {
    return this._computeQ();
  }

  getPreferredAction() {
    const Q = this._computeQ();
    return Q.red >= Q.green ? 'red' : 'green';
  }

  getDisplayData() {
    return {
      M_red: Array.from(this.M_red),
      M_green: Array.from(this.M_green),
      M_planet_red: Array.from(this.M_planet_red),
      M_planet_green: Array.from(this.M_planet_green),
      w: Array.from(this.w),
      Q: this._computeQ(),
      lastUpdatedRows: [...this.lastUpdatedRows],
    };
  }
}
