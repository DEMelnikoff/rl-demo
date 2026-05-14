// simulation.js — free-form phase switching

import {
  STATES,
  getNextState, getReward,
  TRANSITION_BASELINE, TRANSITION_SWAPPED,
} from './task.js';
import { MFAgent, MBAgent, SRAgent } from './algorithms.js';

// ─── Phase modes (user-selectable at any time) ───────────────────────────────

// Phase mode just controls whether the agent makes choices.
// Revaluation phases modify world state (transitions/goal) on entry,
// and those changes persist after switching back to Choice Phase.
export const PHASE_MODES = {
  choice: {
    id: 'choice',
    label: 'Choice Phase',
    color: '#818CF8',
    agentAtChoice: true,
  },
  transition_reval: {
    id: 'transition_reval',
    label: 'Transition Revaluation',
    color: '#F472B6',
    agentAtChoice: false,
    onEnter: (sim) => { sim.currentTransitions = TRANSITION_SWAPPED; },
  },
  outcome_reval: {
    id: 'outcome_reval',
    label: 'Outcome Revaluation',
    color: '#22D3EE',
    agentAtChoice: false,
    onEnter: (sim) => { sim.currentGoal = 'salad'; },
  },
};

// ─── Simulation ──────────────────────────────────────────────────────────────

export class Simulation {
  constructor() {
    this.mf = new MFAgent();
    this.mb = new MBAgent();
    this.sr = new SRAgent();

    this.currentPhaseId = 'choice';

    // World state — persists across phase switches; only changes when entering
    // a revaluation phase or on reset.
    this.currentTransitions = TRANSITION_BASELINE;
    this.currentGoal = 'apple';
    this._lastSyncedGoal = null;

    this.globalTrial = 0;
    this.history = { mf: [], mb: [], sr: [] };
    this.phaseHistory = [{ trial: 0, phaseId: 'choice' }];
    this.stepLog = [];
    this.done = false;
  }

  get currentPhase() {
    return PHASE_MODES[this.currentPhaseId];
  }

  setPhase(phaseId) {
    if (phaseId === this.currentPhaseId) return;
    const newPhase = PHASE_MODES[phaseId];
    if (newPhase.onEnter) newPhase.onEnter(this);
    this.currentPhaseId = phaseId;
    this.phaseHistory.push({ trial: this.globalTrial, phaseId });
    // Immediately sync goal so display reflects new world state
    if (this.currentGoal !== this._lastSyncedGoal) {
      this._lastSyncedGoal = this.currentGoal;
      this.mb.setGoal(this.currentGoal);
      this.sr.setGoal(this.currentGoal);
    }
  }

  reset() {
    this.mf.reset();
    this.mb.reset();
    this.sr.reset();
    this.currentPhaseId = 'choice';
    this.currentTransitions = TRANSITION_BASELINE;
    this.currentGoal = 'apple';
    this._lastSyncedGoal = null;
    this.globalTrial = 0;
    this.history = { mf: [], mb: [], sr: [] };
    this.phaseHistory = [{ trial: 0, phaseId: 'choice' }];
    this.stepLog = [];
    this.done = false;
  }

  step() {
    const phase = this.currentPhase;
    const goal = this.currentGoal;
    const transitions = this.currentTransitions;
    const agentAtChoice = phase.agentAtChoice;

    // Sync goal-based representations when goal changes
    if (goal !== this._lastSyncedGoal) {
      this._lastSyncedGoal = goal;
      this.mb.setGoal(goal);
      this.sr.setGoal(goal);
    }

    let stepDesc;
    if (agentAtChoice) {
      stepDesc = this._stepFromChoice(goal, transitions);
    } else {
      stepDesc = this._stepFromPlanets(goal, transitions);
    }

    const mfQ = this.mf.getQValues();
    const mbQ = this.mb.getQValues();
    const srQ = this.sr.getQValues();
    this.history.mf.push({ trial: this.globalTrial, Qred: mfQ.red, Qgreen: mfQ.green });
    this.history.mb.push({ trial: this.globalTrial, Qred: mbQ.red, Qgreen: mbQ.green });
    this.history.sr.push({ trial: this.globalTrial, Qred: srQ.red, Qgreen: srQ.green });

    this.globalTrial++;

    this.stepLog.unshift(stepDesc);
    if (this.stepLog.length > 5) this.stepLog.pop();

    return stepDesc;
  }

