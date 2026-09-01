// ═══════════════════════════════════════════════════════════
// INVEST — The Investing Cockpit
// ═══════════════════════════════════════════════════════════
//
// Browse a multi-asset universe, pull the live price and the last
// 7 days of real news for any instrument, and ask Felicity Bot for a
// positioned call grounded in that evidence.
// ═══════════════════════════════════════════════════════════

import { investUniverse, assetsByClass, findAsset, ASSET_CLASSES } from './invest-data.js';
import {
  getWatchlist, isWatched, toggleWatch, clearWatchlist,
  getProfile, hasProfile, profileSummary, openProfileModal,
} from './invest-profile.js';
import { mountTickerTape, mountHeatmap, mountCryptoHeatmap, mountEconomicCalendar, mountBondDesk } from './tv-widgets.js';
import { hasFundamentals, loadFundamentals, exportBrief } from './equity-fundamentals.js';
import { renderPortfolio } from './portfolio.js';
import { escapeHtml, safeUrl } from './safe.js';

let currentClass = 'all';
let showWatchlist = false;
let search = '';
let selected = null;
let quoteCache = {};
let fundamentalsFor = null;

const QUOTE_TTL = 45000;

let tapeMounted = false;

export function initInvest() {
  renderShell();
  renderList();
  bindFullscreenEscape();
}

// Leaving the Invest tab while a market view is fullscreen used to strand
// body.tv-fullscreen-open, which sets overflow:hidden — the overlay itself is
// hidden along with its panel, but the whole page stayed unscrollable.
export function onInvestHidden() {
  exitMarketFullscreen();
  const btn = document.getElementById('tv-expand');
  if (btn) btn.textContent = 'Fullscreen';
}

// The Invest panel is display:none at boot. A TradingView widget mounted into
// a hidden container measures 0x0 and stays blank even once shown, so the
// ticker tape is mounted the first time the tab is actually revealed.
export function onInvestShown() {
  if (tapeMounted) return;
  // switchTab flips the panel class in the same tick, so wait a frame for
  // layout to flush before measuring whether the host is really visible.
  requestAnimationFrame(() => {
    if (tapeMounted) return;
    const host = document.getElementById('invest-tape');
    if (!host || !host.offsetParent) return;  // genuinely still hidden
    mountTickerTape('invest-tape');
    tapeMounted = true;
  });
}

// Escapes quotes too, so it is safe inside a quoted attribute.
const esc = escapeHtml;

function fmtPrice(v, cls) {
  if (v == null || isNaN(v)) return '—';
  if (cls === 'forex') return Number(v).toFixed(4);
  if (v >= 1000) return Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (v < 1) return Number(v).toFixed(4);
  return Number(v).toFixed(2);
}

// TradingView's advanced-chart embed does not license index and commodity
// feeds (SP:SPX, DJ:DJI, TVC:GOLD…) — the iframe simply stays blank, the
// same gap that emptied the Bond Desk's US group. Anything on those feeds
// gets a chart drawn by us from real Yahoo daily closes instead. Stocks,
// crypto and the bond ETFs stay on TradingView, whose exchange/COINBASE
// feeds embed fine.
function usesOwnChart(a) {
  return isYield(a) || a.class === 'indices' || a.class === 'commodities';
}

// Bond yield instruments: value is a rate, daily move is basis points.
function isYield(a) { return a && a.class === 'bonds' && a.kind === 'yield'; }

function fmtYield(v) {
  if (v == null || isNaN(v)) return '\u2014';
  return `${Number(v).toFixed(2)}%`;
}

function fmtBp(change) {
  if (change == null || isNaN(change)) return '\u2014';
  const bp = change * 100;
  return `${bp >= 0 ? '+' : ''}${bp.toFixed(1)} bp`;
}

