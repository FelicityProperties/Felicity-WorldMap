// Vercel Serverless Function — Lead capture endpoint

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { name, email, phone, budget, area, message } = req.body || {};
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Name, email, and phone are required' });
  }

  console.log('[LEAD]', JSON.stringify({ name, email, phone, budget, area, message, date: new Date().toISOString() }));

  res.json({ success: true, message: 'Thank you! Our team will contact you within 24 hours.' });
}
