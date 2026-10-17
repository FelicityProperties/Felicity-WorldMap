// ═══════════════════════════════════════════════════════════
// INDEX HEATMAPS — the sixteen markets TradingView withholds from embeds
// ═══════════════════════════════════════════════════════════
//
// TradingView's embedded heatmap draws the S&P 500 in place of the UK,
// France, Euro Stoxx, Netherlands, Belgium, Hang Seng, Nifty, Korea,
// Singapore, Taiwan, Thailand, Turkey, Saudi, DFM and China (CLAUDE.md,
// heatmap datasets). So these maps are drawn by us from two kinds of real
// source, every one of them fetched from Vercel's own network before this
// was written (/api/invest/heatmap-sources, 2026-10-17, region iad1):
//
//   WHO IS IN THE INDEX — one dated list per market, from the most
//   official source the function can reach (MARKETS below names each):
//   the index provider or exchange where it publishes one (NSE's Nifty
//   file, CNI's Shenzhen list, KAP's BIST lists), an index fund's own
//   holdings file where it does not (State Street's STI fund, Invesco's
//   STOXX 600 index file, Yuanta's Taiwan 50 fund via MoneyDJ), a
//   Wikipedia revision for the European blue chips (dated by the
//   revision, linked by its permanent id), and Yahoo's own exchange
//   listing for the three markets whose index is the market itself
//   (KOSPI, Tadawul, DFM). The page says which, and when.
//
//   HOW EACH MEMBER MOVED AND HOW BIG IT IS — Yahoo Finance's v7 quote
//   endpoint, fifty symbols a request, behind Yahoo's cookie-and-crumb
//   handshake (which answers from Vercel; GitHub runners get 429). One
//   answer carries the delayed price, the session move, the market
//   capitalisation and Yahoo's sector. Tiles are sized by market cap,
//   as TradingView sizes its own heatmaps — not by index weight, which
//   the index providers license and we do not publish.
//
// Nothing is filled in. A member Yahoo did not quote is kept and listed;
// a member whose last trade is from an earlier session is hatched, not
// coloured as today; a member with no market cap is listed as unsized
// rather than drawn at an invented size. A constituent list whose format
// changed fails loudly with what it saw.
// ═══════════════════════════════════════════════════════════

import { fetchReason } from './fetch-reason.js';
import { parseCsv } from './nikkei.js';
import { findTable, parseTable, cleanWiki, templates, infoboxCount } from './wikitable.js';
import { readXlsx } from './xlsx.js';
import { kvGet, kvSet } from './kv-store.js';

const UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
// Wikimedia asks API clients to identify themselves
const UA_OWN = 'FelicityIntelligence/1.0 (+https://felicity-world-map.vercel.app)';

export const QUOTE_BATCH = 50;
export const QUOTES_SOURCE = { name: 'Yahoo Finance — delayed quotes, market capitalisation and sector', url: 'https://finance.yahoo.com/' };

// A number only when the upstream sent a real one: Number(null) is 0, and a
// JSON null turned into a "0.00%" tile or a zero market cap is an invented
// figure. Prices and caps can never be zero or negative.
const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
const pos = v => { const n = num(v); return n != null && n > 0 ? n : null; };
const round2 = v => Math.round(v * 100) / 100;

/** Calendar day (YYYY-MM-DD) of an ISO time in an exchange's time zone. */
export function localDay(iso, tz) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

async function timedFetch(ctx, url, { headers = {}, method = 'GET', body, redirect, as = 'text' } = {}) {
  const left = ctx.deadline - Date.now();
  if (left < 400) throw new Error('time budget exceeded');
  const ms = Math.min(ctx.timeoutMs, left);
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await ctx.fetchImpl(url, { method, body, redirect, signal: c.signal, headers: { 'User-Agent': UA_BROWSER, Accept: '*/*', ...headers } });
    // The body is read inside the timer too: a trickling body must not
    // hold the function past its budget
    const data = as === 'buffer' ? new Uint8Array(await r.arrayBuffer()) : await r.text();
    return { status: r.status, ok: r.ok, headers: r.headers, data };
  } catch (e) {
    throw new Error(fetchReason(e, ms));
  } finally {
    clearTimeout(t);
  }
}

// ── Yahoo: cookie + crumb, shared by every market on a warm instance ──
const yahoo = { cookie: null, crumb: null, at: 0, pending: null, cooldownUntil: 0 };
const CRUMB_TTL_MS = 6 * 3600e3;
export const THROTTLE_COOLDOWN_MS = 60e3;

class Throttled extends Error {}

function cookiesOf(headers) {
  const list = headers.getSetCookie?.() || (headers.get('set-cookie') ? headers.get('set-cookie').split(/,(?=\s*[A-Za-z0-9_]+=)/) : []);
  return list.map(c => c.split(';')[0].trim()).filter(c => c.includes('='));
}

