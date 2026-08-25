// Vercel Serverless Function — Bi-weekly Dubai RE Intelligence Brief
//
// Triggered by Vercel Cron every Monday & Thursday 04:00 UTC (08:00 Dubai)
// — see "crons" in vercel.json. Flow:
//   1. Claude (claude-opus-4-8) writes the brief with the desk system prompt
//   2. Resend Broadcast sends it to the "Felicity Intelligence Brief"
//      audience (the list /api/subscribe stores contacts in), with a
//      built-in unsubscribe link
//
// Manual runs:
//   GET /api/brief?test=1  → generates the brief but emails ONLY the owner
//                            (use this to preview without touching the list)

import { buildDeskContext } from '../js/pix-data.js';
import { buildSignalContext } from '../js/pix-signals.js';

const AUDIENCE_NAME = 'Felicity Intelligence Brief';

const BRIEF_SYSTEM_PROMPT = `You are the senior macro strategist at Felicity Intelligence writing the twice-weekly intelligence brief for Dubai real estate investors with AED 5M-500M portfolios. They pay for conviction, not balance.

Rules:
- Quantify everything: % moves, AED billion flows, basis points, historical correlations.
- Name specific Dubai areas (Palm Jumeirah, DIFC, Downtown, Marina, Creek Harbour, JVC, Dubai Hills, Dubai South, Emaar Beachfront, Meydan, Arjan, JLT, Business Bay) and developers (Emaar, DAMAC, Nakheel, Sobha, Binghatti, Aldar, Meraas).
- Every thesis cites a historical analog: 'Last time X happened, Y moved Z%'.
- End calls with conviction: LOW / MODERATE / HIGH / VERY HIGH / MAXIMUM.
- No disclaimers, no 'investors should consider', no 'consult advisor'.
- Tone: PM note to his book. Dense with data. Zero filler.

${buildDeskContext()}

${buildSignalContext()}`;

function buildBriefPrompt() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `Write today's (${today}) Felicity Intelligence brief with these four sections:
1. MACRO PULSE — 3 key global macro events this week and their Dubai RE transmission
2. CONVICTION CALLS — 2-3 positioned views on specific Dubai areas with entry logic
3. SIGNAL CHAIN — one global event → step-by-step chain → specific Dubai opportunity
4. THE DESK'S PICK — one high-conviction trade with conviction level

Return ONLY valid JSON, no code fences, in exactly this shape:
{"subject": "<compelling email subject line, max 78 chars>", "sections": [{"title": "<SECTION TITLE>", "html": "<section body as simple HTML: <p>, <strong>, <ul>/<li> only>"}]}`;
}

