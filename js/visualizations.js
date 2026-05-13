// visualizations.js — D3 chart, representation panels, task diagram animation

import { STATES } from './task.js';

// ─── Colors ───────────────────────────────────────────────────────────────────

export const COLORS = {
  mf: '#F59E0B',
  mb: '#3B82F6',
  sr: '#10B981',
  phase1: 'rgba(99,102,241,0.12)',
  phase2: 'rgba(236,72,153,0.12)',
  phase3: 'rgba(34,211,238,0.12)',
  phaseText1: '#818CF8',
  phaseText2: '#F472B6',
  phaseText3: '#22D3EE',
  bg: '#0F172A',
  card: '#1E293B',
  border: '#334155',
  text: '#E2E8F0',
  textMuted: '#94A3B8',
};

const PHASE_COLORS = [COLORS.phase1, COLORS.phase2, COLORS.phase3];
const PHASE_TEXT_COLORS = [COLORS.phaseText1, COLORS.phaseText2, COLORS.phaseText3];

// ─── Task Diagram ─────────────────────────────────────────────────────────────

export class TaskDiagram {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.activeState = null;
    this.activeAlgo = 'mf';
    this.phase2Active = false;
    this.transitionConfig = null;
    this._render();
  }

  _render() {
    this.container.innerHTML = `
      <svg id="task-svg" viewBox="0 0 800 180" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;">
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#475569"/>
          </marker>
          <marker id="arrow-active" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#ffffff" id="arrow-active-path"/>
          </marker>
          <filter id="glow-mf"><feGaussianBlur stdDeviation="4" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter>
          <filter id="glow-mb"><feGaussianBlur stdDeviation="4" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter>
          <filter id="glow-sr"><feGaussianBlur stdDeviation="4" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/></filter>
        </defs>

        <!-- RED chain -->
        <!-- Red Rocket -->
        <g id="node-red-rocket" class="task-node" transform="translate(70,55)">
          <circle r="30" fill="#1E293B" stroke="#EF4444" stroke-width="2"/>
          <text text-anchor="middle" dominant-baseline="central" font-size="22">🚀</text>
          <text y="44" text-anchor="middle" font-size="10" fill="#94A3B8">red rocket</text>
        </g>

        <!-- Arrow: red rocket -> red planet -->
        <line id="arrow-red-rocket-to-planet" x1="102" y1="55" x2="218" y2="55"
          stroke="#475569" stroke-width="2" marker-end="url(#arrow)"/>

        <!-- Red Planet -->
        <g id="node-red-planet" class="task-node" transform="translate(250,55)">
          <circle r="30" fill="#1E293B" stroke="#EF4444" stroke-width="2"/>
          <text text-anchor="middle" dominant-baseline="central" font-size="22">🪐</text>
          <text y="44" text-anchor="middle" font-size="10" fill="#94A3B8">red planet</text>
        </g>

        <!-- Arrow: red planet -> apple (baseline) -->
        <line id="arrow-red-to-apple" x1="282" y1="55" x2="398" y2="55"
          stroke="#475569" stroke-width="2" marker-end="url(#arrow)"/>
        <!-- Arrow: red planet -> salad (swapped) — hidden by default -->
        <line id="arrow-red-to-salad" x1="282" y1="63" x2="398" y2="130"
          stroke="#475569" stroke-width="1.5" marker-end="url(#arrow)" stroke-dasharray="5,3" opacity="0"/>

        <!-- Apple -->
        <g id="node-apple" class="task-node" transform="translate(430,55)">
          <circle r="30" fill="#1E293B" stroke="#22C55E" stroke-width="2"/>
          <text text-anchor="middle" dominant-baseline="central" font-size="22">🍎</text>
          <text y="44" text-anchor="middle" font-size="10" fill="#94A3B8">apple</text>
        </g>

        <!-- Reward label red chain -->
        <text id="reward-label-red" x="560" y="59" text-anchor="start" font-size="13" fill="#94A3B8">r = <tspan id="reward-val-red" font-weight="bold" fill="#22C55E">1.0</tspan></text>

        <!-- GREEN chain -->
        <!-- Green Rocket -->
        <g id="node-green-rocket" class="task-node" transform="translate(70,130)">
          <circle r="30" fill="#1E293B" stroke="#22C55E" stroke-width="2"/>
          <text text-anchor="middle" dominant-baseline="central" font-size="22">🚀</text>
          <text y="44" text-anchor="middle" font-size="10" fill="#94A3B8">green rocket</text>
        </g>

        <!-- Arrow: green rocket -> green planet -->
        <line id="arrow-green-rocket-to-planet" x1="102" y1="130" x2="218" y2="130"
          stroke="#475569" stroke-width="2" marker-end="url(#arrow)"/>

        <!-- Green Planet -->
        <g id="node-green-planet" class="task-node" transform="translate(250,130)">
          <circle r="30" fill="#1E293B" stroke="#22C55E" stroke-width="2"/>
          <text text-anchor="middle" dominant-baseline="central" font-size="22">🪐</text>
          <text y="44" text-anchor="middle" font-size="10" fill="#94A3B8">green planet</text>
        </g>

        <!-- Arrow: green planet -> salad (baseline) -->
        <line id="arrow-green-to-salad" x1="282" y1="130" x2="398" y2="130"
          stroke="#475569" stroke-width="2" marker-end="url(#arrow)"/>
        <!-- Arrow: green planet -> apple (swapped) — hidden by default -->
        <line id="arrow-green-to-apple" x1="282" y1="122" x2="398" y2="47"
          stroke="#475569" stroke-width="1.5" marker-end="url(#arrow)" stroke-dasharray="5,3" opacity="0"/>

        <!-- Salad -->
        <g id="node-salad" class="task-node" transform="translate(430,130)">
          <circle r="30" fill="#1E293B" stroke="#22C55E" stroke-width="2"/>
          <text text-anchor="middle" dominant-baseline="central" font-size="22">🥗</text>
          <text y="44" text-anchor="middle" font-size="10" fill="#94A3B8">salad</text>
        </g>

        <!-- Reward label green chain -->
        <text id="reward-label-green" x="560" y="134" text-anchor="start" font-size="13" fill="#94A3B8">r = <tspan id="reward-val-green" font-weight="bold" fill="#94A3B8">0.0</tspan></text>

        <!-- Goal label -->
        <text id="goal-label" x="695" y="92" text-anchor="middle" font-size="12" fill="#94A3B8">goal:</text>
        <text id="goal-value" x="695" y="110" text-anchor="middle" font-size="20">🍎</text>
      </svg>
    `;

    this._attachStyles();
  }

  _attachStyles() {
    // Add CSS for task nodes
    if (!document.getElementById('task-diagram-style')) {
      const style = document.createElement('style');
      style.id = 'task-diagram-style';
      style.textContent = `
        .task-node { transition: filter 0.3s, opacity 0.3s; }
        .task-node.active circle { filter: drop-shadow(0 0 8px currentColor); }
        .task-node.faded { opacity: 0.3; }
        @keyframes nodeFlash {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
        .task-node.flash { animation: nodeFlash 0.3s ease; }
      `;
      document.head.appendChild(style);
    }
  }

  setGoal(goal) {
    const goalVal = document.getElementById('goal-value');
    const rewardValRed = document.getElementById('reward-val-red');
    const rewardValGreen = document.getElementById('reward-val-green');
    if (!goalVal) return;

    goalVal.textContent = goal === 'apple' ? '🍎' : '🥗';

    // In baseline transitions: red→apple, green→salad
    if (goal === 'apple') {
      rewardValRed.textContent = '1.0';
      rewardValRed.setAttribute('fill', '#22C55E');
      rewardValGreen.textContent = '0.0';
      rewardValGreen.setAttribute('fill', '#94A3B8');
    } else {
      rewardValRed.textContent = '0.0';
      rewardValRed.setAttribute('fill', '#94A3B8');
      rewardValGreen.textContent = '1.0';
      rewardValGreen.setAttribute('fill', '#22C55E');
    }
  }

  setTransitions(transitionConfig) {
    this.transitionConfig = transitionConfig;
    const isSwapped = transitionConfig.redPlanetOutcome === 'salad';

    // Baseline arrows
    document.getElementById('arrow-red-to-apple').setAttribute('opacity', isSwapped ? '0.2' : '1');
    document.getElementById('arrow-green-to-salad').setAttribute('opacity', isSwapped ? '0.2' : '1');
    // Swapped arrows
    document.getElementById('arrow-red-to-salad').setAttribute('opacity', isSwapped ? '1' : '0');
    document.getElementById('arrow-green-to-apple').setAttribute('opacity', isSwapped ? '1' : '0');
  }

  setPhase2(active) {
    this.phase2Active = active;
    const redRocket = document.getElementById('node-red-rocket');
    const greenRocket = document.getElementById('node-green-rocket');
    const arrRedRocket = document.getElementById('arrow-red-rocket-to-planet');
    const arrGreenRocket = document.getElementById('arrow-green-rocket-to-planet');

    if (active) {
      redRocket.classList.add('faded');
      greenRocket.classList.add('faded');
      arrRedRocket.setAttribute('opacity', '0.2');
      arrGreenRocket.setAttribute('opacity', '0.2');
    } else {
      redRocket.classList.remove('faded');
      greenRocket.classList.remove('faded');
      arrRedRocket.setAttribute('opacity', '1');
      arrGreenRocket.setAttribute('opacity', '1');
    }
  }

  setAlgoColor(algo) {
    this.activeAlgo = algo;
  }

  highlightState(stateIndex, algoColor) {
    // Clear all active states
    document.querySelectorAll('.task-node').forEach(n => {
      n.classList.remove('active');
      const circle = n.querySelector('circle');
      if (circle) {
        circle.setAttribute('stroke-width', '2');
        circle.style.filter = '';
      }
    });

    if (stateIndex === null) return;

    const nodeMap = {
      [STATES.S_CHOICE]: null,
      [STATES.S_RED_PLANET]: 'node-red-planet',
      [STATES.S_GREEN_PLANET]: 'node-green-planet',
      [STATES.S_APPLE]: 'node-apple',
      [STATES.S_SALAD]: 'node-salad',
    };

    const nodeId = nodeMap[stateIndex];
    if (!nodeId) return;

    const node = document.getElementById(nodeId);
    if (node) {
      node.classList.add('active');
      const circle = node.querySelector('circle');
      if (circle) {
        circle.setAttribute('stroke-width', '3');
        circle.style.filter = `drop-shadow(0 0 10px ${algoColor})`;
      }
    }
  }

  animateTrial(stepDesc, algoColor, onComplete, animDelay) {
    // Animate: choice → planet → terminal
    const isChoice = stepDesc.type === 'choice';
    const delay = animDelay !== undefined ? animDelay : 250;

    if (isChoice) {
      const action = stepDesc.animAction;
      const rocketId = action === 'red' ? 'node-red-rocket' : 'node-green-rocket';
      const planetId = action === 'red' ? 'node-red-planet' : 'node-green-planet';
      const terminalState = stepDesc.animTerminal;
      const terminalId = terminalState === STATES.S_APPLE ? 'node-apple' : 'node-salad';

      this.highlightState(STATES.S_CHOICE, algoColor);

      // Flash rocket
      setTimeout(() => {
        const rocketNode = document.getElementById(rocketId);
        if (rocketNode) {
          const circle = rocketNode.querySelector('circle');
          if (circle) circle.style.filter = `drop-shadow(0 0 10px ${algoColor})`;
        }
      }, 0);

      setTimeout(() => { this.highlightState(action === 'red' ? STATES.S_RED_PLANET : STATES.S_GREEN_PLANET, algoColor); }, delay);
      setTimeout(() => { this.highlightState(terminalState, algoColor); }, delay * 2);
      setTimeout(() => { this.highlightState(null, algoColor); if (onComplete) onComplete(); }, delay * 3);
    } else {
      // Phase 2: show red planet then green planet
      const redTerminal = stepDesc.updates.mf.redTerminal || STATES.S_APPLE;
      const greenTerminal = stepDesc.updates.mf.greenTerminal || STATES.S_SALAD;

      setTimeout(() => { this.highlightState(STATES.S_RED_PLANET, algoColor); }, 0);
      setTimeout(() => { this.highlightState(redTerminal, algoColor); }, delay);
      setTimeout(() => { this.highlightState(STATES.S_GREEN_PLANET, algoColor); }, delay * 2);
      setTimeout(() => { this.highlightState(greenTerminal, algoColor); }, delay * 3);
      setTimeout(() => { this.highlightState(null, algoColor); if (onComplete) onComplete(); }, delay * 4);
    }
  }
}

