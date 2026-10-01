// Owner-only analytics dashboard (analytics.html). Reads
// /api/data?layer=stats with the key held in this browser's localStorage.
// Every value from the server is escaped before it reaches markup —
// referrer hosts and city names arrive from visitors' requests.
import { escapeHtml as esc } from './safe.js';

const KEY = 'fi_analytics_key';
const $ = id => document.getElementById(id);
let range = '7d';

function ls() { try { return window.localStorage; } catch { return null; } }
const getKey = () => ls()?.getItem(KEY) || '';

const TAB_NAMES = { overview: 'Overview', worldmap: 'World Map', invest: 'Invest', dubai: 'Dubai Intel', signals: 'Signals', broadcasts: 'Broadcasts', hormuz: 'Hormuz' };
let regionNames = null;
try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { /* old browser */ }
const countryName = c => { try { return (regionNames && /^[A-Z]{2}$/.test(c) && regionNames.of(c)) || c; } catch { return c; } };
const flag = c => /^[A-Z]{2}$/.test(c) ? String.fromCodePoint(...[...c].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65)) : '';
const fmt = n => Number(n || 0).toLocaleString('en-US');
const dur = s => s == null ? '—' : s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
const ago = iso => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

function showGate(err = '') {
  $('an-gate').hidden = false;
  $('an-body').hidden = true;
  $('an-controls').hidden = true;
  $('an-gate-err').textContent = err;
  $('an-key').focus();
}

