// Vercel Serverless Function — AI stock analysis via Claude

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { ticker, name, price, change, eps, fwdEps, pe, fwdPe, nextEarnings, expEps, rating, target, surprises } = req.body || {};

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
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 200, messages: [{ role: 'user', content: prompt }] })
    });

    const data = await response.json();
    res.json({ brief: data.content?.[0]?.text || 'Analysis unavailable.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
