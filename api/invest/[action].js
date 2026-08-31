// Vercel Serverless Function — Investing Cockpit API
//
//   GET  /api/invest/quote?symbol=AAPL      live price for any asset class
//   GET  /api/invest/news?symbol=AAPL       daily news for that instrument
//   POST /api/invest/advise                 Felicity Bot investment analysis
//   POST /api/invest/scan                   screen instruments on real indicators
//   POST /api/invest/backtest               historical strategy simulation
//
// Every price and headline is fetched live from a real provider:
//   US equities  → Finnhub    (quote, company-news)
//   Indices / FX / futures → Yahoo Finance chart API
//   Crypto       → CoinGecko
//   Market news  → Finnhub general news
//
// Nothing is simulated. If a provider fails the response says so.

import { findAsset } from '../../js/invest-data.js';

// Any symbol outside the curated universe is treated as a US equity and
// routed to Finnhub. That keeps the cockpit open-ended — a user can analyse
// a ticker we never hardcoded — while still failing visibly if it isn't real.
function resolveAsset(symbol) {
  const known = findAsset(symbol);
  if (known) return known;
  const s = String(symbol || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(s)) return null;
  return {
    symbol: s, name: s, class: 'stocks', source: 'finnhub', tv: s, adhoc: true,
    drivers: 'Sector fundamentals, earnings delivery versus consensus, and sector-relative multiple.',
  };
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// ── Rate limiting (in-memory, resets on cold start) ──
//
// The bucket is keyed by action AS WELL AS IP. It used to be keyed by IP
// alone while four actions passed four different ceilings into it, so the
// lowest ceiling governed everything: browsing ten instruments (each firing
// a quote and a news call) filled the shared bucket and the screener came
// back "too many scans" before it had ever been run once. Separate buckets
// mean a quote never spends the advisor's allowance.
const rateLimit = {};
function checkRateLimit(key, max, windowMs = 60000) {
  const now = Date.now();

  // Cheap sweep — a warm lambda would otherwise hold every caller forever
  if (Object.keys(rateLimit).length > 5000) {
    for (const k of Object.keys(rateLimit)) {
      if (!rateLimit[k].some(t => now - t < windowMs)) delete rateLimit[k];
    }
  }

  rateLimit[key] = (rateLimit[key] || []).filter(t => now - t < windowMs);
  if (rateLimit[key].length >= max) return false;
  rateLimit[key].push(now);
  return true;
}

// Callers pass this so each action gets its own allowance
function limitKey(req, action) {
  return `${action}:${req.headers['x-forwarded-for'] || 'unknown'}`;
}

async function timedFetch(url, ms = 8000, headers = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { signal: c.signal, headers });
  } finally {
    clearTimeout(t);
  }
}

// ── Quote routing by asset class ──
async function quoteFinnhub(symbol, key) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`;
  let r;
  try {
    r = await timedFetch(url, 6000);
  } catch (e) {
    // One retry on a hung connection before falling through to Yahoo
    r = await timedFetch(url, 6000);
  }
  if (!r.ok) throw new Error(`Finnhub ${r.status}`);
  const d = await r.json();
  if (d.c == null || d.c === 0) throw new Error('No quote data');
  return { price: d.c, changePct: d.dp, change: d.d, high: d.h, low: d.l, open: d.o, prevClose: d.pc };
}

async function quoteYahoo(symbol) {
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const r = await timedFetch(
        `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
        7000, { 'User-Agent': UA }
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
        high: meta.regularMarketDayHigh ?? null,
        low: meta.regularMarketDayLow ?? null,
      };
    } catch { /* try next host */ }
  }
  throw new Error('Yahoo unavailable');
}

async function quoteCoinGecko(id) {
  const r = await timedFetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
  );
  if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
  const d = (await r.json())[id];
  if (!d) throw new Error('No crypto data');
  return {
    price: d.usd,
    changePct: d.usd_24h_change ?? 0,
    change: d.usd_24h_change != null ? (d.usd * d.usd_24h_change) / 100 : 0,
    marketCap: d.usd_market_cap ?? null,
    volume24h: d.usd_24h_vol ?? null,
  };
}