async function load() {
  const key = getKey();
  if (!key) return showGate();
  $('an-status').textContent = 'Loading…';
  let r, d;
  try {
    r = await fetch(`/api/data?layer=stats&range=${encodeURIComponent(range)}`, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
    d = await r.json();
  } catch (e) {
    $('an-status').textContent = `Could not reach the server — ${e.message}`;
    return;
  }
  if (r.status === 401) { ls()?.removeItem(KEY); return showGate('That key was not accepted.'); }
  if (!d.ok) {
    $('an-gate').hidden = true; $('an-body').hidden = false; $('an-controls').hidden = false;
    $('an-status').textContent = `Unavailable — ${d.error || `HTTP ${r.status}`}`;
    return;
  }
  // This browser belongs to the owner: stop counting its visits to the site
  ls()?.setItem('fi_owner', '1');
  $('an-gate').hidden = true; $('an-body').hidden = false; $('an-controls').hidden = false;
  render(d);
}

function bars(rows, label = r => esc(r.k), max = null) {
  if (!rows.length) return '<div class="an-empty">No data in this range yet.</div>';
  const top = max ?? Math.max(...rows.map(r => r.n), 1);
  return `<ul class="an-bars">${rows.map(r => `
    <li><span class="an-bars__label">${label(r)}</span><span class="an-bars__n">${fmt(r.n)}</span>
      <span class="an-bars__bar" style="width:${Math.max(2, Math.round((r.n / top) * 100))}%"></span></li>`).join('')}</ul>`;
}

function chart(series, bucket) {
  if (!series.length) return '<div class="an-empty">No visits in this range yet. The tracker starts counting from its first deploy.</div>';
  const W = 900, H = 220, P = { l: 36, r: 10, t: 10, b: 26 };
  const max = Math.max(...series.map(s => s.pageviews), 1);
  const bw = (W - P.l - P.r) / series.length;
  const y = v => P.t + (H - P.t - P.b) * (1 - v / max);
  const label = t => bucket === 'hour' ? t.slice(11, 16) : t.slice(5, 10);
  const step = Math.max(1, Math.ceil(series.length / 10));
  const pvBars = series.map((s, i) => `<rect x="${(P.l + i * bw + bw * 0.15).toFixed(1)}" y="${y(s.pageviews).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${(H - P.b - y(s.pageviews)).toFixed(1)}" class="an-c-pv"><title>${esc(label(s.t))}: ${s.pageviews} page views, ${s.visitors} visitors</title></rect>`).join('');
  const vLine = series.map((s, i) => `${(P.l + i * bw + bw / 2).toFixed(1)},${y(s.visitors).toFixed(1)}`).join(' ');
  const xl = series.map((s, i) => i % step ? '' : `<text x="${(P.l + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" class="an-c-axis" text-anchor="middle">${esc(label(s.t))}</text>`).join('');
  const yl = [0, 0.5, 1].map(f => `<text x="${P.l - 6}" y="${(y(max * f) + 4).toFixed(1)}" class="an-c-axis" text-anchor="end">${Math.round(max * f)}</text><line x1="${P.l}" x2="${W - P.r}" y1="${y(max * f).toFixed(1)}" y2="${y(max * f).toFixed(1)}" class="an-c-grid"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Page views and visitors over time">${yl}${pvBars}<polyline points="${vLine}" class="an-c-v"/>${xl}</svg>`;
}

function render(d) {
  const t = d.totals;
  $('an-status').innerHTML = `<span class="an-live"><i></i>${fmt(t.liveNow)} on the site now</span> · updated ${esc(new Date(d.generatedAt).toLocaleTimeString())}`;
  const kpi = (label, value, sub = '') => `<div class="an-kpi"><div class="an-kpi__label">${label}</div><div class="an-kpi__value">${value}</div>${sub ? `<div class="an-kpi__sub">${sub}</div>` : ''}</div>`;
  $('an-kpis').innerHTML = [
    kpi('Visitors', fmt(t.visitors), `${fmt(t.newVisitors)} new`),
    kpi('Visits', fmt(t.sessions), t.visitors ? `${(t.sessions / t.visitors).toFixed(1)} per visitor` : ''),
    kpi('Page views', fmt(t.pageviews), `${fmt(t.tabViews)} tab switches`),
    kpi('Avg. time on site', dur(t.avgSecs), 'per visit, visible time'),
  ].join('');
  $('an-chart').innerHTML = chart(d.series, d.bucket);
  $('an-countries').innerHTML = bars(d.countries, r => `${flag(r.k)} ${esc(countryName(r.k))}`);
  $('an-cities').innerHTML = bars(d.cities);
  $('an-refs').innerHTML = bars(d.referrers);
  $('an-tabs').innerHTML = bars(d.tabs, r => esc(TAB_NAMES[r.k] || r.k));
  $('an-devices').innerHTML = bars(d.devices, r => esc(r.k[0].toUpperCase() + r.k.slice(1)));
  $('an-browsers').innerHTML = bars([...d.browsers, ...d.os.map(o => ({ k: o.k, n: o.n, os: true }))], r => `${esc(r.k)}${r.os ? ' <em>OS</em>' : ''}`);
  $('an-recent').innerHTML = d.recent.length ? `
    <thead><tr><th>When</th><th>Where</th><th>Device</th><th>From</th><th>Viewed</th><th>Time</th></tr></thead>
    <tbody>${d.recent.map(v => `<tr>
      <td title="${esc(v.started)}">${esc(ago(v.lastSeen))}${v.isNew ? ' <span class="an-new">new</span>' : ''}</td>
      <td>${flag(v.country)} ${esc([v.city, countryName(v.country)].filter(Boolean).join(', ') || 'Unknown')}</td>
      <td>${esc(v.device)} · ${esc(v.browser)} · ${esc(v.os)}</td>
      <td>${esc(v.ref || 'Direct')}</td>
      <td>${esc((v.tabs || '').split(', ').map(x => TAB_NAMES[x] || x).join(', ') || '—')} <span class="an-dim">(${fmt(v.views)})</span></td>
      <td>${esc(dur(v.secs))}</td></tr>`).join('')}</tbody>` : '<tbody><tr><td class="an-empty">No visits in this range yet.</td></tr></tbody>';
}

$('an-form').addEventListener('submit', e => {
  e.preventDefault();
  const k = $('an-key').value.trim();
  if (!k) return;
  ls()?.setItem(KEY, k);
  $('an-key').value = '';
  load();
});
$('an-range').addEventListener('click', e => {
  const b = e.target.closest('[data-range]');
  if (!b) return;
  range = b.dataset.range;
  document.querySelectorAll('#an-range button').forEach(x => x.classList.toggle('is-on', x === b));
  load();
});
$('an-refresh').addEventListener('click', load);
$('an-signout').addEventListener('click', () => { ls()?.removeItem(KEY); showGate(); });

load();
