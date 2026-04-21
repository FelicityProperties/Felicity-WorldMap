// Vercel Serverless Function — AI country intelligence brief via Claude

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { country, score, region } = req.body || {};
  if (!country) return res.status(400).json({ error: 'Missing country' });

  try {
    const prompt = `3-sentence geopolitical intelligence brief on ${country} (CII Score: ${score || 'N/A'}/10, Region: ${region || 'Unknown'}): current security situation, key risk, one indicator to watch. Crisp and analytical, no preamble.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 300, messages: [{ role: 'user', content: prompt }] })
    });

    const data = await response.json();
    res.json({ intel: data.content?.[0]?.text || 'Intelligence brief unavailable.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
