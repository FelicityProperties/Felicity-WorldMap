// Strait of Hormuz evidence: parsing both date formats the PortWatch layer
// has used, integrity accounting, the summary arithmetic by hand, the
// /api/invest/hormuz route with its failure paths (uncached), the stored
// snapshot fallback, the live wire, and the AI block.
import {
  buildQueryUrl, parseDate, normaliseRows, summarise, fetchHormuz, fetchHormuzWire,
  renderHormuzEvidence, renderHormuzUnavailable, addDays, daysBetween, oneYearBefore,
  parseSeenDate, parseHeadlines,
} from '../lib/hormuz.js';

const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

// ── Synthetic PortWatch rows, built so every expected number is hand-checkable ──
// Recent block: 2026-08-05 … 2026-09-13, constant 12/day (tankers 5, cargo 7),
// except the latest day (9: tankers 3, cargo 6), one gap (2026-09-01), one
// duplicate (2026-09-10), one upstream mismatch (2026-08-20 reports total 13).
// Prior-year block: 2025-08-15 … 2025-09-13, constant 80/day (tankers 40).
function attrs(date, total, tanker, cargo, cls, asEpoch) {
  const [y, m, d] = date.split('-').map(Number);
  const a = {
    ObjectId: 1, portid: 'chokepoint6', portname: 'Strait of Hormuz',
    n_total: total, n_tanker: tanker, n_cargo: cargo,
    n_container: cls[0], n_dry_bulk: cls[1], n_general_cargo: cls[2], n_roro: cls[3],
    capacity: 800000, capacity_tanker: 500000,
  };
  if (asEpoch) a.date = Date.UTC(y, m - 1, d);       // the pre-2026 epoch-ms form, no y/m/d columns
  else Object.assign(a, { date, year: y, month: m, day: d });
  return { attributes: a };
}
function synthetic(asEpoch = false, priorDays = 30) {
  const f = [];
  for (let i = 0; i < 40; i++) {
    const date = addDays('2026-08-05', i);
    if (date === '2026-09-01') continue;                       // gap
    if (date === '2026-09-13') f.push(attrs(date, 9, 3, 6, [2, 2, 1, 1], asEpoch));
    else if (date === '2026-08-20') f.push(attrs(date, 13, 5, 7, [2, 2, 2, 1], asEpoch));  // total ≠ 5+7
    else f.push(attrs(date, 12, 5, 7, [2, 2, 2, 1], asEpoch));
    if (date === '2026-09-10') f.push(attrs(date, 12, 5, 7, [2, 2, 2, 1], asEpoch));      // duplicate
  }
  for (let i = 0; i < priorDays; i++) f.push(attrs(addDays('2025-09-13', -i), 80, 40, 40, [10, 10, 10, 10], asEpoch));
  return f.reverse();                                          // the layer serves date DESC
}

// ── Date helpers ──
check(addDays('2026-03-01', -1) === '2026-02-28' && addDays('2026-12-31', 1) === '2027-01-01', 'addDays crosses month and year');
check(daysBetween('2026-09-13', '2026-09-16') === 3, 'daysBetween');
check(oneYearBefore('2026-09-13') === '2025-09-13' && oneYearBefore('2028-02-29') === '2027-02-28' && oneYearBefore('2025-03-01') === '2024-03-01', 'oneYearBefore is calendar-based, leap-safe');
check(parseDate('2026-09-12') === '2026-09-12', 'ISO string date');
check(parseDate('2026-09-12T00:00:00Z') === '2026-09-12', 'ISO datetime date');
check(parseDate(Date.UTC(2026, 8, 12)) === '2026-09-12', 'epoch-ms date');
check(parseDate('2026-09-11', { year: 2026, month: 9, day: 12 }) === '2026-09-12', 'integer y/m/d columns win over the date field');
check(parseDate('2026-09-11', { year: 1999, month: 9, day: 12 }) === '2026-09-11', 'out-of-band y/m/d falls back to the date field');
check(parseDate('2026-09-11', { year: 2026, month: 2, day: 31 }) === '2026-09-11', 'impossible y/m/d (31 Feb) falls back to the date field');
check(parseDate('not a date') === null && parseDate(null) === null, 'unparseable date is null, not today');
check(parseDate(1e300) === null && parseDate(-1) === null && parseDate(NaN) === null, 'absurd epoch values are null, never a 1970 or NaN row');

