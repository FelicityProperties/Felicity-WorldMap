// ═══════════════════════════════════════════════════════════
// HEATMAP SOURCE PROBE — what the deployed function can actually fetch
// ═══════════════════════════════════════════════════════════
//
// The sixteen markets TradingView withholds from embeds (FTSE 100 … DFM)
// can only be drawn by us, and only from sources the serverless function
// can reach: the development sandbox reaches none of them, a GitHub runner
// is throttled by Yahoo, and several exchanges challenge datacenters. This
// fetches a FIXED list of candidate constituent lists and quote endpoints
// from the function itself and reports status, timing, size and the head
// of each body. The list lives here, not in a query parameter, so the
// route cannot be turned into a fetch proxy.
//
// Diagnostic only: nothing is stored, nothing is cached.
// ═══════════════════════════════════════════════════════════

import { fetchReason } from './fetch-reason.js';
import { readXlsx } from './xlsx.js';

const UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const UA_OWN = 'FelicityIntelligence/1.0 (+https://felicity-world-map.vercel.app)';

const ZHWIKI = 'https://zh.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page=';
const TRWIKI = 'https://tr.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page=';
const WIKI = 'https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page=';

export function probeTargets() {
  return [
    ...['Basic0007B', 'Basic0008', 'Basic0007A', 'Basic0006'].map(page =>
      [`moneydj-${page}-0050`, `https://www.moneydj.com/ETF/X/Basic/${page}.xdjhtm?etfid=0050.TW`, { find: ['資料日期：', 'etfid=2603.TW', 'etfid=2881.TW&back', '</table>'] }]),
    ['moneydj-0007B-2800', 'https://www.moneydj.com/ETF/X/Basic/Basic0007B.xdjhtm?etfid=2800.HK', { find: ['資料日期：', 'etfid=0002.HK', 'etfid=0003.HK'] }],
    ['twse-tai50i', 'https://openapi.twse.com.tw/v1/indicesReport/TAI50I', { parse: 'json', list: j => Array.isArray(j) ? j : [] }],
    ['yahoo-crumb', null, { special: 'yahoo-crumb' }],
  ];
}

// The timeout covers the body as well as the headers: a page that trickles
// in must not hold the function past its budget.
async function timed(url, opts, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: c.signal });
    const buf = new Uint8Array(await r.arrayBuffer());
    const text = new TextDecoder().decode(buf);
    return { status: r.status, headers: r.headers, text: async () => text, buf };
  } finally {
    clearTimeout(t);
  }
}

function headOf(text, n) {
  return text.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, n);
}

async function one(name, url, opt, head, ms) {
  const t0 = Date.now();
  try {
    const r = await timed(url, {
      method: opt.method || 'GET',
      body: opt.body,
      headers: { 'User-Agent': opt.ua || UA_BROWSER, Accept: '*/*', 'Accept-Language': 'en-US,en;q=0.9', ...(opt.headers || {}) },
    }, ms);
    const text = await r.text();
    if (opt.parse === 'xlsx') {
      try {
        const book = readXlsx(r.buf);
        return { target: name, ms: Date.now() - t0, status: r.status, bytes: r.buf.length, sheets: book.sheets.map(sh => ({ name: sh.name, rows: sh.rows.length, head: sh.rows.slice(0, 16).map(row => row.slice(0, 12)) })) };
      } catch (e) { return { target: name, ms: Date.now() - t0, status: r.status, bytes: r.buf.length, error: e.message, head: headOf(text, 200) }; }
    }
    if (opt.parse === 'json') {
      try {
        const j = JSON.parse(text);
        const list = opt.list ? opt.list(j) : null;
        return { target: name, ms: Date.now() - t0, status: r.status, bytes: text.length, keys: Object.keys(j).slice(0, 20), count: list ? list.length : null, sample: list ? [...list.slice(0, 4), ...list.slice(-2)] : undefined };
      } catch (e) { return { target: name, ms: Date.now() - t0, status: r.status, error: e.message, head: headOf(text, 300) }; }
    }
    if (opt.find) {
      // Literal needles, linear scan: each hit with the text around it
      const hits = [];
      for (const needle of opt.find) {
        let i = 0, n = 0;
        while (n < 8 && (i = text.indexOf(needle, i)) !== -1) {
          hits.push(`[${needle}] ` + text.slice(Math.max(0, i - 160), i + 200).replace(/\s+/g, ' '));
          i += needle.length; n++;
        }
      }
      return { target: name, ms: Date.now() - t0, status: r.status, type: r.headers.get('content-type'), bytes: text.length, hits };
    }
    return { target: name, ms: Date.now() - t0, status: r.status, type: r.headers.get('content-type'), bytes: text.length, head: opt.raw ? text.slice(0, head) : headOf(text, head) };
  } catch (e) {
    return { target: name, ms: Date.now() - t0, error: fetchReason(e, ms) };
  }
}

