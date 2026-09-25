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
// Events: GDELT GEO 2.0 — geolocated news coverage of conflict-related
//   terms over the last 24 hours, refreshed by GDELT every 15 minutes.
//   These are places the world's press is writing about kinetic events,
//   with article counts and a lead article — not a casualty database and
//   not a claim that anything happened at that exact point.
//
// Ships stay a labelled reference set: there is no free, licensed AIS feed
// (see lib/hormuz.js for the research).
//
// Both parsers are schema-checked: an upstream that answers with a
// different shape produces ok:false and a reason, never a half-drawn map.
// ═══════════════════════════════════════════════════════════

const OPENSKY_STATES = 'https://opensky-network.org/api/states/all';
const OPENSKY_TOKEN = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const GDELT_GEO = 'https://api.gdeltproject.org/api/v2/geo/geo';

export const FLIGHTS_SOURCE = {
  name: 'OpenSky Network',
  url: 'https://opensky-network.org',
  method: 'ADS-B / Mode S state vectors received by the OpenSky sensor network; aircraft outside sensor coverage (oceans, parts of Africa and Asia) are not in it',
  attribution: 'Data: The OpenSky Network, https://opensky-network.org',
};

export const EVENTS_SOURCE = {
  name: 'GDELT GEO 2.0',
  url: 'https://www.gdeltproject.org',
  method: 'Locations mentioned in worldwide news coverage matching conflict terms over the last 24 hours; size is article count, not severity',
  attribution: 'Data: The GDELT Project, https://www.gdeltproject.org',
};

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

// ── GDELT GEO ──
// Plain terms only: GDELT's GEO endpoint answers a malformed or over-long
// query with an HTML error page, which parseGeo then reports verbatim.
export const EVENTS_QUERY = '(airstrike OR missile OR shelling OR clashes OR bombardment)';

function stripTags(s) { return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

/** GeoJSON PointData → compact events. Article links come from the html property. */
export function parseGeo(json) {
  if (!json || json.type !== 'FeatureCollection' || !Array.isArray(json.features)) {
    throw new Error(`GDELT schema changed — expected a GeoJSON FeatureCollection, got ${json && json.type ? json.type : typeof json}`);
  }
  const events = [];
  for (const f of json.features) {
    const c = f?.geometry?.coordinates;
    if (!Array.isArray(c) || typeof c[0] !== 'number' || typeof c[1] !== 'number') continue;
    const p = f.properties || {};
    // First anchor in the html blob is the lead article; its text may carry inline tags
    const m = String(p.html || '').match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    events.push({
      name: stripTags(p.name) || 'Unnamed location',
      count: Number.isFinite(Number(p.count)) ? Number(p.count) : null,
      lat: r2(c[1]), lng: r2(c[0]),
      url: m && /^https?:\/\//i.test(m[1]) ? m[1] : '',
      title: m ? stripTags(m[2]).slice(0, 160) : '',
    });
  }
  return events;
}

export async function fetchEvents({ timeoutMs = 12000, maxpoints = 250 } = {}) {
  // GEO 2.0 covers the trailing 24 hours by default; no timespan parameter is
  // sent because the endpoint rejects some spellings of it with an HTML page.
  const p = new URLSearchParams({ query: EVENTS_QUERY, mode: 'PointData', format: 'GeoJSON', maxpoints: String(maxpoints) });
  const r = await timedFetch(`${GDELT_GEO}?${p}`, timeoutMs, { headers: { Accept: 'application/json', 'User-Agent': 'FelicityIntelligence/1.0 (+https://felicity-world-map.vercel.app)' } });
  if (!r.ok) throw new Error(`GDELT HTTP ${r.status}`);
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`GDELT answered with non-JSON: ${text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140)}`); }
  const events = parseGeo(json);
  return {
    ok: true,
    source: EVENTS_SOURCE,
    query: EVENTS_QUERY,
    window: '24h',
    fetchedAt: new Date().toISOString(),
    count: events.length,
    events,
  };
}
