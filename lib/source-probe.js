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
    ['ishares-exsa-page', 'https://www.ishares.com/de/privatanleger/de/produkte/251931/ishares-stoxx-europe-600-ucits-etf-de-fund', { grep: /[^"'\s>]*\.ajax\?fileType=csv[^"'\s<]*/g }],
    ['ishares-isf-page', 'https://www.ishares.com/uk/individual/en/products/251795/ishares-ftse-100-ucits-etf-inc-fund', { grep: /[^"'\s>]*\.ajax\?fileType=csv[^"'\s<]*/g }],
    ['taiwanindex-t50', 'https://www.taiwanindex.com.tw/en/indexes/TW50', { grep: /(?:https?:)?\/\/[^"'\s]*api[^"'\s]*|\/api\/[^"'\s]{2,120}|constituent[^<]{0,160}/gi }],
    ['dfm-site', 'https://www.dfm.ae/the-exchange/market-information/listed-securities/equities', { grep: /api2\.dfm\.ae[^"'\s]*|EMAAR[^<]{0,200}|\/_nuxt\/[A-Za-z0-9_-]+\.js/g }],
    ['bist-index-detail', 'https://www.borsaistanbul.com/en/index-detail/1000/bist-100', { grep: /THYAO[^<]{0,200}|[^"'\s]*\.(?:xlsx|csv|zip)[^"'\s]*|\/api\/[^"'\s]{2,120}/gi }],
    ['naver-kospi', 'https://m.stock.naver.com/api/stocks/marketValue/KOSPI?page=1&pageSize=5'],
    ['naver-kospi-index', 'https://m.stock.naver.com/api/index/KOSPI/basic'],
    ['wiki-ftse100-rev', 'https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=timestamp|ids&format=json&formatversion=2&redirects=1&titles=FTSE_100_Index|CAC_40|EURO_STOXX_50|AEX_index|BEL_20|Hang_Seng_Index|Straits_Times_Index', { ua: UA_OWN }],
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
    if (opt.grep) {
      const hits = [...new Set(text.match(opt.grep) || [])].slice(0, 40).map(h => h.slice(0, 300));
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
    // Whole-exchange listings through the screener, for the markets whose
    // index is "every listed share": exchange code, count, the five largest
    const screen = async (label, operands) => {
      const body = JSON.stringify({ size: 250, offset: 0, sortField: 'intradaymarketcap', sortType: 'DESC', quoteType: 'EQUITY', query: { operator: 'and', operands } });
      const sc = await get('https://query1.finance.yahoo.com/v1/finance/screener', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
      const res0 = sc.j?.finance?.result?.[0];
      const rows = res0?.quotes;
      return { label, status: sc.status, total: res0?.total ?? null, got: rows ? rows.length : null, first: rows ? rows.slice(0, 6).map(x => [x.symbol, x.shortName, x.marketCap ?? null, x.exchange]) : undefined, last: rows ? rows.slice(-2).map(x => [x.symbol, x.marketCap ?? null]) : undefined, err: rows ? undefined : headOf(sc.text, 200) };
    };
    const eq = (k, v) => ({ operator: 'eq', operands: [k, v] });
    steps.push({ step: 'screener', results: await Promise.all([
      screen('KSC', [eq('exchange', 'KSC')]),
      screen('region kr', [eq('region', 'kr')]),
      screen('IST', [eq('exchange', 'IST')]),
      screen('SAU', [eq('exchange', 'SAU')]),
      screen('DFM', [eq('exchange', 'DFM')]),
      screen('region ae', [eq('region', 'ae')]),
    ]) });
    const comp = await Promise.all(['^XU100', 'XU100.IS', '^KS11', '^TASI.SR', '^DFMGI'].map(async ix => {
      const r = await get(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ix)}?modules=components,price`);
      const res0 = r.j?.quoteSummary?.result?.[0];
      return { index: ix, status: r.status, count: res0?.components?.components?.length ?? null, name: res0?.price?.shortName ?? null };
    }));
    steps.push({ step: 'components-2', results: comp });
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