// ─── Algorithm Panel ──────────────────────────────────────────────────────────

export class AlgorithmPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentAlgo = 'mf';
    this.flashTimeouts = [];
  }

  render(algo, simState) {
    this.currentAlgo = algo;
    this.container.innerHTML = this._buildPanel(algo, simState);
  }

  update(algo, simState, stepDesc) {
    if (algo !== this.currentAlgo) return;
    this.render(algo, simState);

    // Flash updated cells
    if (stepDesc) {
      this._flashUpdatedCells(algo, stepDesc, simState);
    }
  }

  _buildPanel(algo, simState) {
    const algoColor = COLORS[algo];
    const Q = simState[`${algo}Q`];
    const display = simState[`${algo}Display`];
    const preferred = simState[`${algo}Choice`];

    let representationHTML = '';
    let description = '';
    let name = '';

    if (algo === 'mf') {
      name = 'Model-Free (TD Learning)';
      description = 'Directly caches action values from trial-and-error experience. Updates Q-values using temporal difference errors — no world model needed, but slow to adapt when rewards or transitions change.';
      representationHTML = this._buildMFPanel(display, Q);
    } else if (algo === 'mb') {
      name = 'Model-Based';
      description = 'Builds an explicit model of transitions (T) and rewards (R), then plans ahead. Adapts quickly when either T or R changes, because it re-computes values on the fly.';
      representationHTML = this._buildMBPanel(display, Q);
    } else {
      name = 'Successor Representation (SR)';
      description = 'Caches expected future state occupancy (M) separately from reward weights (w). Instantly adapts to reward changes (w updates), but needs new experience to update occupancy after transition changes.';
      representationHTML = this._buildSRPanel(display, Q);
    }

    const preferredEmoji = preferred === 'red' ? '🔴' : '🟢';

    return `
      <div class="algo-panel-inner">
        <div class="algo-header">
          <span class="algo-badge" style="background:${algoColor}22;border-color:${algoColor};color:${algoColor}">${name}</span>
        </div>
        <p class="algo-description">${description}</p>
        ${representationHTML}
        <div class="q-value-section">
          <div class="q-bar-label">Q(red rocket)</div>
          <div class="q-bar-track">
            <div class="q-bar-fill" id="qbar-red-${algo}" style="width:${this._qToWidth(Q.red)}%;background:${algoColor}"></div>
          </div>
          <span class="q-bar-val">${Q.red.toFixed(3)}</span>
        </div>
        <div class="q-value-section">
          <div class="q-bar-label">Q(green rocket)</div>
          <div class="q-bar-track">
            <div class="q-bar-fill" id="qbar-green-${algo}" style="width:${this._qToWidth(Q.green)}%;background:${algoColor}"></div>
          </div>
          <span class="q-bar-val">${Q.green.toFixed(3)}</span>
        </div>
        <div class="choice-indicator" style="border-color:${algoColor}44;background:${algoColor}11">
          Would choose: <strong style="color:${algoColor}">${preferredEmoji} ${preferred} rocket</strong>
        </div>
      </div>
    `;
  }

  _qToWidth(q) {
    return Math.max(0, Math.min(100, q * 100));
  }

  _buildMFPanel(display, Q) {
    const { Q_choice, Q_planet } = display;
    return `
      <div class="repr-section">
        <div class="repr-title">Q-Table</div>
        <div class="mf-qtable">
          <div class="qtable-row">
            <span class="qtable-label">Q(choice, red 🚀)</span>
            <div class="qtable-bar-track">
              <div class="qtable-bar-fill" id="mf-qchoice-red" style="width:${this._qToWidth(Q_choice.red)}%;background:${COLORS.mf}"></div>
            </div>
            <span class="qtable-val" id="mf-qchoice-red-val">${Q_choice.red.toFixed(3)}</span>
          </div>
          <div class="qtable-row">
            <span class="qtable-label">Q(choice, green 🚀)</span>
            <div class="qtable-bar-track">
              <div class="qtable-bar-fill" id="mf-qchoice-green" style="width:${this._qToWidth(Q_choice.green)}%;background:${COLORS.mf}"></div>
            </div>
            <span class="qtable-val" id="mf-qchoice-green-val">${Q_choice.green.toFixed(3)}</span>
          </div>
          <div class="qtable-row">
            <span class="qtable-label">Q(red 🪐)</span>
            <div class="qtable-bar-track">
              <div class="qtable-bar-fill" id="mf-qplanet-red" style="width:${this._qToWidth(Q_planet.red)}%;background:${COLORS.mf}aa"></div>
            </div>
            <span class="qtable-val" id="mf-qplanet-red-val">${Q_planet.red.toFixed(3)}</span>
          </div>
          <div class="qtable-row">
            <span class="qtable-label">Q(green 🪐)</span>
            <div class="qtable-bar-track">
              <div class="qtable-bar-fill" id="mf-qplanet-green" style="width:${this._qToWidth(Q_planet.green)}%;background:${COLORS.mf}aa"></div>
            </div>
            <span class="qtable-val" id="mf-qplanet-green-val">${Q_planet.green.toFixed(3)}</span>
          </div>
        </div>
      </div>
    `;
  }

  _buildMBPanel(display, Q) {
    const { T, R } = display;
    return `
      <div class="repr-section">
        <div class="repr-title">Transition Model T</div>
        <div class="mb-grid">
          <div class="mb-grid-header"></div>
          <div class="mb-grid-header" style="color:#EF4444">→ 🍎 apple</div>
          <div class="mb-grid-header" style="color:#22C55E">→ 🥗 salad</div>
          <div class="mb-grid-label" style="color:#EF4444">red 🪐</div>
          <div class="mb-cell" id="mb-T-red-apple">
            <div class="mb-prob-bar" style="width:${(T.red.apple*100).toFixed(0)}%;background:#EF444466"></div>
            <span>${T.red.apple.toFixed(2)}</span>
          </div>
          <div class="mb-cell" id="mb-T-red-salad">
            <div class="mb-prob-bar" style="width:${(T.red.salad*100).toFixed(0)}%;background:#22C55E66"></div>
            <span>${T.red.salad.toFixed(2)}</span>
          </div>
          <div class="mb-grid-label" style="color:#22C55E">green 🪐</div>
          <div class="mb-cell" id="mb-T-green-apple">
            <div class="mb-prob-bar" style="width:${(T.green.apple*100).toFixed(0)}%;background:#EF444466"></div>
            <span>${T.green.apple.toFixed(2)}</span>
          </div>
          <div class="mb-cell" id="mb-T-green-salad">
            <div class="mb-prob-bar" style="width:${(T.green.salad*100).toFixed(0)}%;background:#22C55E66"></div>
            <span>${T.green.salad.toFixed(2)}</span>
          </div>
        </div>
        <div class="repr-title" style="margin-top:10px">Reward Model R</div>
        <div class="mf-qtable">
          <div class="qtable-row">
            <span class="qtable-label">R(🍎 apple)</span>
            <div class="qtable-bar-track">
              <div class="qtable-bar-fill" id="mb-R-apple" style="width:${this._qToWidth(R.apple)}%;background:${COLORS.mb}"></div>
            </div>
            <span class="qtable-val">${R.apple.toFixed(3)}</span>
          </div>
          <div class="qtable-row">
            <span class="qtable-label">R(🥗 salad)</span>
            <div class="qtable-bar-track">
              <div class="qtable-bar-fill" id="mb-R-salad" style="width:${this._qToWidth(R.salad)}%;background:${COLORS.mb}"></div>
            </div>
            <span class="qtable-val">${R.salad.toFixed(3)}</span>
          </div>
        </div>
      </div>
    `;
  }

  _buildSRPanel(display, Q) {
    const { M_red, M_green, M_planet_red, M_planet_green, w, lastUpdatedRows } = display;
    const rowLabels = ['red 🚀 (from choice)', 'green 🚀 (from choice)', 'red 🪐 (from planet)', 'green 🪐 (from planet)'];
    const colLabels = ['choice', 'red 🪐', 'green 🪐', '🍎', '🥗'];
    const rows = [M_red, M_green, M_planet_red, M_planet_green];

    const maxVal = Math.max(1, ...rows.flat(), ...w);

    const cellHTML = rows.map((row, ri) => {
      const isFrozen = lastUpdatedRows && !lastUpdatedRows.includes(ri) && lastUpdatedRows.length > 0;
      const rowClass = isFrozen ? 'sr-row-frozen' : '';
      return `
        <div class="sr-row ${rowClass}">
          <div class="sr-row-label">${rowLabels[ri]}</div>
          ${row.map((val, ci) => {
            const intensity = Math.min(1, Math.abs(val) / maxVal);
            const bg = `rgba(16,185,129,${intensity * 0.8})`;
            return `<div class="sr-cell" id="sr-cell-${ri}-${ci}" style="background:${bg}">${val.toFixed(2)}</div>`;
          }).join('')}
        </div>
      `;
    }).join('');

    const wHTML = w.map((val, i) => {
      const label = ['S_choice', 'red 🪐', 'green 🪐', '🍎 apple', '🥗 salad'][i];
      return `
        <div class="qtable-row">
          <span class="qtable-label">${label}</span>
          <div class="qtable-bar-track">
            <div class="qtable-bar-fill" id="sr-w-${i}" style="width:${this._qToWidth(val)}%;background:${COLORS.sr}"></div>
          </div>
          <span class="qtable-val">${val.toFixed(3)}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="repr-section">
        <div class="repr-title">Successor Matrix M</div>
        <div class="sr-col-labels">
          <div class="sr-row-label-spacer"></div>
          ${colLabels.map(l => `<div class="sr-col-label">${l}</div>`).join('')}
        </div>
        <div class="sr-matrix">${cellHTML}</div>
        <div class="repr-title" style="margin-top:10px">Reward Weights w</div>
        <div class="mf-qtable">${wHTML}</div>
      </div>
    `;
  }

  _flashUpdatedCells(algo, stepDesc, simState) {
    // Flash relevant cells after update
    const flash = (id) => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('flash-update');
        void el.offsetWidth; // reflow
        el.classList.add('flash-update');
      }
    };

    if (algo === 'mf' && stepDesc.updates?.mf) {
      const u = stepDesc.updates.mf;
      if (!u.noUpdate) {
        flash(`mf-qplanet-${u.planetKey}`);
        flash(`mf-qchoice-${u.action}`);
      }
    }
    if (algo === 'mb' && stepDesc.updates?.mb) {
      if (!stepDesc.updates.mb.noUpdate) {
        if (stepDesc.type === 'choice') {
          const u = stepDesc.updates.mb;
          flash(`mb-T-${u.planetKey}-${u.outcomeKey}`);
          flash(`mb-R-${u.outcomeKey}`);
        } else {
          const u = stepDesc.updates.mb;
          if (u.redUpdate) {
            flash(`mb-T-red-${u.redUpdate.outcomeKey}`);
          }
          if (u.greenUpdate) {
            flash(`mb-T-green-${u.greenUpdate.outcomeKey}`);
          }
        }
      }
    }
    if (algo === 'sr' && stepDesc.updates?.sr) {
      const u = stepDesc.updates.sr;
      const display = simState.srDisplay;
      // Flash updated matrix rows
      if (display.lastUpdatedRows) {
        display.lastUpdatedRows.forEach(ri => {
          for (let ci = 0; ci < 5; ci++) {
            flash(`sr-cell-${ri}-${ci}`);
          }
        });
      }
    }
  }
}

