// World Map live layers: OpenSky state vectors and GDELT 2.0 event rows are
// parsed by documented index/shape, schema drift fails loudly, and the
// /api/data?layer= routes cache success but never a failure.
import { parseStates, fetchFlights, fetchEvents, parseLastUpdate, exportStamps, unzipSingle, parseEventRows, aggregateEvents } from '../lib/live-layers.js';
import { deflateRawSync } from 'node:zlib';

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

// ── GDELT 2.0 event export ──
const row = (id, root, lat, lng, name, mentions, url) => { const c = new Array(61).fill(''); c[0] = id; c[28] = root; c[31] = String(mentions); c[33] = '3'; c[34] = '-4.2'; c[51] = '4'; c[52] = name; c[53] = 'IR'; c[56] = String(lat); c[57] = String(lng); c[59] = '20260927190000'; c[60] = url; return c.join('\t'); };
const tsv = [
  row('1', '19', 26.57, 56.26, 'Strait Of Hormuz, Oman', 12, 'https://example.com/a'),
  row('2', '19', 26.571, 56.262, 'Strait Of Hormuz, Oman', 30, 'https://example.com/b'),   // same place after rounding, more mentions
  row('3', '04', 48.5, 35.0, 'Kyiv', 99, 'https://example.com/c'),                          // not a material-conflict root
  row('4', '18', 0, 0, 'nowhere', 5, ''),                                                     // no usable location
  row('5', '20', 15.5, 32.5, 'Khartoum, Sudan', 7, 'javascript:alert(1)'),                  // bad url dropped, event kept
  'short\trow',
].join('\n');
const zipOf = (text, method) => {
  const body = method === 8 ? deflateRawSync(Buffer.from(text)) : Buffer.from(text);
  const name = Buffer.from('x.CSV');
  const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(method, 8); h.writeUInt32LE(body.length, 18); h.writeUInt32LE(text.length, 22); h.writeUInt16LE(name.length, 26);
  return Buffer.concat([h, name, body]);
};
check(await unzipSingle(zipOf('hello\tworld', 0)) === 'hello\tworld' && await unzipSingle(zipOf(tsv, 8)) === tsv, 'zip entry read, stored and deflated');
err = null; try { await unzipSingle(Buffer.from('<html>blocked</html>')); } catch (e) { err = e.message; }
check(/not a zip/.test(err || ''), 'a non-zip answer fails loudly');
const pr = parseEventRows(tsv);
check(pr.rows === 6 && pr.malformed === 1 && pr.events.length === 3 && pr.events[2].url === '' && pr.events[0].geoType === 4, `event rows parsed by documented column (${pr.rows} rows, ${pr.malformed} malformed, ${pr.events.length} conflict events)`);
const agg = aggregateEvents(pr.events);
check(agg.length === 2 && agg[0].name === 'Strait Of Hormuz, Oman' && agg[0].count === 42 && agg[0].events === 2 && agg[0].url === 'https://example.com/b' && agg[1].count === 7, `places aggregated by rounded location, most-mentioned article kept (${JSON.stringify(agg[0])})`);
check(parseLastUpdate('123 abc http://data.gdeltproject.org/gdeltv2/20260927190000.export.CSV.zip\n456 def http://data.gdeltproject.org/gdeltv2/20260927190000.mentions.CSV.zip') === '20260927190000', 'lastupdate.txt parsed');
err = null; try { parseLastUpdate('<html>nope</html>'); } catch (e) { err = e.message; }
check(/schema changed/.test(err || ''), 'lastupdate schema drift fails loudly');
check(exportStamps('20260927000000', 3).join() === '20260927000000,20260926234500,20260926233000', 'export stamps step back 15 minutes across midnight');

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
  if (u.includes('lastupdate.txt')) {
    if (mode === 'gdelt-html') return { ok: true, status: 200, text: async () => '<html>slow down</html>' };
    return { ok: true, status: 200, text: async () => '1 a http://data.gdeltproject.org/gdeltv2/20260927190000.export.CSV.zip' };
  }
  if (u.includes('.export.CSV.zip')) {
    if (u.includes('20260927184500')) return { ok: false, status: 404 };            // a slot GDELT skipped
    return { ok: true, status: 200, arrayBuffer: async () => zipOf(tsv, 8) };
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
check(evs.ok && evs.count === 2 && evs.filesFetched === 7 && evs.filesMissing === 1 && evs.window === '105m' && evs.rowsMalformed === 7 && evs.events[0].count === 42 * 7, `fetchEvents reads the newest files, skips a missing slot, reports its accounting (${evs.filesFetched} files, window ${evs.window})`);
mode = 'gdelt-html';
err = null; try { await fetchEvents(); } catch (e) { err = e.message; }
check(/schema changed/.test(err || ''), 'GDELT HTML answer is a named failure');

// Route
mode = 'ok';
const { default: data } = await import('../api/data.js');
// Edge runtime: a Request in, a Response out
const call = async (u, method = 'GET') => {
  const r = await data(new Request('http://localhost' + u, { method }));
  const text = await r.text();
  return { code: r.status, payload: text ? JSON.parse(text) : null, headers: { 'Cache-Control': r.headers.get('Cache-Control') } };
};
let res = await call('/api/data?layer=flights');
check(res.code === 200 && res.payload.ok && res.payload.flights.length === 2 && /s-maxage=300/.test(res.headers['Cache-Control']), 'flights layer served and cached 5 min');
res = await call('/api/data?layer=events');
check(res.code === 200 && res.payload.ok && res.payload.events.length === 2 && /s-maxage=300/.test(res.headers['Cache-Control']), 'events layer served and cached 5 min');
mode = 'opensky-429';
res = await call('/api/data?layer=flights');
check(res.code === 200 && res.payload.ok === false && /rate limit/.test(res.payload.error) && res.headers['Cache-Control'] === 'no-store' && res.payload.source?.name === 'OpenSky Network', 'layer failure is honest and never cached');
// A relayed copy is edge-cached only until it leaves the 45-minute window
const { relayCacheHeader } = await import('../api/data.js');
check(relayCacheHeader(0) === 's-maxage=300', 'a new relay copy caches 5 min');
check(relayCacheHeader(43) === 's-maxage=120', 'a 43-minute copy caches only its 2 fresh minutes');
check(relayCacheHeader(45) === 'no-store' && relayCacheHeader(60) === 'no-store', 'a copy at or past the window is never cached');
res = await call('/api/data?layer=nope');
check(res.code === 404, 'unknown layer is a 404');

// Relay ingest: token gate, kind gate, payload gate; no store without a database
const post = async (u, body, token) => {
  const r = await data(new Request('http://localhost' + u, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));
  return { code: r.status, payload: await r.json() };
};
delete process.env.LIVE_LAYERS_TOKEN;
res = await post('/api/data?layer=ingest&kind=flights', { ok: true, fetchedAt: 'x' }, 'abc');
check(res.code === 503, 'ingest refuses when no token is configured');
process.env.LIVE_LAYERS_TOKEN = 'secret-token';
res = await post('/api/data?layer=ingest&kind=flights', { ok: true, fetchedAt: 'x' }, 'wrong-token1');
check(res.code === 401, 'ingest rejects a wrong token');
res = await post('/api/data?layer=ingest&kind=flights', { ok: true, fetchedAt: 'x' });
check(res.code === 401, 'ingest rejects a missing token');
res = await post('/api/data?layer=ingest&kind=nope', { ok: true, fetchedAt: 'x' }, 'secret-token');
check(res.code === 400, 'ingest rejects an unknown kind');
res = await post('/api/data?layer=ingest&kind=flights', { ok: false, error: 'boom' }, 'secret-token');
check(res.code === 400, 'ingest rejects a failed fetch as a payload');
delete process.env.DATABASE_URL;
res = await post('/api/data?layer=ingest&kind=flights', { ok: true, fetchedAt: '2026-09-27T18:00:00.000Z', flights: [] }, 'secret-token');
check(res.code === 503 && res.payload.stored === false, 'ingest reports honestly when there is no database');
res = await call('/api/data?layer=ingest');
check(res.code === 405, 'GET on ingest is a 405');
delete process.env.LIVE_LAYERS_TOKEN;
delete process.env.DATABASE_URL;
res = await call('/api/data');
check(res.code === 200 && res.payload.source === 'fallback' && res.payload.ciiScores && Array.isArray(res.payload.ships), 'plain /api/data still serves the fallback dashboard payload');

if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log(`live layers: OpenSky and GDELT parsing, auth, failure paths and routes — all checks passed`);
