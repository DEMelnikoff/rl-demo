// main.js — wires everything together, event handlers, animation loop

import { Simulation, SCENARIOS } from './simulation.js';
import { TaskDiagram, AlgorithmPanel, StepLog, QValueChart, PhaseIndicator, COLORS } from './visualizations.js';

// ─── State ────────────────────────────────────────────────────────────────────

const sim = new Simulation();

let currentAlgo = 'mf';
let isPlaying = false;
let playSpeed = 400; // ms per trial
let animDelay = 250; // ms per state in animation
let playTimer = null;
let isAnimating = false;

const taskDiagram = new TaskDiagram('task-diagram');
const algoPanel = new AlgorithmPanel('algo-panel');
const stepLog = new StepLog('step-log');
const qChart = new QValueChart('q-chart');
const phaseIndicator = new PhaseIndicator('phase-indicator');

// ─── Boot ─────────────────────────────────────────────────────────────────────

function init() {
  renderAll();
  attachEventListeners();
}

function renderAll() {
  const state = sim.getState();

  // Sync diagram to current phase
  const phase = state.phases[state.currentPhaseIndex] || state.phases[state.phases.length - 1];
  taskDiagram.setGoal(phase.goal);
  taskDiagram.setTransitions(phase.transitions);
  taskDiagram.setPhase2(state.currentPhaseIndex >= 1);
  taskDiagram.setAlgoColor(currentAlgo);

  algoPanel.render(currentAlgo, state);
  stepLog.render(state.stepLog, currentAlgo);
  qChart.render(state);
  phaseIndicator.render(state);

  updateControlsUI(state);
}

function updateControlsUI(state) {
  const playBtn = document.getElementById('play-btn');
  const nextBtn = document.getElementById('next-btn');
  const resetBtn = document.getElementById('reset-btn');

  if (playBtn) {
    playBtn.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
    playBtn.disabled = state.done;
  }
  if (nextBtn) nextBtn.disabled = state.done || isAnimating;
  if (resetBtn) resetBtn.disabled = false;

  // Update progress bar
  const progressEl = document.getElementById('trial-progress');
  if (progressEl) {
    const pct = state.totalTrials > 0 ? (state.globalTrial / state.totalTrials) * 100 : 0;
    progressEl.style.width = `${Math.min(100, pct)}%`;
  }

  const trialCountEl = document.getElementById('trial-count');
  if (trialCountEl) {
    if (state.done) {
      trialCountEl.textContent = 'Done — Choice Phase';
    } else {
      trialCountEl.textContent = `Phase ${state.currentPhaseIndex + 1} · Trial ${state.trialInPhase + 1} / ${state.phases[state.currentPhaseIndex]?.trials}`;
    }
  }
}

// ─── Step Logic ───────────────────────────────────────────────────────────────

function doStep() {
  if (sim.done || isAnimating) return;

  isAnimating = true;
  const stepDesc = sim.step();
  if (!stepDesc) {
    isAnimating = false;
    return;
  }

  const state = sim.getState();

  // Update phase diagram config
  const phaseIdx = Math.min(state.currentPhaseIndex, state.phases.length - 1);
  const phase = state.phases[phaseIdx] || state.phases[state.phases.length - 1];
  // Use the STEP's phase config (before incrementing)
  const stepPhase = sim.scenario.phases[stepDesc.phase] || sim.scenario.phases[sim.scenario.phases.length - 1];

  taskDiagram.setGoal(stepPhase.goal);
  taskDiagram.setTransitions(stepPhase.transitions);
  taskDiagram.setPhase2(stepDesc.phase >= 1);

  const algoColor = COLORS[currentAlgo];

  taskDiagram.animateTrial(stepDesc, algoColor, () => {
    isAnimating = false;
    algoPanel.update(currentAlgo, state, stepDesc);
    stepLog.render(state.stepLog, currentAlgo);
    qChart.render(state);
    phaseIndicator.render(state);
    updateControlsUI(state);

    if (state.done) {
      stopPlay();
      showDoneMessage();
    }
  }, animDelay);
}

