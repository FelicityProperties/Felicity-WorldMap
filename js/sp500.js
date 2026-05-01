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

  const [quote, metric, earnings, recs, target, calendar] = await Promise.allSettled([
    fetchQuote(ticker),
    fetchJSON(`/api/stocks/metric?symbol=${ticker}`),
    fetchJSON(`/api/stocks/earnings?symbol=${ticker}`),
    fetchJSON(`/api/stocks/recommendation?symbol=${ticker}`),
    fetchJSON(`/api/stocks/price-target?symbol=${ticker}`),
    fetchJSON(`/api/stocks/calendar?symbol=${ticker}`),
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

  const cal = calendar.value?.earningsCalendar || [];
  const nextEarning = cal.length ? cal[0] : null;

  // Debug log so we can verify Finnhub data accuracy
  console.log(`[${ticker}] Earnings data:`, e?.slice(0, 4).map(x => ({
    period: x.period, actual: x.actual, estimate: x.estimate, surprisePct: x.surprisePercent
  })));

  const metricsHtml = renderMetrics(q, m);
  const upcomingHtml = renderUpcomingEarnings(nextEarning, ticker);
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
    ${upcomingHtml}
    ${earningsHtml}
    ${ratingsHtml}
    <div class="sp500-detail__ai">
      <div class="sp500-detail__ai-buttons">
        <button class="sp500-ai-btn" id="sp500-ai-btn">Generate AI Brief</button>
        <button class="sp500-pdf-btn" id="sp500-pdf-btn" style="display:none">Export PDF</button>
      </div>
      <div class="sp500-ai-text" id="sp500-ai-text"></div>
    </div>
  `;

  document.getElementById('sp500-ai-btn')?.addEventListener('click', () => {
    generateAIBrief(ticker, company, q, m, e, rec, pt, nextEarning);
  });

  document.getElementById('sp500-pdf-btn')?.addEventListener('click', () => {
    exportPDF(ticker, company, q, m, e, rec, pt, nextEarning);
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

function renderUpcomingEarnings(next, ticker) {
  if (!next) return '';

  const reportDate = next.date || 'TBD';
  const hour = next.hour === 'bmo' ? 'Before Market Open' : next.hour === 'amc' ? 'After Market Close' : next.hour || 'TBD';
  const hourBadge = next.hour === 'bmo' ? 'BMO' : next.hour === 'amc' ? 'AMC' : 'TBD';
  const epsEst = next.epsEstimate != null ? `$${next.epsEstimate.toFixed(2)}` : 'N/A';
  const revEst = next.revenueEstimate != null ? formatRevenue(next.revenueEstimate) : 'N/A';
  const quarter = next.quarter != null && next.year != null ? `Q${next.quarter} ${next.year}` : '';

  // Days until report
  const now = new Date();
  const report = new Date(reportDate + 'T00:00:00');
  const daysUntil = Math.ceil((report - now) / (1000 * 60 * 60 * 24));
  let urgencyClass = '';
  let urgencyText = '';
  if (daysUntil <= 0) { urgencyClass = 'sp500-upcoming--today'; urgencyText = 'REPORTING TODAY'; }
  else if (daysUntil <= 7) { urgencyClass = 'sp500-upcoming--week'; urgencyText = `IN ${daysUntil} DAY${daysUntil > 1 ? 'S' : ''}`; }
  else { urgencyText = `IN ${daysUntil} DAYS`; }

  return `
    <div class="sp500-upcoming ${urgencyClass}">
      <div class="sp500-upcoming__header">
        <div class="sp500-upcoming__title">Next Earnings Report</div>
        <span class="sp500-upcoming__urgency">${urgencyText}</span>
      </div>
      <div class="sp500-upcoming__grid">
        <div class="sp500-upcoming__item">
          <span class="sp500-upcoming__label">Report Date</span>
          <span class="sp500-upcoming__value">${reportDate}</span>
        </div>
        <div class="sp500-upcoming__item">
          <span class="sp500-upcoming__label">Quarter</span>
          <span class="sp500-upcoming__value">${quarter || 'N/A'}</span>
        </div>
        <div class="sp500-upcoming__item">
          <span class="sp500-upcoming__label">Timing</span>
          <span class="sp500-upcoming__value"><span class="sp500-upcoming__hour-badge">${hourBadge}</span> ${hour}</span>
        </div>
        <div class="sp500-upcoming__item">
          <span class="sp500-upcoming__label">EPS Estimate</span>
          <span class="sp500-upcoming__value sp500-upcoming__value--accent">${epsEst}</span>
        </div>
        <div class="sp500-upcoming__item">
          <span class="sp500-upcoming__label">Revenue Estimate</span>
          <span class="sp500-upcoming__value">${revEst}</span>
        </div>
        <div class="sp500-upcoming__item">
          <span class="sp500-upcoming__label"># Analysts</span>
          <span class="sp500-upcoming__value">${next.epsActual != null ? 'Reported' : (next.epsEstimate != null ? 'Consensus' : 'N/A')}</span>
        </div>
      </div>
    </div>
  `;
}

function formatRevenue(v) {
  if (!v || isNaN(v)) return 'N/A';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
  return '$' + v.toLocaleString();
}

// Robust beat/miss/meet detection — handles null surprisePercent by computing from actual vs estimate
function getEarningsResult(e) {
  // Coerce to numbers — Finnhub sometimes returns strings
  const actual = e.actual != null ? Number(e.actual) : NaN;
  const estimate = e.estimate != null ? Number(e.estimate) : NaN;
  let surprisePct = e.surprisePercent != null ? Number(e.surprisePercent) : NaN;

  // Fallback 1: compute from actual vs estimate
  if (isNaN(surprisePct) && !isNaN(actual) && !isNaN(estimate) && estimate !== 0) {
    surprisePct = ((actual - estimate) / Math.abs(estimate)) * 100;
  }

  // Last resort: if we have actual >= estimate but no surprise %, still call it
  if (isNaN(surprisePct)) {
    if (!isNaN(actual) && !isNaN(estimate)) {
      if (actual > estimate) return { status: 'beat', label: '✓ Beat', cls: 'beat', pct: null };
      if (actual < estimate) return { status: 'miss', label: '✗ Miss', cls: 'miss', pct: null };
      return { status: 'meet', label: '= Meet', cls: 'meet', pct: 0 };
    }
    return { status: 'unknown', label: '—', cls: 'unknown', pct: null };
  }

  // Tolerance for "meet": within 0.5% of estimate
  if (Math.abs(surprisePct) < 0.5) return { status: 'meet', label: '= Meet', cls: 'meet', pct: surprisePct };
  if (surprisePct > 0) return { status: 'beat', label: '✓ Beat', cls: 'beat', pct: surprisePct };
  return { status: 'miss', label: '✗ Miss', cls: 'miss', pct: surprisePct };
}

function renderEarnings(earningsArr) {
  if (!earningsArr?.length) return '<div class="sp500-section-title">Earnings History</div><div class="sp500-empty">No earnings data available</div>';

  const rows = earningsArr.slice(0, 6).map(e => {
    const r = getEarningsResult(e);
    const surprise = r.pct != null ? `${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(1)}%` : '—';
    return `
      <tr>
        <td>${e.period || '—'}</td>
        <td>${e.actual != null ? '$' + e.actual.toFixed(2) : '—'}</td>
        <td>${e.estimate != null ? '$' + e.estimate.toFixed(2) : '—'}</td>
        <td class="sp500-earnings--${r.cls}">${surprise}</td>
        <td class="sp500-earnings--${r.cls}">${r.label}</td>
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

async function generateAIBrief(ticker, company, q, m, earningsArr, rec, pt, nextEarning) {
  const btn = document.getElementById('sp500-ai-btn');
  const text = document.getElementById('sp500-ai-text');
  if (!btn || !text) return;

  btn.textContent = 'Generating...';
  btn.disabled = true;

  // Build accurate surprise string with explicit beat/miss/meet labels for AI
  const surprises = (earningsArr || []).slice(0, 4).map(e => {
    const r = getEarningsResult(e);
    if (r.pct == null) return `${e.period || '?'}: no data`;
    const sign = r.pct >= 0 ? '+' : '';
    const label = r.status.toUpperCase();
    return `${e.period || '?'}: ${label} ${sign}${r.pct.toFixed(1)}% (actual $${e.actual?.toFixed(2) || '?'} vs est $${e.estimate?.toFixed(2) || '?'})`;
  }).join('; ');

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
        nextEarnings: nextEarning ? `${nextEarning.date} (${nextEarning.hour === 'bmo' ? 'Before Open' : 'After Close'}, Q${nextEarning.quarter || '?'} ${nextEarning.year || ''})` : 'TBD',
        expEps: nextEarning?.epsEstimate?.toFixed(2) || 'N/A',
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

  // Show PDF export button
  const pdfBtn = document.getElementById('sp500-pdf-btn');
  if (pdfBtn && text.textContent && !text.textContent.includes('error') && !text.textContent.includes('requires')) {
    pdfBtn.style.display = '';
  }
}

// ── PDF Export ──
function exportPDF(ticker, company, q, m, earningsArr, rec, pt) {
  const briefText = document.getElementById('sp500-ai-text')?.textContent || '';
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const fmt = (v, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : 'N/A';
  const fmtB = v => {
    if (!v || isNaN(v)) return 'N/A';
    if (v >= 1e12) return '$' + (v / 1e12).toFixed(1) + 'T';
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
    return '$' + v.toLocaleString();
  };

  const price = q?.c?.toFixed(2) || 'N/A';
  const dayPct = q?.dp?.toFixed(2) || '0';
  const chgColor = q?.dp >= 0 ? '#22c55e' : '#ef4444';
  const chgSign = q?.dp >= 0 ? '+' : '';

  const earningsRows = (earningsArr || []).slice(0, 6).map(e => {
    const r = getEarningsResult(e);
    const colors = { beat: '#22c55e', miss: '#ef4444', meet: '#f59e0b', unknown: '#888' };
    const labels = { beat: 'BEAT', miss: 'MISS', meet: 'MEET', unknown: '—' };
    const color = colors[r.status];
    const pctStr = r.pct != null ? `${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(1)}%` : 'N/A';
    return `<tr>
      <td>${e.period || 'N/A'}</td>
      <td>$${e.actual != null ? Number(e.actual).toFixed(2) : 'N/A'}</td>
      <td>$${e.estimate != null ? Number(e.estimate).toFixed(2) : 'N/A'}</td>
      <td style="color:${color}">${pctStr}</td>
      <td style="color:${color}">${labels[r.status]}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${ticker} Intelligence Brief — Felicity Intelligence</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; color: #1a1a2e; padding: 40px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #00d4ff; padding-bottom: 20px; margin-bottom: 30px; }
  .header-left h1 { font-size: 28px; color: #0a0e16; margin-bottom: 4px; }
  .header-left .company { font-size: 16px; color: #555; }
  .header-left .sector { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }
  .header-right { text-align: right; }
  .header-right .price { font-family: 'JetBrains Mono', monospace; font-size: 32px; font-weight: 700; }
  .header-right .change { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; color: ${chgColor}; }
  .brand { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #00d4ff; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px; }
  .meta { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #999; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: #00d4ff; margin: 28px 0 12px; font-family: 'JetBrains Mono', monospace; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; }
  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 8px; }
  .metric { background: #f8f9fa; border-radius: 6px; padding: 12px; text-align: center; }
  .metric-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
  .metric-value { font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 700; color: #1a1a2e; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #888; text-align: left; padding: 8px 12px; border-bottom: 2px solid #e5e5e5; }
  td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  .brief { background: #f0f9ff; border-left: 4px solid #00d4ff; padding: 16px 20px; border-radius: 4px; font-size: 14px; line-height: 1.7; color: #333; margin-top: 8px; }
  .targets { display: flex; gap: 16px; margin-top: 8px; }
  .target { flex: 1; background: #f8f9fa; border-radius: 6px; padding: 12px; text-align: center; }
  .target-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #888; text-transform: uppercase; }
  .target-value { font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 700; margin-top: 4px; }
  .target-avg { border: 2px solid #00d4ff; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #aaa; display: flex; justify-content: space-between; }
  @media print { body { padding: 20px; } }
</style></head><body>
<div class="brand">Felicity Intelligence — Stock Intelligence Brief</div>
<div class="meta">${date} at ${time} UTC</div>

<div class="header">
  <div class="header-left">
    <h1>${ticker}</h1>
    <div class="company">${company.name}</div>
    <div class="sector">${company.sector} · ${company.subIndustry} · ${company.hq}</div>
  </div>
  <div class="header-right">
    <div class="price">$${price}</div>
    <div class="change">${chgSign}${dayPct}%</div>
  </div>
</div>

<h2>Key Metrics</h2>
<div class="metrics">
  <div class="metric"><div class="metric-label">EPS (TTM)</div><div class="metric-value">${fmt(m?.epsBasicExclExtraItemsTTM)}</div></div>
  <div class="metric"><div class="metric-label">P/E Ratio</div><div class="metric-value">${fmt(m?.peTTM)}</div></div>
  <div class="metric"><div class="metric-label">Market Cap</div><div class="metric-value">${fmtB((m?.marketCapitalization || 0) * 1e6)}</div></div>
  <div class="metric"><div class="metric-label">Beta</div><div class="metric-value">${fmt(m?.beta)}</div></div>
  <div class="metric"><div class="metric-label">Div Yield</div><div class="metric-value">${fmt(m?.dividendYieldIndicatedAnnual)}%</div></div>
  <div class="metric"><div class="metric-label">52w High</div><div class="metric-value">$${fmt(m?.['52WeekHigh'])}</div></div>
  <div class="metric"><div class="metric-label">52w Low</div><div class="metric-value">$${fmt(m?.['52WeekLow'])}</div></div>
  <div class="metric"><div class="metric-label">Volume</div><div class="metric-value">${fmtB(q?.v)}</div></div>
</div>

${earningsRows ? `<h2>Earnings History</h2>
<table><thead><tr><th>Quarter</th><th>Actual</th><th>Estimate</th><th>Surprise</th><th>Result</th></tr></thead>
<tbody>${earningsRows}</tbody></table>` : ''}

${pt?.targetMean ? `<h2>Analyst Price Targets</h2>
<div class="targets">
  <div class="target"><div class="target-label">Low</div><div class="target-value">$${pt.targetLow?.toFixed(0) || 'N/A'}</div></div>
  <div class="target target-avg"><div class="target-label">Average</div><div class="target-value" style="color:#00d4ff">$${pt.targetMean?.toFixed(0) || 'N/A'}</div></div>
  <div class="target"><div class="target-label">High</div><div class="target-value">$${pt.targetHigh?.toFixed(0) || 'N/A'}</div></div>
</div>` : ''}

${briefText ? `<h2>AI Intelligence Brief</h2>
<div class="brief">${briefText}</div>` : ''}

<div class="footer">
  <span>Generated by Felicity Intelligence Platform</span>
  <span>felicity-intelligence.vercel.app</span>
</div>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch { return null; }
}
