// ═══════════════════════════════════════════════════════════
// HORMUZ — Strait of Hormuz transit monitor
// ═══════════════════════════════════════════════════════════
//
// Two layers, kept visibly apart:
//
//   LIVE WIRE  — Brent and WTI (delayed exchange quotes, minutes old) and
//                the newest headlines mentioning the Strait (GDELT, 15-min
//                refresh). Fetched on load and every ten minutes while the
//                page is visible. This part carries a LIVE badge because it
//                is live, and the badge shows when it was fetched.
//
//   DAILY TRANSITS — IMF PortWatch AIS-visible transit calls per day,
//                published weekly with a lag and revised. The headline
//                carries the date of the last row and its age, computed at
//                render time; never "today". No live dot on this part.
//
// What the page never does: fake a count of ships in the Strait (no free,
// licensed real-time source exists — it says so), fill a gap, or show a
// stored number without saying it is stored. Every payload string passes
// through safe.js before it reaches markup.
// ═══════════════════════════════════════════════════════════

import { escapeHtml, safeUrl } from './safe.js';

const esc = escapeHtml;
const STORE_KEY = 'fi_hormuz_last';
const RANGES = { '90d': 90, '1y': 365, '2y': 730 };

let payload = null;
let stale = null;     // { failedAt, savedAt, error } when showing a browser-stored pull
let range = '1y';
let wire = null;      // last wire payload
let wireStale = null; // { failedAt, error } when the latest wire fetch failed

// ── Formatting ──
const n0 = v => v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
const n1 = v => v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 });
const n2 = v => v == null ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = v => v == null ? '—' : `${v >= 0 ? '+' : ''}${n1(v)}%`;
const signed2 = v => v == null ? '—' : `${v >= 0 ? '+' : ''}${n2(v)}%`;
const tone = v => v == null ? '' : v >= 0 ? 'up' : 'dn';
const hhmm = iso => { try { return new Date(iso).toISOString().slice(11, 16) + ' UTC'; } catch { return ''; } };
const dateTime = iso => { try { return new Date(iso).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; } catch { return ''; } };
const longDate = iso => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
const todayIso = () => new Date().toISOString().slice(0, 10);
const ago = days => days == null ? '' : days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
const relTime = iso => {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return '';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

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
    const p = raw && raw.payload;
    return p && p.ok && Array.isArray(p.rows) && p.rows.length && p.summary && p.summary.latest && p.summary.mean7 && p.summary.mean30 && p.summary.range365 ? raw : null;
  } catch { return null; }
}

const CALC = '<span class="hz-calc" title="Arithmetic over the days present — a Felicity computation, not a PortWatch figure">felicity calc</span>';

// ── Chart: inline SVG drawn from the rows ──
// Lines only; the axis labels are HTML so they never distort. A missing
// day breaks the line instead of being bridged, and a day boxed in by
// gaps still gets a dot so it is not silently invisible.
function chartSvg(rows, days) {
  const latest = rows[rows.length - 1].date;
  const from = addDays(latest, -(days - 1));
  const inWin = rows.filter(r => r.date >= from);
  if (inWin.length < 2) return { html: '<div class="tool__fail">Not enough rows in this range to draw.</div>', count: inWin.length };

  // The 7-day look-back reads the FULL series, so the first week of a range
  // is a real 7-day mean, not a 1-to-6-day one that changes with the range.
  const byDateAll = new Map(rows.map(r => [r.date, r]));
  const mean7 = r => {
    const v = [];
    for (let i = 0; i < 7; i++) { const x = byDateAll.get(addDays(r.date, -i)); if (x) v.push(x.total); }
    return v.reduce((s, x) => s + x, 0) / v.length;
  };

  const W = 640, H = 200, PAD_T = 4, PAD_B = 4;
  const ih = H - PAD_T - PAD_B;
  const yMax = Math.max(1, ...inWin.map(r => r.total));
  const x = iso => (dayIndex(iso, from) / Math.max(1, days - 1)) * W;
  const y = v => PAD_T + ih - (v / yMax) * ih;

  const path = (pick) => {
    let d = '', dots = '', prev = null;
    for (let i = 0; i < inWin.length; i++) {
      const r = inWin[i];
      const v = pick(r);
      if (v == null) { prev = null; continue; }
      const gapBefore = !prev || dayIndex(r.date, prev) > 1;
      const next = inWin[i + 1];
      const gapAfter = !next || dayIndex(next.date, r.date) > 1 || pick(next) == null;
      d += `${gapBefore ? 'M' : 'L'}${x(r.date).toFixed(1)},${y(v).toFixed(1)} `;
      if (gapBefore && gapAfter) dots += `<circle cx="${x(r.date).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2"/>`;
      prev = r.date;
    }
    return { d: d.trim(), dots };
  };

  const levels = [1, 0.5, 0].map(f => Math.round(yMax * f));
  const grid = levels.map(v =>
    `<line x1="0" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="hz-chart__grid"/>`).join('');
  const mid = addDays(from, Math.floor((days - 1) / 2));
  const tanker = path(r => r.tanker), total = path(r => r.total), mean = path(mean7);

  return {
    count: inWin.length,
    html: `
    <div class="hz-chart__frame">
      <div class="hz-chart__y">${levels.map(v => `<span>${v}</span>`).join('')}</div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Daily Strait of Hormuz transit calls, ${esc(from)} to ${esc(latest)}">
        ${grid}
        <g class="hz-chart__tanker"><path d="${tanker.d}"/>${tanker.dots}</g>
        <g class="hz-chart__total"><path d="${total.d}"/>${total.dots}</g>
        <path class="hz-chart__mean" d="${mean.d}"/>
      </svg>
    </div>
    <div class="hz-chart__x"><span>${esc(from)}</span><span>${esc(mid)}</span><span>${esc(latest)}</span></div>`,
  };
}

