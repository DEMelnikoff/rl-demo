// simulation.js — orchestrates runs, step/continuous modes

import { TwoStepTask, STATES, ACTIONS, GOALS } from './task.js';
import { ModelFree, ModelBased, SuccessorRepresentation } from './algorithms.js';

export const SCENARIOS = {
  baseline: {
    id: 'baseline',
    name: 'Scenario 1: Baseline',
    description: 'Goal = apple throughout. All three algorithms learn the task from scratch.',
    totalTrials: 200,
    revaluationTrial: null,
    getGoal: (trial) => GOALS.APPLE,
    getTransitionMode: (trial) => 'standard',
  },
  outcomeRevaluation: {
    id: 'outcomeRevaluation',
    name: 'Scenario 2: Outcome Revaluation',
    description: 'Goal = apple for trials 1–100, then switches to orange at trial 101. MB and SR adapt quickly; MF must re-experience the task.',
    totalTrials: 200,
    revaluationTrial: 100,
    getGoal: (trial) => trial <= 100 ? GOALS.APPLE : GOALS.ORANGE,
    getTransitionMode: (trial) => 'standard',
  },
  transitionRevaluation: {
    id: 'transitionRevaluation',
    name: 'Scenario 3: Transition Revaluation',
    description: 'Standard transitions for trials 1–100, then flipped at trial 101. MB adapts quickly; MF and SR must re-experience.',
    totalTrials: 200,
    revaluationTrial: 100,
    getGoal: (trial) => GOALS.APPLE,
    getTransitionMode: (trial) => trial <= 100 ? 'standard' : 'flipped',
  },
};

export class Simulation {
  constructor(scenarioId) {
    this.scenario = SCENARIOS[scenarioId];
    this.task = new TwoStepTask();
    this.mf = new ModelFree();
    this.mb = new ModelBased();
    this.sr = new SuccessorRepresentation();
    this.trial = 0;
    this.stepLog = []; // log of each step for step-by-step mode
    this.running = false;
    this.stepCallback = null;  // called after each trial in continuous mode
    this._animInterval = null;
  }

  reset() {
    this.task = new TwoStepTask();
    this.mf = new ModelFree();
    this.mb = new ModelBased();
    this.sr = new SuccessorRepresentation();
    this.trial = 0;
    this.stepLog = [];
    this.running = false;
    if (this._animInterval) {
      clearInterval(this._animInterval);
      this._animInterval = null;
    }
  }

  isDone() {
    return this.trial >= this.scenario.totalTrials;
  }

  // Run a single complete trial, return rich log entry
  runTrial() {
    if (this.isDone()) return null;

    this.trial++;
    const scenario = this.scenario;

    // Set environment for this trial
    const goal = scenario.getGoal(this.trial);
    const transMode = scenario.getTransitionMode(this.trial);
    this.task.setGoal(goal);
    this.task.setTransitionMode(transMode);

    // S1 — each algorithm picks action independently
    const s1 = STATES.S1;
    const a1_mf = this.mf.selectAction(s1);
    const a1_mb = this.mb.selectAction(s1);
    const a1_sr = this.sr.selectAction(s1);

    // S1 transitions — each agent experiences same world (sample once per algorithm)
    const s2_mf = this.task.sampleS1Transition(a1_mf);
    const s2_mb = this.task.sampleS1Transition(a1_mb);
    const s2_sr = this.task.sampleS1Transition(a1_sr);

    // S2 — each algorithm picks action at their respective s2
    const a2_mf = this.mf.selectAction(s2_mf);
    const a2_mb = this.mb.selectAction(s2_mb);
    const a2_sr = this.sr.selectAction(s2_sr);

    // Rewards
    const { outcome: out_mf, reward: r_mf } = this.task.sampleReward(s2_mf, a2_mf);
    const { outcome: out_mb, reward: r_mb } = this.task.sampleReward(s2_mb, a2_mb);
    const { outcome: out_sr, reward: r_sr } = this.task.sampleReward(s2_sr, a2_sr);

    // Updates
    const upd_mf = this.mf.update(s1, a1_mf, s2_mf, a2_mf, r_mf);
    const upd_mb = this.mb.update(s1, a1_mb, s2_mb, a2_mb, r_mb);
    const upd_sr = this.sr.update(s1, a1_sr, s2_sr, a2_sr, r_sr);

    const entry = {
      trial: this.trial,
      goal,
      transMode,
      isRevaluation: this.trial === scenario.revaluationTrial + 1,
      mf: {
        s1, a1: a1_mf, s2: s2_mf, a2: a2_mf,
        reward: r_mf, outcome: out_mf,
        update: upd_mf,
        Q: this.mf.getQValues(),
      },
      mb: {
        s1, a1: a1_mb, s2: s2_mb, a2: a2_mb,
        reward: r_mb, outcome: out_mb,
        update: upd_mb,
        Q: this.mb.getQValues(),
        T: this.mb.T.map(row => [...row]),
        R: this.mb.R.map(row => [...row]),
      },
      sr: {
        s1, a1: a1_sr, s2: s2_sr, a2: a2_sr,
        reward: r_sr, outcome: out_sr,
        update: upd_sr,
        Q: this.sr.getQValues(),
        M: this.sr.getM(),
        w: this.sr.getW(),
      },
    };

    this.stepLog.push(entry);
    return entry;
  }

  // Get history arrays for plotting
  getHistory() {
    return {
      mf: this.mf.history,
      mb: this.mb.history,
      sr: this.sr.history,
      trials: this.mf.history.map((_, i) => i + 1),
    };
  }

  // Run all remaining trials and return history
  runAll() {
    while (!this.isDone()) {
      this.runTrial();
    }
    return this.getHistory();
  }

  // Start continuous animation
  startContinuous(trialDelay, onTrial, onDone) {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running || this.isDone()) {
        this.running = false;
        if (this._animInterval) clearInterval(this._animInterval);
        this._animInterval = null;
        if (onDone) onDone();
        return;
      }
      const entry = this.runTrial();
      if (onTrial) onTrial(entry, this.getHistory());
    };
    this._animInterval = setInterval(tick, trialDelay);
  }

  stopContinuous() {
    this.running = false;
    if (this._animInterval) {
      clearInterval(this._animInterval);
      this._animInterval = null;
    }
  }
}