async function yahooAuth(ctx, force = false) {
  if (!force && yahoo.crumb && ctx.now - yahoo.at < CRUMB_TTL_MS) return yahoo;
  if (yahoo.pending) return yahoo.pending;
  yahoo.pending = (async () => {
    const seed = await timedFetch(ctx, 'https://fc.yahoo.com/', { redirect: 'manual' });
    const cookie = cookiesOf(seed.headers).join('; ');
    if (!cookie) throw new Error(`Yahoo set no session cookie (HTTP ${seed.status})`);
    const cr = await timedFetch(ctx, 'https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { Cookie: cookie } });
    if (cr.status === 429) throw new Throttled('Yahoo crumb HTTP 429');
    const crumb = String(cr.data || '').trim();
    if (cr.status !== 200 || !crumb || crumb.length > 40 || /[\s<{]/.test(crumb)) throw new Error(`Yahoo issued no crumb (HTTP ${cr.status})`);
    Object.assign(yahoo, { cookie, crumb, at: ctx.now });
    return yahoo;
  })().finally(() => { yahoo.pending = null; });
  return yahoo.pending;
}

/** A crumbed Yahoo call. One re-handshake on 401/403; a 429 starts a cooldown for every market. */
async function yahooJson(ctx, url, opts = {}) {
  if (Date.now() < yahoo.cooldownUntil) throw new Throttled('Yahoo is throttling this server (HTTP 429)');
  for (let attempt = 0; attempt < 2; attempt++) {
    const s = await yahooAuth(ctx, attempt > 0);
    const r = await timedFetch(ctx, `${url}${url.includes('?') ? '&' : '?'}crumb=${encodeURIComponent(s.crumb)}`,
      { ...opts, headers: { Cookie: s.cookie, Accept: 'application/json', ...(opts.headers || {}) } });
    if (r.status === 429) { yahoo.cooldownUntil = Date.now() + THROTTLE_COOLDOWN_MS; throw new Throttled('Yahoo HTTP 429'); }
    if ((r.status === 401 || r.status === 403) && attempt === 0) continue;
    if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
    try { return JSON.parse(r.data); } catch { throw new Error('Yahoo answer was not JSON'); }
  }
  throw new Error('Yahoo refused the crumb twice');
}

const QUOTE_FIELDS = 'symbol,shortName,longName,regularMarketPrice,regularMarketChangePercent,regularMarketTime,marketCap,sharesOutstanding,currency,financialCurrency,sector,industry,quoteType';

/** One v7 quote result → the fields a tile uses, nulls kept as nulls. */
export function parseQuote(x) {
  const price = pos(x?.regularMarketPrice);
  const chg = num(x?.regularMarketChangePercent);
  const t = pos(x?.regularMarketTime);
  return {
    symbol: x?.symbol || null,
    name: x?.longName || x?.shortName || null,
    shortName: x?.shortName || null,
    price,
    // No price means no move either: a change on a missing price is not evidence
    changePct: price != null && chg != null ? round2(chg) : null,
    time: t ? new Date(t * 1000).toISOString() : null,
    cap: pos(x?.marketCap),
    shares: pos(x?.sharesOutstanding),
    currency: x?.currency || null,
    financialCurrency: x?.financialCurrency || null,
    sector: x?.sector || null,
    industry: x?.industry || null,
  };
}

// Yahoo's batch quote carries no market cap and no share count for some
// large members (Allianz, Publicis, KBC, Halma, 2026-10-17 — with or without
// a fields list), and its quoteSummary has none either. Its fundamentals
// series does: the ordinary share count from the latest reported balance
// sheet (Allianz 379,286,270 at 2026-06-30). Asked for those few only; a
// count reported more than eighteen months ago is not used.
export const SHARE_COUNT_LIMIT = 40;
export function latestShareCount(json, nowMs) {
  let best = null;
  for (const r of json?.timeseries?.result || []) {
    const type = r?.meta?.type?.[0];
    if (!/OrdinarySharesNumber$/.test(type || '')) continue;
    for (const pt of r[type] || []) {
      const v = pos(pt?.reportedValue?.raw);
      const d = pt?.asOfDate;
      if (v == null || !/^\d{4}-\d{2}-\d{2}$/.test(d || '')) continue;
      if (nowMs - Date.parse(d) > 548 * 86400e3) continue;
      if (!best || d > best.asOf) best = { shares: v, asOf: d };
    }
  }
  return best;
}
async function reportedShares(ctx, symbols) {
  const out = {};
  let next = 0, stop = false;
  const p2 = Math.floor(ctx.now / 1000), p1 = p2 - 2 * 365 * 86400;
  await Promise.all(Array.from({ length: Math.min(4, symbols.length) }, async () => {
    while (!stop && next < symbols.length && ctx.deadline - Date.now() > 3000) {
      const s = symbols[next++];
      try {
        const j = await yahooJson(ctx, `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(s)}?symbol=${encodeURIComponent(s)}&type=quarterlyOrdinarySharesNumber,annualOrdinarySharesNumber&period1=${p1}&period2=${p2}`);
        const c = latestShareCount(j, ctx.now);
        if (c) out[s] = c;
      } catch (e) { if (e instanceof Throttled) stop = true; }
    }
  }));
  return out;
}

async function quoteSymbols(ctx, symbols, { concurrency = 4 } = {}) {
  const batches = [];
  for (let i = 0; i < symbols.length; i += QUOTE_BATCH) batches.push(symbols.slice(i, i + QUOTE_BATCH));
  const quotes = {};
  const errors = [];
  let next = 0, throttled = false;
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, async () => {
    while (next < batches.length) {
      const b = batches[next++];
      // Once Yahoo throttles this address, further batches only feed it
      if (throttled) { errors.push('not asked: Yahoo was throttling (HTTP 429)'); continue; }
      try {
        const j = await yahooJson(ctx, `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(b.join(','))}&fields=${QUOTE_FIELDS}`);
        for (const x of j?.quoteResponse?.result || []) if (x?.symbol) quotes[x.symbol] = parseQuote(x);
      } catch (e) {
        if (e instanceof Throttled) throttled = true;
        errors.push(e.message);
      }
    }
  }));
  return { quotes, errors, batches: batches.length, throttled };
}

// ── Constituent lists ──

// Exchange suffixes Yahoo uses for the primary European venues
const EU_PRIMARY = /\.(L|DE|PA|AS|SW|MI|MC|ST|CO|HE|OL|BR|IR|LS|VI|WA|AT)$/;
const MIC_SUFFIX = { XBRU: '.BR', XAMS: '.AS', XPAR: '.PA', XLIS: '.LS', XMSM: '.IR', XOSL: '.OL', XMIL: '.MI' };

const plainTicker = raw => cleanWiki(raw).toUpperCase().replace(/\s+/g, '');
/** LSE EPIC → Yahoo: "BT.A" → "BT-A.L", "RR." → "RR.L". */
export const lseSymbol = raw => {
  const t = plainTicker(raw).replace(/\.+$/, '').replace(/\./g, '-');
  return /^[A-Z0-9-]{1,6}$/.test(t) ? `${t}.L` : null;
};
/** A Yahoo symbol as written ("AC.PA"), or a bare ticker given the home suffix. */
export const suffixed = sfx => raw => {
  const t = plainTicker(raw);
  if (/^[A-Z0-9-]{1,10}\.[A-Z]{1,3}$/.test(t)) return t;
  return /^[A-Z0-9-]{1,8}$/.test(t) ? `${t}${sfx}` : null;
};
/** {{EuronextBrussels|ABI|BE…|XBRU}} → "ABI.BR"; the MIC decides the venue. */
export const euronextSymbol = raw => {
  const t = templates(raw).find(x => /^euronext/i.test(x.name));
  if (!t || !t.params[0]) return null;
  const mic = (t.params[2] || '').toUpperCase() || { euronextbrussels: 'XBRU', euronextamsterdam: 'XAMS', euronextparis: 'XPAR', euronextlisbon: 'XLIS', euronextdublin: 'XMSM' }[t.name.toLowerCase()];
  const sfx = MIC_SUFFIX[mic];
  const code = t.params[0].trim().toUpperCase();
  return sfx && /^[A-Z0-9-]{1,8}$/.test(code) ? `${code}${sfx}` : null;
};
/** {{SEHK|5}} → "0005.HK". */
export const sehkSymbol = raw => {
  const t = templates(raw).find(x => x.name.toUpperCase() === 'SEHK');
  const d = (t?.params[0] || cleanWiki(raw)).replace(/\D/g, '');
  return d && d.length <= 4 ? `${d.padStart(4, '0')}.HK` : null;
};

const wikiUrl = (page, revid) => revid ? `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(page)}&oldid=${revid}` : `https://en.wikipedia.org/wiki/${encodeURIComponent(page)}`;