// ── Live wire ──
function renderWire() {
  const host = document.getElementById('hz-wire');
  if (!host) return;
  if (!wire) {
    host.innerHTML = `
      <div class="hz-panel hz-wire">
        <div class="hz-panel__head"><div><div class="hz-panel__title">Live wire</div>
          <div class="hz-panel__sub">${wireStale ? `Unavailable — ${esc(wireStale.error)}. Nothing is shown in its place.` : 'Fetching Brent, WTI and the newest Strait headlines…'}</div></div></div>
      </div>`;
    return;
  }
  const q = wire.quotes || {};
  const quote = (k) => {
    const v = q[k];
    if (!v || !v.ok) return `<div class="hz-quote hz-quote--na"><span class="hz-quote__label">${esc(v?.label || k)}</span><span class="hz-quote__na">unavailable</span></div>`;
    return `<div class="hz-quote"><span class="hz-quote__label">${esc(v.label)}</span>
      <span class="hz-quote__price">USD ${n2(v.price)}<em>/bbl</em></span>
      <span class="hz-quote__chg ${tone(v.changePct)}">${signed2(v.changePct)}</span></div>`;
  };
  const status = wireStale
    ? `<span class="hz-src hz-src--stale">STALE</span> refresh failed ${esc(hhmm(wireStale.failedAt))} (${esc(wireStale.error)}) — showing the pull from ${esc(hhmm(wire.fetchedAt))}`
    : `<span class="hz-live"><span class="hz-live__dot"></span>LIVE</span> fetched ${esc(hhmm(wire.fetchedAt))} · refreshes every 10 min while open`;
  const heads = (wire.headlines || []).slice(0, 12);
  host.innerHTML = `
    <div class="hz-panel hz-wire">
      <div class="hz-panel__head">
        <div>
          <div class="hz-panel__title">Live wire</div>
          <div class="hz-panel__sub">What is genuinely live about the Strait: oil, and what the world's press is saying. Not a ship count — none exists that we could show honestly.</div>
        </div>
        <div class="hz-wire__status">${status}</div>
      </div>
      <div class="hz-quotes">${quote('BRENT')}${quote('WTI')}
        <div class="hz-quotes__src">Front-month futures · Yahoo Finance delayed quotes · USD per barrel</div>
      </div>
      ${heads.length ? `<ul class="hz-heads">${heads.map(h => `
        <li><a href="${safeUrl(h.url)}" target="_blank" rel="noopener">${esc(h.title)}</a>
          <span class="hz-heads__meta">${esc(h.domain)}${h.seenAt ? ' · ' + esc(relTime(h.seenAt)) : ''}</span></li>`).join('')}</ul>`
        : `<div class="hz-heads__none">No headlines returned${wire.headlinesError ? ` — ${esc(wire.headlinesError)}` : ''}.</div>`}
      <div class="hz-panel__src">Headlines: GDELT DOC 2.0, online news mentioning "Strait of Hormuz", newest first, last 3 days · these are press reports, not verified events</div>
    </div>`;
}

