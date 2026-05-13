// task.js — Two-step task environment

export const STATES = { S1: 0, S2A: 1, S2B: 2 };
export const STATE_NAMES = ['S1', 'S2a', 'S2b'];
export const ACTIONS = { A1: 0, A2: 1 };
export const GOALS = { APPLE: 0, ORANGE: 1 };

// Transition probabilities T[s][a] = [{state, prob}, ...]
export const TRUE_TRANSITIONS = {
  standard: {
    [STATES.S1]: {
      [ACTIONS.A1]: [{ state: STATES.S2A, prob: 0.7 }, { state: STATES.S2B, prob: 0.3 }],
      [ACTIONS.A2]: [{ state: STATES.S2B, prob: 0.7 }, { state: STATES.S2A, prob: 0.3 }],
    },
    [STATES.S2A]: {
      [ACTIONS.A1]: [{ state: STATES.S2A, prob: 1.0 }], // terminal, handled specially
      [ACTIONS.A2]: [{ state: STATES.S2A, prob: 1.0 }],
    },
    [STATES.S2B]: {
      [ACTIONS.A1]: [{ state: STATES.S2B, prob: 1.0 }],
      [ACTIONS.A2]: [{ state: STATES.S2B, prob: 1.0 }],
    },
  },
  flipped: {
    [STATES.S1]: {
      [ACTIONS.A1]: [{ state: STATES.S2B, prob: 0.7 }, { state: STATES.S2A, prob: 0.3 }],
      [ACTIONS.A2]: [{ state: STATES.S2A, prob: 0.7 }, { state: STATES.S2B, prob: 0.3 }],
    },
    [STATES.S2A]: {
      [ACTIONS.A1]: [{ state: STATES.S2A, prob: 1.0 }],
      [ACTIONS.A2]: [{ state: STATES.S2A, prob: 1.0 }],
    },
    [STATES.S2B]: {
      [ACTIONS.A1]: [{ state: STATES.S2B, prob: 1.0 }],
      [ACTIONS.A2]: [{ state: STATES.S2B, prob: 1.0 }],
    },
  },
};

// Reward probabilities: R[s][a] = {apple: p, orange: p}
export const REWARD_PROBS = {
  [STATES.S2A]: {
    [ACTIONS.A1]: { apple: 0.8, orange: 0.2 },
    [ACTIONS.A2]: { orange: 0.7, apple: 0.3 },
  },
  [STATES.S2B]: {
    [ACTIONS.A1]: { orange: 0.8, apple: 0.2 },
    [ACTIONS.A2]: { apple: 0.7, orange: 0.3 },
  },
};

export class TwoStepTask {
  constructor() {
    this.transitionMode = 'standard';
    this.goal = GOALS.APPLE;
  }

  setGoal(goal) {
    this.goal = goal;
  }

  setTransitionMode(mode) {
    this.transitionMode = mode;
  }

  // Sample next state from S1 given action
  sampleS1Transition(action) {
    const transitions = TRUE_TRANSITIONS[this.transitionMode][STATES.S1][action];
    const r = Math.random();
    let cumProb = 0;
    for (const t of transitions) {
      cumProb += t.prob;
      if (r < cumProb) return t.state;
    }
    return transitions[transitions.length - 1].state;
  }

  // Sample reward outcome at S2 state given action
  sampleReward(s2State, action) {
    const probs = REWARD_PROBS[s2State][action];
    const r = Math.random();
    let outcome;
    if (r < probs.apple) {
      outcome = GOALS.APPLE;
    } else {
      outcome = GOALS.ORANGE;
    }
    const reward = outcome === this.goal ? 1 : 0;
    return { outcome, reward };
  }

  // Get expected reward for MB planning given current goal
  getExpectedReward(s2State, action) {
    const probs = REWARD_PROBS[s2State][action];
    if (this.goal === GOALS.APPLE) {
      return probs.apple;
    } else {
      return probs.orange !== undefined ? probs.orange : (1 - probs.apple);
    }
  }

  // Get true transition prob from S1 given action to s2State
  getTrueTransitionProb(action, s2State) {
    const transitions = TRUE_TRANSITIONS[this.transitionMode][STATES.S1][action];
    for (const t of transitions) {
      if (t.state === s2State) return t.prob;
    }
    return 0;
  }
}
