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

const UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const UA_OWN = 'FelicityIntelligence/1.0 (+https://felicity-world-map.vercel.app)';

const WIKI = 'https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page=';

export function probeTargets() {
  return [
    ['cnindex-399001', 'https://www.cnindex.com.cn/sample-detail/detail?indexcode=399001&dateStr=&pageNum=1&rows=600'],
    ['taiwanindex-t50', 'https://www.taiwanindex.com.tw/en/indexes/TW50', { raw: true }],
    ['dfm-site', 'https://www.dfm.ae/the-exchange/market-information/listed-securities/equities', { raw: true }],
    ['twse-openapi-all', 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'],
    ['twse-t50-weights', 'https://www.twse.com.tw/rwd/en/indices/TAI50I?response=json'],
    ['wiki-twse50', `${WIKI}FTSE_TWSE_Taiwan_50_Index`, { ua: UA_OWN }],
    ['wiki-set50', `${WIKI}SET50_Index_and_SET100_Index`, { ua: UA_OWN }],
    ['wiki-bist100', `${WIKI}BIST_100`, { ua: UA_OWN }],
    ['wiki-tasi', `${WIKI}Tadawul_All_Share_Index`, { ua: UA_OWN }],
    ['wiki-dfmgi', `${WIKI}DFM_General_Index`, { ua: UA_OWN }],
    ['wiki-szse', `${WIKI}SZSE_Component_Index`, { ua: UA_OWN }],
    ['wiki-kospi200', `${WIKI}KOSPI_200`, { ua: UA_OWN }],
    ['yahoo-crumb', null, { special: 'yahoo-crumb' }],
  ];
}

async function timed(url, opts, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: c.signal });
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
    return { target: name, ms: Date.now() - t0, status: r.status, type: r.headers.get('content-type'), bytes: text.length, head: opt.raw ? text.slice(0, head) : headOf(text, head) };
  } catch (e) {
    return { target: name, ms: Date.now() - t0, error: fetchReason(e, ms) };
  }
}

// Yahoo's cookie + crumb handshake, then what the crumb unlocks: the v7
// quote endpoint (market capitalisation), quoteSummary's `components`
// (index members) and `assetProfile` (sector), the search endpoint and the
// screener — each reported compactly so one run covers all sixteen markets.
const COMPONENT_INDICES = ['^FTSE', '^FCHI', '^STOXX50E', '^STOXX', '^AEX', '^BFX', '^HSI', '^NSEI', '^KS11', '^KS200', '^STI', '^TWII', '^SET50.BK', '^SET.BK', 'XU100.IS', '^TASI.SR', 'DFMGI.AE', '399001.SZ'];

async function yahooCrumb(head, ms, full) {
  const t0 = Date.now();
  const steps = [];
  try {
    const seed = await timed('https://fc.yahoo.com/', { headers: { 'User-Agent': UA_BROWSER }, redirect: 'manual' }, ms);
    const cookies = (seed.headers.getSetCookie?.() || []).map(c => c.split(';')[0]);
    steps.push({ step: 'cookie', status: seed.status, cookies: cookies.map(c => c.split('=')[0]) });
    const cookie = cookies.join('; ');
    const cr = await timed('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': UA_BROWSER, Cookie: cookie } }, ms);
    const crumb = (await cr.text()).trim();
    steps.push({ step: 'crumb', status: cr.status, length: crumb.length });
    if (cr.status !== 200 || !crumb || crumb.length > 40) return { target: 'yahoo-crumb', ms: Date.now() - t0, steps };
    const get = async (u, opts = {}) => {
      const r = await timed(u + (u.includes('?') ? '&' : '?') + 'crumb=' + encodeURIComponent(crumb),
        { ...opts, headers: { 'User-Agent': UA_BROWSER, Cookie: cookie, Accept: 'application/json', ...(opts.headers || {}) } }, ms);
      const text = await r.text();
      let j = null; try { j = JSON.parse(text); } catch { /* not JSON */ }
      return { status: r.status, text, j };
    };
    const comps = await Promise.all(COMPONENT_INDICES.map(async ix => {
      try {
        const r = await get(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ix)}?modules=components`);
        const list = r.j?.quoteSummary?.result?.[0]?.components?.components || null;
        return { index: ix, status: r.status, count: list ? list.length : null, list: list ? (full ? list : [...list.slice(0, 4), '…', ...list.slice(-3)]) : undefined, err: list ? undefined : headOf(r.text, 160) };
      } catch (e) { return { index: ix, error: fetchReason(e, ms) }; }
    }));
    steps.push({ step: 'components', results: comps });
    // Does the batch quote carry sector or shares when asked for them?
    const q = await get(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent('AZN.L,RELIANCE.NS,RELIANCE.BO,2222.SR,EMAAR.AE,000001.SZ')}&fields=sector,industry,sectorDisp,marketCap,sharesOutstanding,regularMarketPrice`);
    steps.push({ step: 'quote-fields', status: q.status, results: (q.j?.quoteResponse?.result || []).map(x => ({ s: x.symbol, sector: x.sector ?? null, sectorDisp: x.sectorDisp ?? null, industry: x.industry ?? null, cap: x.marketCap ?? null, shares: x.sharesOutstanding ?? null, keys: Object.keys(x).length })) });
    const ap = await get('https://query2.finance.yahoo.com/v10/finance/quoteSummary/AZN.L?modules=assetProfile');
    const prof = ap.j?.quoteSummary?.result?.[0]?.assetProfile;
    steps.push({ step: 'assetProfile', status: ap.status, sector: prof?.sector ?? null, industry: prof?.industry ?? null, sectorKey: prof?.sectorKey ?? null });
    const se = await get('https://query2.finance.yahoo.com/v1/finance/search?q=AZN.L&quotesCount=1&newsCount=0');
    const sq = se.j?.quotes?.[0];
    steps.push({ step: 'search', status: se.status, sector: sq?.sector ?? null, sectorDisp: sq?.sectorDisp ?? null, industry: sq?.industry ?? null, symbol: sq?.symbol ?? null });
    const body = JSON.stringify({ size: 25, offset: 0, sortField: 'intradaymarketcap', sortType: 'DESC', quoteType: 'EQUITY', query: { operator: 'and', operands: [{ operator: 'eq', operands: ['region', 'gb'] }, { operator: 'eq', operands: ['sector', 'Technology'] }] } });
    const sc = await get('https://query1.finance.yahoo.com/v1/finance/screener', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
    const rows = sc.j?.finance?.result?.[0]?.quotes;
    steps.push({ step: 'screener', status: sc.status, total: sc.j?.finance?.result?.[0]?.total ?? null, first: rows ? rows.slice(0, 5).map(x => [x.symbol, x.marketCap ?? null, x.sector ?? null]) : undefined, err: rows ? undefined : headOf(sc.text, 200) });
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
  const results = await Promise.all(list.map(([name, url, opt = {}]) =>
    opt.special === 'yahoo-crumb' ? yahooCrumb(n, timeoutMs, !!only) : one(name, url, opt, n, timeoutMs)));
  return { ok: true, at: new Date().toISOString(), region: process.env.VERCEL_REGION || null, results };
}
