// algorithms.js — MFAgent, MBAgent, SRAgent classes

import { STATES, N_STATES, ACTIONS, oneHot, softmax, sampleAction } from './task.js';

// Live, mutable parameters. The settings overlay edits these and the next
// agent step picks up the new values automatically.
export const PARAMS = {
  alpha_mf: 0.3,
  alpha_mb: 0.3,
  alpha_sr: 0.3,
  beta: 1.0,
  gamma: 1.0,
  // Eligibility-trace decay used by MF and SR. λ=0 is one-step TD (lag);
  // λ=1 propagates each TD error along the full visited trajectory in one trial.
  lambda: 1.0,
};

// ─── Model-Free Agent ──────────────────────────────────────────────────────────

export class MFAgent {
  constructor() {
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
    return sampleAction(softmax(this.Q_choice, PARAMS.beta));
  }

  update(action, planetKey, reward) {
    const alpha = PARAMS.alpha_mf;
    const gamma = PARAMS.gamma;
    const lambda = PARAMS.lambda;

    const oldQplanet = this.Q_planet[planetKey];
    const oldQchoice = this.Q_choice[action];

    // Step 1 (S_choice → S_planet, no immediate reward): TD error bootstraps from
    // the planet's CURRENT estimate (pre-update). Eligibility trace for the
    // choice-action is 1 (just visited).
    const delta1 = gamma * oldQplanet - oldQchoice;
    this.Q_choice[action] += alpha * delta1;

    // Step 2 (S_planet → terminal, reward r): TD error reflects the reward.
    // The planet trace is now 1; the choice trace has decayed once to γ·λ. So
    // BOTH state-values feel this δ — the choice state directly, scaled by γ·λ.
    const delta2 = reward - oldQplanet;
    this.Q_planet[planetKey] += alpha * delta2;
    this.Q_choice[action] += alpha * delta2 * gamma * lambda;

    this.lastUpdate = {
      planetKey,
      action,
      reward,
      oldQplanet,
      newQplanet: this.Q_planet[planetKey],
      deltaplanet: delta2,
      oldQchoice,
      newQchoice: this.Q_choice[action],
      deltachoice: delta1,
    };

    return this.lastUpdate;
  }

  // Planet-only update for revaluation phases: agent observes planet → terminal → reward
  // but did not take a choice action, so Q_choice is left alone. This is the mechanism
  // behind MF failure to revalue — Q_planet shifts but Q_choice doesn't catch up until
  // the agent visits S_choice again.
  updatePlanetOnly(planetKey, reward) {
    const alpha = PARAMS.alpha_mf;
    const oldQplanet = this.Q_planet[planetKey];
    const deltaplanet = reward - oldQplanet;
    this.Q_planet[planetKey] += alpha * deltaplanet;

    this.lastUpdate = {
      planetKey,
      reward,
      oldQplanet,
      newQplanet: this.Q_planet[planetKey],
      deltaplanet,
      planetOnly: true,
    };
    return this.lastUpdate;
  }

  getQValues() {
    return { red: this.Q_choice.red, green: this.Q_choice.green };
  }

  // Values of the two chef (intermediate) states. Used to pick which chef the
  // agent visits during revaluation phases.
  getPlanetValues() {
    return { red: this.Q_planet.red, green: this.Q_planet.green };
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
    this.reset();
  }

  reset() {
    // T_rocket[action][planet]: probability that rocket action leads to planet.
    // Start at 0 — no prior. First observation seeds the model.
    this.T_rocket = {
      red:   { red_planet: 0, green_planet: 0 },
      green: { red_planet: 0, green_planet: 0 },
    };
    // T_planet[planet][outcome]: probability that planet leads to outcome.
    this.T_planet = {
      red:   { apple: 0, salad: 0 },
      green: { apple: 0, salad: 0 },
    };
    // R is determined by goal, not learned. Disfavored item is punished (-1).
    this.R = { apple: 1, salad: -1 };
    this.lastUpdate = null;
  }

  setGoal(goal) {
    this.R = {
      apple: goal === 'apple' ? 1 : -1,
      salad: goal === 'salad' ? 1 : -1,
    };
  }

  selectAction() {
    const Q = this._computeQ();
    return sampleAction(softmax(Q, PARAMS.beta));
  }