function fmtPct(v) {
  if (v == null || isNaN(v)) return '—';
  return `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
}

function fmtBig(v) {
  if (v == null || isNaN(v)) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

// ── Shell ──
function renderShell() {
  const el = document.getElementById('invest-root');
  if (!el) return;

  const tabs = Object.entries(ASSET_CLASSES).map(([k, v]) => {
    const n = k === 'all' ? investUniverse.length : assetsByClass(k).length;
    return `<button class="invest-class-btn${k === currentClass ? ' active' : ''}" data-class="${k}">
      <span class="invest-class-btn__icon">${v.icon}</span>${v.label}
      <span class="invest-class-btn__n">${n}</span>
    </button>`;
  }).join('');

  el.innerHTML = `
    <div class="tv-tape tradingview-widget-container" id="invest-tape"><div class="tradingview-widget-container__widget"></div></div>
    <div class="invest-topbar">
      <button class="invest-watch-toggle" id="invest-watch-toggle">
        <span class="invest-star">★</span> Watchlist
        <span class="invest-class-btn__n" id="invest-watch-count">${getWatchlist().length}</span>
      </button>
      <button class="invest-profile-chip" id="invest-profile-chip">
        <span class="invest-profile-chip__label">Investor profile</span>
        <span class="invest-profile-chip__value" id="invest-profile-value">${esc(profileSummary(getProfile()))}</span>
      </button>
    </div>
    <div class="invest-controls">
      <input type="search" class="dubai-search invest-search" id="invest-search" placeholder="Search 600+ assets — AAPL, Samsung, Bitcoin, Gold, EURUSD, KOSPI...">
      <div class="invest-classes" id="invest-classes">${tabs}</div>
    </div>
    <div class="invest-views" id="invest-views">
      <button class="invest-view-btn" data-view="portfolio">Portfolio</button>
      <button class="invest-view-btn" data-view="screener">Screener</button>
      <button class="invest-view-btn" data-view="backtest">Backtest</button>
      <button class="invest-view-btn" data-view="bonds">Bond Desk</button>
      <button class="invest-view-btn" data-view="heatmap">S&amp;P 500 Heatmap</button>
      <button class="invest-view-btn" data-view="crypto">Crypto Heatmap</button>
      <button class="invest-view-btn" data-view="calendar">Economic Calendar</button>
    </div>
    <div class="invest-layout">
      <div class="invest-list" id="invest-list"></div>
      <div class="invest-detail" id="invest-detail">
        <div class="invest-detail__empty">
          <div class="invest-detail__empty-icon">◆</div>
          <h3>Select an instrument</h3>
          <p>Live price, the last 7 days of real news, and a positioned call from Felicity Bot — grounded only in that evidence.</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('invest-search').addEventListener('input', e => {
    search = e.target.value.trim().toLowerCase();
    renderList();
  });

  document.getElementById('invest-classes').addEventListener('click', e => {
    const b = e.target.closest('.invest-class-btn');
    if (!b) return;
    currentClass = b.dataset.class;
    showWatchlist = false;
    document.getElementById('invest-watch-toggle').classList.remove('active');
    document.querySelectorAll('.invest-class-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    renderList();
  });

  document.getElementById('invest-watch-toggle').addEventListener('click', () => {
    showWatchlist = !showWatchlist;
    document.getElementById('invest-watch-toggle').classList.toggle('active', showWatchlist);
    if (showWatchlist) document.querySelectorAll('.invest-class-btn').forEach(x => x.classList.remove('active'));
    else document.querySelector('.invest-class-btn[data-class="' + currentClass + '"]')?.classList.add('active');
    renderList();
  });

  document.getElementById('invest-views').addEventListener('click', e => {
    const b = e.target.closest('.invest-view-btn');
    if (!b) return;
    document.querySelectorAll('.invest-view-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const v = b.dataset.view;
    if (v === 'screener') renderScreener();
    else if (v === 'backtest') renderBacktester();
    else if (v === 'portfolio') renderPortfolioView();
    else showMarketView(v);
  });

  document.getElementById('invest-profile-chip').addEventListener('click', () => {
    openProfileModal(p => {
      document.getElementById('invest-profile-value').textContent = profileSummary(p);
    });
  });
}

function refreshWatchCount() {
  const el = document.getElementById('invest-watch-count');
  if (el) el.textContent = getWatchlist().length;
}


// On narrow screens the detail pane sits below the list, so a tap can look
// like nothing happened. Bring the result into view.
function revealDetail() {
  if (window.innerWidth > 767) return;
  const el = document.getElementById('invest-detail');
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// ── Instrument list ──
function filtered() {
  if (showWatchlist) {
    const w = getWatchlist();
    return w.map(sym => findAsset(sym)).filter(Boolean);
  }
  let list = assetsByClass(currentClass);
  if (search) {
    list = list.filter(a =>
      a.symbol.toLowerCase().includes(search) ||
      a.name.toLowerCase().includes(search) ||
      (a.sector || '').toLowerCase().includes(search)
    );
  }
  return list.slice(0, 160);
}

// Auto-price small lists (the bonds class is 8 rows) so they show live
// numbers on sight instead of dots-until-clicked. Large lists still price
// lazily — 160 parallel quotes would just burn the rate limit.
const AUTOQUOTE_MAX = 12;
let autoquoteRun = 0;

async function autoquote(list) {
  const run = ++autoquoteRun;
  const need = list.filter(a => {
    const c = quoteCache[a.symbol];
    return !c || Date.now() - c.ts >= QUOTE_TTL;
  });
  for (let i = 0; i < need.length; i += 4) {
    if (run !== autoquoteRun) return;   // list changed under us
    const batch = need.slice(i, i + 4);
    await Promise.allSettled(batch.map(async a => {
      try {
        const r = await fetch(`/api/invest/quote?symbol=${encodeURIComponent(a.symbol)}`);
        const d = await r.json();
        // A failure is cached as null for one TTL — without this, the
        // re-render after each pass would re-trigger autoquote and a dead
        // feed would be hammered in a loop.
        quoteCache[a.symbol] = { data: d.ok && d.quote ? d.quote : null, ts: Date.now() };
      } catch {
        quoteCache[a.symbol] = { data: null, ts: Date.now() };
      }
    }));
  }
  if (run === autoquoteRun) renderList();
}

function renderList() {
  const el = document.getElementById('invest-list');
  if (!el) return;
  const list = filtered();

  if (!list.length) {
    el.innerHTML = showWatchlist
      ? '<div class="dubai-empty">Your watchlist is empty — tap the ★ on any instrument to add it.</div>'
      : '<div class="dubai-empty">No instruments match your search</div>';
    return;
  }

  const sweepBar = showWatchlist ? `
    <div class="invest-sweepbar">
      <button class="invest-sweepbar__run" id="invest-sweep-run">Sweep ${list.length} →</button>
      <button class="invest-sweepbar__news" id="invest-sweep-news">Daily news</button>
      <button class="invest-sweepbar__clear" id="invest-sweep-clear">Clear</button>
    </div>` : '';

  el.innerHTML = sweepBar + list.map(a => {
    const c = quoteCache[a.symbol];
    const q = c && Date.now() - c.ts < QUOTE_TTL ? c.data : null;
    const cls = q ? (q.changePct >= 0 ? 'up' : 'dn') : '';
    return `
      <div class="invest-row${a.symbol === selected ? ' is-active' : ''}" data-symbol="${esc(a.symbol)}">
        <button class="invest-row__star${isWatched(a.symbol) ? ' is-on' : ''}" data-star="${esc(a.symbol)}" title="Toggle watchlist">★</button>
        <div class="invest-row__sym">${esc(a.symbol)}</div>
        <div class="invest-row__name">${esc(a.name)}</div>
        <div class="invest-row__class"><span class="invest-tag invest-tag--${a.class}">${ASSET_CLASSES[a.class].label}</span></div>
        <div class="invest-row__price">${q ? (isYield(a) ? fmtYield(q.price) : fmtPrice(q.price, a.class)) : '<span class="invest-row__dim">·</span>'}</div>
        <div class="invest-row__chg ${cls}">${q ? (isYield(a) ? fmtBp(q.change) : fmtPct(q.changePct)) : ''}</div>
      </div>`;
  }).join('');

  el.querySelectorAll('.invest-row').forEach(r => {
    r.addEventListener('click', e => {
      if (e.target.closest('[data-star]')) return;
      selectAsset(r.dataset.symbol);
    });
  });

  if (list.length <= AUTOQUOTE_MAX && list.some(a => {
    const c = quoteCache[a.symbol];
    return !c || Date.now() - c.ts >= QUOTE_TTL;
  })) autoquote(list);

  document.getElementById('invest-sweep-run')?.addEventListener('click', runSweep);
  document.getElementById('invest-sweep-news')?.addEventListener('click', runWatchlistNews);
  document.getElementById('invest-sweep-clear')?.addEventListener('click', () => {
    clearWatchlist();
    refreshWatchCount();
    renderList();
  });

  el.querySelectorAll('[data-star]').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      toggleWatch(b.dataset.star);
      refreshWatchCount();
      renderList();
    });
  });
}

// ── Full-width market views: heatmaps and the economic calendar ──
const MARKET_VIEWS = {
  heatmap: {
    title: 'S&P 500 Heatmap',
    sub: 'Every constituent grouped by sector, sized by market cap, coloured by today\u2019s move.',
    mount: host => mountHeatmap(host, 'SPX500'),
  },
  crypto: {
    title: 'Crypto Heatmap',
    sub: 'The crypto universe sized by market cap, coloured by 24-hour move.',
    mount: host => mountCryptoHeatmap(host),
  },
  bonds: {
    title: 'Bond Desk',
    sub: 'US Treasury curve priced by our live feed; Japan and Asia-Pacific yields streamed by TradingView. TradingView does not license its US yield symbols for embedding, so those come from our own data.',
    mount: host => mountBondDesk(host),
  },
  calendar: {
    title: 'Economic Calendar',
    sub: 'Real scheduled macro releases across the US, eurozone, UK, Japan, China, Germany, UAE, India and Korea.',
    mount: host => mountEconomicCalendar(host),
  },
};

// A treemap of 500 constituents squeezed into the detail column beside a
// 400px instrument list is unreadable — the blocks collapse to slivers and
// the labels vanish. A market view therefore takes the FULL width of the
// panel (the list is hidden while one is open) and can go fullscreen.
let currentMarketView = null;

