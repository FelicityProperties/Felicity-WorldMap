// ═══════════════════════════════════════════════════════════
// STRAIT OF HORMUZ — daily transit evidence and the live wire
// ═══════════════════════════════════════════════════════════
//
// TWO LAYERS, honestly separated.
//
// 1. DAILY TRANSITS — IMF PortWatch "Daily Chokepoints Transit Calls":
//    one row per chokepoint per UTC day since 2019, from UN Global
//    Platform satellite AIS. Hormuz is portid 'chokepoint6'. It is the
//    only free, keyless, machine-readable daily Hormuz series. It is a
//    FLOOR (ships with AIS off are invisible), it is published weekly
//    with a lag of days, recent rows are revised, and capacity fields
//    are deadweight tonnage never barrels. Every caveat travels in the
//    payload so the page and the AI prompts state them.
//
// 2. LIVE WIRE — what is genuinely live about the Strait today: Brent
//    and WTI prices (Yahoo, minutes old) and the newest headlines that
//    mention the Strait (GDELT DOC 2.0, refreshed every 15 minutes).
//    Neither is a ship count. No free, licensed real-time ship count
//    exists for a serverless function; this module does not fake one.
//
// PERSISTENCE — every successful PortWatch pull is stored in Postgres
// (DATABASE_URL, table created on demand) so a PortWatch outage serves
// the last real pull from the server with `stale: true` and the failure
// reason, not a per-browser guess and not nothing. A daily cron re-pulls
// it (vercel.json) so the stored copy is never more than a day behind
// the layer.
//
// Fetch rules learned elsewhere in this repo: one bounded request, both
// URL casings clients use, the whole window re-pulled every time, the
// date accepted in both formats the layer has used, integrity checked
// row by row, and a schema change failing loudly rather than rendering
// nonsense.
//
// Lives in lib/ so it is not a serverless function of its own.
// ═══════════════════════════════════════════════════════════

import { quoteYahoo } from './market-evidence.js';

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

export const WIRE_SOURCE = {
  headlines: { name: 'GDELT DOC 2.0', url: 'https://www.gdeltproject.org', method: 'Worldwide online news mentioning "Strait of Hormuz", newest first, refreshed by GDELT every 15 minutes' },
  quotes: { name: 'Yahoo Finance', url: 'https://finance.yahoo.com', method: 'Front-month Brent (BZ=F) and WTI (CL=F) futures, delayed exchange quotes' },
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
const ymd = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return ymd(new Date(Date.UTC(y, m - 1, d) + n * 86400000));
}

export function daysBetween(fromIso, toIso) {
  const p = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(toIso) - p(fromIso)) / 86400000);
}

// The same calendar date one year earlier (29 Feb → 28 Feb), so "a year
// earlier" survives a leap year rather than drifting by a day.
export function oneYearBefore(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y - 1, m - 1, Math.min(d, 28)));
  if (d > 28) {
    const tryD = new Date(Date.UTC(y - 1, m - 1, d));
    if (tryD.getUTCMonth() === m - 1) return ymd(tryD);
  }
  return ymd(t);
}

const YEAR_MIN = 2015;
const yearMax = () => new Date().getUTCFullYear() + 1;

function isoIfValid(t) {
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  if (y < YEAR_MIN || y > yearMax()) return null;
  return ymd(d);
}

