// ═══════════════════════════════════════════════════════════
// S&P 500 — Stock Intelligence Terminal
// ═══════════════════════════════════════════════════════════

import { sp500Companies, sectorGroups } from './sp500-data.js';
import { markets } from './data.js';

let selectedTicker = null;
let currentSector = 'All';
let searchQuery = '';
let quoteCache = {};

const CACHE_TTL = 60000;

function getCachedQuote(ticker) {
  const c = quoteCache[ticker];
  if (c && Date.now() - c.ts < CACHE_TTL) return c.data;
  return null;
}

function setCachedQuote(ticker, data) {
  quoteCache[ticker] = { data, ts: Date.now() };
}

export function initSP500() {
  renderHeader();
  renderList();
  fetchInitialQuotes();
}

// ── Header: S&P 500 index summary ──
function renderHeader() {
  const el = document.getElementById('sp500-header');
  if (!el) return;
  const spx = markets.find(m => m.sym === 'SPX');
  const price = spx ? spx.price.toLocaleString() : '—';
  const chg = spx ? spx.chg : 0;
  const cls = chg >= 0 ? 'up' : 'dn';
  const sign = chg >= 0 ? '+' : '';
  const arrow = chg >= 0 ? '▲' : '▼';

  el.innerHTML = `
    <div class="sp500-index">
      <div class="sp500-index__label">S&P 500 INDEX</div>
      <div class="sp500-index__price">${price}</div>
      <span class="sp500-index__change sp500-index__change--${cls}">${arrow} ${sign}${chg.toFixed(2)}%</span>
      <span class="sp500-index__live"><span class="sp500-index__dot"></span>LIVE</span>
    </div>
    <div class="sp500-index__count">${sp500Companies.length} companies tracked</div>
  `;
}

// ── Left panel: searchable stock list ──
function renderList() {
  const el = document.getElementById('sp500-list');
  if (!el) return;

  const filterBtns = Object.keys(sectorGroups).map(label => {
    const active = label === currentSector ? ' active' : '';
    return `<button class="dubai-filter-btn${active}" data-sp-sector="${label}">${label}</button>`;
  }).join('');

  el.innerHTML = `
    <div class="sp500-list__controls">
      <input type="search" class="dubai-search sp500-search" id="sp500-search" placeholder="Search ticker or company...">
      <div class="dubai-filters sp500-filters">${filterBtns}</div>
    </div>
    <div class="sp500-list__rows" id="sp500-rows"></div>
  `;

  renderRows();

  document.getElementById('sp500-search')?.addEventListener('input', e => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderRows();
  });

  el.querySelector('.sp500-filters')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-sp-sector]');
    if (!btn) return;
    currentSector = btn.dataset.spSector;
    el.querySelectorAll('[data-sp-sector]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderRows();
  });
}

function getFilteredCompanies() {
  return sp500Companies.filter(c => {
    if (currentSector !== 'All' && c.sector !== sectorGroups[currentSector]) return false;
    if (searchQuery && !c.ticker.toLowerCase().includes(searchQuery) && !c.name.toLowerCase().includes(searchQuery)) return false;
    return true;
  });
}

function renderRows() {
  const container = document.getElementById('sp500-rows');
  if (!container) return;
  const companies = getFilteredCompanies();

  container.innerHTML = companies.map(c => {
    const q = getCachedQuote(c.ticker);
    const price = q ? `$${q.c?.toFixed(2) || '—'}` : '<span class="sp500-row__loading">...</span>';
    const chg = q ? q.dp?.toFixed(2) : null;
    const cls = chg !== null ? (chg >= 0 ? 'up' : 'dn') : '';
    const chgText = chg !== null ? `${chg >= 0 ? '+' : ''}${chg}%` : '';
    const active = c.ticker === selectedTicker ? ' is-active' : '';

    return `
      <div class="sp500-row${active}" data-ticker="${c.ticker}">
        <div class="sp500-row__ticker">${c.ticker}</div>
        <div class="sp500-row__name">${c.name}</div>
        <div class="sp500-row__sector"><span class="badge badge--${c.sector.toLowerCase()}">${c.sector}</span></div>
        <div class="sp500-row__price">${price}</div>
        <div class="sp500-row__chg ${cls}">${chgText}</div>
      </div>
    `;
  }).join('') || '<div class="dubai-empty">No companies match your search</div>';

  container.querySelectorAll('.sp500-row').forEach(row => {
    row.addEventListener('click', () => {
      const ticker = row.dataset.ticker;
      selectStock(ticker);
      container.querySelectorAll('.sp500-row').forEach(r => r.classList.remove('is-active'));
      row.classList.add('is-active');
    });
  });
}