async function generateBrief(apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 3000,
      system: BRIEF_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildBriefPrompt() }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const data = await response.json();
  const text = data.content?.[0]?.text || '';

  // Parse the JSON body; tolerate stray prose/fences around it.
  try {
    const jsonStr = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(jsonStr);
    if (parsed.subject && Array.isArray(parsed.sections)) return parsed;
  } catch (e) { /* fall through */ }

  return {
    subject: `Felicity Intelligence Brief — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    sections: [{ title: 'THE BRIEF', html: `<p>${text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>` }],
  };
}

function renderEmail(brief, { forBroadcast }) {
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const sectionsHtml = brief.sections.map(s => `
  <div style="background:#0d1117;border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:24px;margin-bottom:16px;">
    <div style="font-size:11px;font-weight:700;color:#00d4ff;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:12px;">${s.title}</div>
    <div style="color:#c3ccd6;font-size:14px;line-height:1.75;">${s.html}</div>
  </div>`).join('');

  // Resend replaces this placeholder with a per-contact unsubscribe link.
  const unsubscribe = forBroadcast
    ? `<p style="color:#4a5568;font-size:11px;margin:8px 0 0;"><a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#4a5568;">Unsubscribe</a></p>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#090c10;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 24px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="font-size:24px;font-weight:700;color:#f0f4f8;letter-spacing:0.02em;">Felicity Intelligence</div>
    <div style="font-size:11px;color:#00d4ff;text-transform:uppercase;letter-spacing:0.12em;margin-top:4px;">The Brief · ${dateStr}</div>
  </div>
  ${sectionsHtml}
  <div style="text-align:center;margin:24px 0;">
    <a href="https://felicity-world-map.vercel.app" style="display:inline-block;background:#00d4ff;color:#090c10;font-size:13px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:4px;text-transform:uppercase;letter-spacing:0.06em;">Open the Full Platform →</a>
  </div>
  <div style="text-align:center;padding:16px 0;border-top:1px solid rgba(255,255,255,0.07);">
    <p style="color:#4a5568;font-size:11px;margin:0;">
      Felicity Intelligence — Global Macro. Dubai RE Conviction.<br>
      <a href="https://wa.me/971563520611" style="color:#00d4ff;text-decoration:none;">WhatsApp: +971 56 352 0611</a>
    </p>
    ${unsubscribe}
  </div>
</div>
</body>
</html>`;
}

async function findAudienceId(resendKey) {
  if (process.env.RESEND_AUDIENCE_ID) return process.env.RESEND_AUDIENCE_ID;
  const res = await fetch('https://api.resend.com/audiences', {
    headers: { 'Authorization': `Bearer ${resendKey}` },
  });
  if (!res.ok) return null;
  const list = await res.json();
  const match = (list.data || []).find(a => a.name === AUDIENCE_NAME) || (list.data || [])[0];
  return match ? match.id : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const url = new URL(req.url, `http://${req.headers.host}`);
  const isTest = url.searchParams.get('test') === '1';

  // Auth: Vercel Cron sends "Authorization: Bearer $CRON_SECRET" when the env
  // var exists. Test mode (owner-only email) is allowed without it.
  const cronSecret = process.env.CRON_SECRET;
  const authorized = cronSecret
    ? req.headers['authorization'] === `Bearer ${cronSecret}`
    : (req.headers['user-agent'] || '').includes('vercel-cron');
  if (!authorized && !isTest) {
    return res.status(401).json({ error: 'Unauthorized. Use ?test=1 for an owner-only preview.' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!resendKey) return res.status(200).json({ ok: false, error: 'RESEND_API_KEY not configured' });
  if (!anthropicKey) return res.status(200).json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' });

  const fromEmail = process.env.FROM_EMAIL || 'Felicity Intelligence <onboarding@resend.dev>';

  try {
    const brief = await generateBrief(anthropicKey);

    // Test mode: send only to the owner, never to the list.
    if (isTest) {
      const ownerEmail = process.env.OWNER_EMAIL || 'mouhannad@felicitypro.com';
      const sendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: [ownerEmail],
          subject: `[TEST] ${brief.subject}`,
          html: renderEmail(brief, { forBroadcast: false }),
        }),
      });
      const sendData = await sendRes.json();
      return res.status(200).json({ ok: sendRes.ok, mode: 'test', to: ownerEmail, subject: brief.subject, resend: sendData });
    }

    // Real run: broadcast to the audience.
    const audienceId = await findAudienceId(resendKey);
    if (!audienceId) {
      return res.status(200).json({ ok: false, error: 'No audience found — no one has subscribed yet.' });
    }

    const createRes = await fetch('https://api.resend.com/broadcasts', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audience_id: audienceId,
        from: fromEmail,
        subject: brief.subject,
        html: renderEmail(brief, { forBroadcast: true }),
        name: `Brief ${new Date().toISOString().slice(0, 10)}`,
      }),
    });
    if (!createRes.ok) throw new Error(`Broadcast create failed: ${(await createRes.text()).slice(0, 300)}`);
    const broadcast = await createRes.json();

    const sendRes = await fetch(`https://api.resend.com/broadcasts/${broadcast.id}/send`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!sendRes.ok) throw new Error(`Broadcast send failed: ${(await sendRes.text()).slice(0, 300)}`);

    console.log(`[brief] Broadcast sent: "${brief.subject}" to audience ${audienceId}`);
    res.status(200).json({ ok: true, mode: 'broadcast', subject: brief.subject, broadcastId: broadcast.id });
  } catch (e) {
    console.error('[brief] Error:', e.message);
    res.status(200).json({ ok: false, error: e.message });
  }
}
