// ═══════════════════════════════════════════════════════════
// STRAIT OF HORMUZ — daily transit evidence from IMF PortWatch
// ═══════════════════════════════════════════════════════════
//
// The only free, keyless, machine-readable daily series of Strait of
// Hormuz ship traffic is the IMF PortWatch "Daily Chokepoints Transit
// Calls" layer: one row per chokepoint per day since 2019, derived from
// UN Global Platform satellite AIS. Hormuz is portid 'chokepoint6'.
//
// What the number IS: AIS-visible transit calls per UTC day, by vessel
// class, plus estimated carrying capacity in metric tons.
// What it is NOT: a count of every ship. Vessels that switch AIS off
// are invisible to it (UKMTO's weekly reports put roughly three in four
// Hormuz movements outside AIS during the 2026 crisis), so it is a
// floor. It is not "today": the series is published weekly with a lag
// of days, and recent days are revised as late AIS lands. And capacity
// is deadweight tonnage, never barrels of oil.
//
// Every one of those caveats is carried in the payload so the page and
// the AI prompts state them instead of quietly dropping them.
//
// Fetch rules, learned the hard way elsewhere in this repo: one bounded
// request, both URL casings that PortWatch clients use, the whole
// window re-pulled every time (revisions — never append), the parsed
// date accepted in both formats the layer has used (epoch ms until
// spring 2026, YYYY-MM-DD strings since), integrity checked row by row,
// and a schema change fails loudly rather than rendering nonsense.
//
// Lives in lib/ so it is not a serverless function of its own.
// ═══════════════════════════════════════════════════════════

export const HORMUZ_PORTID = 'chokepoint6';

export const HORMUZ_SOURCE = {
  name: 'IMF PortWatch',
  dataset: 'Daily Chokepoints Transit Calls',
  upstream: 'UN Global Platform satellite AIS',
  page: 'https://portwatch.imf.org/pages/chokepoint6',
  datasetPage: 'https://portwatch.imf.org/datasets/42132aa4e2fc4d41bdaf9a445f688931_0/about',
  methodology: 'https://portwatch.imf.org/pages/data-and-methodology',
  terms: 'https://www.imf.org/external/terms.htm',
  attribution: 'Source: International Monetary Fund, PortWatch, https://portwatch.imf.org/pages/chokepoint6',
  cadence: 'Daily series, published weekly; the newest rows are provisional and revised on later releases',
  measure: 'AIS-visible transit calls per UTC day — a floor, not a count of every ship',
  capacityNote: 'Capacity fields are estimated carrying capacity in metric tons (deadweight), not cargo moved and never barrels',
};

// Both casings circulate among working PortWatch clients; ArcGIS serves both.
const ENDPOINTS = [
  'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query',
  'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query',
];

const OUT_FIELDS = [
  'date', 'year', 'month', 'day', 'portid', 'portname',
  'n_total', 'n_tanker', 'n_cargo', 'n_container', 'n_dry_bulk', 'n_general_cargo', 'n_roro',
  'capacity', 'capacity_tanker',
];

// ~25 months: a full year for the chart plus the same window a year
// earlier for the baseline, comfortably under the layer's 1,000-row cap.
export const DEFAULT_ROWS = 760;

export function buildQueryUrl(base, rows = DEFAULT_ROWS) {
  const p = new URLSearchParams({
    where: `portid='${HORMUZ_PORTID}'`,
    outFields: OUT_FIELDS.join(','),
    orderByFields: 'date DESC',
    resultRecordCount: String(Math.max(1, Math.min(rows, 1000))),
    returnGeometry: 'false',
    f: 'json',
  });
  return `${base}?${p.toString()}`;
}

// ── Dates (UTC calendar days as YYYY-MM-DD strings) ──
const pad = n => String(n).padStart(2, '0');

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + n * 86400000;
  const x = new Date(t);
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

export function daysBetween(fromIso, toIso) {
  const p = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(toIso) - p(fromIso)) / 86400000);
}

// The layer's date field has been served as epoch milliseconds and as a
// plain YYYY-MM-DD string at different times. The integer year/month/day
// columns are unambiguous, so they win when present.
export function parseDate(v, attrs = {}) {
  const { year, month, day } = attrs;
  if (Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v).toISOString().slice(0, 10);
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  }
  return null;
}

const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v
  : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) ? Number(v)
  : null;

/**
 * Turn ArcGIS features into clean daily rows, oldest first, one per date,
 * and report everything that had to be dropped or that does not add up.
 * Nothing is filled in: a missing day stays missing, a class the layer
 * left null stays null.
 */
