// The client data module may carry symbol metadata and reference sets, but
// never a market price or a headline: those come from the live endpoints
// or are not shown. This pins that, so a seeded "price: 3234" cannot creep
// back and scroll under the LIVE badge during an outage.
const { markets, news, flights, events, ships } = await import('../js/data.js');

const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

check(Array.isArray(markets) && markets.length >= 15, `markets metadata present (${markets.length})`);
for (const m of markets) {
  check(m.price == null && m.chg == null && !m.live, `${m.sym}: no seeded price/chg/live flag`);
  check(typeof m.sym === 'string' && typeof m.name === 'string', `${m.sym}: symbol metadata intact`);
}
check(Array.isArray(news) && news.length === 0, `news starts empty (${news.length})`);
check(Array.isArray(flights) && flights.length === 0 && Array.isArray(events) && events.length === 0, 'flights and events start empty — live layers fill them');
check(Array.isArray(ships) && ships.length > 0 && ships.every(s => typeof s.name === 'string'), 'ships remain a labelled reference set');

// The ticker must render words, not numbers, from this state
const src = await import('node:fs').then(fs => fs.readFileSync(new URL('../js/ticker.js', import.meta.url), 'utf8'));
check(/m\.live && typeof m\.price === 'number'/.test(src), 'ticker filters on fetched prices');
check(/tick-item--empty/.test(src), 'ticker has an explicit empty state');

// And loadFromAPI must not re-seed from the static /api/data fixtures
const dataSrc = await import('node:fs').then(fs => fs.readFileSync(new URL('../js/data.js', import.meta.url), 'utf8'));
check(!/replaceArray\(markets,/.test(dataSrc) && !/replaceArray\(news,/.test(dataSrc) && !/replaceArray\(flights,/.test(dataSrc), '/api/data does not seed markets, news or flights');

// And the server must not publish seeded prices, authored headlines or a
// fictional flight corridor set at all — not even as a "fallback"
const apiSrc = await import('node:fs').then(fs => fs.readFileSync(new URL('../api/data.js', import.meta.url), 'utf8'));
check(!/price:\s*\d/.test(apiSrc) && !/time:\s*"\d+[mh]"/.test(apiSrc), '/api/data carries no seeded price or headline age');
check(!/call:\s*"/.test(apiSrc) && !/FROM flights/.test(apiSrc), '/api/data carries no authored flights');
const { default: dataHandler } = await import('../api/data.js');
const r = { code: 0, payload: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end() {} };
r.status = c => { r.code = c; return r; }; r.json = p => { r.payload = p; return r; };
const savedDb = process.env.DATABASE_URL; delete process.env.DATABASE_URL;
await dataHandler({ method: 'GET', url: '/api/data', headers: { host: 'localhost' } }, r);
if (savedDb !== undefined) process.env.DATABASE_URL = savedDb;
check(r.code === 200 && r.payload && !('markets' in r.payload) && !('news' in r.payload) && !('flights' in r.payload), 'fallback /api/data response has no markets, news or flights keys');
check(r.payload && Object.keys(r.payload.ciiScores || {}).length > 100 && Array.isArray(r.payload.confZones) && Array.isArray(r.payload.ships), 'fallback /api/data still carries CII scores, conflict zones and reference ships');

if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log(`seed guard: ${markets.length} instruments carry no seeded price, news starts empty — all checks passed`);