function showMarketView(view) {
  const meta = MARKET_VIEWS[view];
  const el = document.getElementById('invest-detail');
  if (!meta || !el) return;

  selected = null;
  currentMarketView = view;
  document.querySelectorAll('.invest-row').forEach(r => r.classList.remove('is-active'));
  document.querySelector('.invest-layout')?.classList.add('is-market-view');

  el.innerHTML = `
    <div class="tv-view">
      <div class="tv-view__head">
        <div>
          <div class="tv-view__title">${esc(meta.title)}</div>
          <div class="tv-view__sub">${esc(meta.sub)}</div>
        </div>
        <div class="tv-view__actions">
          <button class="tv-view__expand" id="tv-expand">Fullscreen</button>
          <button class="tv-view__back" id="tv-back">Back to list</button>
          <span class="tv-view__src">TradingView</span>
        </div>
      </div>
      <div class="tv-view__body tradingview-widget-container" id="tv-view-host">
        <div class="tradingview-widget-container__widget"></div>
      </div>
    </div>`;

  meta.mount('tv-view-host');
  revealDetail();

  document.getElementById('tv-expand').addEventListener('click', toggleMarketFullscreen);
  document.getElementById('tv-back').addEventListener('click', closeMarketView);
}

// Any panel that replaces a market view has to give the instrument list its
// column back, and must not leave a fullscreen overlay stranded on screen.
function leaveMarketView() {
  exitMarketFullscreen();
  currentMarketView = null;
  document.querySelector('.invest-layout')?.classList.remove('is-market-view');
}

function closeMarketView() {
  exitMarketFullscreen();
  currentMarketView = null;
  document.querySelector('.invest-layout')?.classList.remove('is-market-view');
  document.querySelectorAll('.invest-view-btn').forEach(x => x.classList.remove('active'));
  const el = document.getElementById('invest-detail');
  if (el) {
    el.innerHTML = `
      <div class="invest-detail__empty">
        <div class="invest-detail__empty-icon">◆</div>
        <h3>Select an instrument</h3>
        <p>Live price, the last 7 days of real news, and a positioned call from Felicity Bot — grounded only in that evidence.</p>
      </div>`;
  }
}

function toggleMarketFullscreen() {
  const view = document.querySelector('.tv-view');
  if (!view) return;
  const on = !view.classList.contains('is-fullscreen');
  view.classList.toggle('is-fullscreen', on);
  document.body.classList.toggle('tv-fullscreen-open', on);
  document.getElementById('tv-expand').textContent = on ? 'Exit fullscreen' : 'Fullscreen';

  // The TradingView iframe sizes itself when it loads, so growing the box
  // around it leaves the old dimensions baked in. Re-mount at the new size.
  const meta = MARKET_VIEWS[currentMarketView];
  if (meta) requestAnimationFrame(() => meta.mount('tv-view-host'));
}

function exitMarketFullscreen() {
  const view = document.querySelector('.tv-view.is-fullscreen');
  if (!view) return;
  view.classList.remove('is-fullscreen');
  document.body.classList.remove('tv-fullscreen-open');
}

// Esc leaves fullscreen — a panel that covers the viewport needs a way out
// that does not depend on finding a small button. Bound in initInvest, not at
// module scope: a module that touches `document` on import cannot be loaded
// outside a browser, and the API endpoints share this folder.
function bindFullscreenEscape() {
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!document.querySelector('.tv-view.is-fullscreen')) return;
    exitMarketFullscreen();
    const btn = document.getElementById('tv-expand');
    if (btn) btn.textContent = 'Fullscreen';
    const meta = MARKET_VIEWS[currentMarketView];
    if (meta) requestAnimationFrame(() => meta.mount('tv-view-host'));
  });
}

// ── Daily news across the whole watchlist, in one consolidated feed ──
async function runWatchlistNews() {
  const list = getWatchlist().map(s => findAsset(s)).filter(Boolean);
  const el = document.getElementById('invest-detail');
  if (!list.length) return;

  el.innerHTML = `
    <div class="sweep">
      <div class="sweep__head">
        <div>
          <div class="sweep__title">Watchlist News</div>
          <div class="sweep__sub">Last 7 days across ${list.length} ${list.length === 1 ? 'holding' : 'holdings'}, newest first.</div>
        </div>
        <div class="sweep__progress" id="wnews-progress">0 / ${list.length}</div>
      </div>
      <div class="wnews" id="wnews-body"></div>
    </div>`;

  revealDetail();
  const body = document.getElementById('wnews-body');
  const prog = document.getElementById('wnews-progress');
  let done = 0;
  const results = [];

  // Fetch in small batches so we stay well inside the endpoint rate limit
  for (let i = 0; i < list.length; i += 4) {
    const batch = list.slice(i, i + 4);
    const settled = await Promise.allSettled(batch.map(async asset => {
      const r = await fetch(`/api/invest/news?symbol=${encodeURIComponent(asset.symbol)}`);
      const d = await r.json();
      return { asset, items: d.items || [], error: d.error };
    }));

    settled.forEach((s, idx) => {
      results.push(s.status === 'fulfilled'
        ? s.value
        : { asset: batch[idx], items: [], error: s.reason?.message || 'unavailable' });
      done++;
    });

    prog.textContent = `${done} / ${list.length}`;
    render();
  }

  prog.textContent = `${done} / ${list.length} complete`;

  function render() {
    // Newest story first, so the busiest names surface at the top
    const sorted = [...results].sort((a, b) => {
      const at = a.items[0]?.datetime || 0;
      const bt = b.items[0]?.datetime || 0;
      return bt - at;
    });

    body.innerHTML = sorted.map(({ asset, items, error }) => {
      if (!items.length) {
        return `<div class="wnews__group wnews__group--empty">
          <div class="wnews__sym">${esc(asset.symbol)}</div>
          <div class="wnews__none">No news in the last 7 days${error ? ` — ${esc(error)}` : ''}.</div>
        </div>`;
      }
      return `<div class="wnews__group">
        <div class="wnews__group-head">
          <span class="wnews__sym">${esc(asset.symbol)}</span>
          <span class="wnews__name">${esc(asset.name)}</span>
          <span class="wnews__count">${items.length}</span>
        </div>
        ${items.slice(0, 5).map(n => {
          const when = n.datetime
            ? new Date(n.datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '';
          return `<a class="wnews__item" href="${safeUrl(n.url)}" target="_blank" rel="noopener">
            <div class="wnews__item-meta">
              <span class="wnews__item-src">${esc(n.source)}</span>
              <span class="wnews__item-date">${esc(when)}</span>
            </div>
            <div class="wnews__item-title">${esc(n.headline)}</div>
          </a>`;
        }).join('')}
      </div>`;
    }).join('');
  }
}

