// ═══════════════════════════════════════════════════════════
// HORMUZ — Strait of Hormuz daily transit monitor
// ═══════════════════════════════════════════════════════════
//
// Renders the IMF PortWatch daily transit-call series for the Strait of
// Hormuz (chokepoint6) fetched through /api/invest/hormuz. Every number
// on the page is a row from that feed or arithmetic over those rows;
// the arithmetic (7-day and 30-day means, the year-earlier comparison)
// is labelled as ours.
//
// What the page must never do, in the house style:
//   - call the series "today": it is published weekly with a lag, so the
//     headline carries the date of the last row and how old it is;
//   - imply a live count of ships in the Strait: there is no free,
//     licensed real-time source, and the page says so in words;
//   - poll or offer a Refresh button: the feed changes weekly and the
//     endpoint is edge-cached for an hour, so a re-fetch is theatre;
//   - fill a gap: when the fetch fails the last real pull is shown with
//     a STALE marker, and with no prior pull the page says unavailable.
//
// Every string from the payload goes through safe.js before it reaches
// markup; the only outbound links are the PortWatch pages.
// ═══════════════════════════════════════════════════════════

import { escapeHtml, safeUrl } from './safe.js';

const esc = escapeHtml;
const STORE_KEY = 'fi_hormuz_last';
const RANGES = { '90d': 90, '1y': 365, '2y': 730 };

let payload = null;
let stale = null;     // { failedAt, savedAt, error } when showing a previous pull
let range = '1y';

// ── Formatting ──
const n0 = v => v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
const n1 = v => v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 });
const signed = v => v == null ? '—' : `${v >= 0 ? '+' : ''}${n1(v)}%`;
const tone = v => v == null ? '' : v >= 0 ? 'up' : 'dn';
const hhmm = iso => { try { return new Date(iso).toISOString().slice(11, 16) + ' UTC'; } catch { return ''; } };
const longDate = iso => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
const ago = days => days == null ? '' : days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
}
function dayIndex(iso, fromIso) {
  const p = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(iso) - p(fromIso)) / 86400000);
}

// ── Storage of the last real pull (per browser, for the stale path only) ──
function saveLast(p) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), payload: p })); } catch { /* quota / private mode */ }
}
function loadLast() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    return raw && raw.payload && raw.payload.ok && Array.isArray(raw.payload.rows) ? raw : null;
  } catch { return null; }
}

// ── Chart: inline SVG drawn from the rows, in the pixSparkline/ychart idiom ──
// A missing day breaks the line rather than being bridged — the gap is
// real and the chart shows it.
function chartSvg(rows, days) {
  const latest = rows[rows.length - 1].date;
  const from = addDays(latest, -(days - 1));
  const inWin = rows.filter(r => r.date >= from);
  if (inWin.length < 2) return '<div class="tool__fail">Not enough rows in this range to draw.</div>';

  const byDate = new Map(inWin.map(r => [r.date, r]));
  const mean7 = r => {
    const v = [];
    for (let i = 0; i < 7; i++) { const x = byDate.get(addDays(r.date, -i)); if (x) v.push(x.total); }
    return v.reduce((s, x) => s + x, 0) / v.length;
  };

  // The SVG holds only lines and is stretched to its box (preserveAspectRatio
  // none, like the cockpit's own charts); axis labels live in HTML around it
  // so they never distort with the aspect ratio.
  const W = 640, H = 200, PAD_L = 0, PAD_R = 0, PAD_T = 4, PAD_B = 4;
  const iw = W - PAD_L - PAD_R, ih = H - PAD_T - PAD_B;
  const yMax = Math.max(1, ...inWin.map(r => r.total));
  const x = iso => PAD_L + (dayIndex(iso, from) / Math.max(1, days - 1)) * iw;
  const y = v => PAD_T + ih - (v / yMax) * ih;

  const path = (pick) => {
    let d = '', prev = null;
    for (const r of inWin) {
      const v = pick(r);
      if (v == null) { prev = null; continue; }
      const gap = prev && dayIndex(r.date, prev) > 1;
      d += `${(!prev || gap) ? 'M' : 'L'}${x(r.date).toFixed(1)},${y(v).toFixed(1)} `;
      prev = r.date;
    }
    return d.trim();
  };

  const levels = [1, 0.5, 0].map(f => Math.round(yMax * f));
  const grid = levels.map(v =>
    `<line x1="${PAD_L}" x2="${W - PAD_R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="hz-chart__grid"/>`).join('');
  const mid = addDays(from, Math.floor((days - 1) / 2));

  return `
    <div class="hz-chart__frame">
      <div class="hz-chart__y">${levels.map(v => `<span>${v}</span>`).join('')}</div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Daily Strait of Hormuz transit calls, ${esc(from)} to ${esc(latest)}">
        ${grid}
        <path class="hz-chart__tanker" d="${path(r => r.tanker)}"/>
        <path class="hz-chart__total" d="${path(r => r.total)}"/>
        <path class="hz-chart__mean" d="${path(mean7)}"/>
      </svg>
    </div>
    <div class="hz-chart__x"><span>${esc(from)}</span><span>${esc(mid)}</span><span>${esc(latest)}</span></div>`;
}