// The layer's date field has been served as epoch milliseconds and as a
// plain YYYY-MM-DD string at different times. The integer year/month/day
// columns are unambiguous, so they win when present and sane; a bad value
// in any form yields null, never "today" and never a 1970 row.
export function parseDate(v, attrs = {}) {
  const { year, month, day } = attrs;
  if (Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day) &&
      year >= YEAR_MIN && year <= yearMax() && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day) return ymd(d);
  }
  if (typeof v === 'number') return isoIfValid(v);
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return isoIfValid(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return isoIfValid(Date.parse(v));
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
 * left null stays null, a malformed row is counted and skipped.
 */
export function normaliseRows(features) {
  const first = features.find(f => f && typeof f === 'object' && f.attributes && typeof f.attributes === 'object');
  const integrity = {
    received: features.length, parsed: 0, dropped: 0, duplicates: 0,
    totalMismatches: 0, cargoMismatches: 0, gaps: 0,
    fieldsSeen: first ? Object.keys(first.attributes) : [],
  };
  const byDate = new Map();
  const today = ymd(new Date());
  for (const f of features) {
    const a = (f && typeof f === 'object' && f.attributes && typeof f.attributes === 'object') ? f.attributes : null;
    if (!a) { integrity.dropped++; continue; }
    const date = parseDate(a.date, a);
    const total = num(a.n_total), tanker = num(a.n_tanker), cargo = num(a.n_cargo);
    if (!date || date > addDays(today, 1) || total == null || tanker == null || cargo == null) { integrity.dropped++; continue; }
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
// A window is comparable only when most of it is present
export const MIN_WINDOW_DAYS = 20;

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
  const prior30 = w(oneYearBefore(latest.date), 30);
  const last365 = windowRows(byDate, latest.date, 365);

  const pct = (a, b) => (a != null && b != null && b > 0) ? r1(((a / b) - 1) * 100) : null;
  const comparable = mean30.days >= MIN_WINDOW_DAYS && prior30.days >= MIN_WINDOW_DAYS;
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
    // Only when both windows are mostly present — a one-day baseline is not a comparison
    pctVsPriorYear: comparable ? { total: pct(mean30.total, prior30.total), tanker: pct(mean30.tanker, prior30.tanker) } : null,
    range365: {
      days: last365.length,
      high: high ? { date: high.date, total: high.total } : null,
      low: low ? { date: low.date, total: low.total } : null,
    },
  };
}

// ── Fetch ──
async function timedFetch(url, ms, init = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: c.signal });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? `timeout after ${ms}ms` : e.message);
  } finally {
    clearTimeout(t);
  }
}

/**
 * Pull the Hormuz series. Throws with a reason when nothing usable came
 * back — the caller decides how to say "unavailable". Never returns a
 * partially invented payload. Bounded overall by deadlineMs.
 */
export async function fetchHormuz({ rows = DEFAULT_ROWS, timeoutMs = 8000, deadlineMs = 14000, today } = {}) {
  const started = Date.now();
  const todayIso = today || ymd(new Date());
  let lastError = 'no response';
  for (const base of ENDPOINTS) {
    const remaining = deadlineMs - (Date.now() - started);
    if (remaining < 500) break;
    let json;
    try {
      const r = await timedFetch(buildQueryUrl(base, rows), Math.min(timeoutMs, remaining), { headers: { Accept: 'application/json' } });
      if (!r.ok) { lastError = `HTTP ${r.status}`; continue; }
      json = await r.json();
    } catch (e) {
      lastError = e.message;
      // A hung host will hang under the other casing too — do not double the wait
      if (/timeout/.test(lastError)) break;
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
      method: 'Rows are PortWatch daily transit calls exactly as served. Means are arithmetic over the days present in each calendar window; missing days are left missing, never interpolated. The year-earlier comparison uses the same 30 calendar days ending on the same date one year before the latest day, and is only computed when both windows have at least 20 days present.',
    };
  }
  throw new Error(`IMF PortWatch unavailable — ${lastError}`);
}

