// algorithms.js — MF, MB, SR implementations

import { STATES, ACTIONS, STATE_NAMES } from './task.js';

const ALPHA_MF = 0.3;
const ALPHA_MB_T = 0.5;
const ALPHA_MB_R = 0.5;
const ALPHA_SR = 0.3;
const ALPHA_W = 0.3;
const GAMMA = 0.9;
const BETA = 5.0; // softmax temperature

function softmax(values, beta) {
  const maxVal = Math.max(...values);
  const exps = values.map(v => Math.exp(beta * (v - maxVal)));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
}

function sampleFromProbs(probs) {
  const r = Math.random();
  let cumProb = 0;
  for (let i = 0; i < probs.length; i++) {
    cumProb += probs[i];
    if (r < cumProb) return i;
  }
  return probs.length - 1;
}

// ─── Model-Free (Q-learning) ─────────────────────────────────────────────────

export class ModelFree {
  constructor() {
    // Q[s][a]: 3 states × 2 actions
    this.Q = [
      [0.5, 0.5], // S1
      [0.5, 0.5], // S2a
      [0.5, 0.5], // S2b
    ];
    this.lastUpdate = null;
    this.history = []; // Q(S1,a1) and Q(S1,a2) over trials
  }

  selectAction(state) {
    const qValues = this.Q[state];
    const probs = softmax(qValues, BETA);
    return sampleFromProbs(probs);
  }

  // Returns update info for visualization
  update(s1, a1, s2, a2, reward) {
    // Update Q(s2, a2) — terminal TD update with reward (no next state bootstrap)
    const oldQ_s2 = this.Q[s2][a2];
    const delta_s2 = reward - oldQ_s2;
    this.Q[s2][a2] += ALPHA_MF * delta_s2;

    // Update Q(s1, a1) — TD update bootstrapping from s2 using post-update Q(s2)
    const maxQ_s2 = Math.max(...this.Q[s2]);
    const oldQ_s1 = this.Q[s1][a1];
    const tdTarget = GAMMA * maxQ_s2; // reward already captured in Q(s2)
    const delta_s1 = tdTarget - oldQ_s1;
    this.Q[s1][a1] += ALPHA_MF * delta_s1;

    this.lastUpdate = {
      s1, a1, s2, a2, reward,
      oldQ_s2, delta_s2, newQ_s2: this.Q[s2][a2],
      oldQ_s1, delta_s1, tdTarget: tdTarget, maxQ_s2, newQ_s1: this.Q[s1][a1],
    };
    this.history.push([this.Q[0][0], this.Q[0][1]]);
    return this.lastUpdate;
  }

  getQValues() {
    return this.Q.map(row => [...row]);
  }
}

// ─── Model-Based ─────────────────────────────────────────────────────────────

export class ModelBased {
  constructor() {
    // Transition counts/probs: T[s1_action][s2] — only S1 transitions matter
    // T[a][s2] = probability estimate
    this.T = [
      [0.5, 0.5], // a1 → [P(S2a), P(S2b)]
      [0.5, 0.5], // a2 → [P(S2a), P(S2b)]
    ];
    // Reward model: R[s2][a2] = expected reward estimate
    this.R = [
      [0.5, 0.5], // S2a: [a1, a2]
      [0.5, 0.5], // S2b: [a1, a2]
    ];
    // Value function V[s]
    this.V = [0.5, 0.5, 0.5];
    this.lastUpdate = null;
    this.history = [];
    this._recomputeActionValues();
  }

