// Vercel Serverless Function — AI country intelligence brief via Claude

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ intel: 'AI intelligence requires ANTHROPIC_API_KEY. Set it in Vercel environment variables.' });
  }

  const { country, score, region } = req.body || {};
  if (!country) return res.status(400).json({ intel: 'Missing country parameter.' });

  const systemPrompt = `You are the senior geopolitical analyst at Felicity Intelligence. Your clients are Dubai real estate investors with AED 5M-500M portfolios tracking how global events impact Dubai property markets.

Rules:
- Quantify everything: % moves, capital flows in AED/USD billions, basis points.
- Name specific Dubai areas and developers when relevant to capital flow implications.
- Every thesis cites a historical analog: 'Last time X happened, Y moved Z%'.
- Embrace second-order effects. The obvious impact is already priced.
- No disclaimers, no 'investors should consider', no 'it depends'.
- Think in probabilities when assessing risk scenarios.
- Tone: Crisp, analytical, institutional-grade. No preamble.`;

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
