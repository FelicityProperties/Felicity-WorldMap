// ═══════════════════════════════════════════════════════════
// MACRO — Global Macro Overview Cards
// ═══════════════════════════════════════════════════════════

import { macroSignals } from './data.js';

export function initMacro() {
  renderMacroCards();
}

function renderMacroCards() {
  const grid = document.getElementById('macro-grid');
  if (!grid) return;

  grid.innerHTML = macroSignals.map(signal => {
    const trendClass = signal.trend === 'up' ? 'macro-card__trend--up' : 'macro-card__trend--down';
    const trendIcon = signal.trend === 'up' ? '\u25B2' : '\u25BC';
    const sign = signal.trendPct >= 0 ? '+' : '';
    const barPct = signal.unit === '/10' ? (signal.value / 10 * 100) : Math.min(signal.value, 100);
    const barColor = signal.value >= 7 ? 'var(--semantic-red)' : signal.value >= 4 ? 'var(--semantic-amber)' : 'var(--semantic-green)';

    return `
      <div class="macro-card">
        <div class="macro-card__header">
          <div class="macro-card__label">${signal.label}</div>
          <span class="macro-card__trend ${trendClass}">${trendIcon} ${sign}${signal.trendPct.toFixed(1)}%</span>
        </div>
        <div class="macro-card__value-row">
          <span class="macro-card__value">${signal.value}</span>
          <span class="macro-card__unit">${signal.unit}</span>
        </div>
        <div class="macro-card__description">${signal.description}</div>
        <div class="macro-card__bar">
          <div class="macro-card__bar-fill" style="width:${barPct}%;background:${barColor}"></div>
        </div>
      </div>
    `;
  }).join('');
}

export function updateMacroData() {
  macroSignals.forEach(s => {
    s.trendPct = Math.round((s.trendPct + (Math.random() - 0.5) * 0.3) * 10) / 10;
    s.value = Math.round((s.value + (Math.random() - 0.5) * 0.2) * 10) / 10;
    s.trend = s.trendPct >= 0 ? 'up' : 'down';
  });
  renderMacroCards();
}
