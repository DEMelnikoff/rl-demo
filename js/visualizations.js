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
      <svg id="task-svg" viewBox="0 0 900 300" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto">
            <path d="M0,0 L0,8 L10,4 z" fill="#475569"/>
          </marker>
        </defs>

        <!-- Top chain (rocket → planet → apple) -->
        <g id="node-red-rocket" class="task-node" transform="translate(85,75)">
          <circle r="45" fill="#1E293B" stroke="#EF4444" stroke-width="2.5"/>
          <text text-anchor="middle" dominant-baseline="central" font-size="38">🚀</text>
          <text y="65" text-anchor="middle" font-size="16" fill="#CBD5E1">rocket</text>
        </g>

        <line id="arrow-red-rocket-to-planet" x1="135" y1="75" x2="295" y2="75"
          stroke="#475569" stroke-width="2.5" marker-end="url(#arrow)"/>

        <g id="node-red-planet" class="task-node" transform="translate(345,75)">
          <circle r="45" fill="#1E293B" stroke="#EF4444" stroke-width="2.5"/>
          <text text-anchor="middle" dominant-baseline="central" font-size="38">🪐</text>
          <text y="65" text-anchor="middle" font-size="16" fill="#CBD5E1">planet</text>
        </g>

        <line id="arrow-red-to-apple" x1="395" y1="75" x2="555" y2="75"
          stroke="#475569" stroke-width="2.5" marker-end="url(#arrow)"/>
        <line id="arrow-red-to-salad" x1="395" y1="100" x2="555" y2="200"
          stroke="#475569" stroke-width="2" marker-end="url(#arrow)" stroke-dasharray="6,4" opacity="0"/>

        <g id="node-apple" class="task-node" transform="translate(605,75)">
          <circle r="45" fill="#1E293B" stroke="#EF4444" stroke-width="2.5"/>
          <text text-anchor="middle" dominant-baseline="central" font-size="38">🍎</text>
          <text y="65" text-anchor="middle" font-size="16" fill="#CBD5E1">apple</text>
        </g>

        <text id="reward-label-red" x="700" y="80" text-anchor="start" font-size="18" fill="#94A3B8">r = <tspan id="reward-val-red" font-weight="bold" fill="#22C55E">1.0</tspan></text>

        <!-- Bottom chain (car → house → salad) -->
        <g id="node-green-rocket" class="task-node" transform="translate(85,225)">
          <circle r="45" fill="#1E293B" stroke="#22C55E" stroke-width="2.5"/>
          <text text-anchor="middle" dominant-baseline="central" font-size="38">🚗</text>
          <text y="65" text-anchor="middle" font-size="16" fill="#CBD5E1">car</text>
        </g>

        <line id="arrow-green-rocket-to-planet" x1="135" y1="225" x2="295" y2="225"
          stroke="#475569" stroke-width="2.5" marker-end="url(#arrow)"/>

        <g id="node-green-planet" class="task-node" transform="translate(345,225)">
          <circle r="45" fill="#1E293B" stroke="#22C55E" stroke-width="2.5"/>
          <text text-anchor="middle" dominant-baseline="central" font-size="38">🏠</text>
          <text y="65" text-anchor="middle" font-size="16" fill="#CBD5E1">house</text>
        </g>

        <line id="arrow-green-to-salad" x1="395" y1="225" x2="555" y2="225"
          stroke="#475569" stroke-width="2.5" marker-end="url(#arrow)"/>
        <line id="arrow-green-to-apple" x1="395" y1="200" x2="555" y2="100"
          stroke="#475569" stroke-width="2" marker-end="url(#arrow)" stroke-dasharray="6,4" opacity="0"/>

        <g id="node-salad" class="task-node" transform="translate(605,225)">
          <circle r="45" fill="#1E293B" stroke="#22C55E" stroke-width="2.5"/>
          <text text-anchor="middle" dominant-baseline="central" font-size="38">🥗</text>
          <text y="65" text-anchor="middle" font-size="16" fill="#CBD5E1">salad</text>
        </g>

        <text id="reward-label-green" x="700" y="230" text-anchor="start" font-size="18" fill="#94A3B8">r = <tspan id="reward-val-green" font-weight="bold" fill="#94A3B8">0.0</tspan></text>

        <!-- Goal label (bigger) -->
        <text id="goal-label" x="830" y="125" text-anchor="middle" font-size="20" fill="#94A3B8">goal:</text>
        <text id="goal-value" x="830" y="185" text-anchor="middle" font-size="56">🍎</text>
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
      // Revaluation: animate the single planet → terminal transition for this step.
      const planetState = stepDesc.animPlanet;
      const terminalState = stepDesc.animTerminal;

      setTimeout(() => { this.highlightState(planetState, algoColor); }, 0);
      setTimeout(() => { this.highlightState(terminalState, algoColor); }, delay);
      setTimeout(() => { this.highlightState(null, algoColor); if (onComplete) onComplete(); }, delay * 2);
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

    if (algo === 'mf') {
      representationHTML = this._buildMFPanel(display, Q);
    } else if (algo === 'mb') {
      representationHTML = this._buildMBPanel(display, Q);
    } else {
      representationHTML = this._buildSRPanel(display, Q);
    }

    // Q bars are redundant for MF (already in Q-table), so omit for MF
    const qBarsHTML = algo === 'mf' ? '' : `
      <div class="q-value-section">
        <div class="q-bar-label">Q(🚀)</div>
        <div class="q-bar-track">
          <div class="q-bar-fill" id="qbar-red-${algo}" style="width:${this._qToWidth(Q.red)}%;background:${algoColor}"></div>
        </div>
        <span class="q-bar-val">${Q.red.toFixed(3)}</span>
      </div>
      <div class="q-value-section">
        <div class="q-bar-label">Q(🚗)</div>
        <div class="q-bar-track">
          <div class="q-bar-fill" id="qbar-green-${algo}" style="width:${this._qToWidth(Q.green)}%;background:${algoColor}"></div>
        </div>
        <span class="q-bar-val">${Q.green.toFixed(3)}</span>
      </div>
    `;

    return `
      <div class="algo-panel-inner">
        ${representationHTML}
        ${qBarsHTML}
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
            <span class="qtable-label">Q(🚀)</span>
            <div class="qtable-bar-track">
              <div class="qtable-bar-fill" id="mf-qchoice-red" style="width:${this._qToWidth(Q_choice.red)}%;background:${COLORS.mf}"></div>
            </div>
            <span class="qtable-val" id="mf-qchoice-red-val">${Q_choice.red.toFixed(3)}</span>
          </div>
          <div class="qtable-row">
            <span class="qtable-label">Q(🚗)</span>
            <div class="qtable-bar-track">
              <div class="qtable-bar-fill" id="mf-qchoice-green" style="width:${this._qToWidth(Q_choice.green)}%;background:${COLORS.mf}"></div>
            </div>
            <span class="qtable-val" id="mf-qchoice-green-val">${Q_choice.green.toFixed(3)}</span>
          </div>
          <div class="qtable-row">
            <span class="qtable-label">Q(🪐)</span>
            <div class="qtable-bar-track">
              <div class="qtable-bar-fill" id="mf-qplanet-red" style="width:${this._qToWidth(Q_planet.red)}%;background:${COLORS.mf}aa"></div>
            </div>
            <span class="qtable-val" id="mf-qplanet-red-val">${Q_planet.red.toFixed(3)}</span>
          </div>
          <div class="qtable-row">
            <span class="qtable-label">Q(🏠)</span>
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
    const { T_rocket, T_planet, R } = display;
    return `
      <div class="repr-section">
        <div class="repr-title">Transition Matrix: Vehicles → Locations</div>
        <div class="mb-grid">
          <div class="mb-grid-header"></div>
          <div class="mb-grid-header">to 🪐</div>
          <div class="mb-grid-header">to 🏠</div>
          <div class="mb-grid-label">from 🚀</div>
          <div class="mb-cell" id="mb-Tr-red-red">
            <div class="mb-prob-bar" style="width:${(T_rocket.red.red_planet*100).toFixed(0)}%;background:#EF444466"></div>
            <span>${T_rocket.red.red_planet.toFixed(2)}</span>
          </div>
          <div class="mb-cell" id="mb-Tr-red-green">
            <div class="mb-prob-bar" style="width:${(T_rocket.red.green_planet*100).toFixed(0)}%;background:#22C55E66"></div>
            <span>${T_rocket.red.green_planet.toFixed(2)}</span>
          </div>
          <div class="mb-grid-label">from 🚗</div>
          <div class="mb-cell" id="mb-Tr-green-red">
            <div class="mb-prob-bar" style="width:${(T_rocket.green.red_planet*100).toFixed(0)}%;background:#EF444466"></div>
            <span>${T_rocket.green.red_planet.toFixed(2)}</span>
          </div>
          <div class="mb-cell" id="mb-Tr-green-green">
            <div class="mb-prob-bar" style="width:${(T_rocket.green.green_planet*100).toFixed(0)}%;background:#22C55E66"></div>
            <span>${T_rocket.green.green_planet.toFixed(2)}</span>
          </div>
        </div>

        <div class="repr-title" style="margin-top:14px">Transition Matrix: Locations → Resources</div>
        <div class="mb-grid">
          <div class="mb-grid-header"></div>
          <div class="mb-grid-header">to 🍎</div>
          <div class="mb-grid-header">to 🥗</div>
          <div class="mb-grid-label">from 🪐</div>
          <div class="mb-cell" id="mb-T-red-apple">
            <div class="mb-prob-bar" style="width:${(T_planet.red.apple*100).toFixed(0)}%;background:#EF444466"></div>
            <span>${T_planet.red.apple.toFixed(2)}</span>
          </div>
          <div class="mb-cell" id="mb-T-red-salad">
            <div class="mb-prob-bar" style="width:${(T_planet.red.salad*100).toFixed(0)}%;background:#22C55E66"></div>
            <span>${T_planet.red.salad.toFixed(2)}</span>
          </div>
          <div class="mb-grid-label">from 🏠</div>
          <div class="mb-cell" id="mb-T-green-apple">
            <div class="mb-prob-bar" style="width:${(T_planet.green.apple*100).toFixed(0)}%;background:#EF444466"></div>
            <span>${T_planet.green.apple.toFixed(2)}</span>
          </div>
          <div class="mb-cell" id="mb-T-green-salad">
            <div class="mb-prob-bar" style="width:${(T_planet.green.salad*100).toFixed(0)}%;background:#22C55E66"></div>
            <span>${T_planet.green.salad.toFixed(2)}</span>
          </div>
        </div>

        ${this._buildRewardValues(R, COLORS.mb)}
      </div>
    `;
  }

  _buildRewardValues(R, color) {
    return `
      <div class="repr-title" style="margin-top:12px">Reward Values (goal-based)</div>
      <div class="mf-qtable">
        <div class="qtable-row">
          <span class="qtable-label">R(🍎)</span>
          <div class="qtable-bar-track">
            <div class="qtable-bar-fill" style="width:${R.apple * 100}%;background:${color}"></div>
          </div>
          <span class="qtable-val" style="color:${R.apple > 0 ? color : 'var(--text-muted)'}">${R.apple.toFixed(0)}</span>
        </div>
        <div class="qtable-row">
          <span class="qtable-label">R(🥗)</span>
          <div class="qtable-bar-track">
            <div class="qtable-bar-fill" style="width:${R.salad * 100}%;background:${color}"></div>
          </div>
          <span class="qtable-val" style="color:${R.salad > 0 ? color : 'var(--text-muted)'}">${R.salad.toFixed(0)}</span>
        </div>
      </div>
    `;
  }

  _buildSRPanel(display, Q) {
    const { M_red, M_green, M_planet_red, M_planet_green, w, lastUpdatedRows } = display;
    const rowLabels = ['from 🚀', 'from 🚗', 'from 🪐', 'from 🏠'];
    // Skip S_choice column (index 0) — show only planet and terminal states
    const colLabels = ['to 🪐', 'to 🏠', 'to 🍎', 'to 🥗'];
    const rows = [M_red, M_green, M_planet_red, M_planet_green];

    const maxVal = Math.max(1, ...rows.map(r => r.slice(1)).flat(), ...w);

    const cellHTML = rows.map((row, ri) => {
      const isFrozen = lastUpdatedRows && !lastUpdatedRows.includes(ri) && lastUpdatedRows.length > 0;
      const rowClass = isFrozen ? 'sr-row-frozen' : '';
      // Slice off index 0 (S_choice column)
      return `
        <div class="sr-row ${rowClass}">
          <div class="sr-row-label">${rowLabels[ri]}</div>
          ${row.slice(1).map((val, ci) => {
            const intensity = Math.min(1, Math.abs(val) / maxVal);
            const bg = `rgba(16,185,129,${intensity * 0.8})`;
            return `<div class="sr-cell" id="sr-cell-${ri}-${ci}" style="background:${bg}">${val.toFixed(2)}</div>`;
          }).join('')}
        </div>
      `;
    }).join('');

    // SR reward weights are shown the same way as MB's R (w[apple], w[salad])
    const R = { apple: w[3], salad: w[4] };

    return `
      <div class="repr-section">
        <div class="repr-title">Successor Matrix</div>
        <div class="sr-col-labels">
          <div class="sr-row-label-spacer"></div>
          ${colLabels.map(l => `<div class="sr-col-label">${l}</div>`).join('')}
        </div>
        <div class="sr-matrix">${cellHTML}</div>
        ${this._buildRewardValues(R, COLORS.sr)}
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
      if (u.planetOnly) {
        flash(`mf-qplanet-${u.planetKey}`);
      } else if (!u.noUpdate) {
        flash(`mf-qplanet-${u.planetKey}`);
        flash(`mf-qchoice-${u.action}`);
      }
    }
    if (algo === 'mb' && stepDesc.updates?.mb) {
      const u = stepDesc.updates.mb;
      if (!u.noUpdate) {
        // Both choice and planets phases now use the same shape: planetKey + outcomeKey.
        flash(`mb-T-${u.planetKey}-${u.outcomeKey}`);
        if (stepDesc.type === 'choice') flash(`mb-R-${u.outcomeKey}`);
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
      if (u && u.planetOnly) {
        updateText = `
          <div class="step-eq">Q(${u.planetKey} 🪐) ← ${u.oldQplanet.toFixed(3)} + 0.3×(${u.reward} − ${u.oldQplanet.toFixed(3)}) = <strong style="color:${color}">${u.newQplanet.toFixed(3)}</strong></div>
          <div class="step-eq">Q(choice) unchanged — agent did not visit choice state</div>
        `;
      } else if (u && !u.noUpdate) {
        updateText = `
          <div class="step-eq">Q(${u.planetKey} 🪐) ← ${u.oldQplanet.toFixed(3)} + 0.3×(${u.reward} − ${u.oldQplanet.toFixed(3)}) = <strong style="color:${color}">${u.newQplanet.toFixed(3)}</strong></div>
          <div class="step-eq">Q(choice, ${u.action} 🚀) ← ${u.oldQchoice.toFixed(3)} + 0.3×(${u.newQplanet.toFixed(3)} − ${u.oldQchoice.toFixed(3)}) = <strong style="color:${color}">${u.newQchoice.toFixed(3)}</strong></div>
        `;
      } else {
        updateText = '<div class="step-eq">No update (agent not at choice state)</div>';
      }
    } else if (algo === 'mb') {
      const u = step.updates?.mb;
      if (u && !u.noUpdate) {
        updateText = `
          <div class="step-eq">T(${u.planetKey}→${u.outcomeKey}) ← ${u.oldT.toFixed(3)} + 0.5×(1 − ${u.oldT.toFixed(3)}) = <strong style="color:${color}">${u.newT.toFixed(3)}</strong></div>
          ${step.type === 'choice'
            ? `<div class="step-eq">R(apple)=${u.reward === 1 ? '<strong style="color:' + color + '">1</strong>' : '0'}, R(salad)=${u.reward === 0 ? '<strong style="color:' + color + '">0</strong>' : '1'} (goal-based, fixed)</div>`
            : ''}
        `;
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
            <div class="step-eq">M_planet_${u.planetKey} row updated from observed transition</div>
            <div class="step-eq">M_red/M_green <span style="color:#94A3B8">FROZEN</span> (agent did not visit choice state)</div>
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

    const { history, phaseHistory } = simState;

    if (!window.d3) return;
    const d3 = window.d3;

    const width = container.clientWidth || 800;
    const height = 220;
    const { margin } = this;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    container.innerHTML = '';

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('background', COLORS.card);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xMax = Math.max(simState.globalTrial, 20);

    const x = d3.scaleLinear().domain([0, xMax]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);

    // Dynamic phase regions from phaseHistory
    const phaseColorMap = {
      choice: 'rgba(129,140,248,0.10)',
      transition_reval: 'rgba(244,114,182,0.12)',
      outcome_reval: 'rgba(34,211,238,0.12)',
    };
    const phaseTextColorMap = {
      choice: COLORS.phaseText1,
      transition_reval: COLORS.phaseText2,
      outcome_reval: COLORS.phaseText3,
    };
    const phaseShortLabel = {
      choice: 'Choice',
      transition_reval: 'Trans. Reval',
      outcome_reval: 'Outcome Reval',
    };

    phaseHistory.forEach((entry, i) => {
      const start = entry.trial;
      const end = (i + 1 < phaseHistory.length) ? phaseHistory[i + 1].trial : simState.globalTrial;
      if (end <= start) return;

      g.append('rect')
        .attr('x', x(start))
        .attr('y', 0)
        .attr('width', x(end) - x(start))
        .attr('height', innerH)
        .attr('fill', phaseColorMap[entry.phaseId] || 'transparent');

      g.append('text')
        .attr('x', x(start) + 6)
        .attr('y', 14)
        .attr('fill', phaseTextColorMap[entry.phaseId])
        .attr('font-size', 12)
        .attr('font-weight', 600)
        .text(phaseShortLabel[entry.phaseId]);
    });

    // Dashed vertical lines at phase switches (skip the first one at trial 0)
    phaseHistory.slice(1).forEach((entry) => {
      g.append('line')
        .attr('x1', x(entry.trial)).attr('x2', x(entry.trial))
        .attr('y1', 0).attr('y2', innerH)
        .attr('stroke', COLORS.border)
        .attr('stroke-dasharray', '4,3')
        .attr('stroke-width', 1.5);
    });

    // Axes (bigger text)
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(Math.min(10, xMax)).tickFormat(d3.format('d')))
      .call(gx => {
        gx.selectAll('text').attr('fill', COLORS.textMuted).attr('font-size', 13);
        gx.selectAll('line,path').attr('stroke', COLORS.border);
      });

    g.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .call(gy => {
        gy.selectAll('text').attr('fill', COLORS.textMuted).attr('font-size', 13);
        gy.selectAll('line,path').attr('stroke', COLORS.border);
      });

    g.append('text')
      .attr('x', innerW / 2).attr('y', innerH + 38)
      .attr('text-anchor', 'middle')
      .attr('fill', COLORS.textMuted)
      .attr('font-size', 14)
      .text('Trial');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerH / 2).attr('y', -38)
      .attr('text-anchor', 'middle')
      .attr('fill', COLORS.textMuted)
      .attr('font-size', 14)
      .text('Q(🚀)');

    // Lines for each algorithm. MF is drawn LAST so it stays visible on top —
    // with γ=1 and the same trajectory, MF Q_choice and SR Q can coincide exactly.
    const algos = [
      { key: 'mb', color: COLORS.mb, label: 'Model-Based' },
      { key: 'sr', color: COLORS.sr, label: 'SR' },
      { key: 'mf', color: COLORS.mf, label: 'Model-Free' },
    ];

    const line = d3.line()
      .x(d => x(d.trial))
      .y(d => y(d.Qred))
      .curve(d3.curveMonotoneX);

    algos.forEach(({ key, color }) => {
      const data = history[key];
      if (data.length < 1) return;
      const path = g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('d', line);
      // MF is dashed so it stays distinguishable even when it coincides with SR.
      if (key === 'mf') path.attr('stroke-dasharray', '5,4');
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
