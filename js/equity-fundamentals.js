// ═══════════════════════════════════════════════════════════
// EQUITY FUNDAMENTALS — company financials inside the cockpit
// ═══════════════════════════════════════════════════════════
//
// This is the capability that used to live on the S&P 500 tab. That tab
// duplicated the cockpit's price, chart, news and AI analysis, so it was
// removed — but its fundamentals were genuinely unique and are kept here,
// rendered inside the instrument detail pane instead of in a second place.
//
// Everything is live Finnhub data through /api/stocks/[action]:
//   metric          P/E, EPS, market cap, beta, dividend yield, 52w range
//   earnings        the last reported quarters, actual against estimate
//   price-target    the analyst target range
//   recommendation  the analyst rating spread
//
// Finnhub's free tier covers US-listed equities, so the section is only
// offered for those. It is never shown with placeholder numbers: a field
// the API did not return renders as an em dash, and a section with no data
// says so rather than displaying zeros.
// ═══════════════════════════════════════════════════════════

import { escapeHtml } from './safe.js';

const esc = escapeHtml;

// Finnhub's free tier does not cover these listings
const UNSUPPORTED_REGIONS = new Set(['Europe', 'Korea', 'Japan']);

export function hasFundamentals(asset) {
  return Boolean(asset)
    && asset.class === 'stocks'
    && !UNSUPPORTED_REGIONS.has(asset.region);
}

