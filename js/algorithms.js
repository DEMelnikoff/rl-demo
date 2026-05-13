// algorithms.js — MFAgent, MBAgent, SRAgent classes

import { STATES, N_STATES, ACTIONS, oneHot, softmax, sampleAction } from './task.js';

const GAMMA = 1.0;
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

    // Step 1: update planet Q value (reward is received at terminal — planet bootstraps to it)
    const deltaplanet = reward - oldQplanet;
    this.Q_planet[planetKey] += alpha * deltaplanet;

    // Step 2: update choice Q value — bootstrap from planet (no immediate reward at choice step)
    const tdTarget = gamma * this.Q_planet[planetKey];
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
    this.reset();
  }

  reset() {
    // T_rocket[action][planet]: probability that rocket action leads to planet
    this.T_rocket = {
      red:   { red_planet: 0.5, green_planet: 0.5 },
      green: { red_planet: 0.5, green_planet: 0.5 },
    };
    // T_planet[planet][outcome]: probability that planet leads to outcome
    this.T_planet = {
      red:   { apple: 0.5, salad: 0.5 },
      green: { apple: 0.5, salad: 0.5 },
    };
    // R is determined by goal, not learned
    this.R = { apple: 1, salad: 0 };
    this.lastUpdate = null;
  }

  setGoal(goal) {
    this.R = { apple: goal === 'apple' ? 1 : 0, salad: goal === 'salad' ? 1 : 0 };
  }

  selectAction() {
    const Q = this._computeQ();
    return sampleAction(softmax(Q, BETA));
  }

  _computeQ() {
    // Full planning: Q(rocket) = Σ_planet T_rocket[rocket][planet] * Σ_outcome T_planet[planet][outcome] * R[outcome]
    const planetValue = (planet) =>
      this.T_planet[planet].apple * this.R.apple +
      this.T_planet[planet].salad * this.R.salad;

    const g2 = GAMMA * GAMMA;
    const Qred = g2 * (
      this.T_rocket.red.red_planet * planetValue('red') +
      this.T_rocket.red.green_planet * planetValue('green')
    );
    const Qgreen = g2 * (
      this.T_rocket.green.red_planet * planetValue('red') +
      this.T_rocket.green.green_planet * planetValue('green')
    );
    return { red: Qred, green: Qgreen };
  }

  /**
   * Update planet→outcome transition model.
   */
  update(planetKey, outcomeKey, reward) {
    const otherOutcome = outcomeKey === 'apple' ? 'salad' : 'apple';
    const oldT = this.T_planet[planetKey][outcomeKey];

    this.T_planet[planetKey][outcomeKey] += this.alpha_T * (1 - this.T_planet[planetKey][outcomeKey]);
    this.T_planet[planetKey][otherOutcome] = 1 - this.T_planet[planetKey][outcomeKey];

    this.lastUpdate = {
      planetKey,
      outcomeKey,
      reward,
      oldT,
      newT: this.T_planet[planetKey][outcomeKey],
    };
    return this.lastUpdate;
  }

  /**
   * Update rocket→planet transition model (only happens on choice trials).
   */
  updateRocket(rocketKey, planetKey) {
    const planetState = planetKey + '_planet'; // 'red_planet' or 'green_planet'
    const otherPlanet = planetState === 'red_planet' ? 'green_planet' : 'red_planet';
    this.T_rocket[rocketKey][planetState] += this.alpha_T * (1 - this.T_rocket[rocketKey][planetState]);
    this.T_rocket[rocketKey][otherPlanet] = 1 - this.T_rocket[rocketKey][planetState];
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
      T_rocket: {
        red: { ...this.T_rocket.red },
        green: { ...this.T_rocket.green },
      },
      T_planet: {
        red: { ...this.T_planet.red },
        green: { ...this.T_planet.green },
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
    this.reset();
  }

  reset() {
    this.M_red = oneHot(STATES.S_CHOICE).slice();
    this.M_green = oneHot(STATES.S_CHOICE).slice();
    this.M_planet_red = oneHot(STATES.S_RED_PLANET).slice();
    this.M_planet_green = oneHot(STATES.S_GREEN_PLANET).slice();

    // w is determined by goal, not learned
    this.w = new Float32Array(N_STATES);
    this.w[STATES.S_APPLE] = 1; // default goal = apple

    this.lastUpdate = null;
    this.lastUpdatedRows = [];
  }

  setGoal(goal) {
    this.w[STATES.S_APPLE] = goal === 'apple' ? 1 : 0;
    this.w[STATES.S_SALAD] = goal === 'salad' ? 1 : 0;
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
    // w is goal-based (set via setGoal), not learned from experience
    return { terminalState, reward, oldW: Array.from(this.w), newW: Array.from(this.w) };
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