  _recomputeActionValues() {
    // Value iteration — do multiple sweeps from S2 backwards
    // Update V for S2a, S2b first
    this.V[STATES.S2A] = Math.max(this.R[0][0], this.R[0][1]);
    this.V[STATES.S2B] = Math.max(this.R[1][0], this.R[1][1]);

    // Update V for S1 using transition model
    const V_a1 = this.T[0][0] * (this.R[0][ACTIONS.A1] + GAMMA * this.V[STATES.S2A])
               + this.T[0][1] * (this.R[1][ACTIONS.A1] + GAMMA * this.V[STATES.S2B]);
    const V_a2 = this.T[1][0] * (this.R[0][ACTIONS.A2] + GAMMA * this.V[STATES.S2A])
               + this.T[1][1] * (this.R[1][ACTIONS.A2] + GAMMA * this.V[STATES.S2B]);

    // Q values at S1
    this.Q_S1 = [V_a1, V_a2];
    this.V[STATES.S1] = Math.max(V_a1, V_a2);
  }

  // Get Q values at S1 for action selection
  getQ_S1() {
    return [...this.Q_S1];
  }

  // Q at S2 states — pick best R
  getQ_S2(s2) {
    return [...this.R[s2 - 1]];
  }

  selectAction(state) {
    let qValues;
    if (state === STATES.S1) {
      qValues = this.Q_S1;
    } else {
      qValues = this.R[state - 1];
    }
    const probs = softmax(qValues, BETA);
    return sampleFromProbs(probs);
  }

  update(s1, a1, s2, a2, reward) {
    // Update transition model: T[a1][s2_idx]
    const s2idx = s2 - 1; // S2a=0, S2b=1
    const oldT = [...this.T[a1]];
    const predError_T = [];
    for (let i = 0; i < 2; i++) {
      const indicator = i === s2idx ? 1 : 0;
      predError_T.push(indicator - this.T[a1][i]);
      this.T[a1][i] += ALPHA_MB_T * (indicator - this.T[a1][i]);
    }

    // Update reward model: R[s2idx][a2]
    const oldR = this.R[s2idx][a2];
    const rewardPE = reward - oldR;
    this.R[s2idx][a2] += ALPHA_MB_R * rewardPE;

    // Planning: value iteration
    this._recomputeActionValues();

    this.lastUpdate = {
      s1, a1, s2, a2, reward, s2idx,
      oldT, newT: [...this.T[a1]], predError_T,
      oldR, newR: this.R[s2idx][a2], rewardPE,
      newQ_S1: [...this.Q_S1],
      newV_S2A: this.V[STATES.S2A],
      newV_S2B: this.V[STATES.S2B],
    };

    this.history.push([this.Q_S1[0], this.Q_S1[1]]);
    return this.lastUpdate;
  }

  getQValues() {
    // Return Q-like values for all states/actions for display
    return [
      [...this.Q_S1],
      [...this.R[0]], // S2a
      [...this.R[1]], // S2b
    ];
  }
}

// ─── Successor Representation ─────────────────────────────────────────────────

