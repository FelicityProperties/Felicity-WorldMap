// ═══════════════════════════════════════════════════════════
// LIVE LAYERS — real feeds behind the World Map
// ═══════════════════════════════════════════════════════════
//
// Flights: OpenSky Network ADS-B state vectors — every aircraft heard by
//   the network in the last few seconds, worldwide. Free, no key needed
//   (400 credits/day anonymously; a global pull costs 4), or 4,000/day
//   with a free account's OAuth2 client credentials in OPENSKY_CLIENT_ID /
//   OPENSKY_CLIENT_SECRET. Either way the endpoint is edge-cached so the
//   allowance is never spent by a busy tab.
//
// Events: the GDELT 2.0 Event export files (data.gdeltproject.org, one
//   zipped TSV every 15 minutes). The GEO 2.0 API this used to call now
//   answers 404 from every network we tried (Sep 2026), and the DOC API
//   rate-limits datacenter addresses. The export files are plain static
//   objects. Each run reads the newest EVENTS_FILES files (2 hours),
//   keeps material-conflict events (CAMEO root codes 18 assault, 19
//   fight, 20 unconventional mass violence) that carry an action
//   location, and aggregates them by place with their mention counts and
//   the most-mentioned source article. These are places the world's press
//   is writing about kinetic events — not a casualty database and not a
//   claim that anything happened at that exact point.
//
// Ships stay a labelled reference set: there is no free, licensed AIS feed
// (see lib/hormuz.js for the research).
//
// Both parsers are schema-checked: an upstream that answers with a
// different shape produces ok:false and a reason, never a half-drawn map.
// ═══════════════════════════════════════════════════════════

import { fetchReason } from './fetch-reason.js';

const OPENSKY_STATES = 'https://opensky-network.org/api/states/all';
const OPENSKY_TOKEN = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const GDELT_EXPORT_BASE = 'http://data.gdeltproject.org/gdeltv2/';
const GDELT_LASTUPDATE = 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt';
const EVENTS_FILES = 8;            // 8 × 15 min = the last 2 hours
const EVENTS_MAX = 300;            // most-mentioned places kept
const CONFLICT_ROOTS = new Set(['18', '19', '20']);

export const FLIGHTS_SOURCE = {
  name: 'OpenSky Network',
  url: 'https://opensky-network.org',
  method: 'ADS-B / Mode S state vectors received by the OpenSky sensor network; aircraft outside sensor coverage (oceans, parts of Africa and Asia) are not in it',
  attribution: 'Data: The OpenSky Network, https://opensky-network.org',
};

export const EVENTS_SOURCE = {
  name: 'GDELT 2.0 Events',
  url: 'https://www.gdeltproject.org',
  method: 'Material-conflict events (CAMEO assault, fight, mass violence) coded from worldwide news in the last 2 hours, aggregated by action location; size is mention count, not severity',
  attribution: 'Data: The GDELT Project, https://www.gdeltproject.org',
};

async function timedFetch(url, ms, init = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: c.signal });
  } catch (e) {
    throw new Error(fetchReason(e, ms));
  } finally {
    clearTimeout(t);
  }
}

// ── OpenSky ──
let token = { value: null, exp: 0 };
async function bearer(clientId, clientSecret, timeoutMs) {
  if (!clientId || !clientSecret) return null;
  if (token.value && Date.now() < token.exp - 60000) return token.value;
  const r = await timedFetch(OPENSKY_TOKEN, timeoutMs, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString(),
  });
  if (!r.ok) throw new Error(`OpenSky token HTTP ${r.status}`);
  const j = await r.json();
  if (!j.access_token) throw new Error('OpenSky token response had no access_token');
  token = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 1800) * 1000 };
  return token.value;
}

const r2 = v => Math.round(v * 100) / 100;

/**
 * OpenSky state vector, by documented index:
 *   0 icao24, 1 callsign, 2 origin_country, 3 time_position, 4 last_contact,
 *   5 longitude, 6 latitude, 7 baro_altitude, 8 on_ground, 9 velocity,
 *   10 true_track, 11 vertical_rate, 12 sensors, 13 geo_altitude, 14 squawk,
 *   15 spi, 16 position_source, 17 category
 */