// Returns { quote, source } so the caller can say where the number really
// came from. US equities fall back Finnhub → Yahoo: both carry live US stock
// quotes, and "the primary feed timed out" is not a reason to show a visitor
// nothing when a second real feed answers. The fallback is labelled — the
// source in the response is the feed that actually supplied the number.
async function getQuote(asset, finnhubKey) {
  if (asset.source === 'finnhub') {
    if (finnhubKey) {
      try {
        return { quote: await quoteFinnhub(asset.symbol, finnhubKey), source: 'finnhub' };
      } catch (e) {
        console.error(`[quote] Finnhub failed for ${asset.symbol} (${e.message}) — trying Yahoo`);
      }
    }
    // Plain US tickers resolve on Yahoo as-is
    try {
      return { quote: await quoteYahoo(asset.yahoo || asset.symbol), source: 'yahoo' };
    } catch (e) {
      throw new Error(finnhubKey
        ? `Both feeds failed — Finnhub and Yahoo (${e.message})`
        : `FINNHUB_API_KEY not configured and Yahoo failed (${e.message})`);
    }
  }
  if (asset.source === 'coingecko') return { quote: await quoteCoinGecko(asset.cg), source: 'coingecko' };
  return { quote: await quoteYahoo(asset.yahoo), source: 'yahoo' };
}

// ── News ──
function ymd(d) { return d.toISOString().slice(0, 10); }

async function getNews(asset, finnhubKey, days = 7) {
  if (!finnhubKey) return { items: [], error: 'FINNHUB_API_KEY not configured' };

  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);

  try {
    // Company news for equities; category news for everything else
    const url = asset.class === 'stocks'
      ? `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(asset.symbol)}&from=${ymd(from)}&to=${ymd(to)}&token=${finnhubKey}`
      : `https://finnhub.io/api/v1/news?category=${asset.class === 'crypto' ? 'crypto' : 'general'}&token=${finnhubKey}`;

    const r = await timedFetch(url, 9000);
    if (!r.ok) return { items: [], error: `Finnhub ${r.status}` };
    let raw = await r.json();
    if (!Array.isArray(raw)) return { items: [], error: 'Unexpected news payload' };

    // For non-equities, keep only headlines that actually mention the instrument
    if (asset.class !== 'stocks') {
      const terms = [asset.name, asset.symbol].filter(Boolean).map(t => t.toLowerCase());
      const bondTerms = ['treasury', 'yield', 'bond', 'fed', 'fomc'];
      const extra = { XAU: ['gold'], XAG: ['silver'], WTI: ['oil', 'crude'], BRENT: ['oil', 'crude'],
                      NG: ['natural gas'], HG: ['copper'], BTC: ['bitcoin'], ETH: ['ethereum'],
                      US3M: bondTerms, US2Y: bondTerms, US5Y: bondTerms,
                      US10Y: bondTerms, US30Y: bondTerms }[asset.symbol] || [];
      const all = [...terms, ...extra];
      const hits = raw.filter(n => {
        const hay = `${n.headline || ''} ${n.summary || ''}`.toLowerCase();
        return all.some(t => hay.includes(t));
      });
      // Fall back to broad market news rather than showing an empty feed
      raw = hits.length ? hits : raw.slice(0, 12);
    }

    const items = raw
      .filter(n => n.headline)
      .sort((a, b) => (b.datetime || 0) - (a.datetime || 0))
      .slice(0, 12)
      .map(n => ({
        headline: n.headline,
        summary: (n.summary || '').slice(0, 400),
        source: n.source || '',
        url: n.url || '',
        datetime: n.datetime ? n.datetime * 1000 : null,
        image: n.image || '',
      }));

    return { items };
  } catch (e) {
    return { items: [], error: e.message };
  }
}