// ── Watchlist sweep: analyse every held name in one pass ──
async function runSweep() {
  const list = getWatchlist().map(s => findAsset(s)).filter(Boolean);
  const el = document.getElementById('invest-detail');
  if (!list.length) return;

  el.innerHTML = `
    <div class="sweep">
      <div class="sweep__head">
        <div>
          <div class="sweep__title">Watchlist Sweep</div>
          <div class="sweep__sub">Felicity Bot is working through ${list.length} ${list.length === 1 ? 'name' : 'names'}, one live pull each.</div>
        </div>
        <div class="sweep__progress" id="sweep-progress">0 / ${list.length}</div>
      </div>
      <div class="sweep__list" id="sweep-list"></div>
    </div>`;

  revealDetail();
  const out = document.getElementById('sweep-list');
  const prog = document.getElementById('sweep-progress');
  const profile = getProfile();
  let done = 0;

  for (const asset of list) {
    const card = document.createElement('div');
    card.className = 'sweep__item';
    card.innerHTML = `<div class="sweep__item-sym">${esc(asset.symbol)}</div>
      <div class="sweep__item-body"><span class="sweep__pending">analysing…</span></div>`;
    out.appendChild(card);

    try {
      const r = await fetch('/api/invest/advise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: asset.symbol, profile }),
      });
      const d = await r.json();
      if (!d.ok) {
        card.querySelector('.sweep__item-body').innerHTML =
          `<span class="sweep__fail">${esc(d.error || 'unavailable')}</span>`;
      } else {
        const a = d.analysis;
        const tone = CALL_TONE[a.call] || 'neutral';
        card.querySelector('.sweep__item-body').innerHTML = `
          <div class="sweep__item-head">
            <span class="invest-call__badge invest-call__badge--${tone}">${esc(a.call)}</span>
            <span class="sweep__item-conv">${esc(a.conviction)}</span>
            <span class="sweep__item-price">${d.kind === 'yield' ? fmtYield(d.quote.price) : fmtPrice(d.quote.price, d.assetClass)} <span class="${(d.kind === 'yield' ? d.quote.change : d.quote.changePct) >= 0 ? 'up' : 'dn'}">${d.kind === 'yield' ? fmtBp(d.quote.change) : fmtPct(d.quote.changePct)}</span></span>
          </div>
          <div class="sweep__item-thesis">${esc(a.thesis)}</div>
          <div class="sweep__item-size"><strong>Size:</strong> ${esc(a.sizing)}</div>
          ${(d.news || []).length ? `<div class="sweep__item-news">
            <span class="sweep__item-news-label">Evidence read</span>
            ${d.news.map(n => `<a class="sweep__item-news-item" href="${safeUrl(n.url)}" target="_blank" rel="noopener">
              <span class="sweep__item-news-src">${esc(n.source)}</span> ${esc(n.headline)}
            </a>`).join('')}
          </div>` : ''}`;
      }
    } catch (e) {
      card.querySelector('.sweep__item-body').innerHTML = `<span class="sweep__fail">${esc(e.message)}</span>`;
    }

    done++;
    prog.textContent = `${done} / ${list.length}`;
  }

  prog.textContent = `${done} / ${list.length} complete`;
}

// ── Detail ──
async function selectAsset(symbol) {
  const asset = findAsset(symbol);
  if (!asset) return;
  selected = symbol;

  leaveMarketView();
  document.querySelectorAll('.invest-row').forEach(r =>
    r.classList.toggle('is-active', r.dataset.symbol === symbol));
  document.querySelectorAll('.invest-view-btn').forEach(x => x.classList.remove('active'));

  const el = document.getElementById('invest-detail');
  el.innerHTML = `
    <div class="invest-detail__head">
      <div>
        <div class="invest-detail__sym">${esc(asset.symbol)}
          <button class="invest-detail__star${isWatched(asset.symbol) ? ' is-on' : ''}" id="invest-detail-star" title="Toggle watchlist">★</button>
        </div>
        <div class="invest-detail__name">${esc(asset.name)}</div>
        <div class="invest-detail__meta">
          <span class="invest-tag invest-tag--${asset.class}">${ASSET_CLASSES[asset.class].label}</span>
          ${asset.sector ? `<span class="invest-detail__sector">${esc(asset.sector)}</span>` : ''}
        </div>
      </div>
      <div class="invest-detail__price-block" id="invest-price-block">
        <div class="skeleton skeleton--text" style="width:120px"></div>
      </div>
    </div>

    <div class="invest-drivers">
      <span class="invest-drivers__label">What moves it</span>
      ${esc(asset.drivers)}
    </div>

    ${hasFundamentals(asset) ? `
    <div class="fund">
      <div class="fund__head">
        <div>
          <div class="fund__title">Fundamentals</div>
          <div class="fund__sub">Reported financials, earnings against consensus and the analyst range — live from Finnhub.</div>
        </div>
        <button class="fund__print" id="invest-print-btn" title="Open a print-ready brief">Print brief</button>
      </div>
      <div class="fund__body" id="invest-fund" data-symbol="${esc(asset.symbol)}">
        <div class="skeleton skeleton--text"></div>
        <div class="skeleton skeleton--text"></div>
      </div>
    </div>` : ''}

    ${usesOwnChart(asset) ? `
    <div class="invest-chart">
      <div class="invest-chart__head">
        <span class="invest-chart__label">${isYield(asset) ? 'Yield history' : 'Price history'}</span>
        <div class="ychart__ranges" id="invest-ychart-ranges">
          <button class="ychart__range" data-range="6mo">6M</button>
          <button class="ychart__range is-on" data-range="1y">1Y</button>
          <button class="ychart__range" data-range="5y">5Y</button>
        </div>
        <span class="invest-chart__src">Yahoo Finance</span>
      </div>
      <div class="ychart" id="invest-ychart"><div class="tool__loading">Loading daily closes…</div></div>
    </div>` : `
    <div class="invest-chart">
      <div class="invest-chart__head">
        <span class="invest-chart__label">Price Chart</span>
        <span class="invest-chart__src">TradingView</span>
      </div>
      <div class="tradingview-widget-container" id="invest-tv"><div class="tradingview-widget-container__widget"></div></div>
    </div>`}

    <div class="invest-advisor">
      <div class="invest-advisor__head">
        <div>
          <div class="invest-advisor__title">Felicity Bot</div>
          <div class="invest-advisor__sub" id="invest-advisor-sub">${hasProfile()
            ? 'Sized to your profile — a real amount, not a percentage'
            : 'Set your investor profile to get a real position size'}</div>
        </div>
        <button class="invest-advisor__btn" id="invest-advise-btn">Analyse ${esc(asset.symbol)} →</button>
      </div>
      <div class="invest-advisor__body" id="invest-advisor-body"></div>
    </div>

    <div class="invest-news">
      <div class="invest-news__head">
        <span class="invest-news__title">Latest News</span>
        <span class="invest-news__sub" id="invest-news-meta">Loading…</span>
      </div>
      <div class="invest-news__list" id="invest-news-list">
        <div class="skeleton skeleton--text"></div>
        <div class="skeleton skeleton--text"></div>
      </div>
    </div>
  `;

  if (usesOwnChart(asset)) {
    loadHistoryChart(asset, '1y');
    document.getElementById('invest-ychart-ranges').addEventListener('click', e => {
      const b = e.target.closest('.ychart__range');
      if (!b) return;
      document.querySelectorAll('.ychart__range').forEach(x => x.classList.toggle('is-on', x === b));
      loadHistoryChart(asset, b.dataset.range);
    });
  } else {
    mountChart(asset);
  }
  loadQuote(asset);
  loadNews(asset);
  revealDetail();

  // Fundamentals for US-listed equities — the capability the S&P 500 tab used
  // to hold, now living beside the price it belongs to.
  if (hasFundamentals(asset)) {
    fundamentalsFor = null;
    loadFundamentals(asset, 'invest-fund').then(d => {
      if (selected === asset.symbol) fundamentalsFor = { symbol: asset.symbol, data: d };
    });

    document.getElementById('invest-print-btn').addEventListener('click', () => {
      const data = fundamentalsFor?.symbol === asset.symbol ? fundamentalsFor.data : null;
      // Printing before the four calls land would silently produce a brief of
      // N/As that looks like the data was checked and found missing.
      if (!data) {
        alert('The fundamentals are still loading — give it a moment and try again.');
        return;
      }
      const q = quoteCache[asset.symbol]?.data || null;
      // Carry the Felicity Bot analysis into the brief when one has been run
      const brief = document.getElementById('invest-thesis-text')?.textContent || '';
      if (!exportBrief(asset, data, q, brief)) {
        alert('The brief opens in a new tab — allow pop-ups for this site and try again.');
      }
    });
  }

  document.getElementById('invest-advise-btn').addEventListener('click', () => runAdvisor(asset));

  document.getElementById('invest-detail-star').addEventListener('click', e => {
    const on = toggleWatch(asset.symbol);
    e.currentTarget.classList.toggle('is-on', on);
    refreshWatchCount();
    renderList();
  });
}

