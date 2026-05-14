// simulation.js — free-form phase switching

import {
  STATES,
  getNextState, getReward,
  softmax, sampleAction,
  TRANSITION_BASELINE, TRANSITION_SWAPPED,
} from './task.js';
import { MFAgent, MBAgent, SRAgent, PARAMS } from './algorithms.js';

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
    // Toggle transitions on each entry so re-clicking the tab re-applies a swap.
    onEnter: (sim) => {
      sim.currentTransitions = sim.currentTransitions === TRANSITION_BASELINE
        ? TRANSITION_SWAPPED
        : TRANSITION_BASELINE;
    },
  },
  outcome_reval: {
    id: 'outcome_reval',
    label: 'Outcome Revaluation',
    color: '#22D3EE',
    agentAtChoice: false,
    // Toggle goal on each entry so re-clicking the tab re-applies a revaluation.
    onEnter: (sim) => {
      sim.currentGoal = sim.currentGoal === 'apple' ? 'salad' : 'apple';
    },
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
    // Which agent drives the policy during Choice Phase. Updated from main.js
    // whenever the algorithm toggle changes.
    this.activeAlgo = 'mf';
    // Seed history with the pre-learning state at trial 0, so the chart has a
    // starting point and the line draws as soon as the first trial completes.
    this._recordHistory();
  }

  get currentPhase() {
    return PHASE_MODES[this.currentPhaseId];
  }

  setActiveAlgo(algo) {
    this.activeAlgo = algo;
  }

  setPhase(phaseId) {
    const newPhase = PHASE_MODES[phaseId];
    const isSamePhase = phaseId === this.currentPhaseId;
    // Always fire onEnter so re-clicks of a revaluation tab re-apply the toggle.
    if (newPhase.onEnter) newPhase.onEnter(this);
    if (!isSamePhase) {
      this.currentPhaseId = phaseId;
      this.phaseHistory.push({ trial: this.globalTrial, phaseId });
    }
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
    this._recordHistory();
  }

  _recordHistory() {
    const mfQ = this.mf.getQValues();
    const mbQ = this.mb.getQValues();
    const srQ = this.sr.getQValues();
    this.history.mf.push({ trial: this.globalTrial, Qred: mfQ.red, Qgreen: mfQ.green });
    this.history.mb.push({ trial: this.globalTrial, Qred: mbQ.red, Qgreen: mbQ.green });
    this.history.sr.push({ trial: this.globalTrial, Qred: srQ.red, Qgreen: srQ.green });
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

    this.globalTrial++;
    this._recordHistory();

    this.stepLog.unshift(stepDesc);
    if (this.stepLog.length > 5) this.stepLog.pop();

    return stepDesc;
  }

  _stepFromChoice(goal, transitions) {
    // The active algorithm drives the policy; all three agents update from the
    // same observed trajectory.
    const activeAgent = this.activeAlgo === 'mb' ? this.mb
      : this.activeAlgo === 'sr' ? this.sr
      : this.mf;
    const action = activeAgent.selectAction();
    const planetKey = action;
    const planetState = action === 'red' ? STATES.S_RED_PLANET : STATES.S_GREEN_PLANET;
    const terminalState = getNextState(planetState, null, transitions);
    const reward = getReward(terminalState, goal);
    const outcomeKey = terminalState === STATES.S_APPLE ? 'apple' : 'salad';

    const updates = {};

    // MF: full two-step TD
    updates.mf = this.mf.update(action, planetKey, reward);
    updates.mf.terminalState = terminalState;
    updates.mf.reward = reward;

    // MB: update both rocket→planet and planet→outcome from observed transition
    this.mb.updateRocket(action, planetKey);
    updates.mb = this.mb.update(planetKey, outcomeKey, reward);
    updates.mb.terminalState = terminalState;
    updates.mb.reward = reward;

    // SR: full-trial TD(λ) update over the visited trajectory + reward weights
    const srTrial = this.sr.updateFromChoiceTrial(action, planetKey, terminalState);
    const wUpdate = this.sr.updateW(terminalState, reward);
    updates.sr = {
      choiceUpdate: srTrial.choiceUpdate,
      planetUpdate: srTrial.planetUpdate,
      wUpdate, terminalState, reward, action,
    };

    return {
      type: 'choice',
      phaseId: this.currentPhaseId,
      trial: this.globalTrial,
      goal,
      transitions,
      action,
      activeAlgo: this.activeAlgo,
      updates,
      animAction: action,
      animPlanet: planetState,
      animTerminal: terminalState,
    };
  }

  _stepFromPlanets(goal, transitions) {
    // Which chef the agent visits is a policy decision based on the active
    // algorithm's value estimates for the two chef (intermediate) states.
    const activeAgent = this.activeAlgo === 'mb' ? this.mb
      : this.activeAlgo === 'sr' ? this.sr
      : this.mf;
    const planetVals = activeAgent.getPlanetValues();
    const planetKey = sampleAction(softmax(planetVals, PARAMS.beta));

    const planetState = planetKey === 'red' ? STATES.S_RED_PLANET : STATES.S_GREEN_PLANET;
    const terminalState = getNextState(planetState, null, transitions);
    const reward = getReward(terminalState, goal);
    const outcomeKey = terminalState === STATES.S_APPLE ? 'apple' : 'salad';

    const updates = {};

    // MF: planet Q only, Q_choice untouched (textbook MF failure to revalue)
    const mfUpdate = this.mf.updatePlanetOnly(planetKey, reward);
    mfUpdate.terminalState = terminalState;
    mfUpdate.reward = reward;
    updates.mf = { planetOnly: true, planetKey, terminalState, reward, ...mfUpdate };

    // MB: update planet→outcome transition
    const mbUpdate = this.mb.update(planetKey, outcomeKey, reward);
    mbUpdate.terminalState = terminalState;
    mbUpdate.reward = reward;
    updates.mb = mbUpdate;

    // SR: update M_planet_<color> row and w
    const planetUpdate = this.sr.updateFromPlanet(planetKey, terminalState);
    const wUpdate = this.sr.updateW(terminalState, reward);
    updates.sr = {
      planetOnly: true,
      planetKey,
      planetUpdate,
      wUpdate,
      terminalState,
      reward,
    };

    return {
      type: 'planets',
      phaseId: this.currentPhaseId,
      trial: this.globalTrial,
      goal,
      transitions,
      planetKey,
      updates,
      animPlanet: planetState,
      animTerminal: terminalState,
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
      beta: PARAMS.beta,
    };
  }
}