// ── Felicity Bot investment analysis ──
const ADVISOR_PROMPT = `You are Felicity Bot, the senior multi-asset strategist at Felicity Intelligence. You brief professional investors across equities, indices, crypto, FX and commodities.

You are given LIVE market data and REAL news headlines fetched moments ago. Ground every claim in them.

Absolute rules:
- NEVER invent a price, level, percentage, or news event. If you need a number that was not supplied, say it was not available.
- Quote the supplied live figures explicitly (price, % change, and the named headlines with their source).
- Take a clear position: BUY / ACCUMULATE / HOLD / TRIM / SHORT / AVOID. No fence-sitting.
- State conviction: LOW / MODERATE / HIGH / VERY HIGH / MAXIMUM.
- Give risk-first structure: an invalidation level (where the thesis is wrong), and a target. Size the position according to the INVESTOR PROFILE block below: with a profile, give a concrete cash amount and show the arithmetic; without one, give a percentage of risk budget and state the assumption.
- Separate what the DATA says from what you INFER. Label inference as inference.
- Address the bear case honestly. If the setup is genuinely unattractive, say AVOID and explain why — a good desk says no more often than yes.
- No filler, no disclaimers-by-paragraph, no "consult a financial advisor" boilerplate.

Return ONLY valid JSON, no code fences, exactly:
{
  "call": "BUY|ACCUMULATE|HOLD|TRIM|SHORT|AVOID",
  "conviction": "LOW|MODERATE|HIGH|VERY HIGH|MAXIMUM",
  "horizon": "e.g. 3-6 months",
  "sizing": "position size — a concrete amount in the reader's currency when a profile was supplied, otherwise a % of risk budget with the assumption stated",
  "invalidation": "the level or condition that proves the thesis wrong",
  "target": "the level or outcome being played for",
  "thesis": "2-4 sentences citing the live numbers supplied",
  "bear_case": "the strongest argument against this call",
  "catalysts": ["near-term catalyst 1", "catalyst 2"],
  "news_read": "what the supplied headlines actually signal, or 'No material news in the window.'"
}`;

// When the reader has told us their circumstances, Felicity Bot may size in
// real money — the capital figure is THEIR number, not an invented one.
function buildProfileBlock(p) {
  if (!p || !p.capital || !isFinite(p.capital)) {
    return `INVESTOR PROFILE: not provided.
Because you do not know this reader's circumstances, express position size ONLY as a percentage of their risk budget and state the assumption behind it. Do NOT give an absolute cash amount.`;
  }
  const cap = Number(p.capital);
  const cur = String(p.currency || 'USD').slice(0, 5);
  const maxLoss = Number(p.maxLossPct) || 10;
  return `INVESTOR PROFILE (supplied by the reader — these are THEIR stated figures, so you may compute real amounts from them):
- Investable capital: ${cur} ${cap.toLocaleString('en-US')}
- Risk tolerance: ${p.risk || 'balanced'}
- Time horizon: ${p.horizon || 'medium'}
- Experience: ${p.experience || 'intermediate'}
- Maximum acceptable loss on a single position: ${maxLoss}% of that position
${p.notes ? `- Existing exposure / constraints: ${p.notes}` : ''}

Because the reader supplied these figures, DO give a concrete ${cur} amount for the position, and show the arithmetic in one line (capital x allocation % = amount; and the ${cur} at risk if the invalidation level is hit). Respect their stated risk tolerance, horizon and constraints — if this instrument conflicts with them, say so plainly and recommend against it even if the setup looks good. Never exceed a sensible concentration for their stated tolerance.`;
}