// Chart drawn by us from real Yahoo daily closes — used wherever the
// TradingView embed cannot legally show the feed. Nothing is modelled:
// the series is the data, thinned server-side, and the caption says so.
let chartSeq = 0;

async function loadHistoryChart(asset, range = '1y') {
  const seq = ++chartSeq;
  const host0 = document.getElementById('invest-ychart');
  if (host0) host0.innerHTML = '<div class="tool__loading">Loading daily closes…</div>';

  try {
    const r = await fetch(`/api/invest/candles?symbol=${encodeURIComponent(asset.symbol)}&range=${encodeURIComponent(range)}`);
    const d = await r.json();
    if (!d.ok || !Array.isArray(d.c) || d.c.length < 2) throw new Error(d.error || 'no history returned');

    const host = document.getElementById('invest-ychart');
    // Navigated away, or a newer range click superseded this fetch
    if (!host || selected !== asset.symbol || seq !== chartSeq) return;

    const yieldMode = isYield(asset);
    const min = Math.min(...d.c), max = Math.max(...d.c);
    const first = d.c[0], last = d.c[d.c.length - 1];
    const W = 640, H = 160;
    const dt = ms => new Date(ms).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

    const fmtV = v => yieldMode ? `${v.toFixed(2)}%` : fmtPrice(v, asset.class);
    const move = yieldMode
      ? `${(last - first) * 100 >= 0 ? '+' : ''}${((last - first) * 100).toFixed(0)} bp over the period`
      : `${fmtPct(first ? ((last - first) / first) * 100 : null)} over the period`;

    host.innerHTML = `
      <div class="ychart__meta">
        <span>${esc(dt(d.t[0]))} – ${esc(dt(d.t[d.t.length - 1]))}</span>
        <span>high ${esc(fmtV(max))} · low ${esc(fmtV(min))}</span>
        <span class="${last >= first ? 'up' : 'dn'}">${esc(move)}</span>
      </div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Daily ${esc(asset.symbol)} closes">
        <path d="${pathFor(d.c, min, max, W, H)}" class="ychart__line" />
      </svg>
      <div class="ychart__src">${esc(d.source)} · ${d.points} daily closes · chart drawn from the data, not embedded</div>`;
  } catch (e) {
    const host = document.getElementById('invest-ychart');
    if (host && selected === asset.symbol && seq === chartSeq) {
      host.innerHTML = `<div class="tool__fail">History unavailable — ${esc(e.message)}</div>`;
    }
  }
}

function mountChart(asset) {
  const host = document.getElementById('invest-tv');
  if (!host) return;
  host.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  s.textContent = JSON.stringify({
    autosize: true,
    symbol: asset.tv || asset.symbol,
    interval: 'D',
    timezone: 'Asia/Dubai',
    theme: 'dark',
    style: '1',
    locale: 'en',
    backgroundColor: 'rgba(13, 17, 23, 1)',
    gridColor: 'rgba(255, 255, 255, 0.06)',
    hide_side_toolbar: true,
    allow_symbol_change: false,
    save_image: false,
    calendar: false,
    support_host: 'https://www.tradingview.com',
  });
  s.onerror = () => { host.innerHTML = '<div class="invest-chart__fail">Chart unavailable — TradingView could not be reached.</div>'; };
  host.appendChild(s);
}

async function loadQuote(asset) {
  const block = document.getElementById('invest-price-block');
  try {
    const r = await fetch(`/api/invest/quote?symbol=${encodeURIComponent(asset.symbol)}&_=${Date.now()}`);
    const d = await r.json();
    if (!d.ok || !d.quote) throw new Error(d.error || 'unavailable');

    quoteCache[asset.symbol] = { data: d.quote, ts: Date.now() };
    const q = d.quote;
    const cls = (isYield(asset) ? q.change : q.changePct) >= 0 ? 'up' : 'dn';

    if (!block) return;
    // A yield IS the number — 4.25% with the day's move in basis points.
    // The source label is what the SERVER says answered, not what we hoped
    // would: a Finnhub outage that fell back to Yahoo is labelled yahoo.
    block.innerHTML = `
      <div class="invest-detail__price">${isYield(asset) ? fmtYield(q.price) : fmtPrice(q.price, asset.class)}</div>
      <div class="invest-detail__chg invest-detail__chg--${cls}">${isYield(asset) ? fmtBp(q.change) : fmtPct(q.changePct)}</div>
      <div class="invest-detail__src">live · ${esc(d.source || asset.source)}</div>
      ${q.marketCap != null ? `<div class="invest-detail__extra">Mkt cap ${fmtBig(q.marketCap)}</div>` : ''}
    `;
    renderList();
  } catch (e) {
    if (block) block.innerHTML = `<div class="invest-detail__fail">Price unavailable — ${esc(e.message)}</div>`;
  }
}

