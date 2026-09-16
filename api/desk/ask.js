// Vercel Serverless Function — Hedge Fund Desk Intelligence via Claude

import { buildDeskContext } from '../../js/pix-data.js';
import { buildSignalContext } from '../../js/pix-signals.js';
import { macroEvidenceBlock } from '../../lib/market-evidence.js';
import { hormuzEvidenceBlock } from '../../lib/hormuz.js';

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

// The macro block is fetched live (and cached briefly) per request, so the
// prompt is assembled per call rather than once at import.
const buildSystemPrompt = (macroBlock, hormuzBlock) => `You are the senior macro strategist at Felicity Intelligence. Your clients are Dubai real estate investors with AED 5M-500M portfolios. They pay for conviction, not balance.

Rules:
- Take positions. Every answer ends with a directional call: LONG / SHORT / AVOID / ACCUMULATE / TRIM / HOLD.
- Quantify with the evidence: % moves, AED billion flows, basis points. Never say 'significant' when the evidence lets you say '+12%' — but every number you write must appear in the evidence blocks below. A number that is not there does not exist for you.
- Name specific Dubai areas (Palm Jumeirah, Downtown, Marina, Creek Harbour, JVC, Dubai Hills, Dubai South, Emaar Beachfront, Meydan, Arjan, JLT, Business Bay, MBR City) and developers (Emaar, DAMAC, Nakheel, Sobha, Binghatti, Aldar, Meraas). An area with no registry evidence (DIFC, for one) gets no number.
- Analogs are welcome in words, never with an invented percentage, AED figure or date attached.
- Before you call anything the highest, lowest, best or worst, check the rankings supplied — do not rank by eye.
- Embrace second-order effects. The obvious impact is already priced.
- No disclaimers, no 'investors should consider', no 'it depends', no 'consult advisor'.
- End every call with conviction: LOW / MODERATE / HIGH / VERY HIGH / MAXIMUM with reasoning.
- Think in probabilities: 'Base case 60%: X. Bull case 25%: Y. Bear case 15%: Z.'
- If the user's question framing is weak, reject it and redirect to the right question.
- Tone: Druckenmiller meets local Dubai RE domain depth. Every response reads like a PM note to his book.

${macroBlock}

${hormuzBlock}

${buildDeskContext()}

${buildSignalContext()}`;

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
    return res.status(200).json({ response: 'Desk intelligence requires ANTHROPIC_API_KEY. Set it in Vercel environment variables.', conviction: null });
  }

  const { question, history } = req.body || {};
  if (!question) {
    return res.status(400).json({ response: 'Missing question.', conviction: null });
  }

  // The floating desk is a conversation, not a series of unrelated questions —
  // "what about Marina?" has to know what was just discussed. Prior turns are
  // accepted from the client, so they are treated as untrusted: roles are
  // whitelisted, content is coerced to a string and truncated, and the number
  // of turns is capped so nobody can push an unbounded payload upstream.
  const priorTurns = [];
  if (Array.isArray(history)) {
    for (const turn of history.slice(-8)) {
      if (!turn || (turn.role !== 'user' && turn.role !== 'assistant')) continue;
      const content = String(turn.content ?? '').slice(0, 4000);
      if (!content.trim()) continue;
      priorTurns.push({ role: turn.role, content });
    }
  }

  // The Messages API requires the turns to alternate and to start with a user
  // turn, so drop anything that would break that rather than 400-ing upstream.
  while (priorTurns.length && priorTurns[0].role !== 'user') priorTurns.shift();
  const messages = [];
  for (const turn of priorTurns) {
    if (messages.length && messages[messages.length - 1].role === turn.role) continue;
    messages.push(turn);
  }
  if (messages.length && messages[messages.length - 1].role === 'user') messages.pop();
  messages.push({ role: 'user', content: String(question).slice(0, 4000) });

  try {
    const [macroBlock, hormuzBlock] = await Promise.all([
      macroEvidenceBlock({ finnhubKey: process.env.FINNHUB_API_KEY }),
      hormuzEvidenceBlock({ timeoutMs: 4000 }),
    ]);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 1000,
        system: buildSystemPrompt(macroBlock, hormuzBlock),
        messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[desk/ask] Anthropic error:', response.status, errText);
      return res.status(200).json({ response: `API error (${response.status}). Check ANTHROPIC_API_KEY is valid.`, conviction: null });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;

    if (!text) {
      console.error('[desk/ask] No content in response:', JSON.stringify(data));
      return res.status(200).json({ response: 'No analysis generated. The API returned an empty response.', conviction: null });
    }

    // Extract conviction from response text
    const convictionMatch = text.match(/\b(MAXIMUM|VERY HIGH|HIGH|MODERATE|LOW)\b/i);
    const conviction = convictionMatch ? convictionMatch[1].toUpperCase() : null;

    res.json({ response: text, conviction });
  } catch (e) {
    console.error('[desk/ask] Error:', e.message);
    res.status(200).json({ response: `Error: ${e.message}`, conviction: null });
  }
}