/** A Wikipedia constituents table → members. */
export function membersFromWikitext(wt, spec) {
  const seg = findTable(wt, spec.table);
  if (!seg) throw new Error(`Wikipedia "${spec.page}" has no constituents table where expected`);
  const { header, rows } = parseTable(seg);
  const col = re => header.findIndex(h => re.test(h));
  const ti = col(spec.ticker), ni = col(spec.name);
  if (ti < 0 || ni < 0) throw new Error(`Wikipedia "${spec.page}" table header changed: "${header.slice(0, 8).map(h => h.slice(0, 30)).join(' | ').slice(0, 240)}"`);
  const members = [];
  const seen = new Set();
  let rowsMalformed = 0, duplicates = 0;
  for (const r of rows) {
    const symbol = spec.symbol(r[ti] || '');
    if (!symbol) { rowsMalformed++; continue; }
    if (seen.has(symbol)) { duplicates++; continue; }
    seen.add(symbol);
    members.push({ symbol, code: symbol.replace(/\.[A-Z]{1,3}$/, ''), name: cleanWiki(r[ni] || '') || null });
  }
  return { members, rowsMalformed, duplicates, infoboxCount: infoboxCount(wt) };
}

async function wikiMembers(spec, ctx) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content|timestamp|ids&rvslots=main&format=json&formatversion=2&redirects=1&titles=${encodeURIComponent(spec.page)}`;
  const r = await timedFetch(ctx, url, { headers: { 'User-Agent': UA_OWN, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Wikipedia HTTP ${r.status}`);
  const rev = JSON.parse(r.data)?.query?.pages?.[0]?.revisions?.[0];
  const wt = rev?.slots?.main?.content;
  if (!wt) throw new Error(`Wikipedia returned no text for "${spec.page}"`);
  const out = membersFromWikitext(wt, spec);
  return {
    ...out,
    asOf: rev.timestamp ? rev.timestamp.slice(0, 10) : null,
    asOfKind: 'revision',
    source: { name: `Wikipedia — "${spec.page.replace(/_/g, ' ')}", revision of ${rev.timestamp?.slice(0, 10) || '—'} (CC BY-SA 4.0)`, url: wikiUrl(spec.page, rev.revid) },
    expected: spec.expected ?? out.infoboxCount,
  };
}

/** NSE's own constituent CSV (Company Name, Industry, Symbol, Series, ISIN Code). */
export function membersFromNiftyCsv(text) {
  if (/^\s*</.test(text)) throw new Error('NSE constituent file came back as HTML, not CSV');
  const rows = parseCsv(text);
  const header = (rows[0] || []).map(h => h.trim().toLowerCase());
  const si = header.indexOf('symbol'), ni = header.indexOf('company name');
  if (si < 0 || ni < 0) throw new Error(`NSE constituent file header changed: "${(rows[0] || []).join(' | ').slice(0, 200)}"`);
  const members = [];
  let rowsMalformed = 0;
  for (const r of rows.slice(1)) {
    const s = (r[si] || '').trim().toUpperCase();
    if (!/^[A-Z0-9&-]{1,20}$/.test(s)) { rowsMalformed++; continue; }
    members.push({ symbol: `${s}.NS`, code: s, name: (r[ni] || '').trim() || null });
  }
  return { members, rowsMalformed, duplicates: 0 };
}

async function niftyMembers(spec, ctx) {
  const r = await timedFetch(ctx, spec.url);
  if (!r.ok) throw new Error(`NSE constituent file HTTP ${r.status}`);
  const out = membersFromNiftyCsv(r.data);
  const lm = r.headers.get('last-modified');
  const asOf = lm && !Number.isNaN(Date.parse(lm)) ? new Date(lm).toISOString().slice(0, 10) : null;
  return { ...out, asOf, asOfKind: asOf ? 'file' : 'fetched', source: { name: 'NSE Indices — Nifty 50 constituent file', url: spec.url }, expected: spec.expected };
}

/** CNI (SZSE's index company) sample list: { data: { total, rows: [{ dateStr, seccode, secname, trade }] } }. */
export function membersFromCnindex(j) {
  const rows = j?.data?.rows;
  if (!Array.isArray(rows)) throw new Error('CNI sample list answered without rows');
  const members = [];
  let rowsMalformed = 0;
  for (const x of rows) {
    const c = String(x?.seccode || '').trim();
    if (!/^\d{6}$/.test(c)) { rowsMalformed++; continue; }
    members.push({ symbol: `${c}.SZ`, code: c, name: null, localName: x.secname || null });
  }
  return { members, rowsMalformed, duplicates: 0, total: j.data.total ?? null, asOf: rows[0]?.dateStr || null };
}

async function cnindexMembers(spec, ctx) {
  const url = `https://www.cnindex.com.cn/sample-detail/detail?indexcode=${spec.code}&dateStr=&pageNum=1&rows=1000`;
  const r = await timedFetch(ctx, url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`CNI HTTP ${r.status}`);
  const out = membersFromCnindex(JSON.parse(r.data));
  return { ...out, asOfKind: 'file', source: { name: 'China National Index (CNI, SZSE) — SZSE Component Index sample list', url: `https://www.cnindex.com.cn/module/index-detail.html?act_menu=1&indexCode=${spec.code}` }, expected: spec.expected };
}

/** KAP's index page: the lists arrive as React Server Component chunks. */
export function membersFromKap(html, code) {
  let text = '';
  for (const m of String(html).matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
    try { text += JSON.parse(`"${m[1]}"`); } catch { /* a chunk that is not a plain string */ }
  }
  const key = `{"code":"${code}","content":[`;
  const at = text.indexOf(key);
  if (at < 0) throw new Error(`KAP index page carries no ${code} constituent list`);
  let i = at + key.length - 1, depth = 0, inStr = false;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (inStr) { if (ch === '\\') i++; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (!depth) break; }
  }
  const list = JSON.parse(text.slice(at + key.length - 1, i + 1));
  const members = [];
  const seen = new Set();
  let rowsMalformed = 0, duplicates = 0;
  for (const x of list) {
    const c = String(x?.stockCode || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,6}$/.test(c)) { rowsMalformed++; continue; }
    if (seen.has(c)) { duplicates++; continue; }
    seen.add(c);
    members.push({ symbol: `${c}.IS`, code: c, name: x.title || null });
  }
  return { members, rowsMalformed, duplicates };
}