async function loadNews(asset) {
  const list = document.getElementById('invest-news-list');
  const meta = document.getElementById('invest-news-meta');
  try {
    const r = await fetch(`/api/invest/news?symbol=${encodeURIComponent(asset.symbol)}`);
    const d = await r.json();

    if (!d.items || !d.items.length) {
      meta.textContent = 'last 7 days';
      list.innerHTML = `<div class="invest-news__empty">No news returned for ${esc(asset.symbol)} in the last 7 days.${d.error ? ` (${esc(d.error)})` : ''}</div>`;
      return;
    }

    meta.textContent = `${d.items.length} stories · last 7 days`;
    list.innerHTML = d.items.map(n => {
      const when = n.datetime ? new Date(n.datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      return `
        <a class="invest-news__item" href="${safeUrl(n.url)}" target="_blank" rel="noopener">
          <div class="invest-news__item-head">
            <span class="invest-news__item-src">${esc(n.source)}</span>
            <span class="invest-news__item-date">${esc(when)}</span>
          </div>
          <div class="invest-news__item-title">${esc(n.headline)}</div>
          ${n.summary ? `<div class="invest-news__item-sum">${esc(n.summary.slice(0, 180))}${n.summary.length > 180 ? '…' : ''}</div>` : ''}
        </a>`;
    }).join('');
  } catch (e) {
    meta.textContent = '';
    list.innerHTML = `<div class="invest-news__empty">News unavailable — ${esc(e.message)}</div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// SCREENER — filter a universe on real computed indicators
// ═══════════════════════════════════════════════════════════
//
// Every number here is computed server-side from Yahoo daily OHLCV. No
// instrument is scored, ranked or predicted — a row either satisfies the
// filter or it does not, and anything whose history could not be fetched
// is reported as failed rather than quietly dropped.

const SCREENS = {
  oversold: {
    label: 'Oversold',
    sub: 'RSI(14) below 30 — stretched to the downside.',
    filters: { rsiBelow: 30 },
  },
  overbought: {
    label: 'Overbought',
    sub: 'RSI(14) above 70 — stretched to the upside.',
    filters: { rsiAbove: 70 },
  },
  volume: {
    label: 'Volume surge',
    sub: 'Latest session traded more than 150% above its 20-day average volume.',
    filters: { volSurgeAbove: 150 },
  },
  momentum: {
    label: 'Momentum leaders',
    sub: 'Within 3% of the 52-week high and holding above the 200-day average.',
    filters: { nearHighWithin: 3, aboveSma200: true },
  },
  pullback: {
    label: 'Pullback in an uptrend',
    sub: '20% or more off the 52-week high but still above the 200-day average.',
    filters: { downFromHighAtLeast: 20, aboveSma200: true },
  },
  trend: {
    label: 'Above both averages',
    sub: 'Trading above the 50-day and the 200-day.',
    filters: { aboveSma50: true, aboveSma200: true },
  },
};

let screenKey = 'oversold';
let screenScope = 'watchlist';

// Must match SCAN_CAP in api/invest/[action].js. The watchlist used to be
// passed uncapped, so a 140-name watchlist showed "Scan 140 instruments"
// and got back "matched 3 of 60" — the button promised a scan the endpoint
// was never going to run.
const SCAN_CAP = 60;

function screenUniverse() {
  const pool = screenScope === 'watchlist'
    ? getWatchlist().map(s => findAsset(s)).filter(Boolean)
    : filtered();
  return { list: pool.slice(0, SCAN_CAP), total: pool.length };
}

function renderPortfolioView() {
  const el = document.getElementById('invest-detail');
  if (!el) return;
  selected = null;
  leaveMarketView();
  document.querySelectorAll('.invest-row').forEach(r => r.classList.remove('is-active'));
  renderPortfolio(el, selectAsset);
  revealDetail();
}

function renderScreener() {
  const el = document.getElementById('invest-detail');
  if (!el) return;
  selected = null;
  leaveMarketView();
  document.querySelectorAll('.invest-row').forEach(r => r.classList.remove('is-active'));

  const { list: universe, total } = screenUniverse();
  const chips = Object.entries(SCREENS).map(([k, s]) =>
    `<button class="tool-chip${k === screenKey ? ' is-on' : ''}" data-screen="${k}">${esc(s.label)}</button>`).join('');

  el.innerHTML = `
    <div class="tool">
      <div class="tool__head">
        <div>
          <div class="tool__title">Screener</div>
          <div class="tool__sub">RSI, volume, moving averages and 52-week position — computed live from daily OHLCV, not stored.</div>
        </div>
        <span class="tool__src">Yahoo Finance</span>
      </div>

      <div class="tool__row">
        <span class="tool__label">Screen</span>
        <div class="tool__chips">${chips}</div>
      </div>

      <div class="tool__row">
        <span class="tool__label">Universe</span>
        <div class="tool__chips">
          <button class="tool-chip${screenScope === 'watchlist' ? ' is-on' : ''}" data-scope="watchlist">Watchlist</button>
          <button class="tool-chip${screenScope === 'view' ? ' is-on' : ''}" data-scope="view">Current list</button>
        </div>
      </div>

      <div class="tool__criteria" id="screen-criteria">${esc(SCREENS[screenKey].sub)}</div>

      <div class="tool__actions">
        <button class="tool__run" id="screen-run"${universe.length ? '' : ' disabled'}>
          Scan ${universe.length} ${universe.length === 1 ? 'instrument' : 'instruments'} →
        </button>
        <span class="tool__note" id="screen-note">${universe.length
          ? (total > universe.length
              ? `One live history pull each · ${total - universe.length} of ${total} left out by the ${SCAN_CAP}-instrument cap`
              : 'One live history pull each')
          : (screenScope === 'watchlist'
              ? 'Your watchlist is empty — star some instruments first.'
              : 'Nothing in the current list to scan.')}</span>
      </div>

      <div class="tool__out" id="screen-out"></div>
    </div>`;

  revealDetail();

  el.querySelectorAll('[data-screen]').forEach(b => b.addEventListener('click', () => {
    screenKey = b.dataset.screen;
    renderScreener();
  }));
  el.querySelectorAll('[data-scope]').forEach(b => b.addEventListener('click', () => {
    screenScope = b.dataset.scope;
    renderScreener();
  }));
  document.getElementById('screen-run')?.addEventListener('click', runScreen);
}

async function runScreen() {
  const { list } = screenUniverse();
  const out = document.getElementById('screen-out');
  const btn = document.getElementById('screen-run');
  if (!list.length || !out) return;

  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Scanning…';
  out.innerHTML = `<div class="tool__loading">Pulling a year of daily bars for ${list.length} ${list.length === 1 ? 'instrument' : 'instruments'} and computing the indicators…</div>`;

  try {
    const r = await fetch('/api/invest/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbols: list.map(a => a.symbol),
        filters: SCREENS[screenKey].filters,
      }),
    });
    const d = await r.json();
    if (!d.ok) { out.innerHTML = `<div class="tool__fail">${esc(d.error || 'Scan unavailable.')}</div>`; return; }

    const head = `
      <div class="screen-summary">
        <strong>${d.matched}</strong> of ${d.scanned} matched
        <span class="screen-summary__crit">${esc(SCREENS[screenKey].sub)}</span>
        ${d.failed.length ? `<span class="screen-summary__fail">${d.failed.length} had no usable history: ${esc(d.failed.slice(0, 8).join(', '))}${d.failed.length > 8 ? '…' : ''}</span>` : ''}
        ${d.skipped?.length ? `<span class="screen-summary__fail">${d.skipped.length} not reached before the time budget ran out: ${esc(d.skipped.slice(0, 8).join(', '))}${d.skipped.length > 8 ? '…' : ''}</span>` : ''}
      </div>`;

    if (!d.results.length) {
      out.innerHTML = head + '<div class="tool__empty">Nothing in this universe meets the criteria right now. That is a result, not a failure — the screen is not loosened to manufacture hits.</div>';
      return;
    }

    out.innerHTML = head + `
      <div class="screen-table">
        <div class="screen-table__head">
          <span>Symbol</span><span>Price</span><span>RSI</span><span>Vol vs 20d</span><span>vs 52w high</span><span>Trend</span>
        </div>
        ${d.results.map(row => {
          const rsiCls = row.rsi14 == null ? '' : row.rsi14 < 30 ? 'dn' : row.rsi14 > 70 ? 'up' : '';
          const trend = [
            row.aboveSma50 === true ? '50d' : null,
            row.aboveSma200 === true ? '200d' : null,
          ].filter(Boolean);
          return `
            <div class="screen-table__row" data-symbol="${esc(row.symbol)}">
              <span class="screen-table__sym">${esc(row.symbol)}<em>${esc(row.name)}</em></span>
              <span>${fmtPrice(row.price, row.assetClass)}</span>
              <span class="${rsiCls}">${row.rsi14 ?? '—'}</span>
              <span class="${row.volSurgePct > 0 ? 'up' : 'dn'}">${row.volSurgePct == null ? '—' : `${row.volSurgePct > 0 ? '+' : ''}${row.volSurgePct}%`}</span>
              <span class="dn">${row.pctFrom52wHigh}%</span>
              <span class="screen-table__trend">${trend.length ? trend.map(t => `<em>above ${t}</em>`).join('') : '<em class="is-off">below both</em>'}</span>
            </div>`;
        }).join('')}
      </div>
      <div class="tool__method">Indicators computed from Yahoo daily OHLCV at scan time. RSI is Wilder's 14-period. Volume is compared with its own 20-day average. This is a filter on measured history — it is not a recommendation and carries no view on what happens next.</div>`;

    out.querySelectorAll('.screen-table__row').forEach(row => {
      row.addEventListener('click', () => selectAsset(row.dataset.symbol));
    });
  } catch (e) {
    out.innerHTML = `<div class="tool__fail">Scan failed — ${esc(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// ═══════════════════════════════════════════════════════════
// BACKTEST — a historical simulation, reported honestly
// ═══════════════════════════════════════════════════════════
//
// The result always shows buy-and-hold on the same axis. A strategy that
// returns 40% while simply holding returned 60% did not work, and the
// number that matters is the difference between them.

const STRATS = {
  rsi_reversion: {
    label: 'RSI mean reversion',
    params: [
      { k: 'oversold', label: 'Buy when RSI is below', def: 30, min: 5, max: 45 },
      { k: 'overbought', label: 'Sell when RSI is above', def: 70, min: 55, max: 95 },
    ],
  },
  sma_cross: {
    label: 'Moving-average crossover',
    params: [
      { k: 'fast', label: 'Fast average (days)', def: 50, min: 2, max: 100 },
      { k: 'slow', label: 'Slow average (days)', def: 200, min: 10, max: 300 },
    ],
  },
  breakout: {
    label: 'Donchian breakout',
    params: [
      { k: 'entry', label: 'Entry: break the N-day high', def: 20, min: 5, max: 200 },
      { k: 'exit', label: 'Exit: break the N-day low', def: 10, min: 3, max: 200 },
    ],
  },
};

let btStrategy = 'rsi_reversion';

function renderBacktester() {
  const el = document.getElementById('invest-detail');
  if (!el) return;
  const symbol = selected || getWatchlist()[0] || 'SPY';
  selected = null;
  leaveMarketView();
  document.querySelectorAll('.invest-row').forEach(r => r.classList.remove('is-active'));

  const strat = STRATS[btStrategy];

  el.innerHTML = `
    <div class="tool">
      <div class="tool__head">
        <div>
          <div class="tool__title">Backtest</div>
          <div class="tool__sub">Run a rule over real daily history. Signals execute at the <em>next</em> bar's open, so the test never trades on information it could not have had.</div>
        </div>
        <span class="tool__src">Yahoo Finance</span>
      </div>

      <div class="tool__form">
        <label class="tool__field">
          <span class="tool__label">Symbol</span>
          <input id="bt-symbol" class="tool__input" value="${esc(symbol)}" placeholder="AAPL, BTC, SPY, EURUSD">
        </label>
        <label class="tool__field">
          <span class="tool__label">Strategy</span>
          <select id="bt-strategy" class="tool__select">
            ${Object.entries(STRATS).map(([k, s]) =>
              `<option value="${k}"${k === btStrategy ? ' selected' : ''}>${esc(s.label)}</option>`).join('')}
          </select>
        </label>
        <label class="tool__field tool__field--sm">
          <span class="tool__label">History</span>
          <select id="bt-range" class="tool__select">
            <option value="1y">1 year</option>
            <option value="2y" selected>2 years</option>
            <option value="5y">5 years</option>
            <option value="10y">10 years</option>
          </select>
        </label>
        ${strat.params.map(p => `
          <label class="tool__field tool__field--sm">
            <span class="tool__label">${esc(p.label)}</span>
            <input type="number" id="bt-p-${p.k}" class="tool__input" value="${p.def}" min="${p.min}" max="${p.max}" step="1">
          </label>`).join('')}
        <label class="tool__field tool__field--sm">
          <span class="tool__label">Fee per side (%)</span>
          <input type="number" id="bt-fee" class="tool__input" value="0.1" min="0" max="5" step="0.01">
        </label>
      </div>

      <div class="tool__actions">
        <button class="tool__run" id="bt-run">Run backtest →</button>
        <span class="tool__note">Long only, one position at a time, fees charged both sides.</span>
      </div>

      <div class="tool__out" id="bt-out"></div>
    </div>`;

  revealDetail();

  document.getElementById('bt-strategy').addEventListener('change', e => {
    btStrategy = e.target.value;
    renderBacktester();
  });
  document.getElementById('bt-run').addEventListener('click', runBacktest);
  document.getElementById('bt-symbol').addEventListener('keydown', e => {
    if (e.key === 'Enter') runBacktest();
  });
}

async function runBacktest() {
  const out = document.getElementById('bt-out');
  const btn = document.getElementById('bt-run');
  const symbol = document.getElementById('bt-symbol').value.trim().toUpperCase();
  if (!symbol) return;

  const params = {};
  STRATS[btStrategy].params.forEach(p => {
    const v = parseFloat(document.getElementById(`bt-p-${p.k}`).value);
    if (isFinite(v)) params[p.k] = v;
  });

  btn.disabled = true;
  btn.textContent = 'Running…';
  out.innerHTML = `<div class="tool__loading">Pulling the daily history for ${esc(symbol)} and walking it bar by bar…</div>`;

  try {
    const r = await fetch('/api/invest/backtest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol,
        strategy: btStrategy,
        params,
        range: document.getElementById('bt-range').value,
        feePct: parseFloat(document.getElementById('bt-fee').value) || 0,
      }),
    });
    const d = await r.json();
    if (!d.ok) { out.innerHTML = `<div class="tool__fail">${esc(d.error || 'Backtest unavailable.')}</div>`; return; }
    out.innerHTML = backtestHtml(d);
  } catch (e) {
    out.innerHTML = `<div class="tool__fail">Backtest failed — ${esc(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run backtest →';
  }
}

function pathFor(points, min, max, w, h) {
  if (points.length < 2) return '';
  const span = (max - min) || 1;
  return points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((v - min) / span) * h;
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function backtestHtml(d) {
  const s = d.stats;
  const beat = s.edgeVsBuyHoldPct > 0;
  const dt = ms => new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  // Strategy and buy-and-hold on one shared axis
  const strat = d.curve.map(p => p.v);
  const hold = d.curve.map(p => p.b);
  const all = strat.concat(hold);
  const min = Math.min(...all), max = Math.max(...all);
  const W = 640, H = 150;

  const verdict = s.trades === 0
    ? 'This rule never triggered over the period tested. No trades, no result — the honest answer is that it says nothing about this instrument.'
    : beat
      ? `Over this window the rule beat simply holding by ${s.edgeVsBuyHoldPct.toFixed(2)} percentage points, across ${s.trades} ${s.trades === 1 ? 'trade' : 'trades'}. One window is not evidence of an edge — test other periods and other instruments before trusting it.`
      : `Over this window the rule <strong>underperformed simply holding</strong> by ${Math.abs(s.edgeVsBuyHoldPct).toFixed(2)} percentage points. All the trading, the fees and the risk bought less than doing nothing.`;

  return `
    <div class="bt">
      <div class="bt__head">
        <div>
          <div class="bt__sym">${esc(d.symbol)} <span class="bt__name">${esc(d.name)}</span></div>
          <div class="bt__strat">${esc(d.strategy.description)}</div>
        </div>
        <div class="bt__period">${dt(d.period.from)} → ${dt(d.period.to)}<br><span>${d.period.bars} trading days</span></div>
      </div>

      <div class="bt__headline">
        <div class="bt__big">
          <span class="bt__big-label">Strategy</span>
          <span class="bt__big-value ${s.strategyReturnPct >= 0 ? 'up' : 'dn'}">${fmtPct(s.strategyReturnPct)}</span>
        </div>
        <div class="bt__big">
          <span class="bt__big-label">Buy &amp; hold</span>
          <span class="bt__big-value ${s.buyHoldReturnPct >= 0 ? 'up' : 'dn'}">${fmtPct(s.buyHoldReturnPct)}</span>
        </div>
        <div class="bt__big bt__big--edge">
          <span class="bt__big-label">Edge</span>
          <span class="bt__big-value ${beat ? 'up' : 'dn'}">${fmtPct(s.edgeVsBuyHoldPct)}</span>
        </div>
      </div>

      <div class="bt__chart">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Strategy equity versus buy and hold">
          <path d="${pathFor(hold, min, max, W, H)}" class="bt__line bt__line--hold" />
          <path d="${pathFor(strat, min, max, W, H)}" class="bt__line bt__line--strat" />
        </svg>
        <div class="bt__legend">
          <span class="bt__key bt__key--strat">Strategy</span>
          <span class="bt__key bt__key--hold">Buy &amp; hold</span>
        </div>
      </div>

      <div class="bt__stats">
        <div><span>Trades</span><strong>${s.trades}</strong></div>
        <div><span>Win rate</span><strong>${s.winRatePct}%</strong></div>
        <div><span>Avg win</span><strong class="${s.avgWinPct ? 'up' : ''}">${s.avgWinPct ? fmtPct(s.avgWinPct) : '—'}</strong></div>
        <div><span>Avg loss</span><strong class="${s.avgLossPct ? 'dn' : ''}">${s.avgLossPct ? fmtPct(s.avgLossPct) : '—'}</strong></div>
        <div><span>Profit factor</span><strong>${s.profitFactor ?? '—'}</strong></div>
        <div><span>Max drawdown</span><strong class="dn">−${s.maxDrawdownPct}%</strong></div>
      </div>

      <div class="bt__verdict ${beat ? 'is-good' : 'is-bad'}">${verdict}</div>

      ${d.trades.length ? `
        <div class="bt__trades">
          <div class="bt__trades-head"><span>Entry</span><span>Exit</span><span>Held</span><span>Return</span></div>
          ${d.trades.slice().reverse().map(t => `
            <div class="bt__trade">
              <span>${dt(t.entryAt)}<em>${t.entryPx}</em></span>
              <span>${t.openAtEnd ? 'open' : dt(t.exitAt)}<em>${t.exitPx}</em></span>
              <span>${t.bars}d</span>
              <span class="${t.returnPct >= 0 ? 'up' : 'dn'}">${fmtPct(t.returnPct)}</span>
            </div>`).join('')}
        </div>
        ${d.stats.trades > d.trades.length ? `<div class="bt__more">Showing the last ${d.trades.length} of ${d.stats.trades} trades.</div>` : ''}
      ` : ''}

      <div class="tool__method">
        ${esc(d.method)} Fees: ${s.feePctPerSide}% per side. Source: ${esc(d.source)}.
        Past behaviour of a rule over one window is not evidence it will work again — and slippage, liquidity, taxes and the discipline to actually follow it are not modelled here.
      </div>
    </div>`;
}

// ── Felicity Bot ──
const CALL_TONE = {
  BUY: 'bullish', ACCUMULATE: 'bullish', HOLD: 'neutral',
  TRIM: 'bearish', SHORT: 'bearish', AVOID: 'bearish',
};

async function runAdvisor(asset) {
  const btn = document.getElementById('invest-advise-btn');
  const body = document.getElementById('invest-advisor-body');
  btn.disabled = true;
  btn.textContent = 'Analysing…';
  body.innerHTML = `<div class="invest-advisor__loading">Pulling the live price and the last 7 days of news, then forming a view…</div>`;

  try {
    const r = await fetch('/api/invest/advise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: asset.symbol, profile: getProfile() }),
    });
    const d = await r.json();

    if (!d.ok) {
      body.innerHTML = `<div class="invest-advisor__fail">${esc(d.error || 'Analysis unavailable.')}</div>`;
      return;
    }

    const a = d.analysis;
    const tone = CALL_TONE[a.call] || 'neutral';
    const cats = Array.isArray(a.catalysts) ? a.catalysts : [];

    body.innerHTML = `
      <div class="invest-call">
        <span class="invest-call__badge invest-call__badge--${tone}">${esc(a.call)}</span>
        <span class="invest-call__conv">Conviction <strong>${esc(a.conviction)}</strong></span>
        <span class="invest-call__horizon">${esc(a.horizon || '')}</span>
      </div>

      <div class="invest-thesis" id="invest-thesis-text">${esc(a.thesis)}</div>

      <div class="invest-grid">
        <div class="invest-grid__cell">
          <span class="invest-grid__label">Position size</span>
          <span class="invest-grid__value">${esc(a.sizing)}</span>
        </div>
        <div class="invest-grid__cell">
          <span class="invest-grid__label">Invalidation</span>
          <span class="invest-grid__value invest-grid__value--risk">${esc(a.invalidation)}</span>
        </div>
        <div class="invest-grid__cell">
          <span class="invest-grid__label">Target</span>
          <span class="invest-grid__value invest-grid__value--target">${esc(a.target)}</span>
        </div>
      </div>

      ${a.news_read ? `<div class="invest-block"><span class="invest-block__label">What the news signals</span>${esc(a.news_read)}</div>` : ''}
      ${a.bear_case ? `<div class="invest-block invest-block--bear"><span class="invest-block__label">The case against</span>${esc(a.bear_case)}</div>` : ''}
      ${cats.length ? `<div class="invest-block"><span class="invest-block__label">Catalysts</span><ul class="invest-cats">${cats.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>` : ''}

      <div class="invest-advisor__foot">
        Generated ${new Date(d.generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
        from the live ${esc(d.source || asset.source)} price and ${d.newsCount} real ${d.newsCount === 1 ? 'story' : 'stories'}.
        <strong>This is research, not personalised financial advice</strong> — it cannot know your circumstances, and markets can move against any position.
      </div>
    `;
  } catch (e) {
    body.innerHTML = `<div class="invest-advisor__fail">Analysis failed — ${esc(e.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = `Re-analyse ${asset.symbol} →`;
  }
}