export class SuccessorRepresentation {
  constructor() {
    // M[s][s'] — 3 states
    // Separate M matrices per action for S1 action selection
    // M_a[a][s][s'] — SR conditioned on taking action a at S1
    this.M = [
      [1.0, 0.0, 0.0], // S1 row
      [0.0, 1.0, 0.0], // S2a row
      [0.0, 0.0, 1.0], // S2b row
    ];
    // Per-action SR at S1: M_a1[s'] and M_a2[s']
    // These track E[discounted future occupancy | starting in s, took action a first]
    this.M_a = [
      [[0.0, 0.5, 0.5], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]], // action a1
      [[0.0, 0.5, 0.5], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]], // action a2
    ];
    // Reward weights w[s'] — expected reward at each state
    this.w = [0.0, 0.5, 0.5]; // S1=0 (no reward), S2a=0.5, S2b=0.5
    this.lastUpdate = null;
    this.history = [];
    this._computeValues();
  }

  _computeValues() {
    // V(s) = M(s,:) · w
    this.V = this.M.map(row => row.reduce((sum, m, i) => sum + m * this.w[i], 0));
    // Q at S1: Q_SR(S1, a) = M_a[a][S1,:] · w
    this.Q_S1 = [
      this.M_a[0][STATES.S1].reduce((sum, m, i) => sum + m * this.w[i], 0),
      this.M_a[1][STATES.S1].reduce((sum, m, i) => sum + m * this.w[i], 0),
    ];
  }

  selectAction(state) {
    let qValues;
    if (state === STATES.S1) {
      qValues = this.Q_S1;
    } else {
      // At S2 states: SR uses per-action SR rows to estimate value
      // M_a[action][state] · w gives Q(state, action)
      qValues = [
        this.M_a[ACTIONS.A1][state].reduce((sum, m, i) => sum + m * this.w[i], 0),
        this.M_a[ACTIONS.A2][state].reduce((sum, m, i) => sum + m * this.w[i], 0),
      ];
    }
    const probs = softmax(qValues, BETA);
    return sampleFromProbs(probs);
  }

  update(s1, a1, s2, a2, reward) {
    // Update w: reward weight for s2 state
    const oldW = this.w[s2];
    const wPE = reward - this.w[s2];
    this.w[s2] += ALPHA_W * wPE;

    // Update M (state-general SR):
    // M(s1,:) += alpha * (I(s1) + gamma * M(s2,:) - M(s1,:))
    const oldM_s1 = [...this.M[s1]];
    const oldM_s2 = [...this.M[s2]];
    for (let sp = 0; sp < 3; sp++) {
      const indicator_s1 = sp === s1 ? 1.0 : 0.0;
      const target = indicator_s1 + GAMMA * this.M[s2][sp];
      this.M[s1][sp] += ALPHA_SR * (target - this.M[s1][sp]);
    }

    // Update M(s2,:) — from s2, no further transitions in this task (terminal reward step)
    for (let sp = 0; sp < 3; sp++) {
      const indicator_s2 = sp === s2 ? 1.0 : 0.0;
      // Next state after s2 is terminal — treat as absorbing with no further states
      const target = indicator_s2; // gamma * 0 for next state
      this.M[s2][sp] += ALPHA_SR * (target - this.M[s2][sp]);
    }

    // Update per-action SR at S1: M_a[a1][s1,:]
    // M_a[a][s1,:] ← M_a[a][s1,:] + α*(I(s1) + γ*M[s2,:] - M_a[a][s1,:])
    const oldM_a_s1 = [...this.M_a[a1][s1]];
    for (let sp = 0; sp < 3; sp++) {
      const indicator_s1 = sp === s1 ? 1.0 : 0.0;
      const target = indicator_s1 + GAMMA * this.M[s2][sp];
      this.M_a[a1][s1][sp] += ALPHA_SR * (target - this.M_a[a1][s1][sp]);
    }

    // Also update M_a for the s2 state (s2, a2) — s2 is absorbing after reward
    for (let sp = 0; sp < 3; sp++) {
      const indicator_s2 = sp === s2 ? 1.0 : 0.0;
      // terminal: next state is absorbing, so target = I(s2)
      this.M_a[a2][s2][sp] += ALPHA_SR * (indicator_s2 - this.M_a[a2][s2][sp]);
    }

    // Recompute values
    const oldQ_S1 = [...this.Q_S1];
    this._computeValues();

    this.lastUpdate = {
      s1, a1, s2, a2, reward,
      oldM_s1, newM_s1: [...this.M[s1]],
      oldM_a_s1, newM_a_s1: [...this.M_a[a1][s1]],
      oldW, newW: this.w[s2], wPE,
      oldQ_S1, newQ_S1: [...this.Q_S1],
    };

    this.history.push([this.Q_S1[0], this.Q_S1[1]]);
    return this.lastUpdate;
  }

  getQValues() {
    // Return Q-like values for display
    return [
      [...this.Q_S1],
      [this.V[STATES.S2A], this.V[STATES.S2A]], // placeholder for S2a
      [this.V[STATES.S2B], this.V[STATES.S2B]], // placeholder for S2b
    ];
  }

  getM() {
    return this.M.map(row => [...row]);
  }

  getW() {
    return [...this.w];
  }
}
