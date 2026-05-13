// simulation.js — Simulation class, phases, trial stepping, scenario configs

import {
  STATES, ACTIONS,
  getNextState, getReward,
  TRANSITION_BASELINE, TRANSITION_SWAPPED,
} from './task.js';
import { MFAgent, MBAgent, SRAgent } from './algorithms.js';

// ─── Scenario configurations ──────────────────────────────────────────────────

export const SCENARIOS = {
  baseline: {
    id: 'baseline',
    name: 'Baseline',
    phases: [
      {
        id: 'phase1',
        label: 'Learn',
        trials: 50,
        goal: 'apple',
        transitions: TRANSITION_BASELINE,
        agentAtChoice: true,   // agent chooses rocket from S_choice
      },
    ],
  },

  transition_reval: {
    id: 'transition_reval',
    name: 'Transition Revaluation',
    phases: [
      {
        id: 'phase1',
        label: 'Learn',
        trials: 50,
        goal: 'apple',
        transitions: TRANSITION_BASELINE,
        agentAtChoice: true,
      },
      {
        id: 'phase2',
        label: 'Revalue',
        trials: 30,
        goal: 'apple',
        transitions: TRANSITION_SWAPPED,
        agentAtChoice: false,  // agent placed directly at planets
      },
    ],
  },

  outcome_reval: {
    id: 'outcome_reval',
    name: 'Outcome Revaluation',
    phases: [
      {
        id: 'phase1',
        label: 'Learn',
        trials: 50,
        goal: 'apple',
        transitions: TRANSITION_BASELINE,
        agentAtChoice: true,
      },
      {
        id: 'phase2',
        label: 'Revalue',
        trials: 30,
        goal: 'salad',
        transitions: TRANSITION_BASELINE,
        agentAtChoice: false,
      },
    ],
  },
};

// ─── Simulation class ─────────────────────────────────────────────────────────

export class Simulation {
  constructor() {
    this.mf = new MFAgent();
    this.mb = new MBAgent();
    this.sr = new SRAgent();

    this.scenarioId = 'baseline';
    this.currentPhaseIndex = 0;
    this.trialInPhase = 0;
    this.globalTrial = 0;

    // History of Q(red) for each algorithm, indexed by global trial
    this.history = {
      mf: [],  // { trial, Qred, Qgreen }
      mb: [],
      sr: [],
    };

    // Phase boundary global trial indices
    this.phaseBoundaries = [];

    // Last step details for the step log
    this.stepLog = [];

    // Whether all trials are done
    this.done = false;

    this._buildPhaseMap();
  }

  _buildPhaseMap() {
    const scenario = SCENARIOS[this.scenarioId];
    this.phaseBoundaries = [];
    let cumulative = 0;
    for (const phase of scenario.phases) {
      this.phaseBoundaries.push(cumulative);
      cumulative += phase.trials;
    }
    // Add a sentinel for "phase 3" (choice test) beyond all trials
    this.phaseBoundaries.push(cumulative);
  }

  get scenario() {
    return SCENARIOS[this.scenarioId];
  }

  get currentPhase() {
    return this.scenario.phases[this.currentPhaseIndex];
  }

  get totalTrials() {
    return this.scenario.phases.reduce((s, p) => s + p.trials, 0);
  }

  setScenario(scenarioId) {
    this.scenarioId = scenarioId;
    this.reset();
  }

  reset() {
    this.mf.reset();
    this.mb.reset();
    this.sr.reset();
    this.currentPhaseIndex = 0;
    this.trialInPhase = 0;
    this.globalTrial = 0;
    this.history = { mf: [], mb: [], sr: [] };
    this.stepLog = [];
    this.done = false;
    this._buildPhaseMap();
  }

  /**
   * Advance one full trial. Returns a step descriptor for visualization.
   */
  step() {
    if (this.done) return null;

    const phase = this.currentPhase;
    const { goal, transitions, agentAtChoice } = phase;

    let stepDesc;

    if (agentAtChoice) {
      stepDesc = this._stepFromChoice(goal, transitions);
    } else {
      stepDesc = this._stepFromPlanets(goal, transitions);
    }

    // Record Q history
    const mfQ = this.mf.getQValues();
    const mbQ = this.mb.getQValues();
    const srQ = this.sr.getQValues();

    this.history.mf.push({ trial: this.globalTrial, Qred: mfQ.red, Qgreen: mfQ.green });
    this.history.mb.push({ trial: this.globalTrial, Qred: mbQ.red, Qgreen: mbQ.green });
    this.history.sr.push({ trial: this.globalTrial, Qred: srQ.red, Qgreen: srQ.green });

    this.globalTrial++;
    this.trialInPhase++;

    if (this.trialInPhase >= phase.trials) {
      this.currentPhaseIndex++;
      this.trialInPhase = 0;
      if (this.currentPhaseIndex >= this.scenario.phases.length) {
        this.done = true;
      }
    }

    // Keep only last 5 steps in log
    this.stepLog.unshift(stepDesc);
    if (this.stepLog.length > 5) this.stepLog.pop();

    return stepDesc;
  }

