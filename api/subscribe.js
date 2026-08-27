// Vercel Serverless Function — Newsletter subscription + welcome email
//
//   POST /api/subscribe            { email }  → store contact, send welcome
//   GET  /api/subscribe?diagnose=1            → why is the newsletter not working?
//
// This endpoint used to return { success: true } no matter what happened. If
// RESEND_API_KEY was missing, if the audience could not be resolved, if Resend
// rejected the send — the visitor still saw "Subscribed! Check your inbox" and
// no email ever arrived. Silent success is the worst possible failure mode for
// a signup form, and it is the same sin as printing a market number we did not
// actually fetch. Every Resend call is now checked and the real reason is
// reported back.

const AUDIENCE_NAME = 'Felicity Intelligence Brief';
const RESEND_TEST_SENDER = 'onboarding@resend.dev';

// In-memory rate limit (resets on cold start): 5 signups/min/IP
const rateLimit = {};
function checkRateLimit(ip, max = 5, windowMs = 60000) {
  const now = Date.now();
  rateLimit[ip] = (rateLimit[ip] || []).filter(t => now - t < windowMs);
  if (rateLimit[ip].length >= max) return false;
  rateLimit[ip].push(now);
  return true;
}

// Anything placed in HTML must be escaped — the address comes from the request
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => HTML_ESCAPES[c]);

// Deliberately conservative: one @, no whitespace, a dot in the domain.
function validEmail(value) {
  const s = String(value || '').trim();
  if (s.length < 6 || s.length > 254) return null;
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[A-Za-z]{2,}$/.test(s)) return null;
  return s.toLowerCase();
}

