// World Map live layers: OpenSky state vectors and GDELT GEO features are
// parsed by documented index/shape, schema drift fails loudly, and the
// /api/data?layer= routes cache success but never a failure.
import { parseStates, parseGeo, fetchFlights, fetchEvents } from '../lib/live-layers.js';

const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

// ── OpenSky ──
const states = {
  time: 1789390000,
  states: [
    ['896400', 'UAE201  ', 'United Arab Emirates', 1789389995, 1789389998, 55.3644, 25.2528, 10668.0, false, 245.5, 314.2, 0, null, 10972.8, '2201', false, 0, 6],
    ['abc123', '', 'Germany', 1789389990, 1789389999, 8.5, 50.03, 0, true, 3.1, 90, 0, null, 100, null, false, 0, 0],      // on ground
    ['def456', 'BAW118', 'United Kingdom', null, 1789389999, null, null, null, false, null, null, null, null, null, null, false, 0, 0],  // no position
    ['fed789', 'QTR7', 'Qatar', 1789389997, 1789389999, 51.6, 25.27, 1524, false, 120.0, 180.0, -5, null, 1600, '1000', false, 0, 3],
    'not an array',
  ],
};
const parsed = parseStates(states);
check(parsed.flights.length === 2 && parsed.onGround === 1 && parsed.noPosition === 1 && parsed.received === 5, `state vectors: ${parsed.flights.length} airborne, ${parsed.onGround} on ground, ${parsed.noPosition} without position`);
const f0 = parsed.flights[0];
check(f0.call === 'UAE201' && f0.country === 'United Arab Emirates' && f0.lat === 25.25 && f0.lng === 55.36 && f0.alt === 10668 && f0.vel === 246 && f0.hdg === 314 && f0.cat === 6, `first vector parsed by documented index (${JSON.stringify(f0)})`);
check(parsed.time === 1789390000, 'feed timestamp carried');
let err = null; try { parseStates({ nope: [] }); } catch (e) { err = e.message; }
check(/schema changed/.test(err || ''), 'OpenSky schema drift fails loudly');

// ── GDELT GEO ──
const geo = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [56.26, 26.57] }, properties: { name: 'Strait Of Hormuz, Oman (general), Oman', count: 143, html: '<a href="https://example.com/x" target="_blank">Tanker <b>hit</b> near Hormuz</a><br><a href="https://example.com/y">second</a>' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: ['bad', 1] }, properties: { name: 'nowhere' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [35.0, 48.5] }, properties: { name: 'Kyiv', count: '12' } },
  ],
};
const events = parseGeo(geo);
check(events.length === 2 && events[0].lat === 26.57 && events[0].lng === 56.26 && events[0].count === 143 && events[0].url === 'https://example.com/x' && events[0].title === 'Tanker hit near Hormuz', `GEO features parsed, [lng,lat] swapped, lead article extracted (${JSON.stringify(events[0])})`);
check(events[1].count === 12 && events[1].url === '' && events[1].title === '', 'feature without html yields no link, count coerced');
err = null; try { parseGeo({ type: 'Nope' }); } catch (e) { err = e.message; }
check(/schema changed/.test(err || ''), 'GDELT schema drift fails loudly');

// ── Fetchers + route, with a recorded fetch ──
const calls = [];
let mode = 'ok';
globalThis.fetch = async (u, opts) => {
  calls.push({ u, opts });
  if (u.includes('auth.opensky-network.org')) return { ok: true, json: async () => ({ access_token: 'tok', expires_in: 1800 }) };
  if (u.includes('opensky-network.org/api/states')) {
    if (mode === 'opensky-429') return { ok: false, status: 429 };
    return { ok: true, status: 200, json: async () => states };
  }
  if (u.includes('gdeltproject.org')) {
    if (mode === 'gdelt-html') return { ok: true, status: 200, text: async () => '<html>slow down</html>' };
    return { ok: true, status: 200, text: async () => JSON.stringify(geo) };
  }
  throw new Error('unexpected fetch ' + u);
};

const fl = await fetchFlights();
check(fl.ok && fl.count === 2 && fl.auth === 'anonymous' && fl.asOf === new Date(1789390000 * 1000).toISOString() && fl.source.name === 'OpenSky Network', `fetchFlights anonymous (${fl.auth}, ${fl.count}, ${fl.asOf})`);
calls.length = 0;
const fl2 = await fetchFlights({ clientId: 'id', clientSecret: 'secret' });
check(fl2.auth === 'authenticated' && calls[0].u.includes('auth.opensky') && calls[1].opts.headers.Authorization === 'Bearer tok', 'client credentials → bearer token on the states call');
calls.length = 0;
await fetchFlights({ clientId: 'id', clientSecret: 'secret' });
check(calls.length === 1, 'token reused within its lifetime');
mode = 'opensky-429';
err = null; try { await fetchFlights(); } catch (e) { err = e.message; }
check(/rate limit reached/.test(err || ''), 'OpenSky 429 explained');
mode = 'ok';
const evs = await fetchEvents();
check(evs.ok && evs.count === 2 && evs.window === '24h' && /airstrike/.test(evs.query), 'fetchEvents');
mode = 'gdelt-html';
err = null; try { await fetchEvents(); } catch (e) { err = e.message; }
check(/non-JSON/.test(err || ''), 'GDELT HTML answer is a named failure');

// Route
mode = 'ok';
const { default: data } = await import('../api/data.js');
const mkRes = () => { const r = { code: 0, payload: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end() {} }; r.status = c => { r.code = c; return r; }; r.json = p => { r.payload = p; return r; }; return r; };
const req = (u, method = 'GET') => ({ method, url: u, headers: { host: 'localhost' } });
let res = mkRes();
await data(req('/api/data?layer=flights'), res);
check(res.code === 200 && res.payload.ok && res.payload.flights.length === 2 && /s-maxage=1200/.test(res.headers['Cache-Control']), 'flights layer served and cached 20 min');
res = mkRes();
await data(req('/api/data?layer=events'), res);
check(res.code === 200 && res.payload.ok && res.payload.events.length === 2 && /s-maxage=900/.test(res.headers['Cache-Control']), 'events layer served and cached 15 min');
mode = 'opensky-429'; res = mkRes();
await data(req('/api/data?layer=flights'), res);
check(res.code === 200 && res.payload.ok === false && /rate limit/.test(res.payload.error) && res.headers['Cache-Control'] === 'no-store' && res.payload.source?.name === 'OpenSky Network', 'layer failure is honest and never cached');
res = mkRes();
await data(req('/api/data?layer=nope'), res);
check(res.code === 404, 'unknown layer is a 404');
delete process.env.DATABASE_URL;
res = mkRes();
await data(req('/api/data'), res);
check(res.code === 200 && res.payload.source === 'fallback' && res.payload.ciiScores && Array.isArray(res.payload.ships), 'plain /api/data still serves the fallback dashboard payload');

if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log(`live layers: OpenSky and GDELT parsing, auth, failure paths and routes — all checks passed`);