async function handleAdvise(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // A watchlist sweep issues one analysis per holding back to back, so this
  // has to comfortably exceed a realistic watchlist size.
  if (!checkRateLimit(limitKey(req, 'advise'), 30)) {
    return res.status(429).json({
      ok: false,
      error: 'Too many analyses in the last minute (limit 30). Wait a moment and continue the sweep.',
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(200).json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' });

  const { symbol, profile } = req.body || {};
  const asset = resolveAsset(symbol);
  if (!asset) return res.status(400).json({ ok: false, error: `Unknown symbol: ${symbol}` });

  const finnhubKey = process.env.FINNHUB_API_KEY;

  // Fetch live evidence first — the model only ever sees real data
  const [qRes, nRes] = await Promise.allSettled([
    getQuote(asset, finnhubKey),
    getNews(asset, finnhubKey),
  ]);

  const quote = qRes.status === 'fulfilled' ? qRes.value.quote : null;
  const quoteSource = qRes.status === 'fulfilled' ? qRes.value.source : asset.source;
  const news = nRes.status === 'fulfilled' ? nRes.value.items : [];

  if (!quote) {
    return res.status(200).json({
      ok: false,
      error: `Live price for ${asset.symbol} is unavailable right now, so no analysis was produced. ${qRes.reason?.message || ''}`.trim(),
    });
  }

  const num = (v, d = 2) => (v == null || isNaN(v) ? 'not available' : Number(v).toFixed(d));
  const newsBlock = news.length
    ? news.slice(0, 8).map(n =>
        `- [${n.datetime ? new Date(n.datetime).toISOString().slice(0, 10) : 'undated'}] ${n.headline} (${n.source})`
      ).join('\n')
    : '(No news returned by the provider for this instrument in the last 7 days.)';

  const userPrompt = `INSTRUMENT: ${asset.name} (${asset.symbol}) — ${asset.class}
What fundamentally drives it: ${asset.drivers}

LIVE PRICE (fetched seconds ago from ${quoteSource}):
- Price: ${num(quote.price, asset.class === 'forex' ? 4 : 2)}
- Change: ${num(quote.change, asset.class === 'forex' ? 4 : 2)} (${num(quote.changePct)}%)
${quote.high != null ? `- Session high ${num(quote.high)} / low ${num(quote.low)}` : ''}
${quote.marketCap != null ? `- Market cap ${num(quote.marketCap, 0)} USD, 24h volume ${num(quote.volume24h, 0)} USD` : ''}

REAL NEWS, LAST 7 DAYS:
${newsBlock}

${buildProfileBlock(profile)}

Produce the analysis as specified JSON.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 1600,
        system: ADVISOR_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('[invest/advise] Anthropic', r.status, t.slice(0, 300));
      return res.status(200).json({ ok: false, error: `Analysis API error (${r.status}).` });
    }

    const data = await r.json();
    const text = data.content?.[0]?.text || '';
    let parsed = null;
    try {
      parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    } catch { /* fall through */ }

    if (!parsed || !parsed.call) {
      return res.status(200).json({ ok: false, error: 'Analysis could not be parsed.', raw: text.slice(0, 600) });
    }

    res.status(200).json({
      ok: true,
      symbol: asset.symbol,
      name: asset.name,
      assetClass: asset.class,
      quote,
      newsCount: news.length,
      // the exact headlines the model was shown, so the UI can display its evidence
      news: news.slice(0, 3).map(n => ({
        headline: n.headline, source: n.source, url: n.url, datetime: n.datetime,
      })),
      analysis: parsed,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[invest/advise]', e.message);
    res.status(200).json({ ok: false, error: e.message });
  }
}


// ═══════════════════════════════════════════════════════════
// CANDLES + INDICATORS — real OHLCV, computed server-side
// ═══════════════════════════════════════════════════════════
//
// Yahoo's chart endpoint returns full OHLCV arrays for equities, indices,
// FX, futures and crypto, so every instrument in the universe can be
// screened and backtested from the same real source. Nothing is modelled
// or synthesised — if the history is unavailable the row says so.

// Whitelisted history windows — `range` reaches the Yahoo query string
const RANGES = new Set(['6mo', '1y', '2y', '5y', '10y', 'max']);

function candleSymbol(asset) {
  if (asset.yahoo) return asset.yahoo;
  if (asset.class === 'crypto') return `${asset.symbol}-USD`;
  return asset.symbol;
}

async function fetchCandles(asset, range = '1y', interval = '1d', timeoutMs = 9000) {
  const sym = candleSymbol(asset);
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const r = await timedFetch(
        `https://${host}/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${encodeURIComponent(range)}`,
        timeoutMs, { 'User-Agent': UA }
      );
      if (!r.ok) continue;
      const res = (await r.json())?.chart?.result?.[0];
      const q = res?.indicators?.quote?.[0];
      if (!res || !q) continue;

      // Drop bars with holes so indicators never straddle a gap
      const out = { t: [], o: [], h: [], l: [], c: [], v: [] };
      for (let i = 0; i < res.timestamp.length; i++) {
        if (q.close?.[i] == null || q.open?.[i] == null) continue;
        out.t.push(res.timestamp[i] * 1000);
        out.o.push(q.open[i]); out.h.push(q.high[i]);
        out.l.push(q.low[i]);  out.c.push(q.close[i]);
        out.v.push(q.volume?.[i] ?? 0);
      }
      if (out.c.length < 30) continue;
      return out;
    } catch { /* try next host */ }
  }
  throw new Error('No price history available');
}