// ── Query URL ──
const url = buildQueryUrl('https://example.test/q', 760);
check(url.includes("where=portid%3D%27chokepoint6%27") && url.includes('orderByFields=date+DESC') && url.includes('resultRecordCount=760') && url.includes('f=json'), 'query URL shape');
check(buildQueryUrl('x', 5000).includes('resultRecordCount=1000'), 'row request capped at the layer maximum');

// ── Normalisation + integrity, both date formats ──
for (const asEpoch of [false, true]) {
  const { rows, integrity } = normaliseRows(synthetic(asEpoch));
  const tag = asEpoch ? 'epoch' : 'iso';
  check(integrity.received === 70 && integrity.parsed === 69 && integrity.duplicates === 1 && integrity.dropped === 0, `${tag}: counts (received ${integrity.received}, parsed ${integrity.parsed}, dup ${integrity.duplicates})`);
  check(integrity.totalMismatches === 1 && integrity.cargoMismatches === 0, `${tag}: mismatch accounting`);
  check(integrity.gaps === 326, `${tag}: gaps counted across the span (${integrity.gaps})`);
  check(rows[0].date === '2025-08-15' && rows[rows.length - 1].date === '2026-09-13', `${tag}: sorted ascending`);
  check(rows.find(r => r.date === '2026-08-20').total === 13, `${tag}: upstream mismatch kept as served, not corrected`);
  check(!rows.some(r => r.date === '2026-09-01'), `${tag}: gap left missing, not filled`);

  const s = summarise(rows, '2026-09-16');
  check(s.latestDate === '2026-09-13' && s.lagDays === 3, `${tag}: latest date and lag`);
  check(s.latest.total === 9 && s.latest.tanker === 3 && s.latest.cargo === 6, `${tag}: latest row`);
  check(s.mean7.days === 7 && s.mean7.total === 11.6 && s.mean7.tanker === 4.7, `${tag}: 7-day mean (${s.mean7.total}, ${s.mean7.tanker})`);
  check(s.mean30.days === 29 && s.mean30.total === 11.9 && s.mean30.tanker === 4.9, `${tag}: 30-day mean over 29 present days (${s.mean30.total})`);
  check(s.priorYear30 && s.priorYear30.days === 30 && s.priorYear30.total === 80 && s.priorYear30.from === '2025-08-15' && s.priorYear30.to === '2025-09-13', `${tag}: year-earlier window`);
  check(s.pctVsPriorYear.total === -85.1 && s.pctVsPriorYear.tanker === -87.7, `${tag}: pct vs prior year (${s.pctVsPriorYear.total}, ${s.pctVsPriorYear.tanker})`);
  check(s.range365.days === 39 && s.range365.high.total === 13 && s.range365.high.date === '2026-08-20' && s.range365.low.total === 9 && s.range365.low.date === '2026-09-13', `${tag}: 365-day range`);
  check(s.mean7.capacityTanker === 500000 && s.mean30.capacity === 800000, `${tag}: capacity means`);
}

// Malformed rows are counted and skipped, never thrown out of
{
  const { rows, integrity } = normaliseRows([null, { attributes: null }, { attributes: { date: 1e300, n_total: 1, n_tanker: 1, n_cargo: 0 } }, attrs('2026-09-13', 9, 3, 6, [2, 2, 1, 1])]);
  check(rows.length === 1 && integrity.dropped === 3 && integrity.parsed === 1, `malformed rows dropped and counted (${integrity.dropped}), good row kept`);
  check(integrity.fieldsSeen.includes('n_total'), 'fieldsSeen taken from the first well-formed feature');
}

// A thin year-earlier window is reported, not compared
{
  const { rows } = normaliseRows(synthetic(false, 10));
  const s = summarise(rows, '2026-09-16');
  check(s.priorYear30 && s.priorYear30.days === 10 && s.pctVsPriorYear === null, 'ten-day baseline → no YoY figure');
  const txt = renderHormuzEvidence({ fetchedAt: '2026-09-16T10:00:00.000Z', latestDate: s.latestDate, summary: s });
  check(txt.includes('year-earlier window has 10 of 30 days — change not computable'), 'evidence says the baseline is too thin');
}
{
  const { rows } = normaliseRows(synthetic(false, 0));
  const s = summarise(rows, '2026-09-16');
  check(s.priorYear30 === null && s.pctVsPriorYear === null, 'no prior-year window → null, not zero');
  const txt = renderHormuzEvidence({ fetchedAt: '2026-09-16T10:00:00.000Z', latestDate: s.latestDate, summary: s });
  check(txt.includes('do not claim a year-on-year change'), 'evidence forbids a YoY claim without the window');
}

