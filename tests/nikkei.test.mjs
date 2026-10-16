// Nikkei 225 heatmap: TradingView withholds Japan from embeds, so the tiles
// come from Nikkei Inc.'s weight file and Yahoo's spark quotes (lib/nikkei.js)
// and are laid out by js/treemap.js. The fixture rows are copied from the
// real responses the probe workflow and the deployed diag returned on
// 2026-10-16; the synthetic rows only pad the file to 225 constituents.
import { parseCsv, parseWeights, parseSpark, sparkUrl, fetchNikkeiHeatmap, _resetNikkeiMemo, tokyoDay, NIKKEI_WEIGHTS_URL, SPARK_BATCH } from '../lib/nikkei.js';
import { squarify } from '../js/treemap.js';
import { layout, moveColour, shortName, tileHtml } from '../js/nikkei-heatmap.js';

const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

const HEADER = 'Date of Data,Code,Company Name,Nikkei Industrial Classification,Sector,Weight';
const REAL = [
  '"2026/09/30","1332","NISSUI CORP.","Fishery","Consumer Goods","0.0562%"',
  '"2026/09/30","1605","INPEX CORP.","Mining","Materials","0.0737%"',
  '"2026/09/30","1925","DAIWA HOUSE IND. CO., LTD.","Construction","Capital Goods/Others","0.2206%"',
  '"2026/09/30","285A","KIOXIA HOLDINGS CORP.","Electric Machinery","Technology","1.9083%"',
  '"2026/09/30","2914","JAPAN TOBACCO INC.","Foods","Consumer Goods","0.3508%"',
];
const sectors = ['Technology', 'Financials', 'Consumer Goods', 'Materials', 'Capital Goods/Others', 'Transportation and Utilities'];
const pad = Array.from({ length: 225 - REAL.length }, (_, i) => `"2026/09/30","${9000 + i}","PAD ${i} CO., LTD.","Industry ${i % 9}","${sectors[i % 6]}","${(0.4).toFixed(4)}%"`);
// The real file ends with Nikkei's copyright line (probe, 2026-10-16)
const NOTICE = '"This material is a copyrightable work of Nikkei. It is prohibited to copy, reproduce, reprint, or circulate all or part of this material in any form without Nikkei\'s permission."';
const CSV = [HEADER, ...REAL, ...pad, NOTICE].join('\r\n') + '\r\n';

// ── CSV and the weight file ──
const rows = parseCsv(CSV);
check(rows.length === 227 && rows[3][2] === 'DAIWA HOUSE IND. CO., LTD.', 'quoted commas stay inside the field');
check(parseCsv('a,"b ""q"" c"\n')[0][1] === 'b "q" c', 'escaped quotes');
const w = parseWeights(CSV);
check(w.constituents.length === 225 && w.asOf === '2026-09-30', 'all 225 constituents and the file date');
check(w.rowsMalformed === 0 && w.notices.length === 1 && /copyrightable work of Nikkei/.test(w.notices[0]), "Nikkei's copyright line is carried as a notice, not counted as a bad row");
const kioxia = w.constituents.find(c => c.code === '285A');
check(kioxia && kioxia.weightPct === 1.9083 && kioxia.sector === 'Technology' && kioxia.industry === 'Electric Machinery', 'alphanumeric code (285A) and its weight');
check(parseWeights(HEADER + '\n"2026/09/30","12","BAD","x","y","1%"\n"2026/09/30","1332","NISSUI","Fishery","Consumer Goods","n/a"\n').rowsMalformed === 2, 'bad code and bad weight are counted, not kept');
check(parseWeights(CSV + REAL[0] + '\r\n').duplicates === 1, 'a repeated code is counted once');
let schemaErr = '';
try { parseWeights('Date,Ticker,Name\n"2026/09/30","1332","NISSUI"\n'); } catch (e) { schemaErr = e.message; }
check(/schema changed/.test(schemaErr) && /Ticker/.test(schemaErr), 'a changed header fails loudly with the fields it saw');