async function fetchWire() {
  try {
    const r = await fetch('/api/invest/hormuz-wire');
    const d = await r.json();
    if (!d || !d.ok) throw new Error((d && d.error) || `HTTP ${r.status}`);
    wire = d; wireStale = null;
  } catch (e) {
    wireStale = { failedAt: new Date().toISOString(), error: e.message || 'network error' };
  }
  renderWire();
  return !wireStale;
}

let wireTimer = null;
export function startHormuzWireRefresh(onUpdate) {
  fetchWire().then(ok => onUpdate && onUpdate(ok));
  wireTimer = setInterval(async () => onUpdate && onUpdate(await fetchWire()), 10 * 60 * 1000);
}
export function stopHormuzWireRefresh() {
  if (wireTimer) { clearInterval(wireTimer); wireTimer = null; }
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
  // Age is computed now, from the row date — never copied from a stored payload
  const lag = dayIndex(todayIso(), p.latestDate);

  const banners = [];
  if (p.stale) banners.push(`
    <div class="hz-stale">
      <span class="hz-stale__badge">STORED PULL</span>
      IMF PortWatch could not be reached at ${esc(dateTime(p.staleAt))}${p.staleReason ? ` (${esc(p.staleReason)})` : ''}. Showing the last successful pull stored on our server, fetched ${esc(dateTime(p.fetchedAt))} — nothing below has been estimated to fill the gap.
    </div>`);
  if (stale) banners.push(`
    <div class="hz-stale">
      <span class="hz-stale__badge">STALE</span>
      Fetch failed at ${esc(dateTime(stale.failedAt))} (${esc(stale.error)}). Showing the last successful pull saved in this browser at ${esc(dateTime(stale.savedAt))} — nothing below has been estimated to fill the gap.
    </div>`);

  const classes = [
    ['Tankers', 'tanker'], ['Container', 'container'], ['Dry bulk', 'dryBulk'],
    ['General cargo', 'generalCargo'], ['Ro-ro', 'roro'], ['All cargo (non-tanker)', 'cargo'], ['Total', 'total'],
  ];
  const chart = chartSvg(p.rows, days);

  const priorText = s.priorYear30
    ? (pct && pct.total != null
        ? `<span class="${tone(pct.total)}">${signed(pct.total)}</span> vs ${n1(s.priorYear30.total)}/day over ${s.priorYear30.days} of the same 30 days a year earlier · ${s.mean30.days} of 30 days present`
        : `${s.mean30.days} of 30 days present · year-earlier window has ${s.priorYear30.days} of 30 days — not enough to compare`)
    : `${s.mean30.days} of 30 days present · no year-earlier window in this pull`;

  host.innerHTML = `
    ${banners.join('')}
    <div id="hz-wire"></div>

    <div class="hz-strip">
      <div class="hz-strip__left">
        <span class="hz-src">${esc(src.name || 'IMF PortWatch')}</span>
        <span class="hz-strip__text">${esc(src.dataset || 'Daily Chokepoints Transit Calls')} · ${esc(src.upstream || 'satellite AIS')} ·
          latest day with data <strong>${esc(longDate(p.latestDate))}</strong> (${esc(ago(lag))}) · published weekly · pulled ${esc(dateTime(p.fetchedAt))}</span>
      </div>
      <a class="hz-strip__link" href="${safeUrl(src.page)}" target="_blank" rel="noopener">PortWatch ↗</a>
    </div>

    <div class="hz-stats">
      ${statCard('Latest day — transit calls', `${n0(latest.total)}<span class="hz-unit">transits</span>`,
        `${esc(longDate(latest.date))} · tankers ${n0(latest.tanker)} · cargo ${n0(latest.cargo)}`)}
      ${statCard('7-day mean', `${n1(s.mean7.total)}<span class="hz-unit">/day</span>`,
        `${s.mean7.days} of 7 days present · tankers ${n1(s.mean7.tanker)}/day`, CALC)}
      ${statCard('30-day mean', `${n1(s.mean30.total)}<span class="hz-unit">/day</span>`, priorText, CALC)}
      ${statCard('Last 365 days', `${s.range365.low ? n0(s.range365.low.total) : '—'}<span class="hz-unit">low</span> · ${s.range365.high ? n0(s.range365.high.total) : '—'}<span class="hz-unit">high</span>`,
        `${s.range365.low ? esc(longDate(s.range365.low.date)) : '—'} · ${s.range365.high ? esc(longDate(s.range365.high.date)) : '—'} · ${s.range365.days} days present in the window`, CALC)}
    </div>

    <div class="hz-panel">
      <div class="hz-panel__head">
        <div>
          <div class="hz-panel__title">Daily transit calls</div>
          <div class="hz-panel__sub">Total, tankers, and the 7-day mean. A break in a line is a day PortWatch has no row for; a lone dot is a day with gaps on both sides.</div>
        </div>
        <div class="hz-ranges" id="hz-ranges">
          ${Object.keys(RANGES).map(k => `<button class="hz-range${k === range ? ' is-on' : ''}" data-range="${k}">${k.toUpperCase()}</button>`).join('')}
        </div>
      </div>
      <div class="hz-chart">${chart.html}</div>
      <div class="hz-legend">
        <span><i class="hz-legend__swatch hz-legend__swatch--total"></i>Total transit calls</span>
        <span><i class="hz-legend__swatch hz-legend__swatch--tanker"></i>Tankers</span>
        <span><i class="hz-legend__swatch hz-legend__swatch--mean"></i>7-day mean (Felicity calc)</span>
      </div>
      <div class="hz-panel__src">Chart drawn from ${chart.count} PortWatch rows in this range (${p.rows.length} pulled), not embedded · ${esc(p.integrity.gaps)} missing day${p.integrity.gaps === 1 ? '' : 's'} across the pulled span</div>
    </div>

    <div class="hz-grid">
      <div class="hz-panel">
        <div class="hz-panel__head">
          <div>
            <div class="hz-panel__title">By vessel class</div>
            <div class="hz-panel__sub">Transit calls per day. "All cargo" is the sum of the four non-tanker classes; total is tankers plus cargo. Means are Felicity arithmetic over the days present.</div>
          </div>
        </div>
        <table class="hz-table">
          <thead><tr><th>Class</th><th>Latest day</th><th>7-day mean ${CALC}</th><th>30-day mean ${CALC}</th></tr></thead>
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
          <li><strong>Not today.</strong> PortWatch publishes the daily series weekly; the latest row is ${esc(ago(lag))} (${esc(longDate(p.latestDate))}). The newest days are provisional and are revised on later releases — our server re-pulls the whole window daily and on every visit rather than appending.</li>
          <li><strong>No live ship count.</strong> There is no free, licensed real-time count of ships in the Strait. The live wire above shows what <em>is</em> live — oil prices and the press — and nothing here is animated or extrapolated.</li>
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

  renderWire();

  host.querySelector('#hz-ranges')?.addEventListener('click', e => {
    const b = e.target.closest('[data-range]');
    if (!b || !RANGES[b.dataset.range]) return;
    range = b.dataset.range;
    render(host);
  });

  const sub = host.closest('section')?.querySelector('.section__header p');
  if (sub) sub.textContent = `Live wire (oil + press) · IMF PortWatch AIS-visible daily transit calls, latest day ${p.latestDate} · published weekly, revised`;
}

function renderFail(host, error) {
  host.innerHTML = `
    <div id="hz-wire"></div>
    <div class="tool__fail">Strait of Hormuz transit data unavailable — ${esc(error)}.
      No previous pull is stored on the server or in this browser, so nothing is shown rather than an estimate.</div>
    <div class="hz-attrib">Source when available: International Monetary Fund, PortWatch ·
      <a href="https://portwatch.imf.org/pages/chokepoint6" target="_blank" rel="noopener">portwatch.imf.org ↗</a></div>`;
  renderWire();
}

async function load(host) {
  host.innerHTML = '<div id="hz-wire"></div><div class="tool__loading">Pulling the IMF PortWatch transit series…</div>';
  renderWire();
  let error = 'network error';
  try {
    const r = await fetch('/api/invest/hormuz');
    const d = await r.json();
    if (d && d.ok && Array.isArray(d.rows) && d.rows.length && d.summary) {
      payload = d; stale = null;
      if (!d.stale) saveLast(d);   // only a fresh pull is worth keeping as "last good"
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
