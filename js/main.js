// main.js — wires everything together, event handlers, animation loop

import { Simulation, PHASE_MODES } from './simulation.js';
import { TaskDiagram, AlgorithmPanel, StepLog, QValueChart, PhaseIndicator, COLORS } from './visualizations.js';
import { PARAMS } from './algorithms.js';

const PARAM_DEFAULTS = { ...PARAMS };
const PARAM_SPECS = [
  { key: 'alpha_mf', decimals: 2 },
  { key: 'alpha_mb', decimals: 2 },
  { key: 'alpha_sr', decimals: 2 },
  { key: 'beta',     decimals: 1 },
  { key: 'gamma',    decimals: 2 },
];

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

  // Use simulation's persistent world state, not phase config
  taskDiagram.setGoal(state.currentGoal);
  taskDiagram.setTransitions(state.currentTransitions);
  taskDiagram.setPhase2(!state.currentPhase.agentAtChoice);
  taskDiagram.setAlgoColor(currentAlgo);

  algoPanel.render(currentAlgo, state);
  qChart.render(state);

  updateControlsUI(state);
}

function updateControlsUI(state) {
  const playBtn = document.getElementById('play-btn');
  const nextBtn = document.getElementById('next-btn');
  const resetBtn = document.getElementById('reset-btn');

  if (playBtn) {
    playBtn.textContent = isPlaying ? '⏸ Pause' : '▶ Play';
  }
  if (nextBtn) nextBtn.disabled = isAnimating;
  if (resetBtn) resetBtn.disabled = false;

  const trialCountEl = document.getElementById('trial-count');
  if (trialCountEl) {
    trialCountEl.textContent = `Trial ${state.globalTrial}`;
  }

  // Highlight active phase tab
  document.querySelectorAll('.phase-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.phase === state.currentPhaseId);
  });
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

  taskDiagram.setGoal(state.currentGoal);
  taskDiagram.setTransitions(state.currentTransitions);
  taskDiagram.setPhase2(!state.currentPhase.agentAtChoice);

  const algoColor = COLORS[currentAlgo];

  taskDiagram.animateTrial(stepDesc, algoColor, () => {
    isAnimating = false;
    algoPanel.update(currentAlgo, state, stepDesc);
    qChart.render(state);
    updateControlsUI(state);
  }, animDelay);
}

function showDoneMessage() {
  const state = sim.getState();
  const banner = document.getElementById('done-banner');
  if (!banner) return;

  const choiceEmoji = (c) => c === 'red' ? '🚀' : '🚗';

  banner.innerHTML = `
    <div class="done-banner-inner">
      <span class="done-title">Choice Phase</span>
      <span class="done-item" style="color:${COLORS.mf}">MF: ${choiceEmoji(state.mfChoice)}</span>
      <span class="done-item" style="color:${COLORS.mb}">MB: ${choiceEmoji(state.mbChoice)}</span>
      <span class="done-item" style="color:${COLORS.sr}">SR: ${choiceEmoji(state.srChoice)}</span>
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
  // Phase tabs — switch phase mode at any time. Algorithm state persists.
  // Re-clicking a revaluation tab re-applies its toggle (swap transitions / flip goal).
  document.querySelectorAll('.phase-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      sim.setPhase(tab.dataset.phase);
      renderAll();
    });
  });

  // Algorithm toggle — also drives which agent's policy chooses actions in Choice Phase.
  document.querySelectorAll('.algo-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentAlgo = btn.dataset.algo;
      sim.setActiveAlgo(currentAlgo);
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

  // Settings overlay
  attachSettingsListeners();
}

// ─── Settings Overlay ─────────────────────────────────────────────────────────

function attachSettingsListeners() {
  const overlay = document.getElementById('settings-overlay');
  const openBtn = document.getElementById('open-settings-btn');
  const closeBtn = document.getElementById('close-settings-btn');
  const resetBtn = document.getElementById('reset-params-btn');

  const syncInputs = () => {
    PARAM_SPECS.forEach(({ key, decimals }) => {
      const input = document.getElementById(`param-${key.replace('_', '-')}`);
      const val = document.getElementById(`param-${key.replace('_', '-')}-val`);
      if (input) input.value = PARAMS[key];
      if (val) val.textContent = Number(PARAMS[key]).toFixed(decimals);
    });
  };

  openBtn?.addEventListener('click', () => {
    syncInputs();
    overlay.style.display = 'flex';
  });
  closeBtn?.addEventListener('click', () => { overlay.style.display = 'none'; });
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.style.display = 'none';
  });

  PARAM_SPECS.forEach(({ key, decimals }) => {
    const id = `param-${key.replace('_', '-')}`;
    const input = document.getElementById(id);
    const valEl = document.getElementById(`${id}-val`);
    input?.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      PARAMS[key] = v;
      if (valEl) valEl.textContent = v.toFixed(decimals);
      // Re-render so MB/SR Q values (computed live from PARAMS.gamma) refresh.
      algoPanel.render(currentAlgo, sim.getState());
    });
  });

  resetBtn?.addEventListener('click', () => {
    Object.assign(PARAMS, PARAM_DEFAULTS);
    syncInputs();
    algoPanel.render(currentAlgo, sim.getState());
  });

  syncInputs();
}

// ─── Start ────────────────────────────────────────────────────────────────────

// Wait for D3 to load
window.addEventListener('load', () => {
  init();
});