// ── Spark (shape copied from the Vercel diag's Kioxia row) ──
const sparkRow = (symbol, price, chg, t = 1792132200) => ({ symbol, response: [{ meta: { currency: 'JPY', symbol, exchangeName: 'JPX', regularMarketTime: t, regularMarketPrice: price, regularMarketChangePercent: chg, chartPreviousClose: price / (1 + chg / 100), shortName: symbol } }] });
const sp = parseSpark({ spark: { result: [sparkRow('285A.T', 13375.0, 3.843)] } });
check(sp['285A.T'].price === 13375 && sp['285A.T'].changePct === 3.84 && sp['285A.T'].time === new Date(1792132200 * 1000).toISOString(), 'spark meta → price, day move, quote time');
check(parseSpark({ spark: { result: [{ symbol: 'X.T', response: [{ meta: { regularMarketPrice: 10 } }] }] } })['X.T'].changePct === null, 'no day move from Yahoo stays null — never computed from a guessed close');
check(sparkUrl(['7203.T', '^N225']).includes('symbols=7203.T%2C%5EN225&range=1d&interval=1d'), 'spark URL');
// Review, 16 Oct: Number(null) is 0 — a JSON null must never become a 0.00% tile or a level of 0
const nulls = parseSpark({ spark: { result: [
  { symbol: 'A.T', response: [{ meta: { regularMarketPrice: null, regularMarketChangePercent: null, regularMarketTime: null } }] },
  { symbol: 'B.T', response: [{ meta: { regularMarketPrice: 0, regularMarketChangePercent: 0 } }] },
  { symbol: 'C.T', response: [{ meta: { regularMarketPrice: '1200', regularMarketChangePercent: '1.2' } }] },
] } });
check(Object.values(nulls).every(q => q.price === null && q.changePct === null), 'explicit null, zero price and string fields are missing, not 0');
check(tokyoDay('2026-10-15T23:30:00Z') === '2026-10-16' && tokyoDay(null) === null, 'Tokyo calendar day');
let htmlErr = '';
try { parseWeights('<!DOCTYPE html><html><title>Just a moment...</title>'); } catch (e) { htmlErr = e.message; }
check(/HTML/.test(htmlErr) && !/Just a moment/.test(htmlErr), 'a challenge page is refused as HTML without echoing it');
let longErr = '';
try { parseWeights('X'.repeat(5000) + ',Y\n1,2\n'); } catch (e) { longErr = e.message; }
check(longErr.length < 420, 'a changed header is echoed bounded');

