// Vercel Serverless Function — Stripe Webhook Handler

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  // Read raw body for signature verification
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');

  // Verify webhook signature
  const sig = req.headers['stripe-signature'];
  const crypto = await import('crypto');
  const parts = sig.split(',').reduce((acc, part) => {
    const [key, val] = part.split('=');
    acc[key] = val;
    return acc;
  }, {});

  const timestamp = parts.t;
  const expectedSig = crypto.createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  if (expectedSig !== parts.v1) {
    console.error('[webhook] Invalid signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(rawBody);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log('[webhook] Subscription created:', {
        customer: session.customer,
        email: session.customer_email || session.customer_details?.email,
        subscription: session.subscription,
        plan: session.metadata?.plan,
      });
      // In production: save to database, send welcome email, activate features
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object;
      console.log('[webhook] Subscription updated:', sub.id, sub.status);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      console.log('[webhook] Subscription cancelled:', sub.id);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log('[webhook] Payment failed:', invoice.customer);
      break;
    }
  }

  res.json({ received: true });
}
