// Vercel Serverless Function — Newsletter subscription + welcome email

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { email } = req.body || {};
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const resendKey = process.env.RESEND_API_KEY;

  // Send welcome email via Resend
  if (resendKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Felicity Intelligence <onboarding@resend.dev>',
          to: [email],
          subject: 'Welcome to Felicity Intelligence — Your First Brief',
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#090c10;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 24px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="font-size:24px;font-weight:700;color:#f0f4f8;letter-spacing:0.02em;">Felicity Intelligence</div>
    <div style="font-size:11px;color:#00d4ff;text-transform:uppercase;letter-spacing:0.12em;margin-top:4px;">Global Macro · Dubai RE</div>
  </div>

  <div style="background:#0d1117;border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:32px 24px;margin-bottom:24px;">
    <h1 style="color:#f0f4f8;font-size:22px;margin:0 0 16px;">Welcome to the Intelligence Brief</h1>
    <p style="color:#8899aa;font-size:15px;line-height:1.7;margin:0 0 20px;">
      You're now subscribed to our weekly institutional-grade Dubai real estate macro analysis.
      Every Monday, you'll receive:
    </p>
    <ul style="color:#8899aa;font-size:14px;line-height:2;margin:0 0 20px;padding-left:20px;">
      <li><strong style="color:#f0f4f8;">Macro Pulse</strong> — Key global events moving Dubai RE this week</li>
      <li><strong style="color:#f0f4f8;">Conviction Calls</strong> — Our positioned views on Dubai areas</li>
      <li><strong style="color:#f0f4f8;">Signal Chains</strong> — How global events translate to specific Dubai opportunities</li>
      <li><strong style="color:#f0f4f8;">The Desk's Pick</strong> — One high-conviction trade of the week</li>
    </ul>
    <p style="color:#8899aa;font-size:14px;line-height:1.7;margin:0 0 24px;">
      In the meantime, explore the full intelligence platform:
    </p>
    <a href="https://felicity-world-map.vercel.app" style="display:inline-block;background:#00d4ff;color:#090c10;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:4px;text-transform:uppercase;letter-spacing:0.06em;">Open Felicity Intelligence →</a>
  </div>

  <div style="text-align:center;padding:16px 0;border-top:1px solid rgba(255,255,255,0.07);">
    <p style="color:#4a5568;font-size:11px;margin:0;">
      Felicity Intelligence — Global Macro. Dubai RE Conviction.<br>
      <a href="https://wa.me/971563520611" style="color:#00d4ff;text-decoration:none;">WhatsApp: +971 56 352 0611</a>
    </p>
  </div>
</div>
</body>
</html>`
        }),
      });
      console.log('[subscribe] Welcome email sent to:', email);
    } catch (e) {
      console.error('[subscribe] Email send error:', e.message);
    }
  }

  // Also notify you (the owner) about the new subscriber
  if (resendKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Felicity Intelligence <onboarding@resend.dev>',
          to: ['felicity@felicityproperties.com'],
          subject: `New Subscriber: ${email}`,
          html: `<p>New newsletter subscriber: <strong>${email}</strong></p><p>Date: ${new Date().toISOString()}</p>`
        }),
      });
    } catch (e) {
      console.error('[subscribe] Owner notification error:', e.message);
    }
  }

  console.log('[subscribe] New subscriber:', email);
  res.json({ success: true, message: 'Subscribed! Check your inbox for the welcome email.' });
}
