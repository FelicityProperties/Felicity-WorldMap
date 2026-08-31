// Vercel Serverless Function — Newsletter subscription + welcome email
//
//   POST /api/subscribe            { email }  → store contact, send welcome
//   GET  /api/subscribe?diagnose=1            → why is the newsletter not working?
//
// This endpoint used to return { success: true } no matter what happened, and
// stored the subscriber only in a Resend Audience. Both were wrong. A Resend
// key created with "Sending access" cannot touch the Audiences API, so every
// signup 401'd and was dropped while the visitor was told "Subscribed! Check
// your inbox". Silent success is the worst possible failure mode for a signup
// form — it is the same sin as printing a market number we never fetched.
//
// Now the list is written to our own Postgres when DATABASE_URL is set, and
// mirrored into the Resend Audience when the key allows it. Either one counts
// as subscribed; if neither works, the visitor is told plainly.

import {
  RESEND_TEST_SENDER, resendHeaders, fromAddress, isRestrictedKeyError,
  dbAvailable, dbStore, dbUnsubscribe, audienceStore, resolveAudience, unsubValid,
} from '../lib/subscribers.js';

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

// ── Unsubscribe ──
// Lives on this route rather than its own file: anything under api/ becomes a
// serverless function and the Hobby plan allows twelve.
async function handleUnsubscribe(res, email, token) {
  const page = (title, body) => `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#090c10;color:#c3ccd6;font-family:Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:80px 24px;text-align:center;">
  <div style="font-size:22px;font-weight:700;color:#f0f4f8;">Felicity Intelligence</div>
  <p style="line-height:1.7;margin:24px 0;">${body}</p>
  <a href="https://felicity-world-map.vercel.app" style="color:#00d4ff;">Back to the platform</a>
</div></body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const clean = validEmail(email);
  if (!clean || !unsubValid(clean, token)) {
    return res.status(400).send(page('Invalid link',
      'That unsubscribe link is not valid. Reply to any brief and we will remove you by hand.'));
  }

  const result = await dbUnsubscribe(clean);
  if (!result.ok) {
    console.error('[unsubscribe] failed:', result.error);
    return res.status(200).send(page('Could not unsubscribe',
      'We could not process that right now. Reply to any brief and we will remove you by hand.'));
  }

  console.log('[unsubscribe]', clean);
  return res.status(200).send(page('Unsubscribed',
    `<strong style="color:#f0f4f8;">${escapeHtml(clean)}</strong> has been removed. You will not receive the Monday and Thursday brief again.`));
}

// ── Diagnostics ──
// Answers "why is the newsletter not working?" without exposing any secret.
// It reports only whether things are configured and what Resend says back.
async function handleDiagnose(res, probe = false) {
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

  // Can the sender domain actually send?
  //
  // This check used to be `Boolean(process.env.FROM_EMAIL)` — it confirmed the
  // variable was SET, never that the domain behind it was VERIFIED, and then
  // reported "the newsletter is ready" while every send was being rejected
  // with a 403. Claiming a green light we had not measured is exactly what
  // this project forbids everywhere else, so it is measured now: read the
  // verified domain list where the key permits it, and where it does not,
  // say so plainly instead of assuming.
  let restrictedKey = false;
  let senderVerified = null;   // null = genuinely unknown, not "fine"
  const senderDomain = (fromEmail.match(/<([^>]+)>/)?.[1] || fromEmail).split('@')[1] || '';

  try {
    const r = await fetch('https://api.resend.com/domains', { headers: resendHeaders(resendKey) });
    const body = r.ok ? null : await r.text();
    if (!r.ok) {
      restrictedKey = isRestrictedKeyError(body);
      add('Resend key can read domains', false,
          restrictedKey
            ? 'This key was created with "Sending access" only. It can send email but cannot read domains, audiences or broadcasts.'
            : `GET /domains returned ${r.status}: ${String(body).slice(0, 160)}`);
    } else {
      add('Resend key can read domains', true, 'authenticated');
      const domains = (await r.json()).data || [];
      const verified = domains.filter(d => d.status === 'verified').map(d => d.name);
      senderVerified = Boolean(senderDomain) && verified.includes(senderDomain);
      add('Sender domain verified', senderVerified,
          domains.length
            ? `sender domain "${senderDomain}" — verified on this account: ${verified.join(', ') || 'none'}`
            : 'no domains added in Resend → Domains yet');
    }
  } catch (e) {
    add('Resend key can read domains', false, e.message);
  }

  // A send-only key cannot read the domain list, so the only way to KNOW is to
  // send. `?diagnose=1&probe=1` does exactly that — one real message to the
  // owner — and reports what Resend actually said. Opt-in, because a
  // diagnostic that emails on every call is its own kind of bug.
  if (senderVerified === null) {
    if (probe) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: resendHeaders(resendKey),
          body: JSON.stringify({
            from: fromEmail,
            to: [process.env.OWNER_EMAIL || 'mouhannad@felicitypro.com'],
            subject: 'Felicity Intelligence — sender check',
            text: 'If this arrived, the sender domain is verified and the newsletter can reach subscribers.',
          }),
        });
        const body = await r.text();
        senderVerified = r.ok;
        add('Sender domain verified', r.ok,
            r.ok
              ? 'PROBE SENT — Resend accepted a real message. Check the owner inbox to confirm delivery.'
              : `PROBE REJECTED — ${String(body).slice(0, 200)}`);
      } catch (e) {
        senderVerified = false;
        add('Sender domain verified', false, `probe failed: ${e.message}`);
      }
    } else {
      add('Sender domain verified', false,
          `UNKNOWN — the send-only key cannot read the domain list, so this cannot be confirmed from here. Add &probe=1 to this URL to send one real test message and find out. Until then, treat "${senderDomain}" as unverified.`);
    }
  }

  // Where the list lives. Either store is sufficient.
  const db = await dbAvailable();
  add('Postgres subscriber store', db.ok,
      db.ok
        ? `${db.count} subscriber${db.count === 1 ? '' : 's'} stored in DATABASE_URL`
        : `unavailable — ${db.error}`);

  let audienceOk = false;
  try {
    const { id, error, restricted } = await resolveAudience(resendKey);
    if (id) {
      audienceOk = true;
      const c = await fetch(`https://api.resend.com/audiences/${id}/contacts`, { headers: resendHeaders(resendKey) });
      const contacts = c.ok ? ((await c.json()).data || []) : null;
      add('Resend audience store', true,
          contacts === null
            ? `audience ${id}, but the contact list could not be read (${c.status})`
            : `audience ${id} — ${contacts.length} contact${contacts.length === 1 ? '' : 's'}`);
    } else {
      restrictedKey = restrictedKey || Boolean(restricted);
      add('Resend audience store', false,
          restricted ? 'blocked: the API key is restricted to sending only' : (error || 'could not resolve'));
    }
  } catch (e) {
    add('Resend audience store', false, e.message);
  }

  // A list needs somewhere to live; either store on its own is fine.
  add('Subscribers can be stored', db.ok || audienceOk,
      db.ok || audienceOk
        ? 'at least one store is writable'
        : 'NEITHER store is writable — signups cannot be recorded. Set DATABASE_URL, or create a Full Access key in Resend.');

  add('Mon/Thu schedule', true, 'vercel.json cron "0 4 * * 1,4" — 04:00 UTC, 08:00 Dubai');
  report.restrictedApiKey = restrictedKey;
  // Only these two actually stop mail reaching subscribers. The rest is detail.
  const canStore = report.checks.find(c => c.name === 'Subscribers can be stored')?.pass;
  const canSend = senderVerified === true;
  report.ok = Boolean(canStore && canSend);

  const blockers = [];
  if (!canStore) {
    blockers.push(restrictedKey
      ? 'The RESEND_API_KEY has "Sending access" only, so the Resend audience is unreachable, and DATABASE_URL is not set either — so there is nowhere to record a subscriber. Fix EITHER: set DATABASE_URL in Vercel, or create a Full Access key in Resend → API Keys.'
      : 'No writable subscriber store. Set DATABASE_URL in Vercel, or create a Full Access key in Resend → API Keys.');
  }
  if (!canSend) {
    if (!process.env.FROM_EMAIL) {
      blockers.push(`FROM_EMAIL is not set, so mail goes out from ${RESEND_TEST_SENDER}, which Resend delivers ONLY to the account owner. Verify your domain in Resend → Domains, then set FROM_EMAIL in Vercel.`);
    } else if (senderVerified === false) {
      blockers.push(`The domain "${senderDomain}" is not verified in Resend, so every send is rejected with a 403. Add it at https://resend.com/domains, publish the DNS records it gives you, and wait for the status to read Verified. No code change can work around this.`);
    } else {
      blockers.push(`Cannot confirm that "${senderDomain}" is a verified sender, because this API key cannot read the domain list. Re-run this URL with &probe=1 to test with a real message.`);
    }
  }
  report.blockers = blockers;
  report.summary = report.ok
    ? 'Subscribers can be stored and mail can reach them. The newsletter is ready.'
    : blockers.join(' ');
  res.status(200).json(report);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.searchParams.get('diagnose') === '1') {
    return handleDiagnose(res, url.searchParams.get('probe') === '1');
  }

  if (req.method === 'GET' && url.searchParams.get('unsubscribe')) {
    return handleUnsubscribe(res, url.searchParams.get('unsubscribe'), url.searchParams.get('t'));
  }

  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'POST only' });

  const email = validEmail((req.body || {}).email);
  if (!email) return res.status(400).json({ success: false, error: 'Enter a valid email address.' });

  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ success: false, error: 'Too many requests. Please try again in a minute.' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = fromAddress();

  if (!resendKey) {
    console.error('[subscribe] RESEND_API_KEY missing — cannot store or send');
    return res.status(200).json({
      success: false,
      error: 'The newsletter is not accepting signups right now. Please try again later.',
      detail: 'RESEND_API_KEY is not configured',
    });
  }

  // 1) Store the subscriber. Two independent stores — our own Postgres and
  //    the Resend audience — and either one is enough. The audience alone used
  //    to be the single point of failure that lost every signup.
  const [dbRes, audRes] = await Promise.all([
    dbStore(email),
    audienceStore(resendKey, email).catch(e => ({ stored: false, error: e.message })),
  ]);

  const stored = dbRes.stored || audRes.stored;
  if (!stored) {
    const detail = [
      dbRes.error ? `postgres: ${dbRes.error}` : null,
      audRes.error ? `resend audience: ${audRes.error}` : null,
    ].filter(Boolean).join(' | ');
    console.error('[subscribe] No store accepted the contact:', detail);
    return res.status(200).json({
      success: false,
      error: 'We could not add you to the list. Please try again, or message us on WhatsApp.',
      detail,
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
    storedIn: [dbRes.stored ? 'postgres' : null, audRes.stored ? 'resend-audience' : null].filter(Boolean),
    welcomeSent,
    message: welcomeSent
      ? 'Subscribed. Check your inbox for the welcome email.'
      : 'Subscribed. The welcome email could not be delivered, but you are on the list for Monday and Thursday.',
    ...(welcomeError ? { detail: welcomeError } : {}),
  });
}