// ── Persistence (Postgres, created on demand) ──
async function sqlClient() {
  const cs = process.env.DATABASE_URL;
  if (!cs) return null;
  try {
    const { neon } = await import('@neondatabase/serverless');
    return neon(cs);
  } catch {
    return null;
  }
}

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS hormuz_snapshots (
      id          SERIAL PRIMARY KEY,
      fetched_at  TIMESTAMPTZ NOT NULL,
      latest_date DATE NOT NULL,
      payload     JSONB NOT NULL
    )`;
}

/** Store a successful pull. Failures are logged, never thrown — storage is a convenience, not the source. */
export async function saveSnapshot(payload) {
  const sql = await sqlClient();
  if (!sql) return { stored: false, reason: 'DATABASE_URL not configured' };
  try {
    await ensureTable(sql);
    await sql`INSERT INTO hormuz_snapshots (fetched_at, latest_date, payload) VALUES (${payload.fetchedAt}, ${payload.latestDate}, ${JSON.stringify(payload)}::jsonb)`;
    // Keep a month of pulls, no more
    await sql`DELETE FROM hormuz_snapshots WHERE id NOT IN (SELECT id FROM hormuz_snapshots ORDER BY fetched_at DESC LIMIT 30)`;
    return { stored: true };
  } catch (e) {
    console.warn('[hormuz] snapshot not stored:', e.message);
    return { stored: false, reason: e.message };
  }
}

/** The most recent stored pull, or null. */
export async function loadSnapshot() {
  const sql = await sqlClient();
  if (!sql) return null;
  try {
    await ensureTable(sql);
    const rows = await sql`SELECT fetched_at, payload FROM hormuz_snapshots ORDER BY fetched_at DESC LIMIT 1`;
    if (!rows.length) return null;
    const p = typeof rows[0].payload === 'string' ? JSON.parse(rows[0].payload) : rows[0].payload;
    if (!p || !Array.isArray(p.rows) || !p.summary) return null;
    return p;
  } catch (e) {
    console.warn('[hormuz] snapshot not loaded:', e.message);
    return null;
  }
}

// ── Live wire: headlines + oil ──
const GDELT_DOC = 'https://api.gdeltproject.org/api/v2/doc/doc';

function stripTags(s) { return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

// GDELT seendate looks like 20260925T101500Z
export function parseSeenDate(s) {
  const m = String(s || '').match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function parseHeadlines(json, max = 20) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.articles)) {
    throw new Error(`GDELT schema changed — expected {articles[]}, got keys ${Object.keys(json || {}).join(', ') || 'none'}`);
  }
  const seen = new Set();
  const out = [];
  for (const a of json.articles) {
    const title = stripTags(a?.title).slice(0, 200);
    const url = typeof a?.url === 'string' && /^https?:\/\//.test(a.url) ? a.url : '';
    if (!title || !url) continue;
    const key = title.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title,
      url,
      domain: stripTags(a.domain).slice(0, 80),
      country: stripTags(a.sourcecountry).slice(0, 40),
      language: stripTags(a.language).slice(0, 20),
      seenAt: parseSeenDate(a.seendate),
    });
    if (out.length >= max) break;
  }
  return out;
}

export async function fetchHormuzWire({ timeoutMs = 8000 } = {}) {
  const p = new URLSearchParams({
    query: '"Strait of Hormuz" sourcelang:english',
    mode: 'ArtList', maxrecords: '40', format: 'json', sort: 'DateDesc', timespan: '3d',
  });
  const [news, brent, wti] = await Promise.allSettled([
    (async () => {
      const r = await timedFetch(`${GDELT_DOC}?${p}`, timeoutMs, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`GDELT HTTP ${r.status}`);
      const text = await r.text();
      let json;
      try { json = JSON.parse(text); } catch { throw new Error(`GDELT answered with non-JSON: ${text.slice(0, 80).replace(/\s+/g, ' ')}`); }
      return parseHeadlines(json);
    })(),
    quoteYahoo('BZ=F', timeoutMs),
    quoteYahoo('CL=F', timeoutMs),
  ]);
  const q = (r, label) => r.status === 'fulfilled'
    ? { ok: true, label, price: r.value.price, changePct: r.value.changePct, asOf: r.value.asOf }
    : { ok: false, label, error: r.reason?.message || 'unavailable' };
  return {
    ok: news.status === 'fulfilled' || brent.status === 'fulfilled' || wti.status === 'fulfilled',
    source: WIRE_SOURCE,
    fetchedAt: new Date().toISOString(),
    headlines: news.status === 'fulfilled' ? news.value : [],
    headlinesError: news.status === 'fulfilled' ? null : (news.reason?.message || 'unavailable'),
    quotes: { BRENT: q(brent, 'Brent crude'), WTI: q(wti, 'WTI crude') },
  };
}

// ── AI evidence block ──
const n0 = v => v == null ? 'n/a' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 1 });

export function renderHormuzEvidence(p) {
  const s = p.summary;
  const prior = s.priorYear30
    ? (s.pctVsPriorYear && s.pctVsPriorYear.total != null
        ? ` vs ${n0(s.priorYear30.total)}/day over ${s.priorYear30.days} of the same 30 days a year earlier (${s.pctVsPriorYear.total >= 0 ? '+' : ''}${n0(s.pctVsPriorYear.total)}%, Felicity calc)`
        : ` (year-earlier window has ${s.priorYear30.days} of 30 days — change not computable, do not claim a year-on-year figure)`)
    : ' (no year-earlier window in the pull — do not claim a year-on-year change)';
  const hi = s.range365.high ? `${s.range365.high.total} on ${s.range365.high.date}` : 'n/a';
  const lo = s.range365.low ? `${s.range365.low.total} on ${s.range365.low.date}` : 'n/a';
  const stale = p.stale ? ` SERVED FROM A STORED PULL: PortWatch could not be reached at ${String(p.staleAt || '').slice(0, 16).replace('T', ' ')} UTC.` : '';
  return `STRAIT OF HORMUZ — IMF PortWatch daily transit calls (UN Global Platform satellite AIS), fetched ${String(p.fetchedAt).slice(0, 16).replace('T', ' ')} UTC. Latest day with data: ${p.latestDate}.${stale} These are AIS-VISIBLE transits only — a floor, not a count of every ship — published weekly and revised.