  _computeQ() {
    // Full planning: Q(rocket) = Σ_planet T_rocket[rocket][planet] * Σ_outcome T_planet[planet][outcome] * R[outcome]
    const planetValue = (planet) =>
      this.T_planet[planet].apple * this.R.apple +
      this.T_planet[planet].salad * this.R.salad;

    const g2 = PARAMS.gamma * PARAMS.gamma;
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
   * Update planet→outcome transition model. Delta-rule on both outcomes:
   * the observed one moves toward 1, the unobserved toward 0. Starting from
   * 0/0, this correctly grows belief in the observed transition without
   * spuriously inflating its complement.
   */
  update(planetKey, outcomeKey, reward) {
    const otherOutcome = outcomeKey === 'apple' ? 'salad' : 'apple';
    const oldT = this.T_planet[planetKey][outcomeKey];

    this.T_planet[planetKey][outcomeKey] += PARAMS.alpha_mb * (1 - this.T_planet[planetKey][outcomeKey]);
    this.T_planet[planetKey][otherOutcome] += PARAMS.alpha_mb * (0 - this.T_planet[planetKey][otherOutcome]);

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
   * Same delta-rule structure as planet→outcome.
   */
  updateRocket(rocketKey, planetKey) {
    const planetState = planetKey + '_planet'; // 'red_planet' or 'green_planet'
    const otherPlanet = planetState === 'red_planet' ? 'green_planet' : 'red_planet';
    this.T_rocket[rocketKey][planetState] += PARAMS.alpha_mb * (1 - this.T_rocket[rocketKey][planetState]);
    this.T_rocket[rocketKey][otherPlanet]  += PARAMS.alpha_mb * (0 - this.T_rocket[rocketKey][otherPlanet]);
  }

  getQValues() {
    return this._computeQ();
  }

  // Values of the two chef states under the current model + reward weights.
  getPlanetValues() {
    return {
      red: this.T_planet.red.apple * this.R.apple + this.T_planet.red.salad * this.R.salad,
      green: this.T_planet.green.apple * this.R.apple + this.T_planet.green.salad * this.R.salad,
    };
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
    this.reset();
  }

  reset() {
    this.M_red = oneHot(STATES.S_CHOICE).slice();
    this.M_green = oneHot(STATES.S_CHOICE).slice();
    this.M_planet_red = oneHot(STATES.S_RED_PLANET).slice();
    this.M_planet_green = oneHot(STATES.S_GREEN_PLANET).slice();

    // w is determined by goal, not learned. Disfavored item is punished (-1).
    this.w = new Float32Array(N_STATES);
    this.w[STATES.S_APPLE] = 1;
    this.w[STATES.S_SALAD] = -1;

    this.lastUpdate = null;
    this.lastUpdatedRows = [];
  }

  setGoal(goal) {
    this.w[STATES.S_APPLE] = goal === 'apple' ? 1 : -1;
    this.w[STATES.S_SALAD] = goal === 'salad' ? 1 : -1;
  }

  selectAction() {
    const Q = this._computeQ();
    return sampleAction(softmax(Q, PARAMS.beta));
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
   * Full-trial SR update for the Choice Phase, using forward-view TD(λ).
   * Both rows (action and planet) are updated from the same trajectory:
   *   action row:  step-1 bootstrap (using OLD M_planet) + γ·λ × step-2 TD error
   *   planet row:  step-2 TD error
   * At λ=1 (with γ=1) the action row converges to the full visited-state count
   * e[choice] + e[planet] + e[terminal], matching Monte Carlo SR.
   */
  updateFromChoiceTrial(action, planetKey, terminalState) {
    const alpha = PARAMS.alpha_sr;
    const gamma = PARAMS.gamma;
    const lambda = PARAMS.lambda;

    const actionRow = action === 'red' ? 'M_red' : 'M_green';
    const planetRow = planetKey === 'red' ? 'M_planet_red' : 'M_planet_green';
    const M_action = this[actionRow];
    const M_planet = this[planetRow];

    const eChoice = oneHot(STATES.S_CHOICE);
    const ePlanet = oneHot(planetKey === 'red' ? STATES.S_RED_PLANET : STATES.S_GREEN_PLANET);
    const eTerminal = oneHot(terminalState);

    const oldM_action = M_action.slice();
    const oldM_planet = M_planet.slice();

    // Step 1 TD error (bootstrap off OLD planet row, no reward).
    // Step 2 TD error (planet row → terminal observation).
    for (let i = 0; i < N_STATES; i++) {
      const delta1 = eChoice[i] + gamma * oldM_planet[i] - oldM_action[i];
      const delta2 = ePlanet[i] + gamma * eTerminal[i] - oldM_planet[i];
      M_action[i] += alpha * (delta1 + gamma * lambda * delta2);
      M_planet[i] += alpha * delta2;
    }

    this.lastUpdatedRows = [
      action === 'red' ? 0 : 1,
      planetKey === 'red' ? 2 : 3,
    ];

    return {
      choiceUpdate: { row: actionRow, oldM: oldM_action, newM: M_action.slice() },
      planetUpdate: { row: planetRow, oldM: oldM_planet, newM: M_planet.slice() },
    };
  }

  /**
   * Update SR when taking rocket action from S_choice (legacy; kept for compat).
   * Use updateFromChoiceTrial for full-trial TD(λ).
   */
  updateFromChoice(action) {
    const alpha = PARAMS.alpha_sr;
    const gamma = PARAMS.gamma;
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
    const alpha = PARAMS.alpha_sr;
    const gamma = PARAMS.gamma;

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

  // Values of the two chef states: each chef-row's SR dotted with w.
  getPlanetValues() {
    return {
      red: this._dot(this.M_planet_red, this.w),
      green: this._dot(this.M_planet_green, this.w),
    };
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