// Yahoo's cookie + crumb handshake, then what the crumb unlocks: the v7
// quote endpoint (market capitalisation), quoteSummary's `components`
// (index members) and `assetProfile` (sector), the search endpoint and the
// screener — each reported compactly so one run covers all sixteen markets.

async function yahooCrumb(head, ms, full) {
  const t0 = Date.now();
  const steps = [];
  try {
    const seed = await timed('https://fc.yahoo.com/', { headers: { 'User-Agent': UA_BROWSER }, redirect: 'manual' }, ms);
    const cookies = (seed.headers.getSetCookie?.() || []).map(c => c.split(';')[0]);
    steps.push({ step: 'cookie', ms: Date.now() - t0, status: seed.status, cookies: cookies.map(c => c.split('=')[0]) });
    const cookie = cookies.join('; ');
    const cr = await timed('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': UA_BROWSER, Cookie: cookie } }, ms);
    const crumb = (await cr.text()).trim();
    steps.push({ step: 'crumb', ms: Date.now() - t0, status: cr.status, length: crumb.length });
    if (cr.status !== 200 || !crumb || crumb.length > 40) return { target: 'yahoo-crumb', ms: Date.now() - t0, steps };
    const get = async (u, opts = {}) => {
      const r = await timed(u + (u.includes('?') ? '&' : '?') + 'crumb=' + encodeURIComponent(crumb),
        { ...opts, headers: { 'User-Agent': UA_BROWSER, Cookie: cookie, Accept: 'application/json', ...(opts.headers || {}) } }, ms);
      const text = await r.text();
      let j = null; try { j = JSON.parse(text); } catch { /* not JSON */ }
      return { status: r.status, text, j };
    };
    // Where else Yahoo keeps a size for members its batch quote leaves bare
    for (const sym of ['ALV.DE', 'HLMA.L', 'KBC.BR', '1928.HK']) {
      const qs = await get(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=price,defaultKeyStatistics,summaryDetail`);
      const r = qs.j?.quoteSummary?.result?.[0] || {};
      const ts = await get(`https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(sym)}?symbol=${encodeURIComponent(sym)}&type=quarterlyOrdinarySharesNumber,annualOrdinarySharesNumber,quarterlyShareIssued&period1=1735689600&period2=1792233600`);
      const series = (ts.j?.timeseries?.result || []).map(x => ({ type: x.meta?.type?.[0], last: (x[x.meta?.type?.[0]] || []).filter(Boolean).slice(-1)[0] || null }));
      steps.push({ step: `size-${sym}`, qsStatus: qs.status, priceCap: r.price?.marketCap?.raw ?? null, sdCap: r.summaryDetail?.marketCap?.raw ?? null, ksShares: r.defaultKeyStatistics?.sharesOutstanding?.raw ?? null, ksImplied: r.defaultKeyStatistics?.impliedSharesOutstanding?.raw ?? null, ksFloat: r.defaultKeyStatistics?.floatShares?.raw ?? null, tsStatus: ts.status, series });
    }
    return { target: 'yahoo-crumb', ms: Date.now() - t0, steps };
  } catch (e) {
    return { target: 'yahoo-crumb', ms: Date.now() - t0, steps, error: fetchReason(e, ms) };
  }
}

/**
 * Probe every target (or one, by name) in parallel. `head` bounds the
 * characters of each body returned (tags and scripts stripped).
 */
export async function probeSources({ only = null, head = 400, timeoutMs = 9000 } = {}) {
  const n = Math.max(80, Math.min(Number(head) || 400, only ? 20000 : 1500));
  const list = probeTargets().filter(([name]) => !only || name === only);
  // A hard deadline per target, so one stuck upstream cannot hold the
  // function past its own limit (round three hung the whole probe)
  const deadline = (name, p) => Promise.race([p, new Promise(r => setTimeout(() => r({ target: name, error: 'probe deadline 40s' }), 40000))]);
  const results = await Promise.all(list.map(([name, url, opt = {}]) =>
    deadline(name, opt.special === 'yahoo-crumb' ? yahooCrumb(n, timeoutMs, !!only) : one(name, url, opt, n, timeoutMs))));
  return { ok: true, at: new Date().toISOString(), region: process.env.VERCEL_REGION || null, results };
}
