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
// It found the sources lib/index-heatmap.js uses (17 Oct); the list below
// is now those sources' raw endpoints, for a quick status check. To vet a
// new upstream, add it here, deploy, and call ?only=<name>&head=N. For the
// parsed view — every market's members as the heatmap reads them — use
// /api/invest/index-heatmap?diag=members instead.
//
// Diagnostic only: nothing is stored, nothing is cached.
// ═══════════════════════════════════════════════════════════

import { fetchReason } from './fetch-reason.js';
import { readXlsx } from './xlsx.js';

const UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const UA_OWN = 'FelicityIntelligence/1.0 (+https://felicity-world-map.vercel.app)';

export function probeTargets() {
  return [
    ['wikipedia-revisions', 'https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=timestamp|ids&format=json&formatversion=2&redirects=1&titles=FTSE_100_Index|CAC_40|EURO_STOXX_50|AEX_index|BEL_20', { ua: UA_OWN }],
    ['nse-nifty50-csv', 'https://niftyindices.com/IndexConstituent/ind_nifty50list.csv', { find: ['Company Name'] }],
    ['cni-399001', 'https://www.cnindex.com.cn/sample-detail/detail?indexcode=399001&dateStr=&pageNum=1&rows=5', { parse: 'json', list: j => (j?.data?.rows || []).map(x => `${x.seccode} ${x.dateStr}`) }],
    ['kap-indices', 'https://www.kap.org.tr/en/Endeksler', { find: ['"code\\":\\"XU100\\"'] }],
    ['ssga-es3-xlsx', 'https://www.ssga.com/sg/en_gb/intermediary/etfs/library-content/products/fund-data/etfs/apac/holdings-daily-sg-en-es3.xlsx', { parse: 'xlsx' }],
    ['moneydj-2800', 'https://www.moneydj.com/ETF/X/Basic/Basic0007B.xdjhtm?etfid=2800.HK', { find: ['資料日期：'] }],
    ['moneydj-0050', 'https://www.moneydj.com/ETF/X/Basic/Basic0007B.xdjhtm?etfid=0050.TW', { find: ['資料日期：'] }],
    ['invesco-sx5e', 'https://dng-api.invesco.com/cache/v1/accounts/en_GB/shareclasses/IE00B60SWX25/holdings/index?idType=isin', { parse: 'json', list: j => [j.effectiveDate, ...(j.holdings || []).map(h => `${h.isin} ${h.name}`)] }],
    ['invesco-stoxx600', 'https://dng-api.invesco.com/cache/v1/accounts/en_GB/shareclasses/IE00B60SWW18/holdings/index?idType=isin', { parse: 'json', list: j => (j.holdings || []).map(h => h.isin) }],
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
        // Shape and date only — never the holdings rows, which carry the
        // fund's weights
        const book = readXlsx(r.buf);
        return { target: name, ms: Date.now() - t0, status: r.status, bytes: r.buf.length, sheets: book.sheets.map(sh => ({ name: sh.name, rows: sh.rows.length, asOf: (sh.rows.find(row => /^holdings as of/i.test(row[0] || '')) || [])[1] || null, header: (sh.rows.find(row => row.includes('Ticker')) || []).slice(0, 16) })) };
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
          // A short window: on holdings pages the cells after a stock are its weight
          hits.push(`[${needle}] ` + text.slice(i, i + needle.length + 40).replace(/\s+/g, ' '));
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
    // The three Yahoo calls the heatmaps make: the batch quote, the
    // screener and the fundamentals series
    const qt = await get(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent('AZN.L,005930.KS,2222.SR')}&fields=symbol,regularMarketPrice,marketCap,sector`);
    steps.push({ step: 'quote', status: qt.status, rows: (qt.j?.quoteResponse?.result || []).map(x => [x.symbol, x.regularMarketPrice ?? null, x.marketCap ?? null, x.sector ?? null]) });
    const sc = await get('https://query1.finance.yahoo.com/v1/finance/screener', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ size: 3, offset: 0, sortField: 'intradaymarketcap', sortType: 'DESC', quoteType: 'EQUITY', query: { operator: 'and', operands: [{ operator: 'eq', operands: ['exchange', 'DFM'] }] } }) });
    steps.push({ step: 'screener', status: sc.status, total: sc.j?.finance?.result?.[0]?.total ?? null });
    const ts = await get('https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/ALV.DE?symbol=ALV.DE&type=quarterlyOrdinarySharesNumber&period1=1735689600&period2=1798761600');
    steps.push({ step: 'timeseries', status: ts.status, series: (ts.j?.timeseries?.result || []).length });
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
