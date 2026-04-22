// ═══════════════════════════════════════════════════════════
// SERVER — Express proxy for Anthropic API
// ═══════════════════════════════════════════════════════════
//
// Proxies requests from the frontend to the Anthropic API,
// keeping the API key server-side. Also serves static files
// for local development.
//
// Usage:
//   ANTHROPIC_API_KEY=sk-... node server.js
//
// Endpoints:
//   POST /api/intel  — Generate intelligence briefs via Claude
//   GET  /api/data   — Serve dashboard data (Neon DB or fallback)
//   GET  /*          — Static file serving
// ═══════════════════════════════════════════════════════════

import express from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ── CORS headers for API routes ──
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── POST /api/intel — Anthropic Claude proxy ──
app.post('/api/intel', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { country, score, region } = req.body;
  if (!country) {
    return res.status(400).json({ error: 'Missing country parameter' });
  }

  try {
    const prompt = `You are a geopolitical intelligence analyst. Provide a brief (3-4 sentences) intelligence assessment for ${country}. CII Score: ${score || 'N/A'}/10, Region: ${region || 'Unknown'}. Cover: current stability, key risks, and real estate investment implications. Be specific and data-driven.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[server] Anthropic API error:', err);
      return res.status(response.status).json({ error: 'Anthropic API error' });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || 'Intelligence brief unavailable.';
    res.json({ intel: text });
  } catch (e) {
    console.error('[server] Intel endpoint error:', e.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/data — Dashboard data endpoint ──
app.get('/api/data', (req, res) => {
  res.status(404).json({ error: 'No database configured, using client-side data' });
});

// ── Finnhub stock proxy helper ──
function finnhubProxy(endpoint) {
  return async (req, res) => {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) return res.status(200).json({ error: 'FINNHUB_API_KEY not configured', setup: true });
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'Missing symbol' });
    try {
      const url = `https://finnhub.io/api/v1/${endpoint}?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
      const r = await fetch(url.includes('metric') ? url + '&metric=all' : url);
      if (!r.ok) throw new Error(`Finnhub ${r.status}`);
      res.json(await r.json());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  };
}

app.get('/api/stocks/quote', finnhubProxy('quote'));
app.get('/api/stocks/metric', finnhubProxy('stock/metric'));
app.get('/api/stocks/earnings', finnhubProxy('stock/earnings'));
app.get('/api/stocks/recommendation', finnhubProxy('stock/recommendation'));
app.get('/api/stocks/price-target', finnhubProxy('stock/price-target'));

// ── POST /api/stocks/ai-brief — AI stock analysis via Claude ──
app.post('/api/stocks/ai-brief', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { ticker, name, price, change, eps, fwdEps, pe, fwdPe, nextEarnings, expEps, rating, target, surprises } = req.body;
  try {
    const prompt = `Given this data for ${ticker} (${name}):
- Current price: $${price}, day change ${change}%
- EPS TTM: ${eps || 'N/A'}, Forward EPS: ${fwdEps || 'N/A'}
- P/E: ${pe || 'N/A'}, Forward P/E: ${fwdPe || 'N/A'}
- Next earnings: ${nextEarnings || 'N/A'}, expected EPS ${expEps || 'N/A'}
- Analyst consensus: ${rating || 'N/A'}, avg price target $${target || 'N/A'}
- Last 4 quarter EPS surprises: ${surprises || 'N/A'}

Write a 3-sentence analytical intelligence brief: (1) current setup, (2) key risk into earnings, (3) one catalyst to watch. No hedging, no disclaimers. Analytical only.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 200, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await response.json();
    res.json({ brief: data.content?.[0]?.text || 'Analysis unavailable.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Static file serving ──
app.use(express.static(__dirname));

// ── SPA fallback — serve index.html for all non-API routes ──
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Felicity] Server running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[Felicity] Note: ANTHROPIC_API_KEY not set — /api/intel will return errors');
  }
});