// ── The full pull against stubbed upstreams ──
const asked = [];
let mode = 'ok';
const stub = async (u) => {
  asked.push(u);
  const url = String(u);
  if (url === NIKKEI_WEIGHTS_URL) {
    if (mode === 'csv-403') return new Response('Just a moment...', { status: 403 });
    return new Response(CSV, { status: 200, headers: { 'Content-Type': 'text/csv' } });
  }
  if (url.includes('/v7/finance/spark')) {
    const syms = decodeURIComponent(new URL(url).searchParams.get('symbols')).split(',');
    if (mode === 'one-batch-down' && syms.includes('9100.T')) return new Response('err', { status: 500 });
    if (mode === 'throttle' && !stub.throttled) { stub.throttled = true; return new Response('Too Many Requests', { status: 429 }); }
    if (mode === 'always-429') return new Response('Too Many Requests', { status: 429 });
    if (mode === 'slow') { await new Promise(res => setTimeout(res, 400)); }
    const result = syms.filter(s => !(mode === 'two-missing' && (s === '1332.T' || s === '1605.T')))
      .map(s => s === '^N225' ? (mode === 'index-null' ? { symbol: s, response: [{ meta: { regularMarketPrice: null, regularMarketChangePercent: null } }] } : sparkRow('^N225', 47512.3, -0.62))
        : sparkRow(s, 1000, s === '285A.T' ? 3.84 : -1.25, mode === 'one-stale' && s === '1605.T' ? 1792132200 - 86400 : 1792132200));
    return new Response(JSON.stringify({ spark: { result } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response('unexpected', { status: 404 });
};
const NOW = Date.parse('2026-10-16T07:00:00Z');

_resetNikkeiMemo();
let d = await fetchNikkeiHeatmap({ fetchImpl: stub, now: NOW });
check(d.ok && d.tiles.length === 225 && d.integrity.quoted === 225 && !d.integrity.missing.length, 'complete pull: 225 of 225 quoted');
check(d.integrity.batches === Math.ceil(226 / SPARK_BATCH) && asked.filter(u => String(u).includes('spark')).every(u => decodeURIComponent(new URL(u).searchParams.get('symbols')).split(',').length <= SPARK_BATCH), `spark asked in batches of at most ${SPARK_BATCH}`);
check(d.index && d.index.level === 47512.3 && d.index.changePct === -0.62, 'the index level comes from ^N225 in the same pull');
check(d.weightsAsOf === '2026-09-30' && d.sectors[0] === 'Technology', 'weights dated; sectors in Nikkei order');
// Owner decision, 16 Oct: exact Nikkei weights never leave the server
check(d.tiles.every(t => !('weightPct' in t)) && !('weightSumPct' in d.integrity), 'no exact weight or weight sum in the payload');
const wire = JSON.stringify(d);
check(!/1\.9083|0\.0562|0\.2206/.test(wire), 'the exact figures from the file appear nowhere in the payload');
const kx = d.tiles.find(t => t.code === '285A'), nissui = d.tiles.find(t => t.code === '1332');
check(kx.size === 1.9 && nissui.size === 0.1 && d.tiles.find(t => t.code === '1605').size === 0.1, 'tiles carry the weight rounded to 0.1 point');
check(d.integrity.weightsSumOk === false, 'a file that does not sum to 100% is flagged (the fixture sums to ~90.6%)');

mode = 'two-missing'; _resetNikkeiMemo();
d = await fetchNikkeiHeatmap({ fetchImpl: stub, now: NOW });
check(d.ok && d.integrity.quoted === 223 && d.integrity.missing.join() === '1332,1605' && d.tiles.find(t => t.code === '1332').changePct === null, 'unquoted constituents are kept, null, and listed');

mode = 'one-batch-down'; _resetNikkeiMemo();
d = await fetchNikkeiHeatmap({ fetchImpl: stub, now: NOW });
check(d.integrity.batchesFailed === 1 && d.integrity.missing.length === SPARK_BATCH && d.integrity.batchErrors[0] === 'HTTP 500', 'a failed batch is counted and its constituents listed');

mode = 'throttle'; stub.throttled = false; _resetNikkeiMemo();
d = await fetchNikkeiHeatmap({ fetchImpl: stub, now: NOW });
check(d.integrity.quoted === 225 && d.integrity.batchesFailed === 0, 'one 429 is retried once');

// The weight file is memoised for six hours on a warm instance
mode = 'ok'; asked.length = 0;
await fetchNikkeiHeatmap({ fetchImpl: stub, now: NOW + 3600e3 });
check(!asked.includes(NIKKEI_WEIGHTS_URL), 'weight file reused within six hours');
await fetchNikkeiHeatmap({ fetchImpl: stub, now: NOW + 7 * 3600e3 });
check(asked.includes(NIKKEI_WEIGHTS_URL), 'weight file refetched after six hours');

// A failed six-hourly refresh keeps the dated copy already parsed, and says so
mode = 'csv-403';
d = await fetchNikkeiHeatmap({ fetchImpl: stub, now: NOW + 13 * 3600e3 });
check(d.ok && d.tiles.length === 225 && /403/.test(d.integrity.weightsRefreshError) && !d.complete, 'weight refresh failure serves the last good copy, flagged and not complete');

// Explicit nulls for the index: no level is printed and the pull is not complete
mode = 'index-null'; _resetNikkeiMemo();
d = await fetchNikkeiHeatmap({ fetchImpl: stub, now: NOW });
check(d.index === null && !d.complete && d.integrity.indexQuoted === false, 'a null index quote is no level, not 0');

// A constituent whose last trade is from an earlier session is not today's move
mode = 'one-stale'; _resetNikkeiMemo();
d = await fetchNikkeiHeatmap({ fetchImpl: stub, now: NOW });
const st = d.tiles.find(t => t.code === '1605');
check(st.stale && d.integrity.staleQuotes.length === 1 && d.integrity.staleQuotes[0].day === '2026-10-15' && d.sessionDay === '2026-10-16' && !d.complete, 'an earlier-session quote is flagged stale, listed, and the pull is not complete');

// Throttled: one batch's two attempts, then no further batches are asked
mode = 'always-429'; _resetNikkeiMemo(); asked.length = 0;
d = await fetchNikkeiHeatmap({ fetchImpl: stub, now: NOW });
const sparkCalls = asked.filter(u => String(u).includes('spark')).length;
check(!d.ok && sparkCalls <= 8 && d.integrity.batchesFailed === d.integrity.batches && d.integrity.batchErrors.some(e => /throttling/.test(e)), `a 429 storm stops after the first wave (${sparkCalls} Yahoo calls, not 48)`);

// A time budget turns a slow upstream into listed gaps, not a 504
mode = 'slow'; _resetNikkeiMemo();
d = await fetchNikkeiHeatmap({ fetchImpl: stub, now: NOW, budgetMs: 1200, concurrency: 1 });
check(d.integrity.batchErrors.includes('time budget exceeded') && d.integrity.missing.length > 0 && d.integrity.missing.length < 225, 'past the budget, untaken batches are listed as gaps');

// Back-to-back and concurrent requests share one pull
mode = 'ok'; _resetNikkeiMemo(); asked.length = 0;
const [p1, p2] = await Promise.all([fetchNikkeiHeatmap({ fetchImpl: stub, now: NOW }), fetchNikkeiHeatmap({ fetchImpl: stub, now: NOW })]);
const firstCalls = asked.length;
const p3 = await fetchNikkeiHeatmap({ fetchImpl: stub, now: NOW + 60e3 });
check(p1 === p2 && asked.length === firstCalls && p3.servedFromMemo && p3.memoAgeSec === 60, 'concurrent callers share one pull; a complete pull is reused for two minutes, with its age');
const p4 = await fetchNikkeiHeatmap({ fetchImpl: stub, now: NOW + 121e3 });
check(!p4.servedFromMemo && asked.length > firstCalls, 'after two minutes it is pulled again');

mode = 'csv-403'; _resetNikkeiMemo();
let csvErr = '';
try { await fetchNikkeiHeatmap({ fetchImpl: stub, now: NOW }); } catch (e) { csvErr = e.message; }
check(/HTTP 403/.test(csvErr), 'an unreadable weight file fails — no constituent list is invented');

// ── The route: only a complete pull is edge-cached ──
const realFetch = globalThis.fetch;
globalThis.fetch = (u, o) => stub(u, o);
const { default: invest } = await import('../api/invest/[action].js');
const mkRes = () => { const r = { code: 0, payload: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end() {} }; r.status = c => { r.code = c; return r; }; r.json = p => { r.payload = p; return r; }; return r; };
const call = async () => { const r = mkRes(); await invest({ method: 'GET', url: '/api/invest/nikkei-heatmap', headers: { host: 'localhost', 'x-forwarded-for': '9.9.9.9' } }, r); return r; };
mode = 'ok'; _resetNikkeiMemo();
let r = await call();
check(r.code === 200 && r.payload.ok && r.headers['Cache-Control'] === 's-maxage=120', 'complete pull cached two minutes');
mode = 'two-missing'; _resetNikkeiMemo();
r = await call();
check(r.payload.ok && !r.payload.complete && r.headers['Cache-Control'] === 's-maxage=30', 'partial pull (gaps listed) cached only thirty seconds');
mode = 'csv-403'; _resetNikkeiMemo();
r = await call();
check(r.code === 200 && r.payload.ok === false && /403/.test(r.payload.error) && r.headers['Cache-Control'] === 'no-store' && r.payload.sources?.constituents?.url, 'failure is honest, uncached and names its sources');
globalThis.fetch = realFetch;

// ── Layout ──
const vals = [6, 6, 4, 3, 2, 2, 1];
const rects = squarify(vals, 0, 0, 600, 400);
const area = rects.reduce((s, q) => s + q.w * q.h, 0);
check(Math.abs(area - 240000) < 1e-6, 'tiles fill the rectangle exactly');
check(rects.every((q, i) => Math.abs((q.w * q.h) / 240000 - vals[i] / 24) < 1e-9), 'each tile is proportional to its value');
check(rects.every(q => q.x >= -1e-9 && q.y >= -1e-9 && q.x + q.w <= 600 + 1e-9 && q.y + q.h <= 400 + 1e-9), 'tiles stay inside the box');
let overlap = false;
for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
  const a = rects[i], b = rects[j];
  if (a.x + a.w - 1e-9 > b.x && b.x + b.w - 1e-9 > a.x && a.y + a.h - 1e-9 > b.y && b.y + b.h - 1e-9 > a.y) overlap = true;
}
check(!overlap, 'no two tiles overlap');
check(squarify([3, 0, -1, NaN], 0, 0, 10, 10).slice(1).every(x => x === null), 'zero, negative and NaN values get no tile');

mode = 'ok'; _resetNikkeiMemo();
d = await fetchNikkeiHeatmap({ fetchImpl: stub, now: NOW });
const groups = layout(d, 1000, 600);
check(groups.length === 6 && groups.reduce((n, g) => n + g.tiles.length, 0) === 225, 'every constituent placed, grouped in six sectors');
const tech = groups.find(g => g.name === 'Technology');
check(tech && tech.tiles.every(t => t.rect && t.rect.x >= tech.box.x - 1e-6 && t.rect.x + t.rect.w <= tech.box.x + tech.box.w + 1e-6), 'tiles sit inside their sector');

// ── Colour, labels and escaping ──
check(moveColour(5) === moveColour(3) && moveColour(-9) === moveColour(-3) && moveColour(null) === 'rgb(42, 46, 57)', '±3% saturates; no quote is grey');
check(shortName('KIOXIA HOLDINGS CORP.') === 'KIOXIA' && shortName('DAIWA HOUSE IND. CO., LTD.') === 'DAIWA HOUSE IND.', 'tile labels drop corporate suffixes');
const hostile = tileHtml({ code: '1332', name: '<img src=x onerror=alert(1)>', industry: '"><script>', sector: 'x', size: 1, price: 1, changePct: 1, rect: { x: 0, y: 0, w: 200, h: 100 } });
check(!/% of the index/.test(tileHtml({ code: '1332', name: 'N', industry: 'I', sector: 'x', size: 1, price: 1, changePct: 1, rect: { x: 0, y: 0, w: 200, h: 100 } })), 'tile details print no weight');
check(!/<img|<script/.test(hostile) && /&lt;img/.test(hostile), 'names and industries from the file are escaped');

if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('nikkei: weight file, spark batches, integrity, route caching, treemap layout and escaping — all checks passed');