async function kapMembers(spec, ctx) {
  const r = await timedFetch(ctx, 'https://www.kap.org.tr/en/Endeksler');
  if (!r.ok) throw new Error(`KAP HTTP ${r.status}`);
  return { ...membersFromKap(r.data, spec.code), asOf: null, asOfKind: 'fetched', source: { name: 'KAP (Public Disclosure Platform, Türkiye) — BIST index constituents', url: 'https://www.kap.org.tr/en/Endeksler' }, expected: spec.expected };
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
/** A State Street holdings sheet: "Holdings as of:" then a header row with ISIN … Ticker … Security Name. */
export function membersFromSsga(rows, suffix) {
  let asOf = null, hi = -1;
  rows.forEach((r, i) => {
    if (/^holdings as of/i.test(r[0] || '')) {
      const m = /(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(r[1] || '');
      if (m && MONTHS[m[2].toLowerCase()]) asOf = `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    if (hi < 0 && r.includes('Ticker') && r.includes('ISIN')) hi = i;
  });
  if (hi < 0) throw new Error('State Street holdings sheet has no Ticker/ISIN header row');
  const h = rows[hi];
  const ti = h.indexOf('Ticker'), ni = h.indexOf('Security Name');
  const members = [];
  let rowsMalformed = 0;
  for (const r of rows.slice(hi + 1)) {
    const t = String(r[ti] || '').trim();
    if (!t) continue;
    const m = /^([A-Z0-9]{1,6})-[A-Z]{2}$/.exec(t);
    if (!m) { rowsMalformed++; continue; }
    members.push({ symbol: `${m[1]}${suffix}`, code: m[1], name: String(r[ni] || '').trim() || null });
  }
  return { members, rowsMalformed, duplicates: 0, asOf };
}

async function ssgaMembers(spec, ctx) {
  const r = await timedFetch(ctx, spec.url, { as: 'buffer' });
  if (!r.ok) throw new Error(`State Street holdings HTTP ${r.status}`);
  const sheet = readXlsx(r.data).sheets[0];
  if (!sheet) throw new Error('State Street holdings file has no sheet');
  return { ...membersFromSsga(sheet.rows, spec.suffix), asOfKind: 'file', source: { name: spec.sourceName, url: spec.page }, expected: spec.expected };
}

/**
 * MoneyDJ's all-holdings page (Basic0007B — Basic0007 is the top ten
 * only): each stock row links "etfid=2330.TW&back=0050.TW"; index futures
 * and cash rows carry no such link and are not members.
 */
export function membersFromMoneyDj(html, fund) {
  const s = String(html);
  const date = /(?:全部持股|持股明細)[\s\S]{0,600}?資料日期：(\d{4})\/(\d{2})\/(\d{2})/.exec(s);
  const back = fund.replace(/[.]/g, '\\.');
  const re = new RegExp(`etfid=([0-9A-Z]{1,6})\\.(TW|HK)&back=${back}['"]>([^<]*?)\\(\\1\\.\\2\\)<\\/a>`, 'g');
  const members = [];
  const seen = new Set();
  let duplicates = 0;
  for (const m of s.matchAll(re)) {
    const code = m[1];
    const symbol = m[2] === 'HK' ? `${code.replace(/^0+(?=\d{4})/, '').padStart(4, '0')}.HK` : `${code}.TW`;
    if (seen.has(symbol)) { duplicates++; continue; }
    seen.add(symbol);
    members.push({ symbol, code, name: null, localName: m[3].trim() || null });
  }
  if (!members.length) throw new Error(`MoneyDJ page for ${fund} lists no holdings`);
  return { members, rowsMalformed: 0, duplicates, asOf: date ? `${date[1]}-${date[2]}-${date[3]}` : null };
}

async function moneydjMembers(spec, ctx) {
  const url = `https://www.moneydj.com/ETF/X/Basic/Basic0007B.xdjhtm?etfid=${spec.fund}`;
  const r = await timedFetch(ctx, url);
  if (!r.ok) throw new Error(`MoneyDJ HTTP ${r.status}`);
  return { ...membersFromMoneyDj(r.data, spec.fund), asOfKind: 'file', source: { name: spec.sourceName, url }, expected: spec.expected };
}

async function yahooComponentMembers(spec, ctx) {
  const j = await yahooJson(ctx, `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(spec.index)}?modules=components`);
  const list = j?.quoteSummary?.result?.[0]?.components?.components;
  if (!Array.isArray(list) || !list.length) throw new Error(`Yahoo lists no components for ${spec.index}`);
  const members = [...new Set(list.filter(s => typeof s === 'string' && /^[A-Z0-9.&-]{1,15}$/.test(s)))].map(symbol => ({ symbol, code: symbol.replace(/\.[A-Z]{1,3}$/, ''), name: null }));
  return { members, rowsMalformed: list.length - members.length, duplicates: 0, asOf: null, asOfKind: 'undated', source: { name: `Yahoo Finance — ${spec.label} component list (undated)`, url: `https://finance.yahoo.com/quote/${encodeURIComponent(spec.index)}/components/` }, expected: spec.expected };
}

/** Every equity Yahoo lists on one exchange, through its screener, largest first. */
async function screenerMembers(spec, ctx) {
  const symbols = [];
  const rows = new Map();
  let total = null;
  for (let offset = 0; offset < 2000; offset += 250) {
    const body = JSON.stringify({ size: 250, offset, sortField: 'intradaymarketcap', sortType: 'DESC', quoteType: 'EQUITY', query: { operator: 'and', operands: [{ operator: 'eq', operands: ['exchange', spec.exchange] }] } });
    const j = await yahooJson(ctx, 'https://query1.finance.yahoo.com/v1/finance/screener', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
    const res = j?.finance?.result?.[0];
    if (!res) throw new Error(`Yahoo screener answered without a result for ${spec.exchange}`);
    total = res.total ?? total;
    for (const q of res.quotes || []) if (q?.symbol) { symbols.push(q.symbol); rows.set(q.symbol, q); }
    if (!res.quotes?.length || symbols.length >= (total ?? 0)) break;
  }
  const kept = [...new Set(symbols)].filter(s => (spec.keep ? spec.keep(s, rows.get(s)) : true));
  return {
    members: kept.map(symbol => ({ symbol, code: symbol.replace(/\.[A-Z]{1,3}$/, ''), name: null })),
    rowsMalformed: 0, duplicates: symbols.length - new Set(symbols).size,
    listed: total, leftOut: symbols.length - kept.length,
    // The market as Yahoo lists it on the day it was read — not the index
    // provider's file, and never "live" once memoised
    asOf: null, asOfKind: 'listing',
    source: { name: spec.sourceName, url: 'https://finance.yahoo.com/research-hub/screener/' },
    expected: null,
  };
}

// ── ISIN → Yahoo symbol, for the STOXX Europe 600 (Invesco lists ISINs) ──
// Yahoo's search answers an ISIN with the primary listing (2026-10-17:
// NL0000226223 → STMPA.PA, NL0010832176 → ARGX.BR, JE00B4T3BW64 → GLEN.L,
// IE0004927939 → KRX.IR, LU1598757687 → MT.AS). Resolved symbols are kept
// on the instance and in Postgres, so the search runs once per ISIN.
const isinMap = new Map();
let isinLoaded = null;
const ISIN_KV = 'index-heatmap:isin-symbols:v2';
// Searches stop with twelve seconds of the pull's budget left, for the quotes
export const ISIN_RESERVE_MS = 12000;

async function loadIsinMap() {
  if (!isinLoaded) isinLoaded = kvGet(ISIN_KV).then(r => { for (const [k, v] of Object.entries(r?.value || {})) if (!isinMap.has(k)) isinMap.set(k, v); }).catch(() => {});
  return isinLoaded;
}

// The home venue an ISIN's country implies. Yahoo's search usually puts the
// primary listing first, but not always: Ferrovial (NL) came back as its
// Nasdaq line and Fresenius as the Frankfurt floor (2026-10-17)
const HOME_SUFFIX = { GB: '.L', JE: '.L', GG: '.L', IM: '.L', DE: '.DE', FR: '.PA', NL: '.AS', CH: '.SW', IT: '.MI', ES: '.MC', SE: '.ST', DK: '.CO', FI: '.HE', NO: '.OL', BE: '.BR', IE: '.IR', PT: '.LS', AT: '.VI', PL: '.WA', GR: '.AT' };
export const isPrimaryEu = s => EU_PRIMARY.test(s);

export function pickSearchSymbol(json, isin = '') {
  const q = (json?.quotes || []).filter(x => x?.quoteType === 'EQUITY' && typeof x.symbol === 'string');
  const home = HOME_SUFFIX[isin.slice(0, 2)];
  return (home && q.find(x => x.symbol.endsWith(home))) ?.symbol
    || q.find(x => EU_PRIMARY.test(x.symbol))?.symbol
    || q[0]?.symbol || null;
}

async function resolveIsins(ctx, isins) {
  await loadIsinMap();
  const todo = isins.filter(i => !isinMap.has(i));
  let next = 0, added = 0, throttled = false;
  const errors = [];
  await Promise.all(Array.from({ length: Math.min(10, todo.length) }, async () => {
    while (next < todo.length && !throttled && ctx.deadline - Date.now() > ISIN_RESERVE_MS) {
      const isin = todo[next++];
      try {
        const r = await timedFetch(ctx, `https://query2.finance.yahoo.com/v1/finance/search?q=${isin}&quotesCount=10&newsCount=0&listsCount=0`, { headers: { Accept: 'application/json' } });
        if (r.status === 429) { throttled = true; yahoo.cooldownUntil = Date.now() + THROTTLE_COOLDOWN_MS; errors.push('Yahoo search HTTP 429'); break; }
        if (!r.ok) { errors.push(`Yahoo search HTTP ${r.status}`); continue; }
        const sym = pickSearchSymbol(JSON.parse(r.data), isin);
        if (sym) { isinMap.set(isin, sym); added++; } else errors.push(`no Yahoo listing for ${isin}`);
      } catch (e) { errors.push(e.message); }
    }
  }));
  if (added) await kvSet(ISIN_KV, Object.fromEntries(isinMap));
  return { added, errors: [...new Set(errors)].slice(0, 6) };
}

async function invescoMembers(spec, ctx) {
  const r = await timedFetch(ctx, spec.url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Invesco holdings HTTP ${r.status}`);
  const j = JSON.parse(r.data);
  const rows = Array.isArray(j?.holdings) ? j.holdings : null;
  if (!rows) throw new Error('Invesco holdings answer has no holdings list');
  const list = [];
  const seen = new Set();
  let rowsMalformed = 0, duplicates = 0;
  for (const h of rows) {
    const isin = String(h?.isin || '').trim().toUpperCase();
    if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) { rowsMalformed++; continue; }
    if (seen.has(isin)) { duplicates++; continue; }
    seen.add(isin);
    list.push({ isin, name: String(h.name || '').replace(/\s+(ORD|N ORD|PS PAR)$/i, '').trim() || null });
  }
  return { isins: list, rowsMalformed, duplicates, asOf: j.effectiveDate || null, asOfKind: 'file', source: { name: spec.sourceName, url: spec.page }, expected: spec.expected };
}

// ── An index level Yahoo does not carry: TWSE's own Taiwan 50 series ──
// openapi.twse.com.tw/v1/indicesReport/TAI50I answers this month's daily
// closes, dated in the ROC calendar ("1151016" is 2026-10-16). The move is
// the last close against the one before it — our arithmetic on TWSE's
// figures, labelled as a close, never as a live level.
export const rocDay = d => {
  const m = /^(\d{3})(\d{2})(\d{2})$/.exec(String(d || '').trim());
  return m ? `${Number(m[1]) + 1911}-${m[2]}-${m[3]}` : null;
};
export function twseIndexLevel(rows, field) {
  if (!Array.isArray(rows)) throw new Error('TWSE index report is not a list');
  if (rows.length && !(field in rows[0])) throw new Error(`TWSE index report has no ${field} field: "${Object.keys(rows[0]).join(' | ').slice(0, 160)}"`);
  const pts = rows.map(x => ({ day: rocDay(x.Date), level: pos(parseFloat(String(x[field]).replace(/,/g, ''))) }))
    .filter(p => p.day && p.level != null).sort((a, b) => (a.day < b.day ? -1 : 1));
  const last = pts[pts.length - 1], prev = pts[pts.length - 2];
  if (!last) return null;
  return { level: last.level, changePct: prev ? round2((last.level / prev.level - 1) * 100) : null, day: last.day, prevDay: prev?.day || null };
}
async function twseIndex(spec, ctx) {
  const r = await timedFetch(ctx, `https://openapi.twse.com.tw/v1/indicesReport/${spec.report}`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`TWSE HTTP ${r.status}`);
  const lv = twseIndexLevel(JSON.parse(r.data), spec.field);
  // 13:30 Taipei, the close
  return lv ? { symbol: `TWSE ${spec.report}`, level: lv.level, changePct: lv.changePct, time: `${lv.day}T05:30:00.000Z`, close: true, prevDay: lv.prevDay } : null;
}

const ADAPTERS = { wiki: wikiMembers, nifty: niftyMembers, cnindex: cnindexMembers, kap: kapMembers, ssga: ssgaMembers, moneydj: moneydjMembers, components: yahooComponentMembers, screener: screenerMembers, invesco: invescoMembers };

// Fund units are not company shares: listed REITs and infrastructure funds
// are left out of the three markets drawn from an exchange listing
const FUND_NAME = /\b(REITs?|Fund)\b/i;
const notFund = q => !FUND_NAME.test(`${q?.longName || ''} ${q?.shortName || ''}`);

// ── The sixteen markets ──
export const MARKETS = {
  ftse100: { label: 'FTSE 100', index: '^FTSE', currency: 'GBP', tz: 'Europe/London', city: 'London',
    members: { kind: 'wiki', page: 'FTSE_100_Index', table: { id: 'constituents' }, ticker: /^ticker$/i, name: /^company$/i, symbol: lseSymbol, expected: 100 } },
  cac40: { label: 'CAC 40', index: '^FCHI', currency: 'EUR', tz: 'Europe/Paris', city: 'Paris',
    members: { kind: 'wiki', page: 'CAC_40', table: { id: 'constituents' }, ticker: /^ticker$/i, name: /^company$/i, symbol: suffixed('.PA'), expected: 40 } },
  sx5e: { label: 'Euro Stoxx 50', index: '^STOXX50E', currency: 'EUR', tz: 'Europe/Berlin', city: 'Frankfurt',
    members: { kind: 'wiki', page: 'EURO_STOXX_50', table: { id: 'constituents' }, ticker: /^ticker$/i, name: /^name$/i, symbol: suffixed('.DE'), expected: 50 } },
  stoxx600: { label: 'STOXX Europe 600', index: '^STOXX', currency: 'EUR', tz: 'Europe/Berlin', city: 'Frankfurt',
    members: { kind: 'invesco', url: 'https://dng-api.invesco.com/cache/v1/accounts/en_GB/shareclasses/IE00B60SWW18/holdings/index?idType=isin', page: 'https://www.invesco.com/uk/en/financial-products/etfs/invesco-stoxx-europe-600-ucits-etf-acc.html', sourceName: 'Invesco — STOXX Europe 600 index constituents, as published for its STOXX Europe 600 UCITS ETF', expected: 600 } },
  aex: { label: 'AEX', index: '^AEX', currency: 'EUR', tz: 'Europe/Amsterdam', city: 'Amsterdam',
    members: { kind: 'wiki', page: 'AEX_index', table: { id: 'constituents' }, ticker: /^ticker$/i, name: /^company$/i, symbol: suffixed('.AS') } },
  bel20: { label: 'BEL 20', index: '^BFX', currency: 'EUR', tz: 'Europe/Brussels', city: 'Brussels',
    members: { kind: 'wiki', page: 'BEL_20', table: { heading: /^constituents$/i }, ticker: /^ticker/i, name: /^company$/i, symbol: euronextSymbol, expected: 20 } },
  // Wikipedia's Hang Seng table listed 85 against its own infobox's 88
  // (2026-10-17), so the index fund's holdings are used instead
  hsi: { label: 'Hang Seng', index: '^HSI', currency: 'HKD', tz: 'Asia/Hong_Kong', city: 'Hong Kong',
    members: { kind: 'moneydj', fund: '2800.HK', sourceName: 'MoneyDJ — holdings of the Tracker Fund of Hong Kong (2800), which tracks the Hang Seng Index' } },
  nifty50: { label: 'Nifty 50', index: '^NSEI', currency: 'INR', tz: 'Asia/Kolkata', city: 'Mumbai',
    // Yahoo carries no market cap on NSE lines; the same company's BSE line has one
    capAlt: s => s.replace(/\.NS$/, '.BO'),
    members: { kind: 'nifty', url: 'https://niftyindices.com/IndexConstituent/ind_nifty50list.csv', expected: 50 } },
  kospi: { label: 'KOSPI', index: '^KS11', currency: 'KRW', tz: 'Asia/Seoul', city: 'Seoul',
    // Common shares only: a Korean share code ending in 0 is the common
    // line; preferred lines end in 5, 7, 9 or a letter. REITs and the
    // listed infrastructure fund are fund units (23 + 1 on 2026-10-17)
    members: { kind: 'screener', exchange: 'KSC', keep: (s, q) => /^[0-9A-Z]{5}0\.KS$/.test(s) && notFund(q), sourceName: 'Yahoo Finance — its listing of the KOSPI market: common company shares, preferred lines and REIT/fund units left out' } },
  sti: { label: 'Straits Times', index: '^STI', currency: 'SGD', tz: 'Asia/Singapore', city: 'Singapore',
    members: { kind: 'ssga', url: 'https://www.ssga.com/sg/en_gb/intermediary/etfs/library-content/products/fund-data/etfs/apac/holdings-daily-sg-en-es3.xlsx', page: 'https://www.ssga.com/sg/en_gb/intermediary/etfs/state-street-spdr-straits-times-index-etf-es3', suffix: '.SI', sourceName: 'State Street — SPDR Straits Times Index ETF (ES3) daily holdings', expected: 30 } },
  // Yahoo carries no FTSE TWSE Taiwan 50 level (^TW50, ^TWT50, ^TWSE50,
  // ^TAI50 all empty, 2026-10-17); TWSE publishes the official close
  tw50: { label: 'Taiwan 50', index: null, indexTwse: { report: 'TAI50I', field: 'Taiwan50Index' }, currency: 'TWD', tz: 'Asia/Taipei', city: 'Taipei',
    members: { kind: 'moneydj', fund: '0050.TW', sourceName: 'MoneyDJ — holdings of the Yuanta Taiwan Top 50 ETF (0050), which tracks the FTSE TWSE Taiwan 50', expected: 50 } },
  set50: { label: 'SET 50', index: '^SET50.BK', currency: 'THB', tz: 'Asia/Bangkok', city: 'Bangkok',
    members: { kind: 'components', index: '^SET50.BK', label: 'SET50', expected: 50 } },
  bist100: { label: 'BIST 100', index: 'XU100.IS', currency: 'TRY', tz: 'Europe/Istanbul', city: 'Istanbul',
    members: { kind: 'kap', code: 'XU100', expected: 100 } },
  tasi: { label: 'Tadawul All Share', index: '^TASI.SR', currency: 'SAR', tz: 'Asia/Riyadh', city: 'Riyadh',
    // Main-market shares only: parallel-market (Nomu) codes start with 9,
    // and the listed REIT funds (28 of them on 2026-10-17, codes 4330-4350)
    // are fund units, not company shares
    members: { kind: 'screener', exchange: 'SAU', keep: (s, q) => /^[1-8]\d{3}\.SR$/.test(s) && notFund(q), sourceName: 'Yahoo Finance — its listing of the Saudi Exchange main market: company shares, Nomu (codes 9xxx) and REIT funds left out' } },
  dfm: { label: 'DFM General', index: 'DFMGI.AE', currency: 'AED', tz: 'Asia/Dubai', city: 'Dubai',
    // Companies cross-listed from Bahrain, Kuwait and Sudan trade on the DFM
    // and are kept; REIT units are not company shares
    members: { kind: 'screener', exchange: 'DFM', keep: (s, q) => notFund(q), sourceName: 'Yahoo Finance — its listing of the Dubai Financial Market: company shares including Gulf cross-listings, REIT units left out' } },
  szse: { label: 'Shenzhen Component', index: '399001.SZ', currency: 'CNY', tz: 'Asia/Shanghai', city: 'Shenzhen',
    members: { kind: 'cnindex', code: '399001', expected: 500 } },
};
export const MARKET_IDS = Object.keys(MARKETS);

// ── Membership memo: twelve hours on a warm instance, the last good list in Postgres ──
const MEMBERS_TTL_MS = 12 * 3600e3;
const membersMemo = new Map();   // id → { at, list, retryAfter?, refreshError? }

async function loadMembers(id, ctx) {
  const memo = membersMemo.get(id);
  if (memo && (ctx.now - memo.at < MEMBERS_TTL_MS || ctx.now < (memo.retryAfter || 0))) return { ...memo.list, cached: true, refreshError: memo.refreshError || null };
  const spec = MARKETS[id].members;
  try {
    const list = await ADAPTERS[spec.kind](spec, ctx);
    if (!(list.members?.length || list.isins?.length)) throw new Error('the constituent list came back empty');
    const stamped = { ...list, fetchedAt: new Date(ctx.now).toISOString() };
    membersMemo.set(id, { at: ctx.now, list: stamped });
    kvSet(`index-heatmap:members:${id}`, stamped).catch(() => {});
    return { ...stamped, cached: false, refreshError: null };
  } catch (e) {
    // A dated list already read beats "unavailable": served with the
    // refresh failure stated, retried in ten minutes
    if (memo) {
      memo.retryAfter = ctx.now + 10 * 60e3;
      memo.refreshError = e.message;
      return { ...memo.list, cached: true, refreshError: e.message };
    }
    const stored = await kvGet(`index-heatmap:members:${id}`);
    if (stored?.value?.members?.length || stored?.value?.isins?.length) {
      membersMemo.set(id, { at: ctx.now, list: stored.value, retryAfter: ctx.now + 10 * 60e3, refreshError: e.message });
      return { ...stored.value, cached: true, fromStore: true, refreshError: e.message };
    }
    throw e;
  }
}

// ── The payload ──
const payloadMemo = new Map();   // id → { at, payload, ttl }
const inflight = new Map();

export function _resetIndexHeatmap() {
  membersMemo.clear(); payloadMemo.clear(); inflight.clear(); isinMap.clear(); isinLoaded = null;
  Object.assign(yahoo, { cookie: null, crumb: null, at: 0, pending: null, cooldownUntil: 0 });
}

// Minor-unit quote currencies: Yahoo quotes London in pence (GBp) but
// states the market cap in pounds
const MINOR = { GBp: ['GBP', 0.01], GBX: ['GBP', 0.01], ZAc: ['ZAR', 0.01], ILA: ['ILS', 0.01] };
const major = cur => (MINOR[cur] ? MINOR[cur][0] : cur);

/**
 * Market cap for a tile, in the quote's major currency: Yahoo's own when it
 * agrees with price × shares within a factor of two, else price × shares
 * (Yahoo has put a whole company's value on a single share class); null
 * when neither exists. The basis travels with the number.
 */
export function capOf(q) {
  if (!q) return { cap: null, basis: null };
  const f = MINOR[q.currency]?.[1] ?? 1;
  const implied = q.price != null && q.shares != null ? q.price * f * q.shares : null;
  if (q.cap != null && implied != null) {
    const r = q.cap / implied;
    if (r < 0.5 || r > 2) return { cap: implied, basis: 'price × shares (Yahoo cap disagreed)' };
  }
  if (q.cap != null) return { cap: q.cap, basis: 'yahoo' };
  if (implied != null) return { cap: implied, basis: 'price × shares' };
  return { cap: null, basis: null };
}

export async function fetchIndexHeatmap(id, opts = {}) {
  if (!MARKETS[id]) throw new Error(`unknown market ${id}`);
  const now = opts.now ?? Date.now();
  const memo = payloadMemo.get(id);
  if (memo && now - memo.at < memo.ttl) return { ...memo.payload, servedFromMemo: true, memoAgeSec: Math.round((now - memo.at) / 1000) };
  // While Yahoo is throttling, a recent real map beats an error
  if (memo && Date.now() < yahoo.cooldownUntil) return { ...memo.payload, servedFromMemo: true, memoAgeSec: Math.round((now - memo.at) / 1000), throttled: true };
  if (inflight.has(id)) return inflight.get(id);
  const p = pull(id, { ...opts, now }).then(payload => {
    payloadMemo.set(id, { at: now, payload, ttl: payload.complete ? 120e3 : 45e3 });
    return payload;
  }).finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

async function pull(id, { timeoutMs = 8000, fetchImpl = fetch, now = Date.now(), budgetMs = 25000 } = {}) {
  const m = MARKETS[id];
  const ctx = { fetchImpl, timeoutMs, now, deadline: Date.now() + budgetMs };
  const list = await loadMembers(id, ctx);

  // STOXX 600: the list is ISINs; resolve what is not yet known
  let members = list.members || [];
  let unresolved = [], isinErrors = [];
  if (list.isins) {
    const r = await resolveIsins(ctx, list.isins.map(x => x.isin));
    isinErrors = r.errors;
    members = [];
    const seen = new Set();
    for (const x of list.isins) {
      const symbol = isinMap.get(x.isin);
      if (!symbol) { unresolved.push(x.name || x.isin); continue; }
      if (seen.has(symbol)) continue;
      seen.add(symbol);
      members.push({ symbol, code: symbol.replace(/\.[A-Z]{1,3}$/, ''), name: x.name, isin: x.isin });
    }
  }

  // A member matched only to a secondary line (a US listing, the Frankfurt
  // floor) is also asked for on its home venue under the same ticker; the
  // home line replaces it only if Yahoo actually quotes it
  const homeTry = {};
  for (const x of members) {
    const home = x.isin ? HOME_SUFFIX[x.isin.slice(0, 2)] : null;
    if (home && !isPrimaryEu(x.symbol)) homeTry[x.symbol] = `${x.symbol.replace(/\.[A-Z]{1,3}$/, '')}${home}`;
  }
  const symbols = [...new Set([...(m.index ? [m.index] : []), ...members.map(x => x.symbol), ...Object.values(homeTry)])];
  const q = await quoteSymbols(ctx, symbols);
  for (const x of members) {
    const h = homeTry[x.symbol];
    if (h && q.quotes[h]?.price != null) { x.symbol = h; x.code = h.replace(/\.[A-Z]{1,3}$/, ''); }
  }
  const errors = [...q.errors];

  // Market caps Yahoo left out on one line, from the company's other line
  const capFrom = {};
  if (m.capAlt) {
    const need = members.filter(x => q.quotes[x.symbol] && capOf(q.quotes[x.symbol]).cap == null).map(x => x.symbol);
    if (need.length && !q.throttled) {
      const alt = await quoteSymbols(ctx, need.map(m.capAlt));
      errors.push(...alt.errors);
      for (const s of need) {
        const a = alt.quotes[m.capAlt(s)];
        const c = capOf(a);
        if (c.cap != null && major(a.currency) === major(q.quotes[s].currency)) capFrom[s] = { cap: c.cap, basis: `${m.capAlt(s)} line` };
      }
    }
  }

  // Members with neither a cap nor a share count: the reported share count
  const noCap = members.filter(x => q.quotes[x.symbol]?.price != null && capOf(q.quotes[x.symbol]).cap == null && !capFrom[x.symbol]).map(x => x.symbol);
  const noCapAsked = noCap.slice(0, SHARE_COUNT_LIMIT);
  if (noCapAsked.length && !q.throttled) {
    const counts = await reportedShares(ctx, noCapAsked);
    for (const s of noCapAsked) {
      if (!counts[s]) continue;
      const c = capOf({ ...q.quotes[s], cap: null, shares: counts[s].shares });
      if (c.cap != null) capFrom[s] = { cap: c.cap, basis: `price × ordinary shares reported ${counts[s].asOf}` };
    }
  }

  // Caps in a currency other than the index's are converted at Yahoo's spot rate
  // A quote with no currency takes its reporting currency only when that is
  // the index's own (one Saudi member, 2026-10-17); named on the page
  const curOf = qq => qq?.currency || (qq?.financialCurrency === m.currency ? m.currency : null);
  const foreign = [...new Set(members.map(x => curOf(q.quotes[x.symbol])).filter(Boolean).map(major))].filter(c => c !== m.currency);
  const fx = {};
  if (foreign.length && !q.throttled) {
    const fq = await quoteSymbols(ctx, foreign.map(c => `${c}${m.currency}=X`));
    errors.push(...fq.errors);
    for (const c of foreign) { const r = fq.quotes[`${c}${m.currency}=X`]?.price; if (r) fx[c] = r; }
  }

  let idx = m.index ? q.quotes[m.index] : null;
  if (m.indexTwse) {
    try { idx = await twseIndex(m.indexTwse, ctx); } catch (e) { errors.push(`index level: ${e.message}`); }
  }
  const memberTimes = members.map(x => q.quotes[x.symbol]?.time).filter(Boolean).sort();
  // The session the map describes: the index's own quote day where Yahoo
  // quotes it live, else the newest member quote (an official close is a
  // day behind during the session)
  const sessionDay = localDay((!idx?.close && idx?.time) || memberTimes[memberTimes.length - 1], m.tz);

  const tiles = [];
  const missing = [], unsized = [], staleQuotes = [], derived = [], currencyInferred = [];
  for (const x of members) {
    const qq = q.quotes[x.symbol];
    if (!qq || qq.price == null) { missing.push(x.code); continue; }
    let { cap, basis } = capOf(qq);
    if (cap == null && capFrom[x.symbol]) ({ cap, basis } = capFrom[x.symbol]);
    const cur = major(curOf(qq) || capFrom[x.symbol]?.currency || null);
    if (!qq.currency && cur) currencyInferred.push(x.code);
    const rate = cur === m.currency ? 1 : fx[cur];
    if (cap == null || !rate) { unsized.push(x.code); continue; }
    if (basis !== 'yahoo') derived.push({ code: x.code, basis });
    const day = localDay(qq.time, m.tz);
    const stale = !!(qq.changePct != null && day && sessionDay && day < sessionDay);
    if (stale) staleQuotes.push({ code: x.code, day });
    tiles.push({
      code: x.code,
      name: x.name || qq.name || x.code,
      localName: x.localName || null,
      sector: qq.sector || 'Other',
      industry: qq.industry || null,
      symbol: x.symbol,
      price: qq.price,
      currency: qq.currency || cur,
      changePct: qq.changePct,
      time: qq.time,
      stale,
      // Market cap in the index's currency, three significant figures:
      // the picture, not a valuation feed
      size: Number((cap * rate).toPrecision(3)),
      // This line's price × its own shares: for a company with several
      // share classes (Hong Kong H-shares, preference lines) less than the
      // company's market cap, and labelled so
      lineValue: /^price × shares/.test(basis || ''),
    });
  }
  const bySector = {};
  for (const t of tiles) bySector[t.sector] = (bySector[t.sector] || 0) + t.size;
  const sectors = Object.keys(bySector).sort((a, b) => bySector[b] - bySector[a]);
  const times = tiles.map(t => t.time).filter(Boolean).sort();
  const constituents = members.length + unresolved.length;
  const expected = list.expected ?? null;

  const complete = !missing.length && !unsized.length && !unresolved.length && !staleQuotes.length && !errors.length
    && !list.refreshError && (!!idx?.price || !!idx?.level) && (expected == null || constituents === expected);
  return {
    ok: tiles.length > 0,
    complete,
    market: { id, label: m.label, currency: m.currency, tz: m.tz, city: m.city },
    fetchedAt: new Date(now).toISOString(),
    sessionDay,
    index: idx?.close ? { symbol: idx.symbol, level: idx.level, changePct: idx.changePct, time: idx.time, close: true, source: 'TWSE official close' }
      : idx && idx.price != null ? { symbol: m.index, level: idx.price, changePct: idx.changePct, time: idx.time } : null,
    membersAsOf: list.asOf || null,
    membersAsOfKind: list.asOfKind || null,
    tiles,
    sectors,
    integrity: {
      constituents,
      expected,
      drawn: tiles.length,
      missing,
      unsized,
      unresolved,
      // A member Yahoo lists only on a secondary venue (a US line, the
      // Frankfurt floor) is drawn from that line and named here
      secondaryListings: list.isins ? members.filter(x => !isPrimaryEu(x.symbol)).map(x => x.symbol) : [],
      staleQuotes,
      capsDerived: derived,
      currencyInferred,
      fx,
      rowsMalformed: list.rowsMalformed || 0,
      duplicates: list.duplicates || 0,
      listed: list.listed ?? null,
      leftOut: list.leftOut ?? null,
      membersFetchedAt: list.fetchedAt || null,
      membersCached: !!list.cached,
      membersFromStore: !!list.fromStore,
      membersRefreshError: list.refreshError || null,
      isinErrors,
      batches: q.batches,
      batchErrors: [...new Set(errors)],
      quotesFrom: times[0] || null,
      quotesTo: times[times.length - 1] || null,
      indexQuoted: !!(idx?.price || idx?.level),
    },
    sources: { constituents: list.source, quotes: QUOTES_SOURCE },
    method: `Tiles are ${list.asOfKind === 'listing' ? `the market as ${list.source?.name || 'Yahoo'} — the exchange as Yahoo lists it, not the index provider's file` : `the members in ${list.source?.name || 'the constituent list'}${list.asOf ? `, ${list.asOf}` : ''}`}, sized by market capitalisation in ${m.currency} (Yahoo Finance; converted at Yahoo's spot rate where a member is quoted in another currency) — not by index weight — and coloured by the session's delayed move. Members Yahoo did not quote, could not size, or whose last trade is from an earlier session are listed, never drawn at an invented size or coloured as today.`,
  };
}

/** Diagnostic: every market's constituent list, without quotes. */
export async function membersDiag(opts = {}) {
  const now = opts.now ?? Date.now();
  const ctx = { fetchImpl: opts.fetchImpl || fetch, timeoutMs: opts.timeoutMs || 9000, now, deadline: Date.now() + (opts.budgetMs || 40000) };
  const out = await Promise.all(MARKET_IDS.map(async id => {
    const t0 = Date.now();
    try {
      const l = await loadMembers(id, ctx);
      const list = l.members || l.isins || [];
      return { id, ms: Date.now() - t0, count: list.length, expected: l.expected ?? null, asOf: l.asOf || null, asOfKind: l.asOfKind || null, source: l.source?.name || null, sample: list.slice(0, 5).map(x => x.symbol || x.isin), last: list.slice(-2).map(x => x.symbol || x.isin), rowsMalformed: l.rowsMalformed || 0, duplicates: l.duplicates || 0, listed: l.listed ?? null, leftOut: l.leftOut ?? null, cached: !!l.cached, refreshError: l.refreshError || null };
    } catch (e) {
      return { id, ms: Date.now() - t0, error: e.message };
    }
  }));
  let indices = null;
  try {
    const cand = [...MARKET_IDS.map(id => MARKETS[id].index).filter(Boolean), '^TW50', '^TWT50', '^TWSE50', '^TAI50'];
    const q = await quoteSymbols(ctx, cand);
    indices = cand.map(s => ({ symbol: s, level: q.quotes[s]?.price ?? null, time: q.quotes[s]?.time ?? null, name: q.quotes[s]?.shortName ?? null }));
  } catch (e) { indices = { error: e.message }; }
  return { ok: true, at: new Date(now).toISOString(), region: process.env.VERCEL_REGION || null, markets: out, indices };
}
