// ═══════════════════════════════════════════════════════════
// PORTFOLIO — real holdings, live prices, honest P&L
// ═══════════════════════════════════════════════════════════
//
// The user enters what they actually hold — symbol, quantity, average
// cost — and every number derived from it is computed from a live quote
// fetched at render time. Nothing is estimated: a position whose quote
// cannot be fetched shows "unavailable" and is EXCLUDED from the totals,
// and the totals line says how many positions it actually covers.
//
// PRIVACY: holdings live in this browser's localStorage only. They are
// never sent to any server — the only thing that leaves the page is the
// list of symbols being priced, which is the same request the watchlist
// already makes.
// ═══════════════════════════════════════════════════════════

import { findAsset } from './invest-data.js';
import { escapeHtml } from './safe.js';

const esc = escapeHtml;
const STORE_KEY = 'fi_portfolio';
const MAX_POSITIONS = 50;

// ── Storage ──
export function getHoldings() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(h =>
      h && typeof h.symbol === 'string' &&
      Number.isFinite(h.qty) && h.qty > 0 &&
      Number.isFinite(h.cost) && h.cost >= 0
    ).slice(0, MAX_POSITIONS);
  } catch { return []; }
}

function saveHoldings(list) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, MAX_POSITIONS))); } catch { /* quota */ }
}

/**
 * Validate and add a position. Returns { ok } or { ok:false, error }.
 * Adding a symbol already held averages the costs — the way a broker would —
 * rather than creating a duplicate row.
 */
export function addHolding(symbolRaw, qtyRaw, costRaw) {
  const symbol = String(symbolRaw || '').trim().toUpperCase();
  const qty = Number(qtyRaw);
  const cost = Number(costRaw);

  if (!symbol) return { ok: false, error: 'Enter a symbol.' };
  const known = findAsset(symbol);
  if (!known && !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) {
    return { ok: false, error: `"${symbol}" does not look like a valid symbol.` };
  }
  // A yield index is a number, not a thing you can own
  if (known && known.class === 'bonds' && known.kind === 'yield') {
    return { ok: false, error: `${symbol} is a yield index — it cannot be held. Use the ETFs (BIL, SHY, IEF, TLT) to hold Treasuries.` };
  }
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: 'Quantity must be a positive number.' };
  if (!Number.isFinite(cost) || cost < 0) return { ok: false, error: 'Average cost must be zero or more.' };

  const list = getHoldings();
  const existing = list.find(h => h.symbol === symbol);
  if (existing) {
    const totalQty = existing.qty + qty;
    existing.cost = (existing.qty * existing.cost + qty * cost) / totalQty;
    existing.qty = totalQty;
  } else {
    if (list.length >= MAX_POSITIONS) return { ok: false, error: `Portfolio is capped at ${MAX_POSITIONS} positions.` };
    list.push({ symbol, qty, cost });
  }
  saveHoldings(list);
  return { ok: true };
}

export function removeHolding(symbol) {
  saveHoldings(getHoldings().filter(h => h.symbol !== symbol));
}

// ── Math (pure — covered by tests) ──
export function computeRow(holding, quote) {
  const cost = holding.qty * holding.cost;
  if (!quote || quote.price == null || isNaN(quote.price)) {
    return { symbol: holding.symbol, qty: holding.qty, avgCost: holding.cost, cost, priced: false };
  }
  const mv = holding.qty * quote.price;
  const pl = mv - cost;
  return {
    symbol: holding.symbol,
    qty: holding.qty,
    avgCost: holding.cost,
    cost,
    priced: true,
    price: quote.price,
    mv,
    pl,
    plPct: cost > 0 ? (pl / cost) * 100 : null,
    dayPl: quote.change != null && !isNaN(quote.change) ? holding.qty * quote.change : null,
  };
}

export function computeTotals(rows) {
  const priced = rows.filter(r => r.priced);
  const cost = priced.reduce((s, r) => s + r.cost, 0);
  const mv = priced.reduce((s, r) => s + r.mv, 0);
  const pl = mv - cost;
  const dayRows = priced.filter(r => r.dayPl != null);
  return {
    positions: rows.length,
    priced: priced.length,
    cost, mv, pl,
    plPct: cost > 0 ? (pl / cost) * 100 : null,
    dayPl: dayRows.length ? dayRows.reduce((s, r) => s + r.dayPl, 0) : null,
    dayCovers: dayRows.length,
  };
}

// ── Formatting (self-contained: this module must not import invest.js) ──
function money(v, d = 2) {
  if (v == null || isNaN(v)) return '—';
  const abs = Math.abs(v);
  // A sub-dollar unit price needs more precision or it rounds to a lie
  const digits = abs > 0 && abs < 1 ? 4 : d;
  const sign = v < 0 ? '-' : '';
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function signedMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `${v >= 0 ? '+' : ''}${money(v)}`;
}