function showDoneMessage() {
  const state = sim.getState();
  const banner = document.getElementById('done-banner');
  if (!banner) return;

  const mfChoice = state.mfChoice === 'red' ? '🔴' : '🟢';
  const mbChoice = state.mbChoice === 'red' ? '🔴' : '🟢';
  const srChoice = state.srChoice === 'red' ? '🔴' : '🟢';

  banner.innerHTML = `
    <div class="done-banner-inner">
      <span class="done-title">Choice Phase</span>
      <span class="done-item" style="color:${COLORS.mf}">MF: ${mfChoice} ${state.mfChoice}</span>
      <span class="done-item" style="color:${COLORS.mb}">MB: ${mbChoice} ${state.mbChoice}</span>
      <span class="done-item" style="color:${COLORS.sr}">SR: ${srChoice} ${state.srChoice}</span>
    </div>
  `;
  banner.style.display = 'flex';
}

function hideDoneMessage() {
  const banner = document.getElementById('done-banner');
  if (banner) banner.style.display = 'none';
}

// ─── Play / Pause ─────────────────────────────────────────────────────────────

function startPlay() {
  if (sim.done) return;
  isPlaying = true;
  document.getElementById('play-btn').textContent = '⏸ Pause';

  function tick() {
    if (!isPlaying || sim.done) {
      stopPlay();
      return;
    }
    if (!isAnimating) {
      doStep();
    }
    playTimer = setTimeout(tick, playSpeed);
  }

  playTimer = setTimeout(tick, 100);
}

function stopPlay() {
  isPlaying = false;
  clearTimeout(playTimer);
  playTimer = null;
  const playBtn = document.getElementById('play-btn');
  if (playBtn) playBtn.textContent = '▶ Play';
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

function attachEventListeners() {
  // Scenario tabs
  document.querySelectorAll('.scenario-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const scenarioId = tab.dataset.scenario;
      if (scenarioId === sim.scenarioId) return;

      stopPlay();
      hideDoneMessage();

      document.querySelectorAll('.scenario-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      sim.setScenario(scenarioId);
      renderAll();
    });
  });

  // Algorithm toggle
  document.querySelectorAll('.algo-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentAlgo = btn.dataset.algo;
      document.querySelectorAll('.algo-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Re-style active button
      document.querySelectorAll('.algo-toggle-btn').forEach(b => {
        const color = COLORS[b.dataset.algo];
        b.style.borderColor = b.classList.contains('active') ? color : COLORS.border;
        b.style.color = b.classList.contains('active') ? color : COLORS.textMuted;
        b.style.background = b.classList.contains('active') ? `${color}22` : 'transparent';
      });

      taskDiagram.setAlgoColor(currentAlgo);
      algoPanel.render(currentAlgo, sim.getState());
      stepLog.render(sim.getState().stepLog, currentAlgo);
    });
  });

  // Play/Pause button
  document.getElementById('play-btn')?.addEventListener('click', () => {
    if (isPlaying) {
      stopPlay();
    } else {
      startPlay();
    }
  });

  // Next Step button
  document.getElementById('next-btn')?.addEventListener('click', () => {
    stopPlay();
    doStep();
  });

  // Reset button
  document.getElementById('reset-btn')?.addEventListener('click', () => {
    stopPlay();
    hideDoneMessage();
    sim.reset();
    isAnimating = false;
    renderAll();
  });

  // Speed slider
  document.getElementById('speed-slider')?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    // val: 1=slow, 2=med, 3=fast, 4=very fast
    const speeds =      { 1: 800, 2: 400, 3: 150, 4: 50 };
    const animDelays =  { 1: 300, 2: 200, 3: 80,  4: 0  };
    playSpeed = speeds[val] || 400;
    animDelay = animDelays[val] ?? 200;
    document.getElementById('speed-label').textContent = ['', 'Slow', 'Medium', 'Fast', 'Very Fast'][val] || 'Medium';
  });

  // Re-render chart on window resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      qChart.render(sim.getState());
    }, 200);
  });

  // Initialize algo toggle button styles
  document.querySelectorAll('.algo-toggle-btn').forEach(b => {
    const color = COLORS[b.dataset.algo];
    if (b.classList.contains('active')) {
      b.style.borderColor = color;
      b.style.color = color;
      b.style.background = `${color}22`;
    }
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────

// Wait for D3 to load
window.addEventListener('load', () => {
  init();
});