  /**
   * Run a full trial where agent chooses a rocket from S_choice.
   */
  _stepFromChoice(goal, transitions) {
    // All three agents select an action (they may choose differently)
    const mfAction = this.mf.selectAction();
    const mbAction = this.mb.selectAction();
    const srAction = this.sr.selectAction();

    // For the "canonical" step visualization we show MF action, but all three update independently
    const actions = { mf: mfAction, mb: mbAction, sr: srAction };

    const updates = {};

    // MF update
    {
      const action = mfAction;
      const planetKey = action; // 'red' or 'green'
      const terminalState = getNextState(
        action === 'red' ? STATES.S_RED_PLANET : STATES.S_GREEN_PLANET,
        null,
        transitions,
      );
      const reward = getReward(terminalState, goal);
      updates.mf = this.mf.update(action, planetKey, reward);
      updates.mf.terminalState = terminalState;
      updates.mf.reward = reward;
    }

    // MB update
    {
      const action = mbAction;
      const planetKey = action;
      const terminalState = getNextState(
        action === 'red' ? STATES.S_RED_PLANET : STATES.S_GREEN_PLANET,
        null,
        transitions,
      );
      const reward = getReward(terminalState, goal);
      const outcomeKey = terminalState === STATES.S_APPLE ? 'apple' : 'salad';
      updates.mb = this.mb.update(planetKey, outcomeKey, reward);
      updates.mb.terminalState = terminalState;
      updates.mb.reward = reward;
    }

    // SR update
    {
      const action = srAction;
      const planetKey = action;
      const terminalState = getNextState(
        action === 'red' ? STATES.S_RED_PLANET : STATES.S_GREEN_PLANET,
        null,
        transitions,
      );
      const reward = getReward(terminalState, goal);

      // Update M from choice (M_red or M_green)
      const choiceUpdate = this.sr.updateFromChoice(action);

      // Update M from planet
      const planetUpdate = this.sr.updateFromPlanet(planetKey, terminalState);

      // Update w
      const wUpdate = this.sr.updateW(terminalState, reward);

      updates.sr = { choiceUpdate, planetUpdate, wUpdate, terminalState, reward, action };
    }

    return {
      type: 'choice',
      phase: this.currentPhaseIndex,
      trial: this.globalTrial,
      trialInPhase: this.trialInPhase,
      goal,
      transitions,
      actions,
      updates,
      // For diagram animation — use MF action as representative
      animAction: mfAction,
      animPlanet: mfAction === 'red' ? STATES.S_RED_PLANET : STATES.S_GREEN_PLANET,
      animTerminal: getNextState(
        mfAction === 'red' ? STATES.S_RED_PLANET : STATES.S_GREEN_PLANET,
        null,
        transitions,
      ),
    };
  }

  /**
   * Run a phase-2 trial where agent is placed at both planets.
   * Each trial visits red planet then green planet.
   */
  _stepFromPlanets(goal, transitions) {
    const updates = {};

    // Determine outcomes for each planet
    const redTerminal = getNextState(STATES.S_RED_PLANET, null, transitions);
    const greenTerminal = getNextState(STATES.S_GREEN_PLANET, null, transitions);
    const redReward = getReward(redTerminal, goal);
    const greenReward = getReward(greenTerminal, goal);

    const redOutcomeKey = redTerminal === STATES.S_APPLE ? 'apple' : 'salad';
    const greenOutcomeKey = greenTerminal === STATES.S_APPLE ? 'apple' : 'salad';

    // MF: nothing updates (no rocket choice)
    updates.mf = { noUpdate: true, redTerminal, greenTerminal, redReward, greenReward };

    // MB: update T and R for both planets
    const mbRedUpdate = this.mb.update('red', redOutcomeKey, redReward);
    const mbGreenUpdate = this.mb.update('green', greenOutcomeKey, greenReward);
    updates.mb = { redUpdate: mbRedUpdate, greenUpdate: mbGreenUpdate, redReward, greenReward };

    // SR: update M_planet_red and M_planet_green (NOT M_red, M_green)
    const srRedPlanetUpdate = this.sr.updateFromPlanet('red', redTerminal);
    const srGreenPlanetUpdate = this.sr.updateFromPlanet('green', greenTerminal);

    // Update w for both outcomes
    const srRedWUpdate = this.sr.updateW(redTerminal, redReward);
    const srGreenWUpdate = this.sr.updateW(greenTerminal, greenReward);

    updates.sr = {
      redPlanetUpdate: srRedPlanetUpdate,
      greenPlanetUpdate: srGreenPlanetUpdate,
      redWUpdate: srRedWUpdate,
      greenWUpdate: srGreenWUpdate,
      redTerminal,
      greenTerminal,
      redReward,
      greenReward,
      frozenRows: [0, 1], // M_red and M_green stay frozen
    };

    return {
      type: 'planets',
      phase: this.currentPhaseIndex,
      trial: this.globalTrial,
      trialInPhase: this.trialInPhase,
      goal,
      transitions,
      updates,
      animPlanet: STATES.S_RED_PLANET, // start animation at red planet
      animTerminal: redTerminal,
    };
  }

  /**
   * Get total trial count across all phases before the given phase index.
   */
  getPhaseStartTrial(phaseIndex) {
    return this.phaseBoundaries[phaseIndex] || 0;
  }

  getState() {
    return {
      scenarioId: this.scenarioId,
      currentPhaseIndex: this.currentPhaseIndex,
      trialInPhase: this.trialInPhase,
      globalTrial: this.globalTrial,
      totalTrials: this.totalTrials,
      done: this.done,
      mfDisplay: this.mf.getDisplayData(),
      mbDisplay: this.mb.getDisplayData(),
      srDisplay: this.sr.getDisplayData(),
      mfQ: this.mf.getQValues(),
      mbQ: this.mb.getQValues(),
      srQ: this.sr.getQValues(),
      mfChoice: this.mf.getPreferredAction(),
      mbChoice: this.mb.getPreferredAction(),
      srChoice: this.sr.getPreferredAction(),
      history: this.history,
      phaseBoundaries: this.phaseBoundaries,
      stepLog: this.stepLog,
      phases: this.scenario.phases,
    };
  }
}