// ── Fetch initial quotes for top 10 ──
async function fetchInitialQuotes() {
  const top10 = sp500Companies.slice(0, 10);
  for (const c of top10) {
    await fetchQuote(c.ticker);
    await new Promise(r => setTimeout(r, 200));
  }
  renderRows();
}

async function fetchQuote(ticker) {
  const cached = getCachedQuote(ticker);
  if (cached) return cached;
  try {
    const res = await fetch(`/api/stocks/quote?symbol=${ticker}`);
    const data = await res.json();
    if (data.setup) return null;
    if (data.c) {
      setCachedQuote(ticker, data);
      return data;
    }
    return null;
  } catch { return null; }
}

// ── Right panel: stock detail ──
async function selectStock(ticker) {
  selectedTicker = ticker;
  const detail = document.getElementById('sp500-detail');
  if (!detail) return;
  const company = sp500Companies.find(c => c.ticker === ticker);
  if (!company) return;

  detail.innerHTML = `
    <div class="sp500-detail__loading">
      <div class="sp500-detail__ticker-lg">${ticker}</div>
      <div class="sp500-detail__name-lg">${company.name}</div>
      <div class="sp500-detail__sector-lg">${company.sector} · ${company.hq}</div>
      <div class="skeleton skeleton--card" style="margin-top:16px"></div>
      <div class="skeleton skeleton--text" style="margin-top:12px"></div>
      <div class="skeleton skeleton--text"></div>
    </div>
  `;

  const [quote, metric, earnings, recs, target] = await Promise.allSettled([
    fetchQuote(ticker),
    fetchJSON(`/api/stocks/metric?symbol=${ticker}`),
    fetchJSON(`/api/stocks/earnings?symbol=${ticker}`),
    fetchJSON(`/api/stocks/recommendation?symbol=${ticker}`),
    fetchJSON(`/api/stocks/price-target?symbol=${ticker}`),
  ]);

  const q = quote.value;
  const m = metric.value?.metric || {};
  const e = earnings.value || [];
  const rec = (recs.value || [])[0] || {};
  const pt = target.value || {};

  if (!q || q.setup) {
    detail.innerHTML = `
      <div class="sp500-detail__error">
        <div class="sp500-detail__error-icon">⚠</div>
        <h3>API Key Required</h3>
        <p>S&P 500 data requires a Finnhub API key. Set <code>FINNHUB_API_KEY</code> in your Vercel environment variables.</p>
        <p>Get a free key at <a href="https://finnhub.io" target="_blank" rel="noopener">finnhub.io</a></p>
      </div>
    `;
    return;
  }

  const price = q.c?.toFixed(2) || '—';
  const dayChg = q.d?.toFixed(2) || '0.00';
  const dayPct = q.dp?.toFixed(2) || '0.00';
  const cls = q.dp >= 0 ? 'up' : 'dn';
  const sign = q.dp >= 0 ? '+' : '';

  const metricsHtml = renderMetrics(q, m);
  const earningsHtml = renderEarnings(e);
  const ratingsHtml = renderRatings(rec, pt);

  detail.innerHTML = `
    <div class="sp500-detail__head">
      <div>
        <div class="sp500-detail__ticker-lg">${ticker}</div>
        <div class="sp500-detail__name-lg">${company.name}</div>
        <div class="sp500-detail__sector-lg">${company.sector} · ${company.hq}</div>
      </div>
      <div class="sp500-detail__price-block">
        <div class="sp500-detail__price">$${price}</div>
        <div class="sp500-detail__change sp500-detail__change--${cls}">${sign}$${dayChg} (${sign}${dayPct}%)</div>
      </div>
    </div>
    ${metricsHtml}
    ${earningsHtml}
    ${ratingsHtml}
    <div class="sp500-detail__ai">
      <button class="sp500-ai-btn" id="sp500-ai-btn">Generate AI Brief</button>
      <div class="sp500-ai-text" id="sp500-ai-text"></div>
    </div>
  `;

  document.getElementById('sp500-ai-btn')?.addEventListener('click', () => {
    generateAIBrief(ticker, company, q, m, e, rec, pt);
  });
}

