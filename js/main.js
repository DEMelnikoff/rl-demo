// main.js — entry point, wires everything together

import { Simulation, SCENARIOS } from './simulation.js';
import { ComparisonChart, QTableViz, MBTableViz, SRViz, StepLogPanel } from './visualizations.js';
import { STATES } from './task.js';

let currentScenario = 'baseline';
let sim = null;
let compChart = null;
let qTableViz = null;
let mbViz = null;
let srViz = null;
let stepLogMF = null, stepLogMB = null, stepLogSR = null;
let mode = 'step'; // 'step' or 'continuous'
let lastEntry = null;
let speedMs = 80; // ms per trial in continuous mode

function initVizs(scenario) {
  const rv = SCENARIOS[scenario].revaluationTrial;
  const total = SCENARIOS[scenario].totalTrials;

  // Destroy old chart if any
  compChart = new ComparisonChart('#comparison-chart', rv, total);
  qTableViz = new QTableViz('#mf-qtable');
  mbViz = new MBTableViz('#mb-table');
  srViz = new SRViz('#sr-viz');
  stepLogMF = new StepLogPanel('#step-log-mf');
  stepLogMB = new StepLogPanel('#step-log-mb');
  stepLogSR = new StepLogPanel('#step-log-sr');
}

function resetAll() {
  if (sim) sim.stopContinuous();
  sim = new Simulation(currentScenario);
  lastEntry = null;

  // Reset UI
  document.getElementById('trial-counter').textContent = 'Trial: 0 / ' + SCENARIOS[currentScenario].totalTrials;
  document.getElementById('btn-step').disabled = false;
  document.getElementById('btn-play').disabled = false;
  document.getElementById('btn-play').textContent = 'Play';
  document.getElementById('btn-reset').classList.remove('active');

  // Initial viz render
  updateVizs(null);
}

function updateVizs(entry) {
  // Update comparison chart
  if (sim) compChart.update(sim.getHistory());

  // Update internal representations
  const mf = sim.mf;
  const mb = sim.mb;
  const sr = sim.sr;

  let hlMF_s2 = null, hlMF_s1 = null;
  let hlMB_T = null, hlMB_R = null;
  let hlSR_row = null;

  if (entry) {
    hlMF_s2 = `${entry.mf.s2},${entry.mf.a2}`;
    hlMF_s1 = `${entry.mf.s1},${entry.mf.a1}`;
    hlMB_T = entry.mb.a1;
    hlMB_R = `${entry.mb.s2 - 1},${entry.mb.a2}`;
    hlSR_row = entry.sr.s1;
  }

  qTableViz.update(mf.getQValues(), hlMF_s1);
  mbViz.update(mb.T, mb.R, hlMB_T, hlMB_R);
  srViz.update(sr.getM(), sr.getW(), hlSR_row);

  stepLogMF.update(entry, 'mf');
  stepLogMB.update(entry, 'mb');
  stepLogSR.update(entry, 'sr');

  if (sim) {
    document.getElementById('trial-counter').textContent =
      `Trial: ${sim.trial} / ${SCENARIOS[currentScenario].totalTrials}`;
  }
}

function doStep() {
  if (!sim || sim.isDone()) return;
  const entry = sim.runTrial();
  lastEntry = entry;
  updateVizs(entry);
  if (sim.isDone()) {
    document.getElementById('btn-step').disabled = true;
    document.getElementById('btn-play').disabled = true;
  }
}

function doPlayPause() {
  if (!sim) return;
  const btn = document.getElementById('btn-play');
  if (sim.running) {
    sim.stopContinuous();
    btn.textContent = 'Play';
    document.getElementById('btn-step').disabled = false;
  } else {
    if (sim.isDone()) return;
    btn.textContent = 'Pause';
    document.getElementById('btn-step').disabled = true;
    sim.startContinuous(
      speedMs,
      (entry, history) => {
        lastEntry = entry;
        compChart.update(history);
        // Update representations less frequently for speed
        if (sim.trial % 5 === 0 || speedMs > 100) {
          updateVizs(entry);
        } else {
          document.getElementById('trial-counter').textContent =
            `Trial: ${sim.trial} / ${SCENARIOS[currentScenario].totalTrials}`;
        }
      },
      () => {
        btn.textContent = 'Play';
        document.getElementById('btn-step').disabled = true;
        document.getElementById('btn-play').disabled = true;
        updateVizs(lastEntry);
      }
    );
  }
}

function handleScenarioChange(scenarioId) {
  currentScenario = scenarioId;

  // Update active tab
  document.querySelectorAll('.scenario-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-scenario="${scenarioId}"]`).classList.add('active');

  // Update scenario description
  const s = SCENARIOS[scenarioId];
  document.getElementById('scenario-title').textContent = s.name;
  document.getElementById('scenario-desc').textContent = s.description;

  // Reinit
  initVizs(scenarioId);
  resetAll();
}

function handleSpeedChange(val) {
  // val: 1 (slow) to 5 (fast)
  const speeds = [500, 200, 80, 30, 10];
  speedMs = speeds[val - 1];
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Scenario tabs
  document.querySelectorAll('.scenario-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      handleScenarioChange(tab.dataset.scenario);
    });
  });

  // Buttons
  document.getElementById('btn-step').addEventListener('click', doStep);
  document.getElementById('btn-play').addEventListener('click', doPlayPause);
  document.getElementById('btn-reset').addEventListener('click', resetAll);

  // Speed slider
  const slider = document.getElementById('speed-slider');
  if (slider) {
    slider.addEventListener('input', () => handleSpeedChange(parseInt(slider.value)));
  }

  // Init with baseline
  initVizs('baseline');
  resetAll();

  // Resize handler
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      compChart = new ComparisonChart(
        '#comparison-chart',
        SCENARIOS[currentScenario].revaluationTrial,
        SCENARIOS[currentScenario].totalTrials
      );
      compChart.update(sim ? sim.getHistory() : { mf: [], mb: [], sr: [], trials: [] });
    }, 250);
  });
});
