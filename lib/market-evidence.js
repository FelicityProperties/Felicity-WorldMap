// ═══════════════════════════════════════════════════════════
// MARKET EVIDENCE — live global macro levels for the AI desk
// ═══════════════════════════════════════════════════════════
//
// The brief and the Ask Felicity desk both open with "global macro" —
// the Fed, the dollar, oil, equity risk appetite — and until now they
// wrote that section from nothing: no level, no date, no headline was
// supplied, so every "Fed on hold, dollar firm" was the model's memory
// dressed as a read of the tape. That is the same fabrication the
// Dubai side was purged of.
//
// This module fetches a fixed set of benchmark levels from Yahoo and,
// when a Finnhub key exists, the latest general-market headlines, and
// renders them as an evidence block for the system prompt. Anything
// that cannot be fetched is listed as unavailable — the prompt tells
// the model not to speak to it. Nothing is ever filled in.
//
// Fetch shape matters. The first version fired nine per-symbol chart
// requests at Yahoo simultaneously and got one back — the same burst
// api/markets.js learned to avoid. So: one batch quote request first
// (the pattern that serves the sidebar in production), then a throttled
// per-symbol fallback only for whatever the batch missed, with one
// retry on a 429. Every miss keeps its reason so the caller can report
// it rather than guess.
//
// Lives in lib/ so it is not a serverless function of its own.
// ═══════════════════════════════════════════════════════════

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

// Benchmarks the desk is allowed to talk about. Order is display order.
// `prefix`/`suffix` wrap the level so the currency travels with the
// number — the first full-evidence brief wrote "Brent AED 109.61/bbl"
// because the prompt talks in AED everywhere else. `kind: 'yield'`
// renders the day's change in basis points, not as a percentage of a
// percentage, which reads as a move ten times larger than it is.
export const MACRO_UNIVERSE = [
  { key: 'DXY',   yahoo: 'DX-Y.NYB', label: 'US Dollar Index (DXY)',       prefix: '',     suffix: '',       digits: 2 },
  { key: 'VIX',   yahoo: '^VIX',     label: 'CBOE Volatility Index (VIX)', prefix: '',     suffix: '',       digits: 2 },
  { key: 'US10Y', yahoo: '^TNX',     label: 'US 10-year Treasury yield',   prefix: '',     suffix: '%',      digits: 2, kind: 'yield' },
  { key: 'US3M',  yahoo: '^IRX',     label: 'US 3-month T-bill yield',     prefix: '',     suffix: '%',      digits: 2, kind: 'yield' },
  { key: 'SPX',   yahoo: '^GSPC',    label: 'S&P 500',                     prefix: '',     suffix: ' pts',   digits: 0 },
  { key: 'BRENT', yahoo: 'BZ=F',     label: 'Brent crude',                 prefix: 'USD ', suffix: ' per barrel', digits: 2 },
  { key: 'WTI',   yahoo: 'CL=F',     label: 'WTI crude',                   prefix: 'USD ', suffix: ' per barrel', digits: 2 },
  { key: 'GOLD',  yahoo: 'GC=F',     label: 'Gold',                        prefix: 'USD ', suffix: ' per oz', digits: 0 },
  { key: 'BTC',   yahoo: 'BTC-USD',  label: 'Bitcoin',                     prefix: 'USD ', suffix: '',       digits: 0 },
];

