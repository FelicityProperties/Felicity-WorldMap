// Vercel Serverless Function — Lead capture with email notification

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

  const lead = { name, email, phone, budget, area, message, date: new Date().toISOString() };
  console.log('[LEAD]', JSON.stringify(lead));

  const resendKey = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.OWNER_EMAIL || 'mouhannad@felicitypro.com';

  if (resendKey) {
    const budgetLabels = {
      'under-1m': 'Under AED 1M',
      '1m-3m': 'AED 1M - 3M',
      '3m-10m': 'AED 3M - 10M',
      '10m-plus': 'AED 10M+'
    };
    const budgetText = budgetLabels[budget] || budget || 'Not specified';

    // Email YOU (owner) about the new lead
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Felicity Leads <onboarding@resend.dev>',
          to: [ownerEmail],
          reply_to: email,
          subject: `🔥 NEW LEAD: ${name} — ${area || 'General'} (${budgetText})`,
          html: `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#090c10;font-family:Arial,sans-serif;color:#f0f4f8;">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;">
  <div style="background:#00d4ff;color:#090c10;padding:16px 20px;border-radius:6px 6px 0 0;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:14px;">
    🔥 New Consultation Request
  </div>
  <div style="background:#0d1117;border:1px solid rgba(255,255,255,0.07);border-top:none;border-radius:0 0 6px 6px;padding:24px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;color:#8899aa;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;width:120px;">Name</td><td style="padding:8px 0;color:#f0f4f8;font-size:16px;font-weight:600;">${escapeHtml(name)}</td></tr>
      <tr><td style="padding:8px 0;color:#8899aa;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Email</td><td style="padding:8px 0;"><a href="mailto:${escapeHtml(email)}" style="color:#00d4ff;text-decoration:none;font-size:16px;">${escapeHtml(email)}</a></td></tr>
      <tr><td style="padding:8px 0;color:#8899aa;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Phone</td><td style="padding:8px 0;"><a href="https://wa.me/${escapeHtml(phone.replace(/[^0-9]/g,''))}" style="color:#22c55e;text-decoration:none;font-size:16px;font-weight:600;">${escapeHtml(phone)} (WhatsApp)</a></td></tr>
      <tr><td style="padding:8px 0;color:#8899aa;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Budget</td><td style="padding:8px 0;color:#d4a853;font-size:16px;font-weight:600;">${escapeHtml(budgetText)}</td></tr>
      <tr><td style="padding:8px 0;color:#8899aa;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Area</td><td style="padding:8px 0;color:#f0f4f8;font-size:16px;">${escapeHtml(area || 'General inquiry')}</td></tr>
      ${message ? `<tr><td style="padding:8px 0;color:#8899aa;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;vertical-align:top;">Message</td><td style="padding:8px 0;color:#f0f4f8;font-size:14px;line-height:1.6;">${escapeHtml(message)}</td></tr>` : ''}
      <tr><td style="padding:8px 0;color:#8899aa;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Received</td><td style="padding:8px 0;color:#8899aa;font-size:13px;">${new Date(lead.date).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</td></tr>
    </table>
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.07);">
      <a href="https://wa.me/${escapeHtml(phone.replace(/[^0-9]/g,''))}" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:4px;text-transform:uppercase;letter-spacing:0.06em;font-size:13px;margin-right:8px;">💬 WhatsApp</a>
      <a href="mailto:${escapeHtml(email)}" style="display:inline-block;background:#00d4ff;color:#090c10;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:4px;text-transform:uppercase;letter-spacing:0.06em;font-size:13px;">✉ Reply</a>
    </div>
  </div>
  <div style="text-align:center;padding:16px 0;color:#4a5568;font-size:11px;">Felicity Intelligence — Lead Capture</div>
</div>
</body></html>`
        }),
      });
      console.log('[LEAD] Owner notified at', ownerEmail);
    } catch (e) {
      console.error('[LEAD] Owner email failed:', e.message);
    }

    // Send confirmation to the lead
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
          subject: 'Your Dubai RE Consultation Request — Felicity Intelligence',
          html: `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#090c10;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 24px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="font-size:24px;font-weight:700;color:#f0f4f8;">Felicity Intelligence</div>
    <div style="font-size:11px;color:#00d4ff;text-transform:uppercase;letter-spacing:0.12em;margin-top:4px;">Global Macro · Dubai RE</div>
  </div>
  <div style="background:#0d1117;border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:32px 24px;">
    <h2 style="color:#f0f4f8;font-size:20px;margin:0 0 16px;">Thank you, ${escapeHtml(name.split(' ')[0])}.</h2>
    <p style="color:#8899aa;font-size:15px;line-height:1.7;margin:0 0 20px;">
      We've received your consultation request${area ? ` for <strong style="color:#f0f4f8;">${escapeHtml(area)}</strong>` : ''}. Our Dubai real estate specialists will reach out within 24 hours.
    </p>
    <p style="color:#8899aa;font-size:14px;line-height:1.7;margin:0 0 24px;">
      For faster response, message us directly on WhatsApp:
    </p>
    <a href="https://wa.me/971563520611" style="display:inline-block;background:#22c55e;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:4px;text-transform:uppercase;letter-spacing:0.06em;">💬 WhatsApp +971 56 352 0611</a>
  </div>
  <div style="text-align:center;padding:16px 0;color:#4a5568;font-size:11px;">Felicity Intelligence — Global Macro. Dubai RE Conviction.</div>
</div>
</body></html>`
        }),
      });
    } catch (e) {
      console.error('[LEAD] Confirmation email failed:', e.message);
    }
  }

  res.json({ success: true, message: 'Thank you! Our team will contact you within 24 hours.' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