// ── Render ──
function statCard(label, value, sub, extra = '') {
  return `
    <div class="hz-stat">
      <div class="hz-stat__label">${label}</div>
      <div class="hz-stat__value">${value}</div>
      <div class="hz-stat__sub">${sub}</div>${extra}
    </div>`;
}

function render(host) {
  const p = payload;
  const s = p.summary;
  const src = p.source || {};
  const days = RANGES[range] || 365;
  const latest = s.latest;
  const pct = s.pctVsPriorYear;

  const staleBanner = stale ? `
    <div class="hz-stale">
      <span class="hz-stale__badge">STALE</span>
      Fetch failed at ${esc(hhmm(stale.failedAt))} (${esc(stale.error)}). Showing the last successful pull from ${esc(hhmm(stale.savedAt))}, ${esc(stale.savedAt.slice(0, 10))} — nothing below has been estimated to fill the gap.
    </div>` : '';

  const classes = [
    ['Tankers', 'tanker'], ['Container', 'container'], ['Dry bulk', 'dryBulk'],
    ['General cargo', 'generalCargo'], ['Ro-ro', 'roro'], ['All cargo (non-tanker)', 'cargo'], ['Total', 'total'],
  ];

  host.innerHTML = `
    ${staleBanner}
    <div class="hz-strip">
      <div class="hz-strip__left">
        <span class="hz-src">${esc(src.name || 'IMF PortWatch')}</span>
        <span class="hz-strip__text">${esc(src.dataset || 'Daily Chokepoints Transit Calls')} · ${esc(src.upstream || 'satellite AIS')} ·
          latest day with data <strong>${esc(longDate(p.latestDate))}</strong> (${esc(ago(p.lagDays))}) · published weekly · pulled ${esc(hhmm(p.fetchedAt))}</span>
      </div>
      <a class="hz-strip__link" href="${safeUrl(src.page)}" target="_blank" rel="noopener">PortWatch ↗</a>
    </div>

    <div class="hz-stats">
      ${statCard('Latest day — transit calls', `${n0(latest.total)}<span class="hz-unit">ships</span>`,
        `${esc(longDate(latest.date))} · tankers ${n0(latest.tanker)} · cargo ${n0(latest.cargo)}`)}
      ${statCard('7-day mean', `${n1(s.mean7.total)}<span class="hz-unit">/day</span>`,
        `${s.mean7.days} of 7 days present · tankers ${n1(s.mean7.tanker)}/day`,
        '<span class="hz-calc" title="Arithmetic over the days present — a Felicity computation, not a PortWatch figure">felicity calc</span>')}
      ${statCard('30-day mean', `${n1(s.mean30.total)}<span class="hz-unit">/day</span>`,
        pct && s.priorYear30
          ? `<span class="${tone(pct.total)}">${signed(pct.total)}</span> vs ${n1(s.priorYear30.total)}/day in the same 30 days a year earlier`
          : `${s.mean30.days} of 30 days present · no year-earlier window in this pull`,
        '<span class="hz-calc" title="Arithmetic over the days present — a Felicity computation, not a PortWatch figure">felicity calc</span>')}
      ${statCard('Last 365 days', `${s.range365.low ? n0(s.range365.low.total) : '—'}<span class="hz-unit">low</span> · ${s.range365.high ? n0(s.range365.high.total) : '—'}<span class="hz-unit">high</span>`,
        `${s.range365.low ? esc(longDate(s.range365.low.date)) : '—'} · ${s.range365.high ? esc(longDate(s.range365.high.date)) : '—'} · ${s.range365.days} days in the window`)}
    </div>

    <div class="hz-panel">
      <div class="hz-panel__head">
        <div>
          <div class="hz-panel__title">Daily transit calls</div>
          <div class="hz-panel__sub">Total, tankers, and the 7-day mean. A break in a line is a day PortWatch has no row for.</div>
        </div>
        <div class="hz-ranges" id="hz-ranges">
          ${Object.keys(RANGES).map(k => `<button class="hz-range${k === range ? ' is-on' : ''}" data-range="${k}">${k.toUpperCase()}</button>`).join('')}
        </div>
      </div>
      <div class="hz-chart">${chartSvg(p.rows, days)}</div>
      <div class="hz-legend">
        <span><i class="hz-legend__swatch hz-legend__swatch--total"></i>Total transit calls</span>
        <span><i class="hz-legend__swatch hz-legend__swatch--tanker"></i>Tankers</span>
        <span><i class="hz-legend__swatch hz-legend__swatch--mean"></i>7-day mean (Felicity calc)</span>
      </div>
      <div class="hz-panel__src">Chart drawn from ${p.rows.length} PortWatch rows, not embedded · ${esc(p.integrity.gaps)} missing day${p.integrity.gaps === 1 ? '' : 's'} in the pulled span</div>
    </div>

    <div class="hz-grid">
      <div class="hz-panel">
        <div class="hz-panel__head">
          <div>
            <div class="hz-panel__title">By vessel class</div>
            <div class="hz-panel__sub">Transit calls per day. "All cargo" is the sum of the four non-tanker classes; total is tankers plus cargo.</div>
          </div>
        </div>
        <table class="hz-table">
          <thead><tr><th>Class</th><th>Latest day</th><th>7-day mean</th><th>30-day mean</th></tr></thead>
          <tbody>
            ${classes.map(([label, k]) => `
              <tr class="${k === 'total' ? 'hz-table__total' : ''}">
                <td>${label}</td>
                <td>${n0(latest[k])}</td>
                <td>${n1(s.mean7[k])}</td>
                <td>${n1(s.mean30[k])}</td>
              </tr>`).join('')}
            <tr class="hz-table__cap">
              <td>Tanker carrying capacity <em>est. metric tons, not barrels</em></td>
              <td>${n0(latest.capacityTanker)}</td>
              <td>${n0(s.mean7.capacityTanker)}</td>
              <td>${n0(s.mean30.capacityTanker)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="hz-panel hz-panel--notes">
        <div class="hz-panel__head">
          <div>
            <div class="hz-panel__title">What this counts — and what it cannot</div>
            <div class="hz-panel__sub">Read before quoting a number.</div>
          </div>
        </div>
        <ul class="hz-notes">
          <li><strong>AIS-visible transits only.</strong> A ship that switches its transponder off is invisible to this series. During the 2026 crisis UKMTO's weekly reports have put most Hormuz movements outside AIS, so treat every figure here as a <strong>floor</strong>, not a count of every ship.</li>
          <li><strong>Not today.</strong> PortWatch publishes the daily series weekly; the latest row is ${esc(ago(p.lagDays))} (${esc(longDate(p.latestDate))}). The newest days are provisional and are revised on later releases — this page re-pulls the whole window every time rather than appending.</li>
          <li><strong>No live layer.</strong> There is no free, licensed real-time count of ships in the Strait available to this site. We do not show one, and no number here is animated or extrapolated.</li>
          <li><strong>Capacity is tonnage.</strong> Capacity fields are estimated carrying capacity in metric tons of the ships that transited — not cargo moved, and never barrels of oil.</li>
          <li><strong>Our arithmetic.</strong> 7-day and 30-day means, the year-earlier comparison and the 365-day high/low are Felicity computations over the rows PortWatch served, with missing days left missing.</li>
        </ul>
        <div class="hz-integrity">
          Integrity check on this pull: ${esc(p.integrity.received)} rows received, ${esc(p.integrity.parsed)} parsed, ${esc(p.integrity.dropped)} dropped, ${esc(p.integrity.duplicates)} duplicate date${p.integrity.duplicates === 1 ? '' : 's'}, ${esc(p.integrity.totalMismatches)} row${p.integrity.totalMismatches === 1 ? '' : 's'} where total ≠ tankers + cargo.
        </div>
        <div class="hz-attrib">
          ${esc(src.attribution || 'Source: International Monetary Fund, PortWatch')} ·
          <a href="${safeUrl(src.methodology)}" target="_blank" rel="noopener">methodology ↗</a> ·
          <a href="${safeUrl(src.datasetPage)}" target="_blank" rel="noopener">dataset ↗</a> ·
          <a href="${safeUrl(src.terms)}" target="_blank" rel="noopener">IMF terms ↗</a>
        </div>
      </div>
    </div>`;

  host.querySelector('#hz-ranges')?.addEventListener('click', e => {
    const b = e.target.closest('[data-range]');
    if (!b || !RANGES[b.dataset.range]) return;
    range = b.dataset.range;
    render(host);
  });

  // The section subtitle states the source and the date, like the desk sections do
  const sub = host.closest('section')?.querySelector('.section__header p');
  if (sub) sub.textContent = `IMF PortWatch · AIS-visible daily transit calls · latest day ${p.latestDate} · published weekly, revised`;
}