// ─── Step Log ─────────────────────────────────────────────────────────────────

export class StepLog {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  render(stepLog, currentAlgo) {
    if (!stepLog || stepLog.length === 0) {
      this.container.innerHTML = '<div class="step-log-empty">No steps yet. Press Next Step or Play.</div>';
      return;
    }

    const algoColor = COLORS[currentAlgo];

    this.container.innerHTML = stepLog.slice(0, 3).map((step, i) => {
      const opacity = 1 - i * 0.25;
      return `<div class="step-entry" style="opacity:${opacity}">
        ${this._buildStepHTML(step, currentAlgo, algoColor)}
      </div>`;
    }).join('');
  }

  _buildStepHTML(step, algo, color) {
    const phaseLabel = `Phase ${step.phase + 1}`;
    const trialLabel = `Trial ${step.trial + 1}`;
    const goalLabel = step.goal === 'apple' ? '🍎 apple' : '🥗 salad';

    let updateText = '';

    if (algo === 'mf') {
      const u = step.updates?.mf;
      if (u && !u.noUpdate) {
        updateText = `
          <div class="step-eq">Q(${u.planetKey} 🪐) ← ${u.oldQplanet.toFixed(3)} + 0.3×(${u.reward} − ${u.oldQplanet.toFixed(3)}) = <strong style="color:${color}">${u.newQplanet.toFixed(3)}</strong></div>
          <div class="step-eq">Q(choice, ${u.action} 🚀) ← ${u.oldQchoice.toFixed(3)} + 0.3×(${u.reward}+0.9×${u.newQplanet.toFixed(3)} − ${u.oldQchoice.toFixed(3)}) = <strong style="color:${color}">${u.newQchoice.toFixed(3)}</strong></div>
        `;
      } else {
        updateText = '<div class="step-eq">No update (agent not at choice state)</div>';
      }
    } else if (algo === 'mb') {
      const u = step.updates?.mb;
      if (u && !u.noUpdate) {
        if (step.type === 'choice') {
          updateText = `
            <div class="step-eq">T(${u.planetKey}→${u.outcomeKey}) ← ${u.oldT.toFixed(3)} + 0.5×(1 − ${u.oldT.toFixed(3)}) = <strong style="color:${color}">${u.newT.toFixed(3)}</strong></div>
            <div class="step-eq">R(${u.outcomeKey}) ← ${u.oldR.toFixed(3)} + 0.3×(${u.reward} − ${u.oldR.toFixed(3)}) = <strong style="color:${color}">${u.newR.toFixed(3)}</strong></div>
          `;
        } else {
          const ru = u.redUpdate, gu = u.greenUpdate;
          updateText = `
            <div class="step-eq">T(red→${ru.outcomeKey}) ← <strong style="color:${color}">${ru.newT.toFixed(3)}</strong> | R(${ru.outcomeKey}) ← <strong style="color:${color}">${ru.newR.toFixed(3)}</strong></div>
            <div class="step-eq">T(green→${gu.outcomeKey}) ← <strong style="color:${color}">${gu.newT.toFixed(3)}</strong> | R(${gu.outcomeKey}) ← <strong style="color:${color}">${gu.newR.toFixed(3)}</strong></div>
          `;
        }
      }
    } else if (algo === 'sr') {
      const u = step.updates?.sr;
      if (u) {
        if (step.type === 'choice') {
          const cu = u.choiceUpdate;
          const pu = u.planetUpdate;
          updateText = `
            <div class="step-eq">M_${cu?.row?.replace('M_', '')} ← e[choice] + γ·M_planet updated</div>
            <div class="step-eq">M_${pu?.row?.replace('M_', '')} ← e[planet] + γ·e[terminal] updated</div>
            <div class="step-eq">w[${u.terminalState === 3 ? 'apple' : 'salad'}] ← <strong style="color:${color}">${u.wUpdate?.newW?.[u.terminalState]?.toFixed(3)}</strong> (r=${u.reward})</div>
          `;
        } else {
          updateText = `
            <div class="step-eq">M_planet_red rows 2-3 updated; M_red/M_green <span style="color:#94A3B8">FROZEN</span></div>
            <div class="step-eq">w updated from planet visits</div>
          `;
        }
      }
    }

    return `
      <div class="step-header">
        <span class="step-phase-tag">${phaseLabel}</span>
        <span class="step-trial-tag">${trialLabel}</span>
        <span class="step-type-tag">${step.type === 'choice' ? '🚀 choice trial' : '🪐 planet trial'}</span>
        <span class="step-goal-tag">goal: ${goalLabel}</span>
      </div>
      ${updateText}
    `;
  }
}