// ── fetchHormuz + the routes, with a recorded fetch ──
const calls = [];
let mode = 'ok';
const PRICES = { 'BZ=F': 109.61, 'CL=F': 104.76 };
globalThis.fetch = async (u, opts) => {
  calls.push(u);
  if (u.includes('finance.yahoo.com')) {
    const sym = decodeURIComponent(u.split('/chart/')[1].split('?')[0]);
    return { ok: true, status: 200, json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: PRICES[sym], chartPreviousClose: PRICES[sym] * 0.92, regularMarketTime: 1789380000 } }] } }) };
  }
  if (u.includes('gdeltproject.org')) {
    if (mode === 'gdelt-html') return { ok: true, status: 200, text: async () => '<html>rate limited</html>' };
    return { ok: true, status: 200, text: async () => JSON.stringify({ articles: [
      { url: 'https://example.com/a', title: 'Tankers <b>queue</b> at Hormuz as insurers pull cover', domain: 'example.com', sourcecountry: 'United Kingdom', language: 'English', seendate: '20260925T101500Z' },
      { url: 'https://example.com/a2', title: 'Tankers queue at Hormuz as insurers pull cover', domain: 'mirror.example', seendate: '20260925T100000Z' },   // duplicate title
      { url: 'javascript:alert(1)', title: 'bad url', domain: 'x', seendate: '20260925T100000Z' },
      { url: 'https://example.com/b', title: 'Brent jumps 8% on pipeline shutdown', domain: 'example.org', seendate: 'garbage' },
    ] }) };
  }
  if (mode === 'first-500' && calls.filter(c => c.includes('arcgis')).length === 1) return { ok: false, status: 500 };
  if (mode === 'arcgis-error') return { ok: true, status: 200, json: async () => ({ error: { code: 400, message: 'Invalid query parameters' } }) };
  if (mode === 'schema-drift') return { ok: true, status: 200, json: async () => ({ features: synthetic().map(f => { const a = { ...f.attributes }; delete a.n_total; return { attributes: a }; }) }) };
  if (mode === 'hang') return new Promise((_, rej) => opts.signal.addEventListener('abort', () => { const e = new Error('x'); e.name = 'AbortError'; rej(e); }));
  return { ok: true, status: 200, json: async () => ({ features: synthetic() }) };
};

const p = await fetchHormuz({ today: '2026-09-16' });
check(p.ok && p.latestDate === '2026-09-13' && p.lagDays === 3 && p.rows.length === 69, 'fetchHormuz payload');
check(calls.length === 1 && calls[0].includes('/arcgis/rest/') && calls[0].includes('chokepoint6'), 'one request to the primary endpoint');
check(p.source.attribution.startsWith('Source: International Monetary Fund, PortWatch'), 'IMF attribution travels with the payload');
check(/floor/.test(p.source.measure) && /never barrels/.test(p.source.capacityNote), 'caveats travel with the payload');
const ev = renderHormuzEvidence(p);
check(ev.includes('Latest day (2026-09-13): 9 transit calls — tankers 3, cargo 6 (IMF PortWatch)'), 'evidence latest line');
check(ev.includes('7-day mean, Felicity calc over 7 days present: 11.6/day, tankers 4.7/day'), 'evidence 7-day line labelled as ours');
check(ev.includes('30-day mean, Felicity calc over 29 days present: 11.9/day vs 80/day over 30 of the same 30 days a year earlier (-85.1%, Felicity calc)'), 'evidence 30-day line with coverage');
check(ev.includes('Last 365 days (Felicity calc over 39 days present): high 13 on 2026-08-20, low 9 on 2026-09-13'), 'evidence range line');
check(ev.includes('AIS-VISIBLE transits only') && ev.includes('never write "ships in the Strait"') && !/\btoday\b/.test(ev.split('Rules:')[0]), 'evidence carries the caveats, absolute dates, no relative "today"');
check(ev.includes('cite means and comparisons as Felicity calculations'), 'evidence tells the model not to attribute our arithmetic to the IMF');

calls.length = 0; mode = 'first-500';
const p2 = await fetchHormuz({ today: '2026-09-16' });
check(p2.ok && calls.length === 2 && calls[1].includes('/ArcGIS/rest/'), 'falls through to the second casing on HTTP 500');

calls.length = 0; mode = 'arcgis-error';
let err = null; try { await fetchHormuz(); } catch (e) { err = e.message; }
check(err && err.includes('ArcGIS 400: Invalid query parameters'), `ArcGIS error body surfaces as a reason (${err})`);