const fmt = (v, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';

function fmtB(v) {
  if (!v || isNaN(v)) return '—';
  if (v >= 1e12) return (v / 1e12).toFixed(1) + 'T';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  return Number(v).toLocaleString('en-US');
}

async function fetchJSON(url) {
  try {
    const r = await fetch(url);
    return await r.json();
  } catch { return null; }
}

// ── Beat / miss / meet, tolerant of Finnhub's inconsistent surprise field ──
export function earningsResult(e) {
  const actual = e.actual != null ? Number(e.actual) : NaN;
  const estimate = e.estimate != null ? Number(e.estimate) : NaN;
  let surprisePct = e.surprisePercent != null ? Number(e.surprisePercent) : NaN;

  if (isNaN(surprisePct) && !isNaN(actual) && !isNaN(estimate) && estimate !== 0) {
    surprisePct = ((actual - estimate) / Math.abs(estimate)) * 100;
  }

  if (isNaN(surprisePct)) {
    if (!isNaN(actual) && !isNaN(estimate)) {
      if (actual > estimate) return { status: 'beat', label: '✓ Beat', cls: 'beat', pct: null };
      if (actual < estimate) return { status: 'miss', label: '✗ Miss', cls: 'miss', pct: null };
      return { status: 'meet', label: '= Meet', cls: 'meet', pct: 0 };
    }
    return { status: 'unknown', label: '—', cls: 'unknown', pct: null };
  }

  if (Math.abs(surprisePct) < 0.5) return { status: 'meet', label: '= Meet', cls: 'meet', pct: surprisePct };
  if (surprisePct > 0) return { status: 'beat', label: '✓ Beat', cls: 'beat', pct: surprisePct };
  return { status: 'miss', label: '✗ Miss', cls: 'miss', pct: surprisePct };
}

// ── Renderers ──
function metricsHtml(m) {
  const cells = [
    ['EPS (TTM)', fmt(m.epsBasicExclExtraItemsTTM)],
    ['P/E', fmt(m.peTTM)],
    ['Mkt cap', fmtB(m.marketCapitalization * 1e6)],
    ['Beta', fmt(m.beta)],
    ['Div yield', m.dividendYieldIndicatedAnnual != null ? `${fmt(m.dividendYieldIndicatedAnnual)}%` : '—'],
    ['52w high', m['52WeekHigh'] != null ? `$${fmt(m['52WeekHigh'])}` : '—'],
    ['52w low', m['52WeekLow'] != null ? `$${fmt(m['52WeekLow'])}` : '—'],
    ['Avg vol (10d)', fmtB(m['10DayAverageTradingVolume'] != null ? m['10DayAverageTradingVolume'] * 1e6 : null)],
  ];
  return `<div class="fund__metrics">${cells.map(([l, v]) =>
    `<div class="fund__metric"><span>${esc(l)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>`;
}

function earningsHtml(arr) {
  if (!arr?.length) return '';
  const rows = arr.slice(0, 6).map(e => {
    const r = earningsResult(e);
    const surprise = r.pct != null ? `${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(1)}%` : '—';
    return `<tr>
      <td>${esc(e.period || '—')}</td>
      <td>${e.actual != null ? '$' + Number(e.actual).toFixed(2) : '—'}</td>
      <td>${e.estimate != null ? '$' + Number(e.estimate).toFixed(2) : '—'}</td>
      <td class="fund--${r.cls}">${esc(surprise)}</td>
      <td class="fund--${r.cls}">${esc(r.label)}</td>
    </tr>`;
  }).join('');

  return `
    <div class="fund__block">
      <div class="fund__block-title">Earnings history</div>
      <div class="fund__scroll">
        <table class="fund__table">
          <thead><tr><th>Quarter</th><th>Actual</th><th>Est.</th><th>Surprise</th><th>Result</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function ratingsHtml(rec, pt) {
  const sb = rec?.strongBuy || 0, b = rec?.buy || 0, h = rec?.hold || 0,
        s = rec?.sell || 0, ss = rec?.strongSell || 0;
  const total = sb + b + h + s + ss;

  const bar = total ? `
    <div class="fund__ratings">
      <div class="fund__bar">
        ${[['strong-buy', sb], ['buy', b], ['hold', h], ['sell', s], ['strong-sell', ss]]
          .map(([cls, n]) => n ? `<div class="fund__bar-seg fund__bar-seg--${cls}" style="width:${(n / total) * 100}%">${n}</div>` : '')
          .join('')}
      </div>
      <div class="fund__bar-key">
        <span class="fund__key fund__key--buy">Buy ${sb + b}</span>
        <span class="fund__key fund__key--hold">Hold ${h}</span>
        <span class="fund__key fund__key--sell">Sell ${s + ss}</span>
      </div>
    </div>` : '';

  const targets = pt?.targetMean ? `
    <div class="fund__targets">
      <div class="fund__target"><span>Low</span><strong>$${fmt(pt.targetLow, 0)}</strong></div>
      <div class="fund__target fund__target--avg"><span>Average</span><strong>$${fmt(pt.targetMean, 0)}</strong></div>
      <div class="fund__target"><span>High</span><strong>$${fmt(pt.targetHigh, 0)}</strong></div>
    </div>` : '';

  if (!bar && !targets) return '';
  return `<div class="fund__block"><div class="fund__block-title">Analyst view</div>${bar}${targets}</div>`;
}

// ── Load and render ──
// Cached per symbol for the life of the page so re-selecting an instrument
// does not spend four more upstream calls.
const cache = {};

export async function loadFundamentals(asset, hostId) {
  const host = document.getElementById(hostId);
  if (!host) return null;

  const sym = asset.symbol;
  let data = cache[sym];

  if (!data) {
    const [metric, earnings, target, rec] = await Promise.all([
      fetchJSON(`/api/stocks/metric?symbol=${encodeURIComponent(sym)}`),
      fetchJSON(`/api/stocks/earnings?symbol=${encodeURIComponent(sym)}`),
      fetchJSON(`/api/stocks/price-target?symbol=${encodeURIComponent(sym)}`),
      fetchJSON(`/api/stocks/recommendation?symbol=${encodeURIComponent(sym)}`),
    ]);
    data = {
      metric: metric?.metric || null,
      earnings: Array.isArray(earnings) ? earnings : [],
      target: target || null,
      rec: Array.isArray(rec) ? rec[0] : (rec || null),
    };
    cache[sym] = data;
  }

  // Every instrument renders into the same host id, so a slow response for a
  // stock the user has already navigated away from would otherwise paint its
  // numbers under the new stock's name. The host is stamped with the symbol it
  // was created for; if it no longer matches, drop the result on the floor.
  const stillThere = document.getElementById(hostId);
  if (!stillThere || stillThere.dataset.symbol !== sym) return data;

  const body = [
    data.metric ? metricsHtml(data.metric) : '',
    earningsHtml(data.earnings),
    ratingsHtml(data.rec, data.target),
  ].filter(Boolean).join('');

  stillThere.innerHTML = body || `
    <div class="fund__empty">No fundamentals returned for ${esc(sym)}. Finnhub's free tier covers
    US-listed equities; nothing has been filled in where the API returned no data.</div>`;

  return data;
}

// ── Printable brief ──
// Opens a print-ready document. Every interpolated value is escaped: the
// company name is ours, but the earnings period and the model's brief are
// not, and this writes into a fresh document.
export function exportBrief(asset, data, quote, briefText = '') {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const m = data?.metric || {};
  const price = quote?.price != null ? Number(quote.price).toFixed(2) : 'N/A';
  const dayPct = quote?.changePct != null ? Number(quote.changePct).toFixed(2) : '0.00';
  const up = (quote?.changePct ?? 0) >= 0;
  const chgColor = up ? '#22c55e' : '#ef4444';

  const money = v => {
    if (!v || isNaN(v)) return 'N/A';
    if (v >= 1e12) return '$' + (v / 1e12).toFixed(1) + 'T';
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
    return '$' + Number(v).toLocaleString('en-US');
  };

  const earningsRows = (data?.earnings || []).slice(0, 6).map(e => {
    const r = earningsResult(e);
    const colors = { beat: '#22c55e', miss: '#ef4444', meet: '#f59e0b', unknown: '#888' };
    const labels = { beat: 'BEAT', miss: 'MISS', meet: 'MEET', unknown: '—' };
    const pctStr = r.pct != null ? `${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(1)}%` : 'N/A';
    return `<tr>
      <td>${esc(e.period || 'N/A')}</td>
      <td>${e.actual != null ? '$' + Number(e.actual).toFixed(2) : 'N/A'}</td>
      <td>${e.estimate != null ? '$' + Number(e.estimate).toFixed(2) : 'N/A'}</td>
      <td style="color:${colors[r.status]}">${esc(pctStr)}</td>
      <td style="color:${colors[r.status]}">${labels[r.status]}</td>
    </tr>`;
  }).join('');

  const pt = data?.target;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${esc(asset.symbol)} Intelligence Brief — Felicity Intelligence</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Inter, system-ui, sans-serif; color: #1a1a2e; padding: 40px; max-width: 800px; margin: 0 auto; }
  .brand { font-family: ui-monospace, monospace; font-size: 10px; color: #00a8cc; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px; }
  .meta { font-family: ui-monospace, monospace; font-size: 10px; color: #999; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #00d4ff; padding-bottom: 20px; margin: 20px 0 30px; }
  .header h1 { font-size: 28px; }
  .company { font-size: 16px; color: #555; }
  .sector { font-family: ui-monospace, monospace; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px; }
  .right { text-align: right; }
  .price { font-family: ui-monospace, monospace; font-size: 32px; font-weight: 700; }
  .change { font-family: ui-monospace, monospace; font-size: 14px; font-weight: 700; color: ${chgColor}; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: #00a8cc; margin: 28px 0 12px; font-family: ui-monospace, monospace; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; }
  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .metric { background: #f8f9fa; border-radius: 6px; padding: 12px; text-align: center; }
  .metric-label { font-family: ui-monospace, monospace; font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
  .metric-value { font-family: ui-monospace, monospace; font-size: 16px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  th { font-family: ui-monospace, monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #888; text-align: left; padding: 8px 12px; border-bottom: 2px solid #e5e5e5; }
  td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-family: ui-monospace, monospace; font-size: 12px; }
  .targets { display: flex; gap: 16px; }
  .target { flex: 1; background: #f8f9fa; border-radius: 6px; padding: 12px; text-align: center; }
  .target-label { font-family: ui-monospace, monospace; font-size: 9px; color: #888; text-transform: uppercase; }
  .target-value { font-family: ui-monospace, monospace; font-size: 18px; font-weight: 700; margin-top: 4px; }
  .target-avg { border: 2px solid #00d4ff; }
  .brief { white-space: pre-wrap; background: #f0f9ff; border-left: 4px solid #00d4ff; padding: 16px 20px; border-radius: 4px; font-size: 14px; line-height: 1.7; color: #333; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-family: ui-monospace, monospace; font-size: 9px; color: #aaa; display: flex; justify-content: space-between; }
  @media print { body { padding: 20px; } }
</style></head><body>
<div class="brand">Felicity Intelligence — Instrument Brief</div>
<div class="meta">${esc(date)} at ${esc(time)}</div>

<div class="header">
  <div>
    <h1>${esc(asset.symbol)}</h1>
    <div class="company">${esc(asset.name)}</div>
    <div class="sector">${esc([asset.sector, asset.region].filter(Boolean).join(' · '))}</div>
  </div>
  <div class="right">
    <div class="price">$${esc(price)}</div>
    <div class="change">${up ? '+' : ''}${esc(dayPct)}%</div>
  </div>
</div>

<h2>Key metrics</h2>
<div class="metrics">
  <div class="metric"><div class="metric-label">EPS (TTM)</div><div class="metric-value">${esc(fmt(m.epsBasicExclExtraItemsTTM))}</div></div>
  <div class="metric"><div class="metric-label">P/E ratio</div><div class="metric-value">${esc(fmt(m.peTTM))}</div></div>
  <div class="metric"><div class="metric-label">Market cap</div><div class="metric-value">${esc(money((m.marketCapitalization || 0) * 1e6))}</div></div>
  <div class="metric"><div class="metric-label">Beta</div><div class="metric-value">${esc(fmt(m.beta))}</div></div>
  <div class="metric"><div class="metric-label">Div yield</div><div class="metric-value">${esc(fmt(m.dividendYieldIndicatedAnnual))}%</div></div>
  <div class="metric"><div class="metric-label">52w high</div><div class="metric-value">$${esc(fmt(m['52WeekHigh']))}</div></div>
  <div class="metric"><div class="metric-label">52w low</div><div class="metric-value">$${esc(fmt(m['52WeekLow']))}</div></div>
  <div class="metric"><div class="metric-label">Avg vol (10d)</div><div class="metric-value">${esc(fmtB(m['10DayAverageTradingVolume'] != null ? m['10DayAverageTradingVolume'] * 1e6 : null))}</div></div>
</div>

${earningsRows ? `<h2>Earnings history</h2>
<table><thead><tr><th>Quarter</th><th>Actual</th><th>Estimate</th><th>Surprise</th><th>Result</th></tr></thead>
<tbody>${earningsRows}</tbody></table>` : ''}

${pt?.targetMean ? `<h2>Analyst price targets</h2>
<div class="targets">
  <div class="target"><div class="target-label">Low</div><div class="target-value">$${esc(fmt(pt.targetLow, 0))}</div></div>
  <div class="target target-avg"><div class="target-label">Average</div><div class="target-value" style="color:#00a8cc">$${esc(fmt(pt.targetMean, 0))}</div></div>
  <div class="target"><div class="target-label">High</div><div class="target-value">$${esc(fmt(pt.targetHigh, 0))}</div></div>
</div>` : ''}

${briefText ? `<h2>Felicity Bot analysis</h2>
<div class="brief">${esc(briefText)}</div>` : ''}

<div class="footer">
  <span>Generated by Felicity Intelligence · live Finnhub data, nothing simulated</span>
  <span>Research, not personalised financial advice</span>
</div>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
  return true;
}
