// Vercel Serverless Function — Create Stripe Checkout Session

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(200).json({ error: 'Stripe not configured', setup: true });
  }

  const { plan, email } = req.body || {};
  if (!plan) return res.status(400).json({ error: 'Missing plan' });

  // Price IDs — set these after creating products in Stripe Dashboard
  const prices = {
    pro: process.env.STRIPE_PRICE_PRO || null,
    institutional: process.env.STRIPE_PRICE_INSTITUTIONAL || null,
  };

  const priceId = prices[plan];
  if (!priceId) {
    return res.status(200).json({
      error: `Stripe price not configured for "${plan}" plan. Set STRIPE_PRICE_PRO and STRIPE_PRICE_INSTITUTIONAL in Vercel env vars.`,
      setup: true
    });
  }

  try {
    const origin = req.headers.origin || req.headers.referer || 'https://felicity-world-map.vercel.app';

    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
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

    if (!sessionRes.ok) {
      const err = await sessionRes.text();
      console.error('[stripe] Checkout error:', err);
      return res.status(200).json({ error: 'Failed to create checkout session' });
    }

    const session = await sessionRes.json();
    res.json({ url: session.url, sessionId: session.id });
  } catch (e) {
    console.error('[stripe] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
