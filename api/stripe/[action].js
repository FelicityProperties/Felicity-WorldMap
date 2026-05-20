// Vercel Serverless Function — Unified Stripe router
// Handles: /api/stripe/checkout (POST) and /api/stripe/webhook (POST)

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.pathname.split('/').filter(Boolean)[2] || '';

  if (action === 'checkout') return handleCheckout(req, res);
  if (action === 'webhook') return handleWebhook(req, res);
  return res.status(404).json({ error: `Unknown stripe action: ${action}` });
}

async function handleCheckout(req, res) {
  // Read body manually since bodyParser is off
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.json({ error: 'Stripe not configured', setup: true });

  const { plan, email } = body;
  if (!plan) return res.status(400).json({ error: 'Missing plan' });

  const prices = {
    pro: process.env.STRIPE_PRICE_PRO || null,
    institutional: process.env.STRIPE_PRICE_INSTITUTIONAL || null,
  };

  const priceId = prices[plan];
  if (!priceId) return res.json({ error: `Price not configured for "${plan}"`, setup: true });

  try {
    const origin = req.headers.origin || req.headers.referer || 'https://felicity-world-map.vercel.app';
    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        'mode': 'subscription',
        'payment_method_types[0]': 'card',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'success_url': `${origin}?subscription=success&plan=${plan}`,
        'cancel_url': `${origin}?subscription=cancelled`,
        ...(email ? { 'customer_email': email } : {}),
      }).toString(),
    });

    if (!sessionRes.ok) return res.json({ error: 'Failed to create checkout session' });
    const session = await sessionRes.json();
    res.json({ url: session.url, sessionId: session.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function handleWebhook(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(200).json({ received: true });

  const event = JSON.parse(rawBody);
  console.log('[stripe-webhook]', event.type, event.data?.object?.id);
  res.json({ received: true });
}
