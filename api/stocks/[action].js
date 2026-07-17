// Vercel Serverless Function — Unified stocks API router
// Handles: quote, metric, earnings, recommendation, price-target, calendar, ai-brief

// ── Rate Limiting ──
const rateLimit = {};
const RATE_LIMIT = 30;
const RATE_WINDOW = 60000;

function checkRateLimit(ip) {
  const now = Date.now();
  if (!rateLimit[ip]) rateLimit[ip] = [];
  rateLimit[ip] = rateLimit[ip].filter(t => now - t < RATE_WINDOW);
  if (rateLimit[ip].length >= RATE_LIMIT) return false;
  rateLimit[ip].push(now);
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Extract the action from the URL: /api/stocks/[action]
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'stocks', 'action']
  const action = parts[2] || '';

  // AI brief is POST, everything else is GET
  if (action === 'ai-brief') return handleAiBrief(req, res);

  // All Finnhub endpoints are GET
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only for this endpoint' });

  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (!finnhubKey) return res.json({ error: 'FINNHUB_API_KEY not configured', setup: true });

  const symbol = url.searchParams.get('symbol') || req.query?.symbol;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

  const ip = req.headers['x-forwarded-for'] || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const endpoints = {
    'quote': `https://finnhub.io/api/v1/quote?symbol=${enc(symbol)}&token=${finnhubKey}`,
    'metric': `https://finnhub.io/api/v1/stock/metric?symbol=${enc(symbol)}&metric=all&token=${finnhubKey}`,
    'earnings': `https://finnhub.io/api/v1/stock/earnings?symbol=${enc(symbol)}&token=${finnhubKey}`,
    'recommendation': `https://finnhub.io/api/v1/stock/recommendation?symbol=${enc(symbol)}&token=${finnhubKey}`,
    'price-target': `https://finnhub.io/api/v1/stock/price-target?symbol=${enc(symbol)}&token=${finnhubKey}`,
    'calendar': buildCalendarUrl(symbol, finnhubKey),
  };

  const endpoint = endpoints[action];
  if (!endpoint) return res.status(404).json({ error: `Unknown action: ${action}` });

  try {
    const r = await fetch(endpoint);
    if (!r.ok) throw new Error(`Finnhub ${r.status}`);
    const cacheTtl = action === 'quote' ? 30 : 300;
    res.setHeader('Cache-Control', `s-maxage=${cacheTtl}`);
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function enc(s) { return encodeURIComponent(s); }

function buildCalendarUrl(symbol, key) {
  const today = new Date();
  const from = today.toISOString().split('T')[0];
  const future = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
  const to = future.toISOString().split('T')[0];
  return `https://finnhub.io/api/v1/calendar/earnings?symbol=${enc(symbol)}&from=${from}&to=${to}&token=${key}`;
}

async function handleAiBrief(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const ip = req.headers['x-forwarded-for'] || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.json({ brief: 'ANTHROPIC_API_KEY not configured.' });

  const body = req.body || {};
  const { ticker, name, price, change, eps, fwdEps, pe, fwdPe, nextEarnings, expEps, rating, target, surprises } = body;
  if (!ticker) return res.status(400).json({ brief: 'Missing ticker.' });

  const systemPrompt = `You are the senior equity strategist at Felicity Intelligence. Your clients are sophisticated investors with multi-million dollar portfolios. They pay for conviction, not balance.

Rules:
- Take positions. Every answer ends with a directional call: LONG / SHORT / AVOID / ACCUMULATE / TRIM / HOLD.
- Quantify everything: % moves, basis points, historical correlations.
- Every thesis cites a historical analog.
- No disclaimers. End with conviction: LOW / MODERATE / HIGH / VERY HIGH / MAXIMUM.
- Think in probabilities.

CRITICAL: Every claim must be backed by a specific statistic or data point. No sentence without a number.`;

  try {
    const prompt = `LIVE DATA for ${ticker} (${name || 'Unknown'}) — use these exact numbers:
- Price: $${price || 'N/A'}, change ${change || 'N/A'}%
- EPS TTM: ${eps || 'N/A'}, Fwd EPS: ${fwdEps || 'N/A'}
- P/E: ${pe || 'N/A'}, Fwd P/E: ${fwdPe || 'N/A'}
- Next earnings: ${nextEarnings || 'N/A'}, exp EPS ${expEps || 'N/A'}
- Consensus: ${rating || 'N/A'}, target $${target || 'N/A'}
- Last 4Q results: ${surprises || 'N/A'}

CRITICAL: Use the BEAT/MISS labels above exactly. Do NOT contradict them.

4-5 sentence hedge-fund brief: (1) setup, (2) key risk, (3) catalyst, (4) directional call + conviction. End with historical analog.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 800, system: systemPrompt, messages: [{ role: 'user', content: prompt }] })
    });

    if (!response.ok) return res.json({ brief: `API error (${response.status}).` });
    const data = await response.json();
    res.json({ brief: data.content?.[0]?.text || 'Analysis unavailable.' });
  } catch (e) {
    res.json({ brief: `Error: ${e.message}` });
  }
}