function renderMetrics(q, m) {
  const fmt = (v, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';
  const fmtB = v => {
    if (!v || isNaN(v)) return '—';
    if (v >= 1e12) return (v / 1e12).toFixed(1) + 'T';
    if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    return v.toLocaleString();
  };

  return `
    <div class="sp500-metrics-grid">
      <div class="sp500-metric"><span class="sp500-metric__label">EPS (TTM)</span><span class="sp500-metric__value">${fmt(m.epsBasicExclExtraItemsTTM)}</span></div>
      <div class="sp500-metric"><span class="sp500-metric__label">P/E</span><span class="sp500-metric__value">${fmt(m.peTTM)}</span></div>
      <div class="sp500-metric"><span class="sp500-metric__label">Mkt Cap</span><span class="sp500-metric__value">${fmtB(m.marketCapitalization * 1e6)}</span></div>
      <div class="sp500-metric"><span class="sp500-metric__label">Beta</span><span class="sp500-metric__value">${fmt(m.beta)}</span></div>
      <div class="sp500-metric"><span class="sp500-metric__label">Div Yield</span><span class="sp500-metric__value">${fmt(m.dividendYieldIndicatedAnnual)}%</span></div>
      <div class="sp500-metric"><span class="sp500-metric__label">52w High</span><span class="sp500-metric__value">$${fmt(m['52WeekHigh'])}</span></div>
      <div class="sp500-metric"><span class="sp500-metric__label">52w Low</span><span class="sp500-metric__value">$${fmt(m['52WeekLow'])}</span></div>
      <div class="sp500-metric"><span class="sp500-metric__label">Volume</span><span class="sp500-metric__value">${fmtB(q.v)}</span></div>
    </div>
  `;
}

function renderEarnings(earningsArr) {
  if (!earningsArr?.length) return '<div class="sp500-section-title">Earnings History</div><div class="sp500-empty">No earnings data available</div>';

  const rows = earningsArr.slice(0, 6).map(e => {
    const surprise = e.surprisePercent != null ? e.surprisePercent.toFixed(1) : '—';
    const beat = e.surprisePercent > 0;
    const cls = beat ? 'beat' : 'miss';
    return `
      <tr>
        <td>${e.period || '—'}</td>
        <td>$${e.actual?.toFixed(2) || '—'}</td>
        <td>$${e.estimate?.toFixed(2) || '—'}</td>
        <td class="sp500-earnings--${cls}">${surprise}%</td>
        <td class="sp500-earnings--${cls}">${beat ? '✓ Beat' : '✗ Miss'}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="sp500-section-title">Earnings History</div>
    <table class="sp500-earnings-table">
      <thead><tr><th>Quarter</th><th>Actual</th><th>Est.</th><th>Surprise</th><th>Result</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderRatings(rec, pt) {
  const total = (rec.buy || 0) + (rec.hold || 0) + (rec.sell || 0) + (rec.strongBuy || 0) + (rec.strongSell || 0);
  if (!total) return '';

  const pct = v => total ? ((v / total) * 100).toFixed(0) : 0;
  const sb = rec.strongBuy || 0, b = rec.buy || 0, h = rec.hold || 0, s = rec.sell || 0, ss = rec.strongSell || 0;

  return `
    <div class="sp500-section-title">Analyst Ratings</div>
    <div class="sp500-ratings">
      <div class="sp500-ratings-bar">
        <div class="sp500-ratings-bar__seg sp500-ratings-bar__seg--strong-buy" style="width:${pct(sb)}%">${sb}</div>
        <div class="sp500-ratings-bar__seg sp500-ratings-bar__seg--buy" style="width:${pct(b)}%">${b}</div>
        <div class="sp500-ratings-bar__seg sp500-ratings-bar__seg--hold" style="width:${pct(h)}%">${h}</div>
        <div class="sp500-ratings-bar__seg sp500-ratings-bar__seg--sell" style="width:${pct(s)}%">${s}</div>
        <div class="sp500-ratings-bar__seg sp500-ratings-bar__seg--strong-sell" style="width:${pct(ss)}%">${ss}</div>
      </div>
      <div class="sp500-ratings-labels">
        <span class="sp500-ratings-label sp500-ratings-label--buy">Strong Buy</span>
        <span class="sp500-ratings-label sp500-ratings-label--buy">Buy</span>
        <span class="sp500-ratings-label sp500-ratings-label--hold">Hold</span>
        <span class="sp500-ratings-label sp500-ratings-label--sell">Sell</span>
        <span class="sp500-ratings-label sp500-ratings-label--sell">Strong Sell</span>
      </div>
    </div>
    ${pt.targetMean ? `
    <div class="sp500-price-targets">
      <div class="sp500-pt"><span class="sp500-pt__label">Low</span><span class="sp500-pt__value">$${pt.targetLow?.toFixed(0) || '—'}</span></div>
      <div class="sp500-pt sp500-pt--avg"><span class="sp500-pt__label">Average</span><span class="sp500-pt__value">$${pt.targetMean?.toFixed(0) || '—'}</span></div>
      <div class="sp500-pt"><span class="sp500-pt__label">High</span><span class="sp500-pt__value">$${pt.targetHigh?.toFixed(0) || '—'}</span></div>
    </div>
    ` : ''}
  `;
}

async function generateAIBrief(ticker, company, q, m, earningsArr, rec, pt) {
  const btn = document.getElementById('sp500-ai-btn');
  const text = document.getElementById('sp500-ai-text');
  if (!btn || !text) return;

  btn.textContent = 'Generating...';
  btn.disabled = true;

  const surprises = (earningsArr || []).slice(0, 4).map(e =>
    `${e.period}: ${e.surprisePercent?.toFixed(1) || '?'}%`
  ).join(', ');

  try {
    const res = await fetch('/api/stocks/ai-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker, name: company.name,
        price: q.c?.toFixed(2), change: q.dp?.toFixed(2),
        eps: m.epsBasicExclExtraItemsTTM?.toFixed(2),
        fwdEps: m.epsNormalizedAnnual?.toFixed(2),
        pe: m.peTTM?.toFixed(1),
        fwdPe: m.peNormalizedAnnual?.toFixed(1),
        nextEarnings: 'TBD',
        expEps: 'N/A',
        rating: `${rec.buy || 0} Buy / ${rec.hold || 0} Hold / ${rec.sell || 0} Sell`,
        target: pt.targetMean?.toFixed(0),
        surprises
      })
    });
    const data = await res.json();
    text.textContent = data.brief || data.error || 'Analysis unavailable.';
  } catch (e) {
    text.textContent = 'AI analysis requires ANTHROPIC_API_KEY to be configured.';
  }

  btn.textContent = 'Regenerate Brief';
  btn.disabled = false;
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch { return null; }
}
