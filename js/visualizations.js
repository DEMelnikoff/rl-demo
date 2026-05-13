// visualizations.js — D3-based plots and heatmaps

import { STATE_NAMES, GOALS } from './task.js';

const COLORS = {
  mf: '#f59e0b',   // amber
  mb: '#60a5fa',   // blue
  sr: '#34d399',   // teal/green
  a1: '#a78bfa',   // purple for action 1
  a2: '#f472b6',   // pink for action 2
  bg: '#1e2235',
  panel: '#252a3d',
  border: '#3a4060',
  text: '#e2e8f0',
  muted: '#8892b0',
};

// ─── Main comparison line chart ───────────────────────────────────────────────

export class ComparisonChart {
  constructor(container, revaluationTrial, totalTrials) {
    this.container = container;
    this.revaluationTrial = revaluationTrial;
    this.totalTrials = totalTrials;
    this.margin = { top: 20, right: 30, bottom: 50, left: 55 };
    this._init();
  }

  _init() {
    const el = document.querySelector(this.container);
    if (!el) return;
    const w = el.clientWidth || 600;
    const h = el.clientHeight || 300;
    this.width = w - this.margin.left - this.margin.right;
    this.height = h - this.margin.top - this.margin.bottom;

    d3.select(this.container).selectAll('*').remove();
    const svg = d3.select(this.container)
      .append('svg')
      .attr('width', w)
      .attr('height', h);

    this.g = svg.append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    this.xScale = d3.scaleLinear().domain([1, this.totalTrials]).range([0, this.width]);
    this.yScale = d3.scaleLinear().domain([0, 1]).range([this.height, 0]);

    // Axes
    this.g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.height})`)
      .call(d3.axisBottom(this.xScale).ticks(10).tickFormat(d3.format('d')))
      .call(g => g.select('.domain').attr('stroke', COLORS.border))
      .call(g => g.selectAll('.tick line').attr('stroke', COLORS.border))
      .call(g => g.selectAll('.tick text').attr('fill', COLORS.muted));

    this.g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(this.yScale).ticks(5).tickFormat(d3.format('.1f')))
      .call(g => g.select('.domain').attr('stroke', COLORS.border))
      .call(g => g.selectAll('.tick line').attr('stroke', COLORS.border))
      .call(g => g.selectAll('.tick text').attr('fill', COLORS.muted));

    // Grid lines
    this.g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(this.yScale).ticks(5).tickSize(-this.width).tickFormat(''))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke', COLORS.border).attr('stroke-opacity', 0.5));

    // Axis labels
    this.g.append('text')
      .attr('x', this.width / 2)
      .attr('y', this.height + 40)
      .attr('text-anchor', 'middle')
      .attr('fill', COLORS.muted)
      .attr('font-size', '12px')
      .text('Trial');

    this.g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -this.height / 2)
      .attr('y', -42)
      .attr('text-anchor', 'middle')
      .attr('fill', COLORS.muted)
      .attr('font-size', '12px')
      .text('Q(S1, a1) value');

    // Revaluation line
    if (this.revaluationTrial) {
      this.g.append('line')
        .attr('class', 'reval-line')
        .attr('x1', this.xScale(this.revaluationTrial))
        .attr('x2', this.xScale(this.revaluationTrial))
        .attr('y1', 0)
        .attr('y2', this.height)
        .attr('stroke', '#ef4444')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '6,4')
        .attr('opacity', 0.8);

      this.g.append('text')
        .attr('x', this.xScale(this.revaluationTrial) + 5)
        .attr('y', 14)
        .attr('fill', '#ef4444')
        .attr('font-size', '11px')
        .text('Revaluation');
    }

    // Line generators
    const lineGen = (key) => d3.line()
      .x((d, i) => this.xScale(i + 1))
      .y(d => this.yScale(d[0]))  // d[0] = Q(S1,a1)
      .curve(d3.curveCatmullRom.alpha(0.5));

    this.lines = {};
    ['mf', 'mb', 'sr'].forEach(alg => {
      const color = COLORS[alg];
      this.lines[alg] = this.g.append('path')
        .attr('class', `line-${alg}`)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2.5)
        .attr('opacity', 0.9);
    });

    // Legend
    const legendData = [
      { key: 'mf', label: 'Model-Free (Q-learning)' },
      { key: 'mb', label: 'Model-Based' },
      { key: 'sr', label: 'Successor Rep.' },
    ];
    const legend = this.g.append('g').attr('transform', `translate(${this.width - 180}, 4)`);
    legendData.forEach((d, i) => {
      const row = legend.append('g').attr('transform', `translate(0, ${i * 20})`);
      row.append('line')
        .attr('x1', 0).attr('x2', 20).attr('y1', 8).attr('y2', 8)
        .attr('stroke', COLORS[d.key]).attr('stroke-width', 2.5);
      row.append('text')
        .attr('x', 26).attr('y', 12)
        .attr('fill', COLORS.text).attr('font-size', '11px')
        .text(d.label);
    });
  }

  update(history) {
    if (!history || !this.lines) return;
    ['mf', 'mb', 'sr'].forEach(alg => {
      if (!history[alg] || history[alg].length === 0) return;
      const lineGen = d3.line()
        .x((d, i) => this.xScale(i + 1))
        .y(d => this.yScale(Math.max(0, Math.min(1, d[0]))))
        .curve(d3.curveCatmullRom.alpha(0.5));
      this.lines[alg].datum(history[alg]).attr('d', lineGen);
    });
  }

  resize() {
    this._init();
  }
}

// ─── Q-table grid (MF) ───────────────────────────────────────────────────────

export class QTableViz {
  constructor(container) {
    this.container = container;
    this.highlightCells = new Set();
  }

  update(Q, highlightKey) {
    const el = document.querySelector(this.container);
    if (!el) return;

    const rows = ['S1', 'S2a', 'S2b'];
    const cols = ['a1', 'a2'];

    let html = '<table class="q-table"><thead><tr><th>State</th><th>Q(s,a1)</th><th>Q(s,a2)</th></tr></thead><tbody>';

    Q.forEach((row, si) => {
      const best = Math.max(...row);
      row.forEach((val, ai) => {
        const isBest = val === best;
        const isHighlighted = highlightKey === `${si},${ai}`;
        const intensity = Math.max(0, Math.min(1, val));
        const bg = isHighlighted ? 'rgba(245,158,11,0.5)' : `rgba(245,158,11,${intensity * 0.35})`;
        const border = isHighlighted ? '2px solid #f59e0b' : '1px solid #3a4060';
        if (ai === 0) html += `<tr><td class="q-state">${rows[si]}</td>`;
        html += `<td style="background:${bg};border:${border};font-weight:${isBest ? 'bold' : 'normal'}">${val.toFixed(3)}</td>`;
        if (ai === 1) html += '</tr>';
      });
    });

    html += '</tbody></table>';
    el.innerHTML = html;
  }
}

// ─── MB T matrix + R table ───────────────────────────────────────────────────

export class MBTableViz {
  constructor(container) {
    this.container = container;
  }

  update(T, R, highlightT, highlightR) {
    const el = document.querySelector(this.container);
    if (!el) return;

    let html = '<div class="mb-tables">';

    // Transition table
    html += '<div class="mb-subtable"><div class="subtable-label">Transition T(S1,a→s2)</div>';
    html += '<table class="q-table"><thead><tr><th>Action</th><th>→S2a</th><th>→S2b</th></tr></thead><tbody>';
    T.forEach((row, ai) => {
      const hl = highlightT === ai;
      html += `<tr style="${hl ? 'background:rgba(96,165,250,0.15)' : ''}"><td class="q-state">a${ai + 1}</td>`;
      row.forEach((val, si) => {
        const hl2 = hl;
        const intensity = Math.max(0, Math.min(1, val));
        const bg = hl2 ? `rgba(96,165,250,${0.15 + intensity * 0.25})` : `rgba(96,165,250,${intensity * 0.25})`;
        html += `<td style="background:${bg}">${val.toFixed(3)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    // Reward table
    html += '<div class="mb-subtable"><div class="subtable-label">Reward R(s2,a)</div>';
    html += '<table class="q-table"><thead><tr><th>State</th><th>a1</th><th>a2</th></tr></thead><tbody>';
    const s2Names = ['S2a', 'S2b'];
    R.forEach((row, si) => {
      html += `<tr><td class="q-state">${s2Names[si]}</td>`;
      row.forEach((val, ai) => {
        const hl = highlightR === `${si},${ai}`;
        const intensity = Math.max(0, Math.min(1, val));
        const bg = hl ? `rgba(96,165,250,0.5)` : `rgba(96,165,250,${intensity * 0.35})`;
        const border = hl ? '2px solid #60a5fa' : '1px solid #3a4060';
        html += `<td style="background:${bg};border:${border}">${val.toFixed(3)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    html += '</div>';
    el.innerHTML = html;
  }
}

// ─── SR M matrix heatmap + w bar ─────────────────────────────────────────────

export class SRViz {
  constructor(container) {
    this.container = container;
  }

  update(M, w, highlightRow) {
    const el = document.querySelector(this.container);
    if (!el) return;

    const states = ['S1', 'S2a', 'S2b'];
    const maxM = 1.0;

    let html = '<div class="sr-container">';

    // M matrix heatmap as table
    html += '<div class="sr-matrix-wrap"><div class="subtable-label">SR Matrix M(s,s\')</div>';
    html += '<table class="q-table sr-table"><thead><tr><th>From\\ To</th>';
    states.forEach(s => html += `<th>${s}</th>`);
    html += '</tr></thead><tbody>';

    M.forEach((row, si) => {
      const hl = highlightRow === si;
      html += `<tr style="${hl ? 'outline: 2px solid #34d399;' : ''}"><td class="q-state">${states[si]}</td>`;
      row.forEach((val, sj) => {
        const intensity = Math.max(0, Math.min(1, val / maxM));
        const lightness = 20 + intensity * 50;
        const bg = `hsl(160, 60%, ${lightness}%)`;
        html += `<td style="background:${bg};color:${intensity > 0.5 ? '#0f2921' : '#e2e8f0'}">${val.toFixed(3)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    // w vector bar
    html += '<div class="sr-w-wrap"><div class="subtable-label">Reward Weights w(s)</div>';
    html += '<div class="w-bars">';
    w.forEach((val, i) => {
      const pct = Math.max(0, Math.min(100, val * 100));
      html += `<div class="w-bar-item">
        <div class="w-bar-label">${states[i]}</div>
        <div class="w-bar-track"><div class="w-bar-fill" style="width:${pct}%"></div></div>
        <div class="w-bar-val">${val.toFixed(3)}</div>
      </div>`;
    });
    html += '</div></div>';

    html += '</div>';
    el.innerHTML = html;
  }
}

// ─── Trial step log panel ─────────────────────────────────────────────────────

export class StepLogPanel {
  constructor(container) {
    this.container = container;
  }

  update(entry, algKey) {
    const el = document.querySelector(this.container);
    if (!el) return;
    if (!entry) {
      el.innerHTML = '<div class="step-placeholder">Press "Step" to advance one trial</div>';
      return;
    }

    const alg = entry[algKey];
    const u = alg.update;
    const stateNames = ['S1', 'S2a', 'S2b'];
    const outcomeNames = ['apple', 'orange'];
    const goalName = entry.goal === 0 ? 'apple' : 'orange';

    let html = `<div class="step-log">`;
    html += `<div class="step-trial">Trial ${entry.trial} | Goal: <span class="goal-badge goal-${goalName}">${goalName}</span></div>`;
    html += `<div class="step-trace">`;
    html += `<span class="step-state">${stateNames[alg.s1]}</span>`;
    html += `<span class="step-arrow">→<sub>a${alg.a1 + 1}</sub></span>`;
    html += `<span class="step-state">${stateNames[alg.s2]}</span>`;
    html += `<span class="step-arrow">→<sub>a${alg.a2 + 1}</sub></span>`;
    html += `<span class="step-reward reward-${alg.reward > 0 ? 'got' : 'miss'}">`;
    html += `${outcomeNames[alg.outcome]} (r=${alg.reward})</span>`;
    html += `</div>`;

    // Algorithm-specific equations
    if (algKey === 'mf') {
      html += `<div class="step-equations">`;
      html += `<div class="eq-line"><span class="eq-label">S2 update:</span>`;
      html += `Q(${stateNames[alg.s2]},a${alg.a2 + 1}) ← ${u.oldQ_s2.toFixed(3)} + α(r=${u.reward} − ${u.oldQ_s2.toFixed(3)})`;
      html += ` = <strong>${u.newQ_s2.toFixed(3)}</strong></div>`;
      html += `<div class="eq-line"><span class="eq-label">S1 update:</span>`;
      html += `Q(S1,a${alg.a1 + 1}) ← ${u.oldQ_s1.toFixed(3)} + α(γ·max Q(${stateNames[alg.s2]}) − ${u.oldQ_s1.toFixed(3)})`;
      html += ` = <strong>${u.newQ_s1.toFixed(3)}</strong></div>`;
      html += `<div class="eq-line"><span class="eq-label">δ(S1):</span> ${u.delta_s1.toFixed(4)} &nbsp; max Q(${stateNames[alg.s2]})=${u.maxQ_s2.toFixed(3)}</div>`;
      html += `</div>`;
    } else if (algKey === 'mb') {
      html += `<div class="step-equations">`;
      html += `<div class="eq-line"><span class="eq-label">T update:</span>`;
      html += `T(a${alg.a1 + 1},${stateNames[alg.s2]}) ← ${u.oldT[alg.s2 - 1].toFixed(3)} + 0.5×(1 − ${u.oldT[alg.s2 - 1].toFixed(3)})`;
      html += ` = <strong>${u.newT[alg.s2 - 1].toFixed(3)}</strong></div>`;
      html += `<div class="eq-line"><span class="eq-label">R update:</span>`;
      html += `R(${stateNames[alg.s2]},a${alg.a2 + 1}) ← ${u.oldR.toFixed(3)} + 0.5×(${u.reward} − ${u.oldR.toFixed(3)})`;
      html += ` = <strong>${u.newR.toFixed(3)}</strong></div>`;
      html += `<div class="eq-line"><span class="eq-label">After VI:</span>`;
      html += `Q(S1,a1)=${u.newQ_S1[0].toFixed(3)}, Q(S1,a2)=${u.newQ_S1[1].toFixed(3)}</div>`;
      html += `</div>`;
    } else if (algKey === 'sr') {
      html += `<div class="step-equations">`;
      html += `<div class="eq-line"><span class="eq-label">w update:</span>`;
      html += `w(${stateNames[alg.s2]}) ← ${u.oldW.toFixed(3)} + 0.3×(${u.reward} − ${u.oldW.toFixed(3)})`;
      html += ` = <strong>${u.newW.toFixed(3)}</strong></div>`;
      html += `<div class="eq-line"><span class="eq-label">M update (S1 row):</span>`;
      html += `M(S1,:) ← M(S1,:) + α×(I(S1) + 0.9×M(${stateNames[alg.s2]},:) − M(S1,:))</div>`;
      html += `<div class="eq-line"><span class="eq-label">New M(S1,:):</span>`;
      html += `[${u.newM_s1.map(v => v.toFixed(3)).join(', ')}]</div>`;
      html += `<div class="eq-line"><span class="eq-label">Q(S1,·):</span>`;
      html += `a1=${u.newQ_S1[0].toFixed(3)}, a2=${u.newQ_S1[1].toFixed(3)}</div>`;
      html += `</div>`;
    }

    html += '</div>';
    el.innerHTML = html;
  }
}