- Latest day (${s.latest.date}): ${s.latest.total} transit calls — tankers ${s.latest.tanker}, cargo ${s.latest.cargo} (IMF PortWatch)
- 7-day mean, Felicity calc over ${s.mean7.days} days present: ${n0(s.mean7.total)}/day, tankers ${n0(s.mean7.tanker)}/day
- 30-day mean, Felicity calc over ${s.mean30.days} days present: ${n0(s.mean30.total)}/day${prior}
- Last 365 days (Felicity calc over ${s.range365.days} days present): high ${hi}, low ${lo}
Rules: cite daily counts as "AIS-visible transit calls (IMF PortWatch)" with the date; cite means and comparisons as Felicity calculations over PortWatch rows, never as IMF figures; never write "ships in the Strait" or "transits today"; never convert capacity to barrels; a figure not listed here does not exist for you.`;
}

// Only a fixed category reaches the prompt — never raw upstream text
export function renderHormuzUnavailable(reason) {
  const r = String(reason || '');
  const category = /timeout/i.test(r) ? 'upstream timeout' : /schema/i.test(r) ? 'upstream schema change' : /HTTP|ArcGIS/i.test(r) ? 'upstream error' : 'upstream unavailable';
  return `STRAIT OF HORMUZ — transit evidence unavailable this run (${category}). Do not state any Hormuz traffic figure, level or direction; say the desk has no read on Hormuz traffic.`;
}

// Cached for the interactive desk; the brief fetches fresh each run. The
// stored snapshot is the fallback so a PortWatch blip does not blank the desk.
let cache = { at: 0, block: '', ttl: 0 };
export async function hormuzEvidenceBlock({ ttlMs = 6 * 3600000, timeoutMs = 4000, deadlineMs = 5000 } = {}) {
  if (cache.block && Date.now() - cache.at < cache.ttl) return cache.block;
  let block, ttl;
  try {
    block = renderHormuzEvidence(await fetchHormuz({ timeoutMs, deadlineMs }));
    ttl = ttlMs;
  } catch (e) {
    console.warn('[hormuz] evidence unavailable:', e.message);
    const snap = await loadSnapshot();
    if (snap) {
      block = renderHormuzEvidence({ ...snap, stale: true, staleAt: new Date().toISOString() });
      ttl = 60 * 60000;
    } else {
      block = renderHormuzUnavailable(e.message);
      ttl = 60000;
    }
  }
  cache = { at: Date.now(), block, ttl };
  return block;
}