// Wilder's RSI
function rsiSeries(c, period = 14) {
  const out = new Array(c.length).fill(null);
  if (c.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = c[i] - c[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= period; loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    gain = (gain * (period - 1) + (d > 0 ? d : 0)) / period;
    loss = (loss * (period - 1) + (d < 0 ? -d : 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

function smaAt(arr, n, i) {
  if (i + 1 < n) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += arr[k];
  return s / n;
}

function maxDrawdown(equity) {
  let peak = equity[0] ?? 1, mdd = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    const dd = peak ? (peak - v) / peak : 0;
    if (dd > mdd) mdd = dd;
  }
  return mdd * 100;
}

// Snapshot of the indicators the screener filters on
function indicatorSnapshot(k) {
  const n = k.c.length - 1;
  const rsi = rsiSeries(k.c);
  const volAvg20 = smaAt(k.v, 20, n);
  const hi52 = Math.max(...k.h.slice(-252));
  const lo52 = Math.min(...k.l.slice(-252));
  const sma50 = smaAt(k.c, 50, n);
  const sma200 = smaAt(k.c, 200, n);
  const price = k.c[n];

  return {
    price,
    rsi14: rsi[n] != null ? +rsi[n].toFixed(1) : null,
    volume: k.v[n],
    volSurgePct: volAvg20 ? +(((k.v[n] - volAvg20) / volAvg20) * 100).toFixed(0) : null,
    sma50: sma50 != null ? +sma50.toFixed(2) : null,
    sma200: sma200 != null ? +sma200.toFixed(2) : null,
    aboveSma50: sma50 != null ? price > sma50 : null,
    aboveSma200: sma200 != null ? price > sma200 : null,
    pctFrom52wHigh: +(((price - hi52) / hi52) * 100).toFixed(1),
    pctFrom52wLow: +(((price - lo52) / lo52) * 100).toFixed(1),
    chg5dPct: k.c.length > 5 ? +(((price - k.c[n - 5]) / k.c[n - 5]) * 100).toFixed(2) : null,
    bars: k.c.length,
    asOf: k.t[n],
  };
}

// ── Screener ──
// Kept in step with SCAN_CAP in js/invest.js so the button never promises
// more instruments than the endpoint will actually look at.
const SCAN_CAP = 60;
const SCAN_BUDGET_MS = 40000;   // inside the 60s maxDuration below

function passesFilters(ind, f) {
  if (f.rsiBelow != null && !(ind.rsi14 != null && ind.rsi14 < f.rsiBelow)) return false;
  if (f.rsiAbove != null && !(ind.rsi14 != null && ind.rsi14 > f.rsiAbove)) return false;
  if (f.volSurgeAbove != null && !(ind.volSurgePct != null && ind.volSurgePct > f.volSurgeAbove)) return false;
  if (f.aboveSma50 === true && ind.aboveSma50 !== true) return false;
  if (f.aboveSma50 === false && ind.aboveSma50 !== false) return false;
  if (f.aboveSma200 === true && ind.aboveSma200 !== true) return false;
  if (f.nearHighWithin != null && !(ind.pctFrom52wHigh > -Math.abs(f.nearHighWithin))) return false;
  if (f.downFromHighAtLeast != null && !(ind.pctFrom52wHigh < -Math.abs(f.downFromHighAtLeast))) return false;
  return true;
}

async function handleScan(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  if (!checkRateLimit(limitKey(req, 'scan'), 10)) {
    return res.status(429).json({ ok: false, error: 'Too many scans in the last minute. Wait a moment.' });
  }

  const { symbols, filters = {} } = req.body || {};
  if (!Array.isArray(symbols) || !symbols.length) {
    return res.status(400).json({ ok: false, error: 'Provide a symbols array to scan.' });
  }

  // Hard cap: each symbol is one upstream request
  const assets = symbols.slice(0, SCAN_CAP).map(resolveAsset).filter(Boolean);
  const matches = [], failed = [];

  // A serverless function is killed at its wall-clock limit, and a killed
  // scan returns nothing at all — the user sees a 504 and loses the work
  // already done. So stop starting batches once the budget is nearly spent
  // and return what completed, naming what was skipped. A short scan that
  // says what it missed beats a long one that dies silently.
  const deadline = Date.now() + SCAN_BUDGET_MS;
  let cursor = 0;

  for (; cursor < assets.length; cursor += 8) {
    if (Date.now() > deadline) break;
    const batch = assets.slice(cursor, cursor + 8);
    const settled = await Promise.allSettled(batch.map(async a => {
      const k = await fetchCandles(a, '1y', '1d', 6000);
      return { asset: a, ind: indicatorSnapshot(k) };
    }));
    settled.forEach((r, idx) => {
      if (r.status !== 'fulfilled') { failed.push(batch[idx].symbol); return; }
      if (passesFilters(r.value.ind, filters)) {
        matches.push({
          symbol: r.value.asset.symbol,
          name: r.value.asset.name,
          assetClass: r.value.asset.class,
          ...r.value.ind,
        });
      }
    });
  }

  const skipped = assets.slice(Math.min(cursor, assets.length)).map(a => a.symbol);

  res.status(200).json({
    ok: true,
    requested: symbols.length,
    scanned: assets.length - skipped.length,
    matched: matches.length,
    failed,
    skipped,
    filters,
    results: matches,
    source: 'Yahoo Finance daily OHLCV, indicators computed server-side',
  });
}

// ── Backtest ──
// Long-only, one position at a time. A signal computed on bar i is executed
// at the OPEN of bar i+1, so the test never trades on information it could
// not have had. Fees are charged on both sides.
const STRATEGIES = {
  rsi_reversion: {
    label: 'RSI mean reversion',
    describe: p => `Buy when RSI(14) closes below ${p.oversold}; sell when it closes above ${p.overbought}.`,
    defaults: { oversold: 30, overbought: 70 },
    signals(k, p) {
      const rsi = rsiSeries(k.c);
      return k.c.map((_, i) => {
        if (rsi[i] == null) return 0;
        if (rsi[i] < p.oversold) return 1;
        if (rsi[i] > p.overbought) return -1;
        return 0;
      });
    },
  },
  sma_cross: {
    label: 'Moving-average crossover',
    describe: p => `Buy when the ${p.fast}-day SMA crosses above the ${p.slow}-day; sell on the cross back below.`,
    defaults: { fast: 50, slow: 200 },
    signals(k, p) {
      return k.c.map((_, i) => {
        const f = smaAt(k.c, p.fast, i), s = smaAt(k.c, p.slow, i);
        const pf = smaAt(k.c, p.fast, i - 1), ps = smaAt(k.c, p.slow, i - 1);
        if (f == null || s == null || pf == null || ps == null) return 0;
        if (pf <= ps && f > s) return 1;
        if (pf >= ps && f < s) return -1;
        return 0;
      });
    },
  },
  breakout: {
    label: 'Donchian breakout',
    describe: p => `Buy a close above the ${p.entry}-day high; exit on a close below the ${p.exit}-day low.`,
    defaults: { entry: 20, exit: 10 },
    signals(k, p) {
      return k.c.map((_, i) => {
        if (i < Math.max(p.entry, p.exit)) return 0;
        const hi = Math.max(...k.h.slice(i - p.entry, i));
        const lo = Math.min(...k.l.slice(i - p.exit, i));
        if (k.c[i] > hi) return 1;
        if (k.c[i] < lo) return -1;
        return 0;
      });
    },
  },
};

async function handleBacktest(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  if (!checkRateLimit(limitKey(req, 'backtest'), 20)) {
    return res.status(429).json({ ok: false, error: 'Too many backtests in the last minute. Wait a moment.' });
  }

  const { symbol, strategy = 'rsi_reversion', params = {}, range: rawRange = '2y', feePct: rawFee = 0.1 } = req.body || {};
  const asset = resolveAsset(symbol);
  if (!asset) return res.status(400).json({ ok: false, error: `Unknown symbol: ${symbol}` });

  const strat = STRATEGIES[strategy];
  if (!strat) return res.status(400).json({ ok: false, error: `Unknown strategy: ${strategy}` });

  // Every knob is caller-supplied, so none of it is trusted.
  //
  // `range` used to be interpolated straight into the Yahoo query string —
  // a whitelist keeps it from carrying extra parameters. And a non-numeric
  // feePct made Math.max(0, NaN) return NaN, which then propagated through
  // every price into stats that serialise as null: a result that looks like
  // an answer but is arithmetic on NaN. Bad input must be refused, not
  // quietly turned into a blank report.
  const range = RANGES.has(rawRange) ? rawRange : '2y';
  const feeNum = Number(rawFee);
  if (!Number.isFinite(feeNum) || feeNum < 0 || feeNum > 5) {
    return res.status(400).json({ ok: false, error: 'feePct must be a number between 0 and 5.' });
  }
  const feePct = feeNum;

  const p = { ...strat.defaults };
  for (const [k, v] of Object.entries(params || {})) {
    if (!(k in strat.defaults)) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) {
      return res.status(400).json({ ok: false, error: `Parameter "${k}" must be a number.` });
    }
    p[k] = Math.min(400, Math.max(1, n));
  }

  let k;
  try {
    k = await fetchCandles(asset, range, '1d');
  } catch (e) {
    return res.status(200).json({ ok: false, error: `No price history for ${asset.symbol}: ${e.message}` });
  }

  const sig = strat.signals(k, p);
  const fee = Math.max(0, Number(feePct)) / 100;

  const trades = [];
  let inPos = false, entryPx = 0, entryAt = 0;
  let equity = 1;
  const curve = [];

  for (let i = 0; i < k.c.length - 1; i++) {
    // Mark to market on the close of each bar. `b` is buy-and-hold on the
    // same axis, so the chart shows whether the strategy actually earned
    // its trading — the comparison the demos always leave out.
    curve.push({
      t: k.t[i],
      v: inPos ? equity * (k.c[i] / entryPx) : equity,
      b: k.c[i] / k.c[0],
    });

    const execPx = k.o[i + 1];            // executed on the NEXT bar's open
    if (!inPos && sig[i] === 1) {
      inPos = true; entryPx = execPx * (1 + fee); entryAt = k.t[i + 1];
    } else if (inPos && sig[i] === -1) {
      const exitPx = execPx * (1 - fee);
      const ret = (exitPx - entryPx) / entryPx;
      equity *= (1 + ret);
      trades.push({
        entryAt, exitAt: k.t[i + 1],
        entryPx: +entryPx.toFixed(4), exitPx: +exitPx.toFixed(4),
        returnPct: +(ret * 100).toFixed(2),
        bars: Math.round((k.t[i + 1] - entryAt) / 86400000),
      });
      inPos = false;
    }
  }

  // Close any open position at the last available price
  if (inPos) {
    const exitPx = k.c[k.c.length - 1] * (1 - fee);
    const ret = (exitPx - entryPx) / entryPx;
    equity *= (1 + ret);
    trades.push({
      entryAt, exitAt: k.t[k.t.length - 1],
      entryPx: +entryPx.toFixed(4), exitPx: +exitPx.toFixed(4),
      returnPct: +(ret * 100).toFixed(2),
      bars: Math.round((k.t[k.t.length - 1] - entryAt) / 86400000),
      openAtEnd: true,
    });
  }

  const wins = trades.filter(t => t.returnPct > 0);
  const losses = trades.filter(t => t.returnPct <= 0);
  const grossWin = wins.reduce((s, t) => s + t.returnPct, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.returnPct, 0));
  const buyHold = ((k.c[k.c.length - 1] - k.c[0]) / k.c[0]) * 100;
  const stratRet = (equity - 1) * 100;

  res.status(200).json({
    ok: true,
    symbol: asset.symbol,
    name: asset.name,
    strategy: { key: strategy, label: strat.label, description: strat.describe(p), params: p },
    period: {
      from: k.t[0], to: k.t[k.t.length - 1],
      bars: k.c.length, range,
    },
    stats: {
      trades: trades.length,
      winRatePct: trades.length ? +((wins.length / trades.length) * 100).toFixed(1) : 0,
      strategyReturnPct: +stratRet.toFixed(2),
      buyHoldReturnPct: +buyHold.toFixed(2),
      edgeVsBuyHoldPct: +(stratRet - buyHold).toFixed(2),
      avgWinPct: wins.length ? +(grossWin / wins.length).toFixed(2) : 0,
      avgLossPct: losses.length ? +(-grossLoss / losses.length).toFixed(2) : 0,
      profitFactor: grossLoss ? +(grossWin / grossLoss).toFixed(2) : null,
      maxDrawdownPct: +maxDrawdown(curve.map(x => x.v)).toFixed(2),
      feePctPerSide: feePct,
    },
    trades: trades.slice(-30),
    curve: curve.filter((_, i) => i % Math.max(1, Math.floor(curve.length / 120)) === 0),
    method: 'Signals are evaluated on each daily close and executed at the next bar\'s open, so the test never trades on information it could not have had. Fees are charged on entry and exit. Long-only, one position at a time. This is a historical simulation, not a prediction.',
    source: 'Yahoo Finance daily OHLCV',
  });
}

// ── Router ──
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.pathname.split('/').filter(Boolean)[2] || '';
  const finnhubKey = process.env.FINNHUB_API_KEY;

  if (action === 'advise')   return handleAdvise(req, res);
  if (action === 'scan')     return handleScan(req, res);
  if (action === 'backtest') return handleBacktest(req, res);

  const symbol = url.searchParams.get('symbol');
  const asset = resolveAsset(symbol);
  if (!asset) return res.status(400).json({ ok: false, error: `Unknown symbol: ${symbol}` });

  if (!checkRateLimit(limitKey(req, action), 90)) return res.status(429).json({ ok: false, error: 'Rate limit exceeded' });

  try {
    if (action === 'quote') {
      res.setHeader('Cache-Control', 's-maxage=30');
      const { quote, source } = await getQuote(asset, finnhubKey);
      return res.status(200).json({ ok: true, symbol: asset.symbol, assetClass: asset.class, kind: asset.kind || 'price', source, quote });
    }

    if (action === 'news') {
      res.setHeader('Cache-Control', 's-maxage=600');
      const { items, error } = await getNews(asset, finnhubKey);
      return res.status(200).json({ ok: !error, symbol: asset.symbol, count: items.length, items, error });
    }

    return res.status(404).json({ ok: false, error: `Unknown action: ${action}` });
  } catch (e) {
    return res.status(200).json({ ok: false, symbol: asset.symbol, error: e.message });
  }
}

// A screener pass makes up to SCAN_CAP upstream history requests, which does
// not fit the default 10s. Hobby allows 60.
export const config = { maxDuration: 60 };
