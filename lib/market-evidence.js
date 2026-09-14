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
// Lives in lib/ so it is not a serverless function of its own.
// ═══════════════════════════════════════════════════════════

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Benchmarks the desk is allowed to talk about. Order is display order.
export const MACRO_UNIVERSE = [
  { key: 'DXY',   yahoo: 'DX-Y.NYB', label: 'US Dollar Index (DXY)',        unit: '',   digits: 2 },
  { key: 'VIX',   yahoo: '^VIX',     label: 'CBOE Volatility Index (VIX)',  unit: '',   digits: 2 },
  { key: 'US10Y', yahoo: '^TNX',     label: 'US 10-year Treasury yield',    unit: '%',  digits: 2 },
  { key: 'US3M',  yahoo: '^IRX',     label: 'US 3-month T-bill yield',      unit: '%',  digits: 2 },
  { key: 'SPX',   yahoo: '^GSPC',    label: 'S&P 500',                      unit: '',   digits: 0 },
  { key: 'BRENT', yahoo: 'BZ=F',     label: 'Brent crude (USD/bbl)',        unit: '',   digits: 2 },
  { key: 'WTI',   yahoo: 'CL=F',     label: 'WTI crude (USD/bbl)',          unit: '',   digits: 2 },
  { key: 'GOLD',  yahoo: 'GC=F',     label: 'Gold (USD/oz)',                unit: '',   digits: 0 },
  { key: 'BTC',   yahoo: 'BTC-USD',  label: 'Bitcoin (USD)',                unit: '',   digits: 0 },
];

async function timedFetch(url, ms, headers = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { signal: c.signal, headers });
  } finally {
    clearTimeout(t);
  }
}

// Same Yahoo chart endpoint the cockpit uses — one source, one number.
export async function quoteYahoo(symbol, timeoutMs = 5000) {
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const r = await timedFetch(
        `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
        timeoutMs, { 'User-Agent': UA }
      );
      if (!r.ok) continue;
      const meta = (await r.json())?.chart?.result?.[0]?.meta;
      if (!meta) continue;
      const price = meta.regularMarketPrice ?? meta.previousClose;
      const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
      if (price == null) continue;
      return {
        price,
        prevClose: prev,
        change: price - prev,
        changePct: prev ? ((price - prev) / prev) * 100 : 0,
        asOf: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
      };
    } catch { /* try the other host */ }
  }
  throw new Error('Yahoo unavailable');
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
 * Fetch every benchmark and the headline feed in parallel. Never throws:
 * each line is either a real level or "unavailable".
 */
export async function fetchMacroEvidence({ finnhubKey, timeoutMs = 5000 } = {}) {
  const [quotes, news] = await Promise.all([
    Promise.allSettled(MACRO_UNIVERSE.map(m => quoteYahoo(m.yahoo, timeoutMs))),
    generalNews(finnhubKey, timeoutMs),
  ]);
  const levels = MACRO_UNIVERSE.map((m, i) => {
    const q = quotes[i];
    return q.status === 'fulfilled'
      ? { ...m, ok: true, ...q.value }
      : { ...m, ok: false, error: q.reason?.message || 'unavailable' };
  });
  return { fetchedAt: new Date().toISOString(), levels, news };
}

function fmt(v, digits) {
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Render the evidence as the block the system prompts embed. */
export function renderMacroEvidence(ev) {
  const okCount = ev.levels.filter(l => l.ok).length;
  const lines = ev.levels.map(l => l.ok
    ? `- ${l.label}: ${fmt(l.price, l.digits)}${l.unit} (${l.changePct >= 0 ? '+' : ''}${l.changePct.toFixed(2)}% vs prior close)`
    : `- ${l.label}: unavailable — do not state a level or a direction for it`
  ).join('\n');

  const newsLines = ev.news.items.length
    ? ev.news.items.map(n => `- ${n.date} ${n.source ? `[${n.source}] ` : ''}${n.headline}`).join('\n')
    : `- No headline feed available (${ev.news.error || 'empty'}). Do not describe any news event as having happened this week.`;

  return `LIVE GLOBAL MACRO EVIDENCE — fetched ${ev.fetchedAt.slice(0, 16).replace('T', ' ')} UTC (${okCount} of ${ev.levels.length} benchmarks live; Yahoo Finance quotes, Finnhub headlines).
${lines}

LATEST MARKET HEADLINES (these are the only news events you may reference):
${newsLines}

Rules for macro claims:
- Every macro level, move or event you mention must appear above. If it is not here, you do not know it — say the desk has no read on it rather than supplying one from memory.
- Do not state central-bank decisions, data releases or geopolitical events as this week's facts unless a headline above says so.
- A benchmark marked unavailable gets no number and no direction.`;
}

// Cached for the interactive desk so a conversation does not re-fetch nine
// quotes on every turn. The brief runs twice a week and fetches fresh.
let cache = { at: 0, block: '' };
export async function macroEvidenceBlock({ finnhubKey, ttlMs = 5 * 60000, timeoutMs = 4000 } = {}) {
  if (Date.now() - cache.at < ttlMs && cache.block) return cache.block;
  const block = renderMacroEvidence(await fetchMacroEvidence({ finnhubKey, timeoutMs }));
  cache = { at: Date.now(), block };
  return block;
}
