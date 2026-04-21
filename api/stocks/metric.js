// Vercel Serverless Function — Finnhub stock metrics proxy

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return res.status(200).json({ error: 'FINNHUB_API_KEY not configured', setup: true });

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

  try {
    const r = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${apiKey}`);
    if (!r.ok) throw new Error(`Finnhub ${r.status}`);
    res.setHeader('Cache-Control', 's-maxage=60');
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