// ─── Q-Value Chart (D3) ───────────────────────────────────────────────────────

export class QValueChart {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.svg = null;
    this.margin = { top: 20, right: 20, bottom: 40, left: 50 };
    this._init();
  }

  _init() {
    // Will be created on first render
  }

  render(simState) {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const { history, phaseBoundaries, phases } = simState;
    const totalTrials = simState.totalTrials;

    // Use D3 if available
    if (!window.d3) return;
    const d3 = window.d3;

    const width = container.clientWidth || 800;
    const height = 200;
    const { margin } = this;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    // Clear and recreate
    container.innerHTML = '';

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('background', COLORS.card);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xMax = Math.max(totalTrials, history.mf.length, 1);

    const x = d3.scaleLinear().domain([0, xMax]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);

    // Phase regions
    const phaseColors = [COLORS.phase1, COLORS.phase2, COLORS.phase3];
    phaseBoundaries.forEach((start, i) => {
      if (i >= phaseBoundaries.length - 1) return;
      const end = phaseBoundaries[i + 1];
      const phaseLabel = i === 0 ? 'Phase 1: Learn' : i === 1 ? 'Phase 2: Revalue' : 'Phase 3';

      g.append('rect')
        .attr('x', x(start))
        .attr('y', 0)
        .attr('width', x(end) - x(start))
        .attr('height', innerH)
        .attr('fill', phaseColors[i] || 'transparent');

      g.append('text')
        .attr('x', x(start) + 6)
        .attr('y', 12)
        .attr('fill', PHASE_TEXT_COLORS[i])
        .attr('font-size', 10)
        .text(phaseLabel);
    });

    // "Choice test" region after all phases
    if (simState.done) {
      g.append('rect')
        .attr('x', x(totalTrials))
        .attr('y', 0)
        .attr('width', Math.max(0, innerW - x(totalTrials)))
        .attr('height', innerH)
        .attr('fill', COLORS.phase3);
    }

    // Phase boundary lines
    phaseBoundaries.slice(1, -1).forEach((t) => {
      g.append('line')
        .attr('x1', x(t)).attr('x2', x(t))
        .attr('y1', 0).attr('y2', innerH)
        .attr('stroke', COLORS.border)
        .attr('stroke-dasharray', '4,3')
        .attr('stroke-width', 1.5);
    });

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(Math.min(10, xMax)).tickFormat(d3.format('d')))
      .call(gx => {
        gx.selectAll('text').attr('fill', COLORS.textMuted).attr('font-size', 10);
        gx.selectAll('line,path').attr('stroke', COLORS.border);
      });

    g.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .call(gy => {
        gy.selectAll('text').attr('fill', COLORS.textMuted).attr('font-size', 10);
        gy.selectAll('line,path').attr('stroke', COLORS.border);
      });

    // Axis labels
    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 34)
      .attr('text-anchor', 'middle')
      .attr('fill', COLORS.textMuted)
      .attr('font-size', 11)
      .text('Trial');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -36)
      .attr('text-anchor', 'middle')
      .attr('fill', COLORS.textMuted)
      .attr('font-size', 11)
      .text('Q(red rocket)');

    // Lines for each algorithm
    const algos = [
      { key: 'mf', color: COLORS.mf, label: 'Model-Free' },
      { key: 'mb', color: COLORS.mb, label: 'Model-Based' },
      { key: 'sr', color: COLORS.sr, label: 'SR' },
    ];

    const line = d3.line()
      .x(d => x(d.trial))
      .y(d => y(d.Qred))
      .curve(d3.curveMonotoneX);

    algos.forEach(({ key, color, label }) => {
      const data = history[key];
      if (data.length < 1) return;

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('d', line);

      // Legend dot
      const legendX = innerW - 140 + algos.findIndex(a => a.key === key) * 50;
    });

    // Legend
    const legendG = g.append('g').attr('transform', `translate(${innerW - 160}, ${-10})`);
    algos.forEach(({ key, color, label }, i) => {
      legendG.append('line')
        .attr('x1', i * 60).attr('x2', i * 60 + 18)
        .attr('y1', 10).attr('y2', 10)
        .attr('stroke', color).attr('stroke-width', 2);
      legendG.append('text')
        .attr('x', i * 60 + 20).attr('y', 14)
        .attr('fill', color).attr('font-size', 9)
        .text(label);
    });
  }
}

// ─── Phase Indicator ─────────────────────────────────────────────────────────

export class PhaseIndicator {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  render(simState) {
    const { phases, currentPhaseIndex, done } = simState;
    const allPhases = [...phases, { id: 'choice', label: 'Choose' }];
    const activeIndex = done ? allPhases.length - 1 : currentPhaseIndex;

    const dots = allPhases.map((phase, i) => {
      const isActive = i === activeIndex;
      const isDone = i < activeIndex;
      const color = i === 0 ? COLORS.phaseText1 : i === 1 ? COLORS.phaseText2 : COLORS.phaseText3;

      return `
        <div class="phase-dot-wrap">
          <div class="phase-dot ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}"
            style="${isActive ? `border-color:${color};box-shadow:0 0 8px ${color}` : isDone ? `background:${color}44;border-color:${color}44` : ''}">
            ${isDone ? '✓' : i + 1}
          </div>
          <div class="phase-dot-label" style="${isActive ? `color:${color}` : ''}">${phase.label}</div>
        </div>
        ${i < allPhases.length - 1 ? `<div class="phase-connector ${isDone ? 'done' : ''}"></div>` : ''}
      `;
    }).join('');

    this.container.innerHTML = `<div class="phase-indicator">${dots}</div>`;
  }
}
