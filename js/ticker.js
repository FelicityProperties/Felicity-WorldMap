// ═══════════════════════════════════════════════════════════
// TICKER — Market Ticker Scroll + Data Updates
// ═══════════════════════════════════════════════════════════

import { markets } from './data.js';
import { formatPrice } from './utils.js';

export function buildTicker() {
  const track = document.getElementById('ticker-track');
  if (!track) return;

  // Duplicate items for seamless scroll
  const items = [...markets, ...markets].map(m => {
    const cls = m.chg >= 0 ? 'up' : 'dn';
    const sign = m.chg >= 0 ? '+' : '';
    const val = formatPrice(m.price, m.sym);
    return `<span class="tick-item">
      <span class="tick-sym">${m.sym}</span>
      <span class="tick-val">$${val}</span>
      <span class="tick-chg ${cls}">${sign}${m.chg.toFixed(2)}%</span>
      <span class="tick-sep">\u00b7</span>
    </span>`;
  }).join('');

  track.innerHTML = items;
}

// NOTE: an earlier updateMarketData() nudged every price with Math.random()
// on a timer, fabricating movement between real refreshes. It was unused and
// has been removed. The ticker is fed only by markets-live.js, which pulls
// real prices from Yahoo Finance and CoinGecko via /api/markets.
