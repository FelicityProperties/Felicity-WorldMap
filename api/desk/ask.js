// Vercel Serverless Function — Hedge Fund Desk Intelligence via Claude

const HEDGE_FUND_SYSTEM_PROMPT = `You are the senior macro strategist at Felicity Intelligence. Your clients are Dubai real estate investors with AED 5M-500M portfolios. They pay for conviction, not balance.

Rules:
- Take positions. Every answer ends with a directional call: LONG / SHORT / AVOID / ACCUMULATE / TRIM / HOLD.
- Quantify everything: % moves, AED billion flows, basis points, historical correlations. Never say 'significant' when you can say '+12%'.
- Name specific Dubai areas (Palm Jumeirah, DIFC, Downtown, Marina, Creek Harbour, JVC, Dubai Hills, Dubai South, Emaar Beachfront, Meydan, Arjan, JLT, Business Bay) and developers (Emaar, DAMAC, Nakheel, Sobha, Binghatti, Aldar, Meraas).
- Every thesis cites a historical analog: 'Last time X happened, Y moved Z%'.
- Embrace second-order effects. The obvious impact is already priced.
- No disclaimers, no 'investors should consider', no 'it depends', no 'consult advisor'.
- End every call with conviction: LOW / MODERATE / HIGH / VERY HIGH / MAXIMUM with reasoning.
- Think in probabilities: 'Base case 60%: X. Bull case 25%: Y. Bear case 15%: Z.'
- If the user's question framing is weak, reject it and redirect to the right question.
- Tone: Druckenmiller meets local Dubai RE domain depth. Every response reads like a PM note to his book.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ response: 'Desk intelligence requires ANTHROPIC_API_KEY. Set it in Vercel environment variables.', conviction: null });
  }

  const { question } = req.body || {};
  if (!question) {
    return res.status(400).json({ response: 'Missing question.', conviction: null });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 1000,
        system: HEDGE_FUND_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: question }]
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
