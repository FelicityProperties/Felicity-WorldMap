// Vercel Serverless Function — Finnhub earnings calendar proxy

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
    // Get upcoming earnings for this specific symbol using earnings calendar
    const today = new Date();
    const from = today.toISOString().split('T')[0];
    const future = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
    const to = future.toISOString().split('T')[0];

    const r = await fetch(`https://finnhub.io/api/v1/calendar/earnings?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${apiKey}`);
    if (!r.ok) throw new Error(`Finnhub ${r.status}`);
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=3600');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