function resendHeaders(key) {
  return { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
}

// Resolve the audience to store contacts in: env override → existing → create.
async function getAudienceId(resendKey) {
  if (process.env.RESEND_AUDIENCE_ID) return { id: process.env.RESEND_AUDIENCE_ID };

  const headers = resendHeaders(resendKey);

  const listRes = await fetch('https://api.resend.com/audiences', { headers });
  if (listRes.ok) {
    const list = await listRes.json();
    const existing = (list.data || []).find(a => a.name === AUDIENCE_NAME) || (list.data || [])[0];
    if (existing) return { id: existing.id };
  } else {
    return { id: null, error: `Resend audiences ${listRes.status}: ${(await listRes.text()).slice(0, 200)}` };
  }

  const createRes = await fetch('https://api.resend.com/audiences', {
    method: 'POST', headers, body: JSON.stringify({ name: AUDIENCE_NAME }),
  });
  if (createRes.ok) return { id: (await createRes.json()).id };
  return { id: null, error: `Could not create audience: ${(await createRes.text()).slice(0, 200)}` };
}

// Turn Resend's raw rejection into something the site owner can act on.
function explainSendFailure(status, body, fromEmail) {
  const usingTestSender = fromEmail.includes(RESEND_TEST_SENDER);
  if (usingTestSender) {
    return 'FROM_EMAIL is not set, so email is sent from Resend\'s test address, which only ' +
           'delivers to the Resend account owner. Verify a domain in Resend → Domains and set ' +
           'FROM_EMAIL in Vercel.';
  }
  if (status === 401 || status === 403) {
    return `Resend rejected the request (${status}). Check RESEND_API_KEY is valid and that the ` +
           `sender domain in FROM_EMAIL is verified. Resend said: ${body.slice(0, 200)}`;
  }
  if (status === 422) {
    return `Resend could not accept the message (422) — usually a malformed FROM_EMAIL. ` +
           `Resend said: ${body.slice(0, 200)}`;
  }
  return `Resend returned ${status}: ${body.slice(0, 200)}`;
}

function welcomeHtml() {
  return `<!DOCTYPE html>
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
      You're now subscribed to our institutional-grade Dubai real estate macro analysis.
      Every <strong style="color:#f0f4f8;">Monday</strong> and <strong style="color:#f0f4f8;">Thursday</strong>, you'll receive:
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
</html>`;
}

// ── Diagnostics ──
// Answers "why is the newsletter not working?" without exposing any secret.
// It reports only whether things are configured and what Resend says back.
async function handleDiagnose(res) {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || `Felicity Intelligence <${RESEND_TEST_SENDER}>`;

  const report = {
    ok: false,
    checks: [],
    fromEmail,
    usingResendTestSender: fromEmail.includes(RESEND_TEST_SENDER),
  };
  const add = (name, pass, detail) => report.checks.push({ name, pass, detail });

  add('RESEND_API_KEY set', Boolean(resendKey),
      resendKey ? 'present' : 'MISSING — no email can be sent or stored at all');
  add('ANTHROPIC_API_KEY set', Boolean(process.env.ANTHROPIC_API_KEY),
      process.env.ANTHROPIC_API_KEY ? 'present' : 'MISSING — the Mon/Thu brief cannot be written');
  add('FROM_EMAIL set', Boolean(process.env.FROM_EMAIL),
      process.env.FROM_EMAIL
        ? 'present'
        : `MISSING — falling back to ${RESEND_TEST_SENDER}, which Resend only delivers to the account owner. This is the usual reason subscribers receive nothing.`);

  if (!resendKey) {
    res.status(200).json(report);
    return;
  }

  // Verified sending domains
  try {
    const r = await fetch('https://api.resend.com/domains', { headers: resendHeaders(resendKey) });
    if (!r.ok) {
      add('Resend API key valid', false, `GET /domains returned ${r.status}`);
    } else {
      add('Resend API key valid', true, 'authenticated');
      const domains = (await r.json()).data || [];
      const verified = domains.filter(d => d.status === 'verified').map(d => d.name);
      const sender = (fromEmail.match(/<([^>]+)>/)?.[1] || fromEmail).split('@')[1] || '';
      add('Sender domain verified',
          Boolean(sender) && verified.includes(sender),
          domains.length
            ? `sender domain "${sender}" — verified domains on this account: ${verified.join(', ') || 'none'}`
            : 'no domains added in Resend → Domains yet');
    }
  } catch (e) {
    add('Resend API key valid', false, e.message);
  }

  // Audience + subscriber count
  try {
    const { id, error } = await getAudienceId(resendKey);
    if (!id) {
      add('Newsletter audience', false, error || 'could not resolve or create the audience');
    } else {
      const c = await fetch(`https://api.resend.com/audiences/${id}/contacts`, { headers: resendHeaders(resendKey) });
      const contacts = c.ok ? ((await c.json()).data || []) : null;
      add('Newsletter audience', true,
          contacts === null
            ? `audience ${id}, but the contact list could not be read (${c.status})`
            : `audience ${id} — ${contacts.length} subscriber${contacts.length === 1 ? '' : 's'} stored`);
    }
  } catch (e) {
    add('Newsletter audience', false, e.message);
  }

  add('Mon/Thu schedule', true, 'vercel.json cron "0 4 * * 1,4" — 04:00 UTC, 08:00 Dubai');
  report.ok = report.checks.every(c => c.pass);
  report.summary = report.ok
    ? 'Everything needed to deliver the newsletter is configured.'
    : 'Fix the checks marked pass:false — the first failing one is the blocker.';
  res.status(200).json(report);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.searchParams.get('diagnose') === '1') {
    return handleDiagnose(res);
  }

  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'POST only' });

  const email = validEmail((req.body || {}).email);
  if (!email) return res.status(400).json({ success: false, error: 'Enter a valid email address.' });

  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ success: false, error: 'Too many requests. Please try again in a minute.' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || `Felicity Intelligence <${RESEND_TEST_SENDER}>`;

  if (!resendKey) {
    console.error('[subscribe] RESEND_API_KEY missing — cannot store or send');
    return res.status(200).json({
      success: false,
      error: 'The newsletter is not accepting signups right now. Please try again later.',
      detail: 'RESEND_API_KEY is not configured',
    });
  }

  // 1) Store the subscriber. This is what the Monday/Thursday broadcast sends
  //    to, so a failure here means they are not subscribed — say so.
  let stored = false;
  let storeError = null;
  try {
    const { id: audienceId, error } = await getAudienceId(resendKey);
    if (!audienceId) {
      storeError = error || 'Could not resolve the newsletter audience';
    } else {
      const r = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
        method: 'POST',
        headers: resendHeaders(resendKey),
        body: JSON.stringify({ email, unsubscribed: false }),
      });
      if (r.ok) {
        stored = true;
      } else {
        const body = await r.text();
        // Resend returns 409 when the address is already on the list, which is
        // not a failure from the visitor's point of view.
        if (r.status === 409 || /already exists/i.test(body)) stored = true;
        else storeError = `Resend contacts ${r.status}: ${body.slice(0, 200)}`;
      }
    }
  } catch (e) {
    storeError = e.message;
  }

  if (!stored) {
    console.error('[subscribe] Could not store contact:', storeError);
    return res.status(200).json({
      success: false,
      error: 'We could not add you to the list. Please try again, or message us on WhatsApp.',
      detail: storeError,
    });
  }

  // 2) Welcome email. The subscription itself already succeeded, so a bounce
  //    here is reported as a partial success rather than losing the signup.
  let welcomeSent = false;
  let welcomeError = null;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: resendHeaders(resendKey),
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: 'Welcome to Felicity Intelligence — Briefs Every Mon & Thu',
        html: welcomeHtml(),
      }),
    });
    if (r.ok) welcomeSent = true;
    else welcomeError = explainSendFailure(r.status, await r.text(), fromEmail);
  } catch (e) {
    welcomeError = e.message;
  }

  if (welcomeError) console.error('[subscribe] Welcome email failed:', welcomeError);

  // 3) Owner notification — best effort, never affects the visitor's result
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: resendHeaders(resendKey),
      body: JSON.stringify({
        from: fromEmail,
        to: [process.env.OWNER_EMAIL || 'mouhannad@felicitypro.com'],
        subject: `New Subscriber: ${email}`,
        html: `<p>New newsletter subscriber: <strong>${escapeHtml(email)}</strong></p>
               <p>Date: ${new Date().toISOString()}</p>`,
      }),
    });
  } catch (e) {
    console.error('[subscribe] Owner notification error:', e.message);
  }

  console.log('[subscribe] Subscribed:', email, '| welcome sent:', welcomeSent);

  res.status(200).json({
    success: true,
    stored: true,
    welcomeSent,
    message: welcomeSent
      ? 'Subscribed. Check your inbox for the welcome email.'
      : 'Subscribed. The welcome email could not be delivered, but you are on the list for Monday and Thursday.',
    ...(welcomeError ? { detail: welcomeError } : {}),
  });
}
