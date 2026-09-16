// ═══════════════════════════════════════════════════════════
// TICKER — Market Ticker Scroll
// ═══════════════════════════════════════════════════════════
//
// Renders only instruments that carry a price from a real fetch. Before
// the first fetch lands — or if every fetch fails — the track says so in
// words rather than scrolling seeded numbers under the LIVE badge, which
// is what an earlier build did (gold at $3,234 while the tape said $4,300).
// ═══════════════════════════════════════════════════════════

import { markets } from './data.js';
import { formatPrice } from './utils.js';

export function buildTicker() {
  const track = document.getElementById('ticker-track');
  if (!track) return;

  const priced = markets.filter(m => m.live && typeof m.price === 'number' && Number.isFinite(m.price));
  if (!priced.length) {
    track.innerHTML = '<span class="tick-item tick-item--empty">Awaiting live prices — nothing is shown until a real quote arrives</span>';
    return;
  }

  // Duplicate items for seamless scroll
  const items = [...priced, ...priced].map(m => {
    const chg = Number.isFinite(m.chg) ? m.chg : 0;
    const cls = chg >= 0 ? 'up' : 'dn';
    const sign = chg >= 0 ? '+' : '';
    const val = formatPrice(m.price, m.sym);
    return `<span class="tick-item">
      <span class="tick-sym">${m.sym}</span>
      <span class="tick-val">$${val}</span>
      <span class="tick-chg ${cls}">${sign}${chg.toFixed(2)}%</span>
      <span class="tick-sep">·</span>
    </span>`;
  }).join('');

  track.innerHTML = items;
}

// NOTE: an earlier updateMarketData() nudged every price with Math.random()
// on a timer, fabricating movement between real refreshes. It was unused and
// has been removed. The ticker is fed only by markets-live.js, which pulls
// real prices from Yahoo Finance and CoinGecko via /api/markets.