function signedPct(v) {
  if (v == null || isNaN(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

const tone = v => (v == null || isNaN(v)) ? '' : v >= 0 ? 'up' : 'dn';

// ── Quotes: batched, briefly cached ──
const quoteCache = {};
const TTL = 60000;

async function fetchQuotes(symbols) {
  const out = {};
  const need = [];
  for (const s of symbols) {
    const c = quoteCache[s];
    if (c && Date.now() - c.ts < TTL) out[s] = c.data;
    else need.push(s);
  }
  for (let i = 0; i < need.length; i += 4) {
    const batch = need.slice(i, i + 4);
    const settled = await Promise.allSettled(batch.map(async s => {
      const r = await fetch(`/api/invest/quote?symbol=${encodeURIComponent(s)}`);
      const d = await r.json();
      if (!d.ok || !d.quote) throw new Error(d.error || 'unavailable');
      return d.quote;
    }));
    settled.forEach((res, idx) => {
      if (res.status === 'fulfilled') {
        out[batch[idx]] = res.value;
        quoteCache[batch[idx]] = { data: res.value, ts: Date.now() };
      }
    });
  }
  return out;
}

// ── Renderer ──
// Mounts into the host the cockpit hands it. `onSelect(symbol)` opens the
// instrument detail so a row click drills into chart, news and the bot.
let renderSeq = 0;

export async function renderPortfolio(host, onSelect) {
  if (!host) return;
  const seq = ++renderSeq;
  const holdings = getHoldings();

  host.innerHTML = `
    <div class="tool">
      <div class="tool__head">
        <div>
          <div class="tool__title">Portfolio</div>
          <div class="tool__sub">Your positions marked to the live market. Stored in this browser only —
            holdings are never sent to any server.</div>
        </div>
        <span class="tool__src">live quotes</span>
      </div>

      <form class="pf-add" id="pf-add">
        <input class="tool__input pf-add__sym" id="pf-sym" placeholder="Symbol — AAPL, BTC, TLT" maxlength="10" autocomplete="off">
        <input class="tool__input pf-add__num" id="pf-qty" type="number" min="0" step="any" placeholder="Quantity">
        <input class="tool__input pf-add__num" id="pf-cost" type="number" min="0" step="any" placeholder="Avg cost (USD)">
        <button class="tool__run pf-add__btn" type="submit">Add</button>
      </form>
      <div class="pf-error" id="pf-error" style="display:none"></div>

      <div class="tool__out" id="pf-out">${holdings.length ? '<div class="tool__loading">Pricing your positions…</div>'
        : `<div class="tool__empty">No positions yet. Add what you hold — quantity and your average cost —
           and it is marked to the live market on every visit.</div>`}</div>
    </div>`;

  host.querySelector('#pf-add').addEventListener('submit', e => {
    e.preventDefault();
    const errEl = host.querySelector('#pf-error');
    const res = addHolding(
      host.querySelector('#pf-sym').value,
      host.querySelector('#pf-qty').value,
      host.querySelector('#pf-cost').value,
    );
    if (!res.ok) {
      errEl.textContent = res.error;   // textContent — never markup
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';
    renderPortfolio(host, onSelect);
  });

  if (!holdings.length) return;
  const out = host.querySelector('#pf-out');

  const quotes = await fetchQuotes(holdings.map(h => h.symbol));

  // The user may have navigated away, or a newer render (an added or
  // removed position) may have superseded this one while quotes were in
  // flight — a stale continuation must never paint over fresher state.
  if (seq !== renderSeq || !host.querySelector('#pf-out')) return;

  const rows = holdings.map(h => computeRow(h, quotes[h.symbol]));
  const t = computeTotals(rows);

  out.innerHTML = `
    <div class="pf-table">
      <div class="pf-table__head">
        <span>Symbol</span><span>Qty</span><span>Avg cost</span><span>Price</span>
        <span>Value</span><span>P&amp;L</span><span>Day</span><span></span>
      </div>
      ${rows.map(r => {
        const a = findAsset(r.symbol);
        return `
        <div class="pf-table__row" data-symbol="${esc(r.symbol)}">
          <span class="pf-table__sym">${esc(r.symbol)}<em>${esc(a ? a.name : 'not in universe')}</em></span>
          <span>${r.qty.toLocaleString('en-US', { maximumFractionDigits: 8 })}</span>
          <span>${money(r.avgCost)}</span>
          <span>${r.priced ? money(r.price) : '<em class="pf-na">unavailable</em>'}</span>
          <span>${r.priced ? money(r.mv) : '—'}</span>
          <span class="${tone(r.pl)}">${r.priced ? `${signedMoney(r.pl)}<em>${signedPct(r.plPct)}</em>` : '—'}</span>
          <span class="${tone(r.dayPl)}">${r.priced ? signedMoney(r.dayPl) : '—'}</span>
          <button class="pf-table__del" data-del="${esc(r.symbol)}" title="Remove position">&times;</button>
        </div>`;
      }).join('')}
      <div class="pf-table__total">
        <span>Total</span><span></span>
        <span>${money(t.cost)}</span><span></span>
        <span>${money(t.mv)}</span>
        <span class="${tone(t.pl)}">${signedMoney(t.pl)}<em>${signedPct(t.plPct)}</em></span>
        <span class="${tone(t.dayPl)}">${signedMoney(t.dayPl)}</span><span></span>
      </div>
    </div>
    <div class="tool__method">
      ${t.priced === t.positions
        ? `All ${t.positions} ${t.positions === 1 ? 'position' : 'positions'} priced live.`
        : `Totals cover ${t.priced} of ${t.positions} positions — ${t.positions - t.priced} quote${t.positions - t.priced === 1 ? '' : 's'} unavailable right now and excluded rather than estimated.`}
      ${t.dayPl != null && t.dayCovers < t.priced ? `Day P&amp;L covers ${t.dayCovers} position${t.dayCovers === 1 ? '' : 's'}.` : ''}
      All figures USD. Cost basis is what you entered; the market side is fetched at render time.
    </div>`;

  out.querySelectorAll('.pf-table__row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('[data-del]')) return;
      if (onSelect) onSelect(row.dataset.symbol);
    });
  });
  out.querySelectorAll('[data-del]').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      removeHolding(b.dataset.del);
      renderPortfolio(host, onSelect);
    });
  });
}
