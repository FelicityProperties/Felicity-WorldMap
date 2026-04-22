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

  try {
    const prompt = `3-sentence geopolitical intelligence brief on ${country} (CII Score: ${score || 'N/A'}/10, Region: ${region || 'Unknown'}): current security situation, key risk, one indicator to watch. Crisp and analytical, no preamble.`;

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