async function timedFetch(url, ms, headers = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { signal: c.signal, headers });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? `timeout after ${ms}ms` : e.message);
  } finally {
    clearTimeout(t);
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function shape(price, prev, time) {
  return {
    price,
    prevClose: prev,
    change: price - prev,
    changePct: prev ? ((price - prev) / prev) * 100 : 0,
    asOf: time ? new Date(time * 1000).toISOString() : null,
  };
}

// One request for every symbol. Returns whatever Yahoo answered for; a
// symbol missing from the reply is simply not in the map.
async function batchYahoo(symbols, timeoutMs) {
  let lastError = 'no response';
  for (const host of HOSTS) {
    try {
      const r = await timedFetch(
        `https://${host}/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}`,
        timeoutMs, { 'User-Agent': UA, Accept: 'application/json' }
      );
      if (!r.ok) { lastError = `HTTP ${r.status}`; continue; }
      const list = (await r.json())?.quoteResponse?.result;
      if (!Array.isArray(list)) { lastError = 'unexpected payload'; continue; }
      const out = {};
      for (const q of list) {
        const price = q.regularMarketPrice ?? q.previousClose;
        if (price == null) continue;
        const prev = q.regularMarketPreviousClose ?? q.previousClose ?? price;
        out[q.symbol] = shape(price, prev, q.regularMarketTime);
      }
      return { quotes: out, error: null };
    } catch (e) {
      lastError = e.message;
    }
  }
  return { quotes: {}, error: lastError };
}

// Same chart endpoint the cockpit uses — one symbol, one retry on a 429.
export async function quoteYahoo(symbol, timeoutMs = 5000) {
  let lastError = 'no response';
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const host of HOSTS) {
      try {
        const r = await timedFetch(
          `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
          timeoutMs, { 'User-Agent': UA }
        );
        if (r.status === 429) { lastError = 'HTTP 429'; break; }
        if (!r.ok) { lastError = `HTTP ${r.status}`; continue; }
        const meta = (await r.json())?.chart?.result?.[0]?.meta;
        if (!meta) { lastError = 'no chart meta'; continue; }
        const price = meta.regularMarketPrice ?? meta.previousClose;
        if (price == null) { lastError = 'no price'; continue; }
        return shape(price, meta.chartPreviousClose ?? meta.previousClose ?? price, meta.regularMarketTime);
      } catch (e) {
        lastError = e.message;
      }
    }
    if (lastError !== 'HTTP 429') break;
    await sleep(800);
  }
  throw new Error(lastError);
}

// Run tasks with at most `n` in flight — a burst is what got us 1/9.
// Results are written into the caller's array as they land, so a caller
// that stops waiting still keeps whatever had finished.
async function throttled(items, n, fn, results) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]).then(v => ({ ok: true, v }), e => ({ ok: false, e }));
    }
  }));
  return results;
}

// Wait for `p` or `ms`, whichever is first, without leaving a timer that
// keeps a serverless invocation alive after the answer is in.
function withinMs(p, ms) {
  let t;
  const timer = new Promise(r => { t = setTimeout(() => r('deadline'), ms); });
  return Promise.race([p, timer]).finally(() => clearTimeout(t));
}

async function generalNews(finnhubKey, timeoutMs, max = 8) {
  if (!finnhubKey) return { items: [], error: 'FINNHUB_API_KEY not configured' };
  try {
    const r = await timedFetch(`https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`, timeoutMs);
    if (!r.ok) return { items: [], error: `Finnhub ${r.status}` };
    const raw = await r.json();
    if (!Array.isArray(raw)) return { items: [], error: 'Unexpected news payload' };
    const items = raw
      .filter(n => n.headline)
      .sort((a, b) => (b.datetime || 0) - (a.datetime || 0))
      .slice(0, max)
      .map(n => ({
        headline: String(n.headline).slice(0, 200),
        source: String(n.source || '').slice(0, 40),
        date: n.datetime ? new Date(n.datetime * 1000).toISOString().slice(0, 10) : '',
      }));
    return { items };
  } catch (e) {
    return { items: [], error: e.message };
  }
}

/**
 * Fetch every benchmark (batch first, throttled fallback for misses) and
 * the headline feed. Never throws: each level is either a real quote or
 * carries the reason it is not.
 *
 * `deadlineMs` bounds the whole thing. Without it a Yahoo outage would
 * cost nine misses × two hosts × timeout in the fallback — long enough
 * to hang every Ask Felicity question behind a macro block nobody asked
 * for. Past the deadline, whatever has landed is used and the rest is
 * reported as missed on deadline.
 */
export async function fetchMacroEvidence({ finnhubKey, timeoutMs = 5000, deadlineMs = 12000 } = {}) {
  const started = Date.now();
  const symbols = MACRO_UNIVERSE.map(m => m.yahoo);

  // The batch phase is under the same deadline as the fallback — two hosts
  // × a per-request timeout is already most of the desk's budget.
  const perRequest = Math.min(timeoutMs, deadlineMs);
  let batch = { quotes: {}, error: `missed ${deadlineMs}ms deadline` };
  let news = { items: [], error: `missed ${deadlineMs}ms deadline` };
  const first = await withinMs(
    Promise.all([batchYahoo(symbols, perRequest), generalNews(finnhubKey, perRequest)]),
    deadlineMs
  );
  if (first !== 'deadline') [batch, news] = first;

  const missing = MACRO_UNIVERSE.filter(m => !batch.quotes[m.yahoo]);
  const fallback = new Array(missing.length).fill(null);
  const remaining = deadlineMs - (Date.now() - started);
  if (missing.length && remaining > 500) {
    await withinMs(
      throttled(missing, 2, m => quoteYahoo(m.yahoo, Math.min(timeoutMs, remaining)), fallback),
      remaining
    );
  }

  const levels = MACRO_UNIVERSE.map(m => {
    if (batch.quotes[m.yahoo]) return { ...m, ok: true, via: 'batch', ...batch.quotes[m.yahoo] };
    const f = fallback[missing.indexOf(m)];
    if (f?.ok) return { ...m, ok: true, via: 'chart', ...f.v };
    const reason = f ? (f.e?.message || 'unavailable') : `missed ${deadlineMs}ms deadline`;
    return { ...m, ok: false, error: `${reason}${batch.error ? ` (batch: ${batch.error})` : ''}` };
  });
  return { fetchedAt: new Date().toISOString(), levels, news };
}

/** What did not come back, and why — for responses and logs. */
export function macroMisses(ev) {
  return ev.levels.filter(l => !l.ok).map(l => `${l.key}: ${l.error}`);
}

function fmt(v, digits) {
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Render the evidence as the block the system prompts embed. */
export function renderMacroEvidence(ev) {
  const okCount = ev.levels.filter(l => l.ok).length;
  const lines = ev.levels.map(l => {
    if (!l.ok) return `- ${l.label}: unavailable — do not state a level or a direction for it`;
    const level = `${l.prefix}${fmt(l.price, l.digits)}${l.suffix}`;
    const move = l.kind === 'yield'
      ? `${l.change >= 0 ? '+' : ''}${Math.round(l.change * 100)} bp vs prior close`
      : `${l.changePct >= 0 ? '+' : ''}${l.changePct.toFixed(2)}% vs prior close`;
    return `- ${l.label}: ${level} (${move})`;
  }).join('\n');

  const newsLines = ev.news.items.length
    ? ev.news.items.map(n => `- ${n.date} ${n.source ? `[${n.source}] ` : ''}${n.headline}`).join('\n')
    : `- No headline feed available (${ev.news.error || 'empty'}). Do not describe any news event as having happened this week.`;

  return `LIVE GLOBAL MACRO EVIDENCE — fetched ${ev.fetchedAt.slice(0, 16).replace('T', ' ')} UTC (${okCount} of ${ev.levels.length} benchmarks live; Yahoo Finance quotes, Finnhub headlines).
${lines}

LATEST MARKET HEADLINES (these are the only news events you may reference):
${newsLines}

Rules for macro claims:
- Every macro level, move or event you mention must appear above. If it is not here, you do not know it — say the desk has no read on it rather than supplying one from memory.
- Quote each level with the currency and unit shown (USD per barrel, USD per oz, bp for yields). These are dollar benchmarks — never restate them in AED.
- Do not state central-bank decisions, data releases or geopolitical events as this week's facts unless a headline above says so.
- A benchmark marked unavailable gets no number and no direction.`;
}

// Cached for the interactive desk so a conversation does not re-fetch the
// benchmarks on every turn. A thin result is cached only briefly so an
// outage clears quickly. The brief runs twice a week and fetches fresh.
let cache = { at: 0, block: '', ttl: 0 };
export async function macroEvidenceBlock({ finnhubKey, ttlMs = 5 * 60000, timeoutMs = 4000, deadlineMs = 6000 } = {}) {
  if (cache.block && Date.now() - cache.at < cache.ttl) return cache.block;
  const ev = await fetchMacroEvidence({ finnhubKey, timeoutMs, deadlineMs });
  const okCount = ev.levels.filter(l => l.ok).length;
  if (okCount < ev.levels.length) console.warn('[macro-evidence] missing:', macroMisses(ev).join('; '));
  cache = { at: Date.now(), block: renderMacroEvidence(ev), ttl: okCount === ev.levels.length ? ttlMs : Math.min(ttlMs, 60000) };
  return cache.block;
}
