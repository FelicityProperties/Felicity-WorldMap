// Strait of Hormuz evidence: parsing both date formats the PortWatch layer
// has used, integrity accounting, the summary arithmetic by hand, the
// /api/invest/hormuz route with its failure paths, and the AI block.
import {
  buildQueryUrl, parseDate, normaliseRows, summarise, fetchHormuz,
  renderHormuzEvidence, renderHormuzUnavailable, addDays, daysBetween,
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
function synthetic(asEpoch = false) {
  const f = [];
  for (let i = 0; i < 40; i++) {
    const date = addDays('2026-08-05', i);
    if (date === '2026-09-01') continue;                       // gap
    if (date === '2026-09-13') f.push(attrs(date, 9, 3, 6, [2, 2, 1, 1], asEpoch));
    else if (date === '2026-08-20') f.push(attrs(date, 13, 5, 7, [2, 2, 2, 1], asEpoch));  // total ≠ 5+7
    else f.push(attrs(date, 12, 5, 7, [2, 2, 2, 1], asEpoch));
    if (date === '2026-09-10') f.push(attrs(date, 12, 5, 7, [2, 2, 2, 1], asEpoch));      // duplicate
  }
  for (let i = 0; i < 30; i++) f.push(attrs(addDays('2025-08-15', i), 80, 40, 40, [10, 10, 10, 10], asEpoch));
  return f.reverse();                                          // the layer serves date DESC
}

// ── Date helpers ──
check(addDays('2026-03-01', -1) === '2026-02-28' && addDays('2026-12-31', 1) === '2027-01-01', 'addDays crosses month and year');
check(daysBetween('2026-09-13', '2026-09-16') === 3, 'daysBetween');
check(parseDate('2026-09-12') === '2026-09-12', 'ISO string date');
check(parseDate('2026-09-12T00:00:00Z') === '2026-09-12', 'ISO datetime date');
check(parseDate(Date.UTC(2026, 8, 12)) === '2026-09-12', 'epoch-ms date');
check(parseDate('2026-09-11', { year: 2026, month: 9, day: 12 }) === '2026-09-12', 'integer y/m/d columns win over the date field');
check(parseDate('not a date') === null && parseDate(null) === null, 'unparseable date is null, not today');

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

// No prior-year window → no year-on-year claim, and the evidence says so
{
  const { rows } = normaliseRows(synthetic().filter(f => (f.attributes.year || 2026) === 2026 || (typeof f.attributes.date === 'string' && f.attributes.date.startsWith('2026'))));
  const s = summarise(rows, '2026-09-16');
  check(s.priorYear30 === null && s.pctVsPriorYear === null, 'no prior-year window → null, not zero');
  const txt = renderHormuzEvidence({ fetchedAt: '2026-09-16T10:00:00.000Z', latestDate: s.latestDate, lagDays: 3, summary: s });
  check(txt.includes('do not claim a year-on-year change'), 'evidence forbids a YoY claim without the window');
}

// ── fetchHormuz + the route, with a recorded fetch ──
const calls = [];
let mode = 'ok';
globalThis.fetch = async (u, opts) => {
  calls.push(u);
  if (mode === 'first-500' && calls.length === 1) return { ok: false, status: 500 };
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
check(ev.includes('Latest day (2026-09-13): 9 transits — tankers 3, cargo 6'), 'evidence latest line');
check(ev.includes('7-day mean (7 days present): 11.6/day, tankers 4.7/day'), 'evidence 7-day line');
check(ev.includes('30-day mean (29 days present): 11.9/day vs 80/day over the same 30 days a year earlier (-85.1%)'), 'evidence 30-day line');
check(ev.includes('high 13 on 2026-08-20, low 9 on 2026-09-13'), 'evidence range line');
check(ev.includes('AIS-VISIBLE transits only') && ev.includes('never write "ships in the Strait"'), 'evidence carries the caveats and rules');

calls.length = 0; mode = 'first-500';
const p2 = await fetchHormuz({ today: '2026-09-16' });
check(p2.ok && calls.length === 2 && calls[1].includes('/ArcGIS/rest/'), 'falls through to the second casing on HTTP 500');

calls.length = 0; mode = 'arcgis-error';
let err = null; try { await fetchHormuz(); } catch (e) { err = e.message; }
check(err && err.includes('ArcGIS 400: Invalid query parameters'), `ArcGIS error body surfaces as a reason (${err})`);

mode = 'schema-drift';
err = null; try { await fetchHormuz(); } catch (e) { err = e.message; }
check(err && err.includes('schema changed') && err.includes('missing n_total'), `schema drift fails loudly (${err})`);

mode = 'hang';
const t0 = Date.now();
err = null; try { await fetchHormuz({ timeoutMs: 300 }); } catch (e) { err = e.message; }
check(err && /timeout after 300ms/.test(err) && Date.now() - t0 < 2000, `hung upstream times out per endpoint (${err})`);
check(renderHormuzUnavailable(err).includes('Do not state any Hormuz traffic figure'), 'unavailable block forbids a figure');

// Route
const { default: invest } = await import('../api/invest/[action].js');
const mkRes = () => { const r = { code: 0, payload: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end() {} }; r.status = c => { r.code = c; return r; }; r.json = p => { r.payload = p; return r; }; return r; };
mode = 'ok'; calls.length = 0;
let res = mkRes();
await invest({ method: 'GET', url: '/api/invest/hormuz', headers: { host: 'localhost', 'x-forwarded-for': '9.9.9.9' } }, res);
check(res.code === 200 && res.payload.ok && res.payload.rows.length === 69, 'GET /api/invest/hormuz returns the series without a symbol');
check(/s-maxage=3600/.test(res.headers['Cache-Control']), 'edge-cached for an hour');
res = mkRes();
await invest({ method: 'POST', url: '/api/invest/hormuz', headers: { host: 'localhost', 'x-forwarded-for': '9.9.9.9' } }, res);
check(res.code === 405, 'POST rejected');
mode = 'arcgis-error'; res = mkRes();
await invest({ method: 'GET', url: '/api/invest/hormuz', headers: { host: 'localhost', 'x-forwarded-for': '9.9.9.9' } }, res);
check(res.code === 200 && res.payload.ok === false && /ArcGIS 400/.test(res.payload.error) && res.payload.source?.name === 'IMF PortWatch', 'upstream failure is an honest ok:false with the source named');

if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('hormuz: parsing, integrity, summary arithmetic, route and evidence — all checks passed');
