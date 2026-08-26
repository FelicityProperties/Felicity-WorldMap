// ═══════════════════════════════════════════════════════════
// MACRO — Global Macro Overview Cards
// ═══════════════════════════════════════════════════════════
//
// Two of these signals are directly measurable market data and are
// fetched LIVE: USD Strength (DXY) and Market Volatility (VIX).
//
// The other four — Global Risk Index, Capital Flow Pressure, Commodity
// Pressure, Geopolitical Tension — are Felicity desk composites. They
// are not measurable market prices, so they carry a "desk" marker and
// are never presented as measured evidence.
//
// Nothing here drifts randomly. An earlier version nudged these values
// with Math.random() on a timer, which fabricated movement; that has
// been removed. A value either comes from a live feed or it is a stated
// desk assessment.
// ═══════════════════════════════════════════════════════════

import { macroSignals } from './data.js';
import { escapeHtml } from './safe.js';

// Signals that map to a real, quotable instrument
const LIVE_SIGNALS = {
  usd:        { symbol: 'DXY', label: 'DXY' },
  volatility: { symbol: 'VIX', label: 'VIX' },
};

const liveValues = {};

export function initMacro() {
  renderMacroCards();
  refreshLiveSignals();
}

const esc = escapeHtml;

function renderMacroCards() {
  const grid = document.getElementById('macro-grid');
  if (!grid) return;

  grid.innerHTML = macroSignals.map(signal => {
    const live = liveValues[signal.id];
    const isLive = Boolean(LIVE_SIGNALS[signal.id]);

    const value = live ? live.value : signal.value;
    const trendPct = live ? live.changePct : signal.trendPct;
    const up = trendPct >= 0;
    const trendClass = up ? 'macro-card__trend--up' : 'macro-card__trend--down';
    const trendIcon = up ? '▲' : '▼';
    const sign = up ? '+' : '';

    const barPct = signal.unit === '/10' ? (value / 10 * 100) : Math.min(value, 100);
    const barColor = value >= 7 ? 'var(--semantic-red)' : value >= 4 ? 'var(--semantic-amber)' : 'var(--semantic-green)';

    // Provenance marker — live feed versus desk assessment
    const marker = isLive
      ? (live
          ? '<span class="macro-src macro-src--live" title="Live market price">live</span>'
          : '<span class="macro-src" title="Fetching live price…">…</span>')
      : '<span class="macro-src" title="Felicity desk composite — not a measured market price">desk</span>';

    const shownTrend = (isLive && !live) ? '—' : `${sign}${Number(trendPct).toFixed(1)}%`;

    return `
      <div class="macro-card">
        <div class="macro-card__header">
          <div class="macro-card__label">${esc(signal.label)}${marker}</div>
          <span class="macro-card__trend ${trendClass}">${trendIcon} ${shownTrend}</span>
        </div>
        <div class="macro-card__value-row">
          <span class="macro-card__value">${typeof value === 'number' ? value.toFixed(1) : value}</span>
          <span class="macro-card__unit">${esc(signal.unit)}</span>
        </div>
        <div class="macro-card__description">${esc(signal.description)}</div>
        <div class="macro-card__bar">
          <div class="macro-card__bar-fill" style="width:${barPct}%;background:${barColor}"></div>
        </div>
      </div>
    `;
  }).join('');
}

// Pull the two measurable signals from the live quote endpoint
async function refreshLiveSignals() {
  const entries = Object.entries(LIVE_SIGNALS);

  await Promise.allSettled(entries.map(async ([id, { symbol }]) => {
    try {
      const r = await fetch(`/api/invest/quote?symbol=${encodeURIComponent(symbol)}`);
      const d = await r.json();
      if (d.ok && d.quote && d.quote.price != null) {
        liveValues[id] = { value: d.quote.price, changePct: d.quote.changePct ?? 0 };
      }
    } catch { /* leave the desk value in place and keep the '…' marker */ }
  }));

  renderMacroCards();
}

// Re-pull the live signals. Never invents movement — if the fetch fails
// the previous live value simply stands.
export function updateMacroData() {
  refreshLiveSignals();
}