  _stepFromChoice(goal, transitions) {
    const mfAction = this.mf.selectAction();
    const mbAction = this.mb.selectAction();
    const srAction = this.sr.selectAction();

    const actions = { mf: mfAction, mb: mbAction, sr: srAction };
    const updates = {};

    // MF
    {
      const action = mfAction;
      const planetKey = action;
      const terminalState = getNextState(
        action === 'red' ? STATES.S_RED_PLANET : STATES.S_GREEN_PLANET,
        null, transitions,
      );
      const reward = getReward(terminalState, goal);
      updates.mf = this.mf.update(action, planetKey, reward);
      updates.mf.terminalState = terminalState;
      updates.mf.reward = reward;
    }

    // MB
    {
      const action = mbAction;
      const planetKey = action;
      const terminalState = getNextState(
        action === 'red' ? STATES.S_RED_PLANET : STATES.S_GREEN_PLANET,
        null, transitions,
      );
      const reward = getReward(terminalState, goal);
      const outcomeKey = terminalState === STATES.S_APPLE ? 'apple' : 'salad';
      this.mb.updateRocket(action, planetKey);
      updates.mb = this.mb.update(planetKey, outcomeKey, reward);
      updates.mb.terminalState = terminalState;
      updates.mb.reward = reward;
    }

    // SR
    {
      const action = srAction;
      const planetKey = action;
      const terminalState = getNextState(
        action === 'red' ? STATES.S_RED_PLANET : STATES.S_GREEN_PLANET,
        null, transitions,
      );
      const reward = getReward(terminalState, goal);
      // Backward TD order
      const planetUpdate = this.sr.updateFromPlanet(planetKey, terminalState);
      const choiceUpdate = this.sr.updateFromChoice(action);
      const wUpdate = this.sr.updateW(terminalState, reward);
      updates.sr = { choiceUpdate, planetUpdate, wUpdate, terminalState, reward, action };
    }

    return {
      type: 'choice',
      phaseId: this.currentPhaseId,
      trial: this.globalTrial,
      goal,
      transitions,
      actions,
      updates,
      animAction: mfAction,
      animPlanet: mfAction === 'red' ? STATES.S_RED_PLANET : STATES.S_GREEN_PLANET,
      animTerminal: getNextState(
        mfAction === 'red' ? STATES.S_RED_PLANET : STATES.S_GREEN_PLANET,
        null, transitions,
      ),
    };
  }

  _stepFromPlanets(goal, transitions) {
    const updates = {};

    const redTerminal = getNextState(STATES.S_RED_PLANET, null, transitions);
    const greenTerminal = getNextState(STATES.S_GREEN_PLANET, null, transitions);
    const redReward = getReward(redTerminal, goal);
    const greenReward = getReward(greenTerminal, goal);

    const redOutcomeKey = redTerminal === STATES.S_APPLE ? 'apple' : 'salad';
    const greenOutcomeKey = greenTerminal === STATES.S_APPLE ? 'apple' : 'salad';

    updates.mf = { noUpdate: true, redTerminal, greenTerminal, redReward, greenReward };

    const mbRedUpdate = this.mb.update('red', redOutcomeKey, redReward);
    const mbGreenUpdate = this.mb.update('green', greenOutcomeKey, greenReward);
    updates.mb = { redUpdate: mbRedUpdate, greenUpdate: mbGreenUpdate, redReward, greenReward };

    const srRedPlanetUpdate = this.sr.updateFromPlanet('red', redTerminal);
    const srGreenPlanetUpdate = this.sr.updateFromPlanet('green', greenTerminal);
    const srRedWUpdate = this.sr.updateW(redTerminal, redReward);
    const srGreenWUpdate = this.sr.updateW(greenTerminal, greenReward);

    updates.sr = {
      redPlanetUpdate: srRedPlanetUpdate,
      greenPlanetUpdate: srGreenPlanetUpdate,
      redWUpdate: srRedWUpdate,
      greenWUpdate: srGreenWUpdate,
      redTerminal, greenTerminal, redReward, greenReward,
      frozenRows: [0, 1],
    };

    return {
      type: 'planets',
      phaseId: this.currentPhaseId,
      trial: this.globalTrial,
      goal,
      transitions,
      updates,
      animPlanet: STATES.S_RED_PLANET,
      animTerminal: redTerminal,
    };
  }

  getState() {
    return {
      currentPhaseId: this.currentPhaseId,
      currentPhase: this.currentPhase,
      currentTransitions: this.currentTransitions,
      currentGoal: this.currentGoal,
      globalTrial: this.globalTrial,
      done: false,
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
      phaseHistory: this.phaseHistory,
      stepLog: this.stepLog,
    };
  }
}
