// Vercel Serverless Function — Investing Cockpit API
//
//   GET  /api/invest/quote?symbol=AAPL      live price for any asset class
//   GET  /api/invest/news?symbol=AAPL       daily news for that instrument
//   POST /api/invest/advise                 Felicity Bot investment analysis
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
const rateLimit = {};
function checkRateLimit(ip, max, windowMs = 60000) {
  const now = Date.now();
  rateLimit[ip] = (rateLimit[ip] || []).filter(t => now - t < windowMs);
  if (rateLimit[ip].length >= max) return false;
  rateLimit[ip].push(now);
  return true;
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
  const r = await timedFetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`);
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

async function getQuote(asset, finnhubKey) {
  if (asset.source === 'finnhub') {
    if (!finnhubKey) throw new Error('FINNHUB_API_KEY not configured');
    return quoteFinnhub(asset.symbol, finnhubKey);
  }
  if (asset.source === 'coingecko') return quoteCoinGecko(asset.cg);
  return quoteYahoo(asset.yahoo);
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
      const extra = { XAU: ['gold'], XAG: ['silver'], WTI: ['oil', 'crude'], BRENT: ['oil', 'crude'],
                      NG: ['natural gas'], HG: ['copper'], BTC: ['bitcoin'], ETH: ['ethereum'] }[asset.symbol] || [];
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

  const ip = req.headers['x-forwarded-for'] || 'unknown';
  if (!checkRateLimit(ip, 12)) return res.status(429).json({ error: 'Rate limit exceeded. Max 12 analyses per minute.' });

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

  const quote = qRes.status === 'fulfilled' ? qRes.value : null;
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

LIVE PRICE (fetched seconds ago from ${asset.source}):
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

// ── Router ──
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.pathname.split('/').filter(Boolean)[2] || '';
  const finnhubKey = process.env.FINNHUB_API_KEY;

  if (action === 'advise') return handleAdvise(req, res);

  const symbol = url.searchParams.get('symbol');
  const asset = resolveAsset(symbol);
  if (!asset) return res.status(400).json({ ok: false, error: `Unknown symbol: ${symbol}` });

  const ip = req.headers['x-forwarded-for'] || 'unknown';
  if (!checkRateLimit(ip, 90)) return res.status(429).json({ ok: false, error: 'Rate limit exceeded' });

  try {
    if (action === 'quote') {
      res.setHeader('Cache-Control', 's-maxage=30');
      const quote = await getQuote(asset, finnhubKey);
      return res.status(200).json({ ok: true, symbol: asset.symbol, assetClass: asset.class, source: asset.source, quote });
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
