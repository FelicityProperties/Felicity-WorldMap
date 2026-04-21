// Vercel Serverless Function — AI stock analysis via Claude

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ brief: 'AI analysis requires ANTHROPIC_API_KEY. Set it in Vercel environment variables.' });
  }

  const body = req.body || {};
  const { ticker, name, price, change, eps, fwdEps, pe, fwdPe, nextEarnings, expEps, rating, target, surprises } = body;

  if (!ticker) {
    return res.status(400).json({ brief: 'Missing ticker symbol.' });
  }

  try {
    const prompt = `Given this data for ${ticker} (${name || 'Unknown'}):
- Current price: $${price || 'N/A'}, day change ${change || 'N/A'}%
- EPS TTM: ${eps || 'N/A'}, Forward EPS: ${fwdEps || 'N/A'}
- P/E: ${pe || 'N/A'}, Forward P/E: ${fwdPe || 'N/A'}
- Next earnings: ${nextEarnings || 'N/A'}, expected EPS ${expEps || 'N/A'}
- Analyst consensus: ${rating || 'N/A'}, avg price target $${target || 'N/A'}
- Last 4 quarter EPS surprises: ${surprises || 'N/A'}

Write a 3-sentence analytical intelligence brief: (1) current setup, (2) key risk into earnings, (3) one catalyst to watch. No hedging, no disclaimers. Analytical only.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 250,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[ai-brief] Anthropic error:', response.status, errText);
      return res.status(200).json({ brief: `API error (${response.status}). Check ANTHROPIC_API_KEY is valid.` });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text;

    if (!text) {
      console.error('[ai-brief] No content in response:', JSON.stringify(data));
      return res.status(200).json({ brief: 'No analysis generated. The API returned an empty response.' });
    }

    res.json({ brief: text });
  } catch (e) {
    console.error('[ai-brief] Error:', e.message);
    res.status(200).json({ brief: `Error: ${e.message}` });
  }
}