mode = 'schema-drift';
err = null; try { await fetchHormuz(); } catch (e) { err = e.message; }
check(err && err.includes('schema changed') && err.includes('missing n_total'), `schema drift fails loudly (${err})`);

calls.length = 0; mode = 'hang';
let t0 = Date.now();
err = null; try { await fetchHormuz({ timeoutMs: 300, deadlineMs: 2000 }); } catch (e) { err = e.message; }
check(err && /timeout after 300ms/.test(err) && Date.now() - t0 < 1500 && calls.length === 1, `hung upstream times out once, second casing skipped (${err}, ${calls.length} calls)`);
check(renderHormuzUnavailable(err) === 'STRAIT OF HORMUZ — transit evidence unavailable this run (upstream timeout). Do not state any Hormuz traffic figure, level or direction; say the desk has no read on Hormuz traffic.', 'unavailable block carries a category, not raw upstream text');
check(!renderHormuzUnavailable('PortWatch schema changed — missing n_total; fields seen: <script>').includes('<script>'), 'raw upstream text never reaches the prompt');

// ── Live wire ──
check(parseSeenDate('20260925T101500Z') === '2026-09-25T10:15:00.000Z' && parseSeenDate('garbage') === null, 'GDELT seendate parsing');
mode = 'ok'; calls.length = 0;
const w = await fetchHormuzWire();
check(w.ok && w.headlines.length === 2 && w.headlines[0].title === 'Tankers queue at Hormuz as insurers pull cover' && w.headlines[1].seenAt === null, `wire headlines parsed, deduped, tags stripped, bad url dropped (${w.headlines.length})`);
check(w.quotes.BRENT.ok && w.quotes.BRENT.price === 109.61 && w.quotes.WTI.ok && Math.abs(w.quotes.BRENT.changePct - 8.7) < 0.1, 'wire quotes from Yahoo');
mode = 'gdelt-html';
const w2 = await fetchHormuzWire();
check(w2.ok && w2.headlines.length === 0 && /non-JSON/.test(w2.headlinesError) && w2.quotes.BRENT.ok, 'GDELT non-JSON reported, quotes still served');
check(parseHeadlines({ articles: [] }).length === 0, 'empty article list is empty, not an error');
let perr = null; try { parseHeadlines({ nope: 1 }); } catch (e) { perr = e.message; }
check(/schema changed/.test(perr || ''), 'GDELT schema change fails loudly');

// ── Routes ──
const { default: invest } = await import('../api/invest/[action].js');
const mkRes = () => { const r = { code: 0, payload: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end() {} }; r.status = c => { r.code = c; return r; }; r.json = p => { r.payload = p; return r; }; return r; };
const req = (u, method = 'GET') => ({ method, url: u, headers: { host: 'localhost', 'x-forwarded-for': '9.9.9.9' } });
mode = 'ok'; calls.length = 0;
let res = mkRes();
await invest(req('/api/invest/hormuz'), res);
check(res.code === 200 && res.payload.ok && res.payload.rows.length === 69 && res.payload.stored === false, 'GET /api/invest/hormuz returns the series without a symbol (no DB → stored:false)');
check(/s-maxage=3600/.test(res.headers['Cache-Control']), 'success edge-cached for an hour');
res = mkRes();
await invest(req('/api/invest/hormuz?refresh=1'), res);
check(res.code === 200 && res.payload.ok && res.headers['Cache-Control'] === 'no-store', 'cron refresh bypasses the edge cache');
res = mkRes();
await invest(req('/api/invest/hormuz', 'POST'), res);
check(res.code === 405, 'POST rejected');
mode = 'arcgis-error'; res = mkRes();
await invest(req('/api/invest/hormuz'), res);
check(res.code === 200 && res.payload.ok === false && /ArcGIS 400/.test(res.payload.error) && res.payload.source?.name === 'IMF PortWatch', 'upstream failure is an honest ok:false with the source named');
check(res.headers['Cache-Control'] === 'no-store', 'a failure is never edge-cached');
mode = 'ok'; res = mkRes();
await invest(req('/api/invest/hormuz-wire'), res);
check(res.code === 200 && res.payload.ok && res.payload.headlines.length === 2 && /s-maxage=600/.test(res.headers['Cache-Control']), 'GET /api/invest/hormuz-wire served and cached ten minutes');

if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('hormuz: parsing, integrity, summary arithmetic, routes, wire and evidence — all checks passed');