export function parseStates(json) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.states)) {
    throw new Error(`OpenSky schema changed — expected {time, states[]}, got keys ${Object.keys(json || {}).join(', ') || 'none'}`);
  }
  const flights = [];
  let onGround = 0, noPosition = 0;
  for (const s of json.states) {
    if (!Array.isArray(s) || s.length < 11) continue;
    const lng = s[5], lat = s[6];
    if (typeof lat !== 'number' || typeof lng !== 'number') { noPosition++; continue; }
    if (s[8] === true) { onGround++; continue; }
    flights.push({
      icao: String(s[0] || ''),
      call: String(s[1] || '').trim(),
      country: String(s[2] || ''),
      lat: r2(lat), lng: r2(lng),
      alt: typeof s[7] === 'number' ? Math.round(s[7]) : (typeof s[13] === 'number' ? Math.round(s[13]) : null),   // metres
      vel: typeof s[9] === 'number' ? Math.round(s[9]) : null,        // m/s
      hdg: typeof s[10] === 'number' ? Math.round(s[10]) : null,      // degrees
      cat: typeof s[17] === 'number' ? s[17] : null,
    });
  }
  return { time: typeof json.time === 'number' ? json.time : null, flights, onGround, noPosition, received: json.states.length };
}

export async function fetchFlights({ clientId, clientSecret, timeoutMs = 12000 } = {}) {
  let auth = 'anonymous';
  const headers = {};
  try {
    const t = await bearer(clientId, clientSecret, 6000);
    if (t) { headers.Authorization = `Bearer ${t}`; auth = 'authenticated'; }
  } catch (e) {
    console.warn('[live-layers] OpenSky auth failed, falling back to anonymous:', e.message);
  }
  const r = await timedFetch(OPENSKY_STATES, timeoutMs, { headers });
  if (r.status === 429) throw new Error('OpenSky rate limit reached for today (HTTP 429)');
  if (!r.ok) throw new Error(`OpenSky HTTP ${r.status}`);
  const parsed = parseStates(await r.json());
  return {
    ok: true,
    source: FLIGHTS_SOURCE,
    auth,
    fetchedAt: new Date().toISOString(),
    asOf: parsed.time ? new Date(parsed.time * 1000).toISOString() : null,
    count: parsed.flights.length,
    onGround: parsed.onGround,
    noPosition: parsed.noPosition,
    received: parsed.received,
    flights: parsed.flights,
  };
}

// ── GDELT 2.0 event export: file names, the zip container, the TSV ──

/** 'YYYYMMDDHHMMSS' of the newest export named in lastupdate.txt. */
export function parseLastUpdate(text) {
  const m = String(text || '').match(/(\d{14})\.export\.CSV\.zip/);
  if (!m) throw new Error(`GDELT lastupdate.txt schema changed: ${String(text || '').slice(0, 80).replace(/\s+/g, ' ')}`);
  return m[1];
}

/** The newest `n` export file stamps, 15 minutes apart, newest first. */
export function exportStamps(latest, n = EVENTS_FILES) {
  const t = Date.UTC(+latest.slice(0, 4), +latest.slice(4, 6) - 1, +latest.slice(6, 8), +latest.slice(8, 10), +latest.slice(10, 12), +latest.slice(12, 14));
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(t - i * 15 * 60000);
    out.push(d.toISOString().replace(/[-:T]/g, '').slice(0, 14));
  }
  return out;
}

/** The single entry of a GDELT export zip, as text. Web APIs only, so it runs on the Edge runtime too. */
export async function unzipSingle(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 30 || dv.getUint32(0, true) !== 0x04034b50) throw new Error('not a zip file');
  const flags = dv.getUint16(6, true);
  const method = dv.getUint16(8, true);
  const compSize = dv.getUint32(18, true);
  const nameLen = dv.getUint16(26, true);
  const extraLen = dv.getUint16(28, true);
  const start = 30 + nameLen + extraLen;
  // With the data-descriptor flag the size is unknown up front; inflate to the end
  const data = (flags & 8) || !compSize ? b.subarray(start) : b.subarray(start, start + compSize);
  if (method === 0) return new TextDecoder().decode(data);
  if (method !== 8) throw new Error(`zip method ${method} not supported`);
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