export function normaliseRows(features) {
  const integrity = {
    received: features.length, parsed: 0, dropped: 0, duplicates: 0,
    totalMismatches: 0, cargoMismatches: 0, gaps: 0,
    fieldsSeen: features.length ? Object.keys(features[0].attributes || {}) : [],
  };
  const byDate = new Map();
  for (const f of features) {
    const a = f?.attributes || {};
    const date = parseDate(a.date, a);
    const total = num(a.n_total), tanker = num(a.n_tanker), cargo = num(a.n_cargo);
    if (!date || total == null || tanker == null || cargo == null) { integrity.dropped++; continue; }
    if (byDate.has(date)) { integrity.duplicates++; continue; }
    const row = {
      date, total, tanker, cargo,
      container: num(a.n_container), dryBulk: num(a.n_dry_bulk),
      generalCargo: num(a.n_general_cargo), roro: num(a.n_roro),
      capacity: num(a.capacity), capacityTanker: num(a.capacity_tanker),
    };
    if (total !== tanker + cargo) integrity.totalMismatches++;
    const classes = [row.container, row.dryBulk, row.generalCargo, row.roro];
    if (classes.every(x => x != null) && cargo !== classes.reduce((s, x) => s + x, 0)) integrity.cargoMismatches++;
    byDate.set(date, row);
    integrity.parsed++;
  }
  const rows = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (rows.length > 1) {
    integrity.gaps = daysBetween(rows[0].date, rows[rows.length - 1].date) + 1 - rows.length;
  }
  return { rows, integrity };
}

// ── Summary arithmetic (means over the rows present in a calendar window) ──
const r1 = x => x == null ? null : Math.round(x * 10) / 10;
const CLASS_KEYS = ['total', 'tanker', 'cargo', 'container', 'dryBulk', 'generalCargo', 'roro', 'capacity', 'capacityTanker'];

function windowRows(byDate, endIso, days) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const r = byDate.get(addDays(endIso, -i));
    if (r) out.push(r);
  }
  return out;
}

function meansOf(rowsIn, from, to) {
  const m = { days: rowsIn.length, from, to };
  for (const k of CLASS_KEYS) {
    const v = rowsIn.map(r => r[k]).filter(x => x != null);
    m[k] = v.length ? r1(v.reduce((s, x) => s + x, 0) / v.length) : null;
  }
  return m;
}

export function summarise(rows, todayIso) {
  if (!rows.length) return null;
  const byDate = new Map(rows.map(r => [r.date, r]));
  const latest = rows[rows.length - 1];
  const w = (end, days) => meansOf(windowRows(byDate, end, days), addDays(end, -(days - 1)), end);

  const mean7 = w(latest.date, 7);
  const mean30 = w(latest.date, 30);
  const priorEnd = addDays(latest.date, -365);
  const prior30 = w(priorEnd, 30);
  const last365 = windowRows(byDate, latest.date, 365);

  const pct = (a, b) => (a != null && b != null && b > 0) ? r1(((a / b) - 1) * 100) : null;
  const extreme = (pick) => last365.reduce((best, r) => (best == null || pick(r, best)) ? r : best, null);
  const high = extreme((r, b) => r.total > b.total);
  const low = extreme((r, b) => r.total < b.total);

  return {
    latestDate: latest.date,
    lagDays: todayIso ? daysBetween(latest.date, todayIso) : null,
    latest,
    mean7,
    mean30,
    priorYear30: prior30.days ? prior30 : null,
    pctVsPriorYear: prior30.days ? { total: pct(mean30.total, prior30.total), tanker: pct(mean30.tanker, prior30.tanker) } : null,
    range365: {
      days: last365.length,
      high: high ? { date: high.date, total: high.total } : null,
      low: low ? { date: low.date, total: low.total } : null,
    },
  };
}

// ── Fetch ──
async function timedFetch(url, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { signal: c.signal, headers: { Accept: 'application/json' } });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? `timeout after ${ms}ms` : e.message);
  } finally {
    clearTimeout(t);
  }
}

/**
 * Pull the Hormuz series. Throws with a reason when nothing usable came
 * back — the caller decides how to say "unavailable". Never returns a
 * partially invented payload.
 */
