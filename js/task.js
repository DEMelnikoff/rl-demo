// task.js — state constants, transition logic, reward function

export const STATES = {
  S_CHOICE: 0,
  S_RED_PLANET: 1,
  S_GREEN_PLANET: 2,
  S_APPLE: 3,
  S_SALAD: 4,
};

export const STATE_NAMES = ['S_choice', 'S_red_planet', 'S_green_planet', 'S_apple', 'S_salad'];
export const STATE_LABELS = ['🚀 Choice', '🔴🪐 Red Planet', '🟢🪐 Green Planet', '🍎 Apple', '🥗 Salad'];

export const ACTIONS = {
  RED_ROCKET: 'red',
  GREEN_ROCKET: 'green',
};

export const N_STATES = 5;

/**
 * Returns the next state given current state, action, and transition config.
 * transitionConfig: { redPlanetOutcome: 'apple'|'salad', greenPlanetOutcome: 'apple'|'salad' }
 */
export function getNextState(state, action, transitionConfig) {
  const { redPlanetOutcome, greenPlanetOutcome } = transitionConfig;

  if (state === STATES.S_CHOICE) {
    if (action === ACTIONS.RED_ROCKET) return STATES.S_RED_PLANET;
    if (action === ACTIONS.GREEN_ROCKET) return STATES.S_GREEN_PLANET;
  }

  if (state === STATES.S_RED_PLANET) {
    return redPlanetOutcome === 'apple' ? STATES.S_APPLE : STATES.S_SALAD;
  }

  if (state === STATES.S_GREEN_PLANET) {
    return greenPlanetOutcome === 'apple' ? STATES.S_APPLE : STATES.S_SALAD;
  }

  // Terminal states
  return state;
}

/**
 * Returns reward given the terminal state reached and the current goal.
 * goal: 'apple' | 'salad'
 */
export function getReward(terminalState, goal) {
  if (terminalState === STATES.S_APPLE && goal === 'apple') return 1;
  if (terminalState === STATES.S_SALAD && goal === 'salad') return 1;
  return 0;
}

/**
 * One-hot vector of length N_STATES for given state index.
 */
export function oneHot(stateIndex) {
  const v = new Float32Array(N_STATES);
  v[stateIndex] = 1;
  return v;
}

/**
 * Softmax with numerical stability (subtract max).
 * Returns probability for each action.
 * beta: inverse temperature
 */
export function softmax(qValues, beta) {
  const vals = Object.values(qValues);
  const keys = Object.keys(qValues);
  const maxVal = Math.max(...vals);
  const exps = vals.map(v => Math.exp(beta * (v - maxVal)));
  const sum = exps.reduce((a, b) => a + b, 0);
  const probs = {};
  keys.forEach((k, i) => { probs[k] = exps[i] / sum; });
  return probs;
}

/**
 * Sample action from probability distribution.
 */
export function sampleAction(probs) {
  const r = Math.random();
  let cumulative = 0;
  for (const [action, prob] of Object.entries(probs)) {
    cumulative += prob;
    if (r <= cumulative) return action;
  }
  // Fallback to last action
  return Object.keys(probs)[Object.keys(probs).length - 1];
}

// Scenario transition configs
export const TRANSITION_BASELINE = {
  redPlanetOutcome: 'apple',
  greenPlanetOutcome: 'salad',
};

export const TRANSITION_SWAPPED = {
  redPlanetOutcome: 'salad',
  greenPlanetOutcome: 'apple',
};