function renderFail(host, error) {
  host.innerHTML = `
    <div class="tool__fail">Strait of Hormuz transit data unavailable — ${esc(error)}.
      No previous pull is stored in this browser, so nothing is shown rather than an estimate.</div>
    <div class="hz-attrib">Source when available: International Monetary Fund, PortWatch ·
      <a href="https://portwatch.imf.org/pages/chokepoint6" target="_blank" rel="noopener">portwatch.imf.org ↗</a></div>`;
}

async function load(host) {
  host.innerHTML = '<div class="tool__loading">Pulling the IMF PortWatch transit series…</div>';
  let error = 'network error';
  try {
    const r = await fetch('/api/invest/hormuz');
    const d = await r.json();
    if (d && d.ok && Array.isArray(d.rows) && d.rows.length && d.summary) {
      payload = d; stale = null;
      saveLast(d);
      render(host);
      return;
    }
    error = (d && d.error) || `HTTP ${r.status}`;
  } catch (e) {
    error = e.message || error;
  }
  const last = loadLast();
  if (last) {
    payload = last.payload;
    stale = { failedAt: new Date().toISOString(), savedAt: last.savedAt, error };
    render(host);
  } else {
    renderFail(host, error);
  }
}

export function initHormuz() {
  const host = document.getElementById('hormuz-root');
  if (!host) return;
  load(host);
}