export async function fetchHormuz({ rows = DEFAULT_ROWS, timeoutMs = 8000, today } = {}) {
  const todayIso = today || new Date().toISOString().slice(0, 10);
  let lastError = 'no response';
  for (const base of ENDPOINTS) {
    let json;
    try {
      const r = await timedFetch(buildQueryUrl(base, rows), timeoutMs);
      if (!r.ok) { lastError = `HTTP ${r.status}`; continue; }
      json = await r.json();
    } catch (e) {
      lastError = e.message;
      continue;
    }
    if (json?.error) { lastError = `ArcGIS ${json.error.code || ''}: ${json.error.message || 'error'}`.trim(); continue; }
    if (!Array.isArray(json?.features)) { lastError = 'unexpected payload (no features array)'; continue; }
    if (!json.features.length) { lastError = 'no rows returned for chokepoint6'; continue; }

    const { rows: clean, integrity } = normaliseRows(json.features);
    const missing = ['n_total', 'n_tanker', 'n_cargo', 'date'].filter(k => !integrity.fieldsSeen.includes(k));
    if (missing.length) throw new Error(`PortWatch schema changed — missing ${missing.join(', ')}; fields seen: ${integrity.fieldsSeen.join(', ')}`);
    if (!clean.length) throw new Error(`PortWatch rows could not be parsed (${integrity.received} received, ${integrity.dropped} dropped)`);

    return {
      ok: true,
      source: HORMUZ_SOURCE,
      endpoint: base,
      fetchedAt: new Date().toISOString(),
      latestDate: clean[clean.length - 1].date,
      lagDays: daysBetween(clean[clean.length - 1].date, todayIso),
      rows: clean,
      summary: summarise(clean, todayIso),
      integrity,
      method: 'Rows are PortWatch daily transit calls exactly as served. Means are arithmetic over the days present in each calendar window; missing days are left missing, never interpolated. The year-earlier comparison uses the same 30 calendar days ending 365 days before the latest day.',
    };
  }
  throw new Error(`IMF PortWatch unavailable — ${lastError}`);
}

// ── AI evidence block ──
const n0 = v => v == null ? 'n/a' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 });

export function renderHormuzEvidence(p) {
  const s = p.summary;
  const lag = p.lagDays === 0 ? 'today' : `${p.lagDays} day${p.lagDays === 1 ? '' : 's'} before today`;
  const prior = s.priorYear30 && s.pctVsPriorYear
    ? ` vs ${n0(s.priorYear30.total)}/day over the same 30 days a year earlier (${s.pctVsPriorYear.total >= 0 ? '+' : ''}${n0(s.pctVsPriorYear.total)}%)`
    : ' (no year-earlier window in the pull — do not claim a year-on-year change)';
  const hi = s.range365.high ? `${s.range365.high.total} on ${s.range365.high.date}` : 'n/a';
  const lo = s.range365.low ? `${s.range365.low.total} on ${s.range365.low.date}` : 'n/a';
  return `STRAIT OF HORMUZ — IMF PortWatch daily transit calls (UN Global Platform satellite AIS), fetched ${p.fetchedAt.slice(0, 16).replace('T', ' ')} UTC. Latest day with data: ${p.latestDate} (${lag}). These are AIS-VISIBLE transits only — a floor, not a count of every ship — published weekly and revised.
- Latest day (${s.latest.date}): ${s.latest.total} transits — tankers ${s.latest.tanker}, cargo ${s.latest.cargo}
- 7-day mean (${s.mean7.days} days present): ${n0(s.mean7.total)}/day, tankers ${n0(s.mean7.tanker)}/day
- 30-day mean (${s.mean30.days} days present): ${n0(s.mean30.total)}/day${prior}
- Last 365 days: high ${hi}, low ${lo}
Rules: cite these as "AIS-visible transit calls (IMF PortWatch)" with the date; never write "ships in the Strait" or "transits today"; never convert capacity to barrels; a figure not listed here does not exist for you.`;
}

export function renderHormuzUnavailable(reason) {
  return `STRAIT OF HORMUZ — transit evidence unavailable this run (${reason}). Do not state any Hormuz traffic figure, level or direction; say the desk has no read on Hormuz traffic.`;
}

// Cached for the interactive desk; the brief fetches fresh each run.
let cache = { at: 0, block: '', ttl: 0 };
export async function hormuzEvidenceBlock({ ttlMs = 6 * 3600000, timeoutMs = 4000 } = {}) {
  if (cache.block && Date.now() - cache.at < cache.ttl) return cache.block;
  let block, ttl;
  try {
    block = renderHormuzEvidence(await fetchHormuz({ timeoutMs }));
    ttl = ttlMs;
  } catch (e) {
    block = renderHormuzUnavailable(e.message);
    ttl = 60000;
    console.warn('[hormuz] evidence unavailable:', e.message);
  }
  cache = { at: Date.now(), block, ttl };
  return block;
}
