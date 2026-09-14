// Vercel Serverless Function — AI country intelligence brief via Claude
//
// No country data feed exists here — no GDP, inflation, ratings or flows
// are fetched — so the prompt must not demand "exact figures"; that only
// produces confident numbers from memory. The country read is a labelled
// desk assessment. The Dubai side, by contrast, is real: the PIX evidence
// blocks are injected so any area figure comes from the register.

import { buildDeskContext } from '../js/pix-data.js';
import { buildSignalContext } from '../js/pix-signals.js';

// ── Rate Limiting (in-memory, resets on cold start) ──
const rateLimit = {};
const RATE_LIMIT = 20; // requests per minute per IP
const RATE_WINDOW = 60000; // 1 minute

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Max 20 requests per minute.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ intel: 'AI intelligence requires ANTHROPIC_API_KEY. Set it in Vercel environment variables.' });
  }

  const body = req.body || {};
  if (!body.country) return res.status(400).json({ intel: 'Missing country parameter.' });
  // Client-supplied, and now interpolated into the system prompt — bound it.
  const country = String(body.country).replace(/[\r\n]/g, ' ').slice(0, 80);
  const score = body.score, region = body.region;

  const systemPrompt = `You are the senior geopolitical analyst at Felicity Intelligence. Your clients are Dubai real estate investors with AED 5M-500M portfolios tracking how global events impact Dubai property markets.

Rules:
- Name specific Dubai areas and developers when relevant to capital flow implications, and quote Dubai figures ONLY from the registry evidence below. An area with no evidence gets no number.
- Embrace second-order effects. The obvious impact is already priced.
- No disclaimers, no 'investors should consider', no 'it depends'.
- Think in probabilities when assessing risk scenarios.
- Tone: Crisp, analytical, institutional-grade. No preamble.

WHAT YOU DO AND DO NOT HAVE:
- You have NO live data feed for ${country}: no GDP, inflation, ratings, FDI, trade or population figures were supplied. Do not state any such statistic as a current fact — describe the situation and its direction in words, and mark the country read as the desk's assessment.
- Analogs are welcome in words, never with an invented percentage, dollar amount or date attached.
- The only numbers you may write are the Dubai registry figures in the evidence below. Cite them exactly.
- Every other sentence carries a mechanism, not a made-up number.

${buildDeskContext()}

${buildSignalContext()}`;

  try {
    const prompt = `Geopolitical intelligence brief on ${country} (CII Score: ${score || 'N/A'}/10, Region: ${region || 'Unknown'}):
1. Current security situation with quantified risk assessment
2. Key risk with probability-weighted scenarios
3. Dubai RE capital flow implication — which areas benefit or suffer and why
4. One leading indicator to watch

Be specific and directional. No hedging.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[intel] Anthropic error:', response.status, errText);
      return res.status(200).json({ intel: `API error (${response.status}). Check that your ANTHROPIC_API_KEY is valid.` });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;

    if (!text) {
      return res.status(200).json({ intel: 'No intelligence generated.' });
    }

    res.json({ intel: text });
  } catch (e) {
    console.error('[intel] Error:', e.message);
    res.status(200).json({ intel: `Error generating brief: ${e.message}` });
  }
}
