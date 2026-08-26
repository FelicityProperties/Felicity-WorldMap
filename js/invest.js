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

let currentClass = 'all';
let showWatchlist = false;
let search = '';
let selected = null;
let quoteCache = {};

const QUOTE_TTL = 45000;

export function initInvest() {
  renderShell();
  renderList();
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = String(s == null ? '' : s);
  return d.innerHTML;
}

function fmtPrice(v, cls) {
  if (v == null || isNaN(v)) return '—';
  if (cls === 'forex') return Number(v).toFixed(4);
  if (v >= 1000) return Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (v < 1) return Number(v).toFixed(4);
  return Number(v).toFixed(2);
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
      <button class="invest-sweepbar__run" id="invest-sweep-run">Run sweep on ${list.length} ${list.length === 1 ? 'name' : 'names'} →</button>
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
        <div class="invest-row__price">${q ? fmtPrice(q.price, a.class) : '<span class="invest-row__dim">·</span>'}</div>
        <div class="invest-row__chg ${cls}">${q ? fmtPct(q.changePct) : ''}</div>
      </div>`;
  }).join('');

  el.querySelectorAll('.invest-row').forEach(r => {
    r.addEventListener('click', e => {
      if (e.target.closest('[data-star]')) return;
      selectAsset(r.dataset.symbol);
    });
  });

  document.getElementById('invest-sweep-run')?.addEventListener('click', runSweep);
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
            <span class="sweep__item-price">${fmtPrice(d.quote.price, d.assetClass)} <span class="${d.quote.changePct >= 0 ? 'up' : 'dn'}">${fmtPct(d.quote.changePct)}</span></span>
          </div>
          <div class="sweep__item-thesis">${esc(a.thesis)}</div>
          <div class="sweep__item-size"><strong>Size:</strong> ${esc(a.sizing)}</div>`;
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

  document.querySelectorAll('.invest-row').forEach(r =>
    r.classList.toggle('is-active', r.dataset.symbol === symbol));

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

    <div class="sp500-chart">
      <div class="sp500-chart__head">
        <span class="sp500-chart__label">Price Chart</span>
        <span class="sp500-chart__src">TradingView</span>
      </div>
      <div class="tradingview-widget-container" id="invest-tv"><div class="tradingview-widget-container__widget"></div></div>
    </div>

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

  mountChart(asset);
  loadQuote(asset);
  loadNews(asset);

  document.getElementById('invest-advise-btn').addEventListener('click', () => runAdvisor(asset));

  document.getElementById('invest-detail-star').addEventListener('click', e => {
    const on = toggleWatch(asset.symbol);
    e.currentTarget.classList.toggle('is-on', on);
    refreshWatchCount();
    renderList();
  });
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
  s.onerror = () => { host.innerHTML = '<div class="sp500-chart__fail">Chart unavailable — TradingView could not be reached.</div>'; };
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
    const cls = q.changePct >= 0 ? 'up' : 'dn';

    if (!block) return;
    block.innerHTML = `
      <div class="invest-detail__price">${fmtPrice(q.price, asset.class)}</div>
      <div class="invest-detail__chg invest-detail__chg--${cls}">${fmtPct(q.changePct)}</div>
      <div class="invest-detail__src">live · ${esc(asset.source)}</div>
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
        <a class="invest-news__item" href="${esc(n.url)}" target="_blank" rel="noopener">
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

      <div class="invest-thesis">${esc(a.thesis)}</div>

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
        from the live ${esc(asset.source)} price and ${d.newsCount} real ${d.newsCount === 1 ? 'story' : 'stories'}.
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