/**
 * GDELT 2.0 event rows (61 tab-separated columns, documented layout) →
 * compact conflict events with an action location. Rows with a different
 * width are counted, not guessed at.
 */
export function parseEventRows(tsv) {
  const events = [];
  let rows = 0, malformed = 0;
  for (const line of String(tsv || '').split('\n')) {
    if (!line) continue;
    rows++;
    const c = line.split('\t');
    if (c.length !== 61) { malformed++; continue; }
    if (!CONFLICT_ROOTS.has(c[28])) continue;
    const lat = Number(c[56]), lng = Number(c[57]);
    if (!c[52] || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
    events.push({
      id: c[0],
      name: c[52].slice(0, 120),
      country: c[53],
      geoType: Number(c[51]) || 0,      // 1 country · 2 US state · 3 US city · 4 world city · 5 world state
      lat: r2(lat), lng: r2(lng),
      root: c[28],
      mentions: Number(c[31]) || 0,
      articles: Number(c[33]) || 0,
      tone: Number(c[34]) || 0,
      url: /^https?:\/\//i.test(c[60]) ? c[60] : '',
      addedAt: c[59],
    });
  }
  return { events, rows, malformed };
}

/** Aggregate events by place: mention totals, event count, the most-mentioned article. */
export function aggregateEvents(events, max = EVENTS_MAX) {
  const byPlace = new Map();
  for (const e of events) {
    const key = `${e.lat},${e.lng}`;
    const p = byPlace.get(key) || { name: e.name, country: e.country, geoType: e.geoType, lat: e.lat, lng: e.lng, count: 0, events: 0, url: '', topMentions: -1 };
    p.count += e.mentions;
    p.events += 1;
    if (e.url && e.mentions > p.topMentions) { p.url = e.url; p.topMentions = e.mentions; }
    byPlace.set(key, p);
  }
  return [...byPlace.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, max)
    .map(({ topMentions, ...p }) => ({ ...p, title: '' }));
}

export async function fetchEvents({ timeoutMs = 12000, files = EVENTS_FILES } = {}) {
  const ua = { 'User-Agent': 'FelicityIntelligence/1.0 (+https://felicity-world-map.vercel.app)' };
  const lu = await timedFetch(GDELT_LASTUPDATE, timeoutMs, { headers: ua });
  if (!lu.ok) throw new Error(`GDELT lastupdate HTTP ${lu.status}`);
  const latest = parseLastUpdate(await lu.text());
  const stamps = exportStamps(latest, files);
  const all = [];
  let rows = 0, malformed = 0, fetched = 0, missing = 0;
  const errors = [];
  for (const stamp of stamps) {
    const url = `${GDELT_EXPORT_BASE}${stamp}.export.CSV.zip`;
    try {
      const r = await timedFetch(url, timeoutMs, { headers: ua });
      if (r.status === 404) { missing++; continue; }       // a slot GDELT skipped
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const parsed = parseEventRows(await unzipSingle(await r.arrayBuffer()));
      all.push(...parsed.events);
      rows += parsed.rows; malformed += parsed.malformed; fetched++;
    } catch (e) {
      errors.push(`${stamp}: ${e.message}`);
    }
  }
  if (!fetched) throw new Error(`GDELT export unreadable — ${errors[0] || `${missing} files missing`}`);
  const events = aggregateEvents(all);
  return {
    ok: true,
    source: EVENTS_SOURCE,
    window: `${fetched * 15}m`,
    latestFile: latest,
    filesFetched: fetched,
    filesMissing: missing,
    fileErrors: errors,
    rowsRead: rows,
    rowsMalformed: malformed,
    conflictEvents: all.length,
    fetchedAt: new Date().toISOString(),
    count: events.length,
    events,
  };
}
