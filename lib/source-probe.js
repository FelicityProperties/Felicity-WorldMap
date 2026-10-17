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

const YAHOO_STOCKS = ['AZN.L', 'MC.PA', 'ASML.AS', 'ABI.BR', 'SAP.DE', '0700.HK', 'RELIANCE.NS', '005930.KS', 'D05.SI', '2330.TW', 'PTT.BK', 'THYAO.IS', '2222.SR', 'EMAAR.AE', '000001.SZ'];
const YAHOO_INDICES = ['^FTSE', '^FCHI', '^STOXX50E', '^STOXX', '^AEX', '^BFX', '^HSI', '^NSEI', '^KS11', '^STI', '^TWII', '^SET.BK', 'XU100.IS', '^TASI.SR', 'DFMGI.AE', '399001.SZ'];

function krxDay() {
  // Last weekday in Seoul, as YYYYMMDD
  const d = new Date(Date.now() + 9 * 3600e3);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

export function probeTargets() {
  return [
    // Index-provider and exchange constituent lists
    ['hsi-constituents', 'https://www.hsi.com.hk/data/eng/rt/index-series/hsi/constituents.do'],
    ['nifty-csv', 'https://niftyindices.com/IndexConstituent/ind_nifty50list.csv'],
    ['nse-archive-csv', 'https://nsearchives.nseindia.com/content/indices/ind_nifty50list.csv'],
    ['krx-kospi-all', 'https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Referer: 'https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020101', 'X-Requested-With': 'XMLHttpRequest' },
      body: `bld=dbms/MDC/STAT/standard/MDCSTAT01501&locale=en&mktId=STK&trdDd=${krxDay()}&share=1&money=1&csvxls_isNo=false`,
    }],
    ['euronext-cac-comp', 'https://live.euronext.com/en/ajax/getIndexComposition/FR0003500008-XPAR'],
    ['euronext-cac-full', 'https://live.euronext.com/en/ajax/getIndexCompositionFull/FR0003500008-XPAR'],
    ['euronext-cac-page', 'https://live.euronext.com/en/product/indices/FR0003500008-XPAR'],
    ['ishares-stoxx600', 'https://www.ishares.com/de/privatanleger/de/produkte/251931/ishares-stoxx-europe-600-ucits-etf-de-fund/1478358465952.ajax?fileType=csv&fileName=EXSA_holdings&dataType=fund'],
    ['ishares-sx5e', 'https://www.ishares.com/de/privatanleger/de/produkte/251783/ishares-euro-stoxx-50-ucits-etf-de-fund/1478358465952.ajax?fileType=csv&fileName=EXW1_holdings&dataType=fund'],
    ['ishares-ftse100', 'https://www.ishares.com/uk/individual/en/products/251795/ishares-ftse-100-ucits-etf-inc-fund/1506575576011.ajax?fileType=csv&fileName=ISF_holdings&dataType=fund'],
    ['lse-ftse100-page', 'https://www.londonstockexchange.com/indices/ftse-100/constituents/table'],
    ['set-set50', 'https://www.set.or.th/api/set/index/set50/composition?lang=en'],
    ['twse-yuanta-0050', 'https://www.yuantaetfs.com/api/StkWeights?date=&fundid=1066'],
    ['taiwanindex-t50', 'https://www.taiwanindex.com.tw/en/indexes/TW50'],
    ['szse-399001', 'https://www.szse.cn/api/report/ShowReport/data?SHOWTYPE=JSON&CATALOGID=1747_zs&TABKEY=tab1&ZSDM=399001'],
    ['cnindex-399001', 'https://www.cnindex.com.cn/sample-detail/detail?indexcode=399001&dateStr=&pageNum=1&rows=20'],
    ['tadawul-companies', 'https://www.saudiexchange.sa/tadawul.eportal.theme.helper/ThemeSearchUtilityServlet'],
    ['dfm-site', 'https://www.dfm.ae/the-exchange/market-information/listed-securities/equities'],
    ['bist-site', 'https://www.borsaistanbul.com/en/index/2/1/bist-100'],
    ['wikipedia-ftse100', 'https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page=FTSE_100_Index', { ua: UA_OWN }],
    // Yahoo: the batch endpoint without a crumb, for every suffix and index
    ['yahoo-spark-stocks', `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(YAHOO_STOCKS.join(','))}&range=1d&interval=1d`],
    ['yahoo-spark-indices', `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(YAHOO_INDICES.join(','))}&range=1d&interval=1d`],
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
    return { target: name, ms: Date.now() - t0, status: r.status, type: r.headers.get('content-type'), bytes: text.length, head: headOf(text, head) };
  } catch (e) {
    return { target: name, ms: Date.now() - t0, error: fetchReason(e, ms) };
  }
}

// Yahoo's cookie + crumb handshake, then the v7 quote endpoint (which
// carries market capitalisation) with it, for the same symbols as spark.
async function yahooCrumb(head, ms) {
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
    const symbols = [...YAHOO_STOCKS, ...YAHOO_INDICES].join(',');
    const q = await timed(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&crumb=${encodeURIComponent(crumb)}`,
      { headers: { 'User-Agent': UA_BROWSER, Cookie: cookie, Accept: 'application/json' } }, ms);
    const body = await q.text();
    let summary = null;
    try {
      summary = (JSON.parse(body)?.quoteResponse?.result || []).map(x => ({
        s: x.symbol, n: x.shortName || x.longName || null, p: x.regularMarketPrice ?? null, c: x.regularMarketChangePercent ?? null,
        cap: x.marketCap ?? null, cur: x.currency || null, t: x.regularMarketTime ?? null, ex: x.fullExchangeName || x.exchange || null,
      }));
    } catch { /* not JSON */ }
    steps.push({ step: 'quote', status: q.status, bytes: body.length, results: summary, head: summary ? undefined : headOf(body, head) });
    // The components module of quoteSummary once listed index members
    const comp = await timed(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/%5EFTSE?modules=components&crumb=${encodeURIComponent(crumb)}`,
      { headers: { 'User-Agent': UA_BROWSER, Cookie: cookie, Accept: 'application/json' } }, ms);
    steps.push({ step: 'components', status: comp.status, head: headOf(await comp.text(), head) });
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
    opt.special === 'yahoo-crumb' ? yahooCrumb(n, timeoutMs) : one(name, url, opt, n, timeoutMs)));
  return { ok: true, at: new Date().toISOString(), region: process.env.VERCEL_REGION || null, results };
}
