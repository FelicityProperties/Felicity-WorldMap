// ═══════════════════════════════════════════════════════════
// SUBSCRIBERS — where the newsletter list actually lives
// ═══════════════════════════════════════════════════════════
//
// The list used to live only in a Resend Audience. That turned out to be a
// single point of failure: a Resend API key created with "Sending access"
// cannot call the Audiences API at all, so every signup returned 401 and was
// silently dropped. Nobody was ever stored, and the Monday/Thursday broadcast
// had nothing to send to.
//
// So the subscriber list — which is a business asset, not a vendor detail —
// is stored in our own Postgres when DATABASE_URL is set, and mirrored into
// the Resend Audience when the key has permission. Either one is enough.
//
// Sending then follows the same rule: with an audience we use a Resend
// broadcast; with only the database we send individual messages, which a
// send-only key is allowed to do.
//
// This file lives outside api/ deliberately — anything inside api/ becomes
// its own serverless function, and the Hobby plan allows twelve.
// ═══════════════════════════════════════════════════════════

import { createHmac } from 'crypto';

export const AUDIENCE_NAME = 'Felicity Intelligence Brief';
export const RESEND_TEST_SENDER = 'onboarding@resend.dev';

export function resendHeaders(key) {
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

export function fromAddress() {
  return process.env.FROM_EMAIL || `Felicity Intelligence <${RESEND_TEST_SENDER}>`;
}

// A key restricted to sending returns this on any Audiences/Broadcasts call.
export function isRestrictedKeyError(body) {
  return /restricted_api_key|restricted to only send/i.test(String(body || ''));
}

// ── Unsubscribe ──
// A broadcast gets Resend's own per-contact link. Individual sends do not, so
// every message carries a signed link of our own — an unsubscribe path is a
// legal requirement, not a nicety. The token is an HMAC so nobody can
// unsubscribe an address they do not control by guessing the URL.
function unsubSecret() {
  return process.env.UNSUB_SECRET || process.env.RESEND_API_KEY || 'felicity-unsub';
}

export function unsubToken(email) {
  return createHmac('sha256', unsubSecret())
    .update(String(email).toLowerCase())
    .digest('hex')
    .slice(0, 32);
}

export function unsubValid(email, token) {
  const expected = unsubToken(email);
  const given = String(token || '');
  if (given.length !== expected.length) return false;
  // Constant-time compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

export function unsubUrl(email, base) {
  const root = base || process.env.SITE_URL || 'https://felicity-world-map.vercel.app';
  return `${root}/api/subscribe?unsubscribe=${encodeURIComponent(email)}&t=${unsubToken(email)}`;
}

// ── Postgres ──
async function sqlClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  try {
    const { neon } = await import('@neondatabase/serverless');
    return neon(connectionString);
  } catch {
    return null;
  }
}

// Created on demand so a fresh deployment does not need a migration step
// before the first person can subscribe.
async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS subscribers (
      id            SERIAL PRIMARY KEY,
      email         VARCHAR(254) UNIQUE NOT NULL,
      subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      unsubscribed  BOOLEAN NOT NULL DEFAULT FALSE,
      source        VARCHAR(40) DEFAULT 'site'
    )`;
}

export async function dbAvailable() {
  const sql = await sqlClient();
  if (!sql) return { ok: false, error: 'DATABASE_URL not configured' };
  try {
    await ensureTable(sql);
    const rows = await sql`SELECT COUNT(*)::int AS n FROM subscribers WHERE unsubscribed = FALSE`;
    return { ok: true, count: rows[0]?.n ?? 0 };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/** Store a subscriber. Re-subscribing an unsubscribed address reactivates it. */
export async function dbStore(email, source = 'site') {
  const sql = await sqlClient();
  if (!sql) return { stored: false, error: 'DATABASE_URL not configured' };
  try {
    await ensureTable(sql);
    await sql`
      INSERT INTO subscribers (email, source) VALUES (${email}, ${source})
      ON CONFLICT (email) DO UPDATE SET unsubscribed = FALSE`;
    return { stored: true };
  } catch (e) {
    return { stored: false, error: e.message };
  }
}

export async function dbUnsubscribe(email) {
  const sql = await sqlClient();
  if (!sql) return { ok: false, error: 'DATABASE_URL not configured' };
  try {
    await ensureTable(sql);
    await sql`UPDATE subscribers SET unsubscribed = TRUE WHERE email = ${String(email).toLowerCase()}`;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function dbRecipients() {
  const sql = await sqlClient();
  if (!sql) return null;
  try {
    await ensureTable(sql);
    const rows = await sql`
      SELECT email FROM subscribers WHERE unsubscribed = FALSE ORDER BY subscribed_at`;
    return rows.map(r => r.email);
  } catch {
    return null;
  }
}

// ── Resend audience (only reachable with a full-access key) ──
export async function resolveAudience(resendKey) {
  if (process.env.RESEND_AUDIENCE_ID) return { id: process.env.RESEND_AUDIENCE_ID };
  const headers = resendHeaders(resendKey);

  const listRes = await fetch('https://api.resend.com/audiences', { headers });
  if (listRes.ok) {
    const list = await listRes.json();
    const existing = (list.data || []).find(a => a.name === AUDIENCE_NAME) || (list.data || [])[0];
    if (existing) return { id: existing.id };
  } else {
    const body = await listRes.text();
    return {
      id: null,
      restricted: isRestrictedKeyError(body),
      error: `Resend audiences ${listRes.status}: ${body.slice(0, 200)}`,
    };
  }

  const createRes = await fetch('https://api.resend.com/audiences', {
    method: 'POST', headers, body: JSON.stringify({ name: AUDIENCE_NAME }),
  });
  if (createRes.ok) return { id: (await createRes.json()).id };
  const body = await createRes.text();
  return {
    id: null,
    restricted: isRestrictedKeyError(body),
    error: `Could not create audience: ${body.slice(0, 200)}`,
  };
}

export async function audienceStore(resendKey, email) {
  const { id, error, restricted } = await resolveAudience(resendKey);
  if (!id) return { stored: false, restricted, error };
  const r = await fetch(`https://api.resend.com/audiences/${id}/contacts`, {
    method: 'POST',
    headers: resendHeaders(resendKey),
    body: JSON.stringify({ email, unsubscribed: false }),
  });
  if (r.ok) return { stored: true, audienceId: id };
  const body = await r.text();
  // Already on the list is not a failure from the visitor's point of view
  if (r.status === 409 || /already exists/i.test(body)) return { stored: true, audienceId: id };
  return { stored: false, restricted: isRestrictedKeyError(body), error: `Resend contacts ${r.status}: ${body.slice(0, 200)}` };
}

// ── Sending ──
/**
 * Send one message per recipient. This is what a send-only key can do, and it
 * is how the brief goes out when the list lives in Postgres rather than in a
 * Resend Audience. `htmlFor(email)` builds the body per recipient so each one
 * carries its own unsubscribe link. Returns real counts — never an assumption
 * that it worked.
 */
export async function sendIndividually(resendKey, { from, subject, htmlFor, recipients }) {
  const sent = [], failed = [];
  for (let i = 0; i < recipients.length; i += 5) {
    const batch = recipients.slice(i, i + 5);
    const results = await Promise.allSettled(batch.map(async to => {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: resendHeaders(resendKey),
        body: JSON.stringify({ from, to: [to], subject, html: htmlFor(to) }),
      });
      if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 120)}`);
      return to;
    }));
    results.forEach((res, idx) => {
      if (res.status === 'fulfilled') sent.push(batch[idx]);
      else failed.push({ email: batch[idx], error: res.reason?.message || 'unknown' });
    });
  }
  return { sent: sent.length, failed };
}
