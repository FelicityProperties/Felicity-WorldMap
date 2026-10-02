// ═══════════════════════════════════════════════════════════
// ANALYTICS — first-party visit beacons (see lib/analytics.js)
// ═══════════════════════════════════════════════════════════
//
// Sends three kinds of beacon to /api/data?layer=hit: a pageview on load,
// a tab view when the reader switches tab, and on leaving, the seconds the
// page was actually visible. No cookies, no IP stored, no third party.
//
// Not tracked at all: browsers sending Do-Not-Track or Global Privacy
// Control, and the owner's own browser once the dashboard has been opened
// in it (it sets `fi_owner` in localStorage).
// ═══════════════════════════════════════════════════════════

const ENDPOINT = '/api/data?layer=hit';

function store(kind) {
  try { return kind === 'local' ? window.localStorage : window.sessionStorage; } catch { return null; }
}

function randomId() {
  const a = new Uint8Array(12);
  (window.crypto || {}).getRandomValues?.(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('') || String(Date.now());
}

function optedOut() {
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true) return true;
  try { return store('local')?.getItem('fi_owner') === '1'; } catch { return false; }
}

let ids = null;
let visibleSince = null;
let visibleMs = 0;
let lastTab = null;

function getIds() {
  if (ids) return ids;
  const ls = store('local'), ss = store('session');
  let vid = ls?.getItem('fi_vid');
  const newVisitor = !vid;
  // setItem throws when storage is full or refused (old Safari private mode)
  if (!vid) { vid = randomId(); try { ls?.setItem('fi_vid', vid); } catch { /* id lives for this page only */ } }
  let sid = ss?.getItem('fi_sid');
  if (!sid) { sid = randomId(); try { ss?.setItem('fi_sid', sid); } catch { /* same */ } }
  ids = { vid, sid, newVisitor };
  return ids;
}

function send(payload) {
  try {
    const body = JSON.stringify({ ...payload, vid: getIds().vid, sid: getIds().sid });
    // text/plain keeps sendBeacon a simple request; the server parses JSON
    if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }))) return;
    fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  } catch { /* analytics must never break the page */ }
}

/** Call once at startup with the tab that is showing. */
export function initAnalytics(initialTab) {
  // Runs first in boot(): nothing in here may throw into the app
  try { start(initialTab); } catch { /* analytics must never break the page */ }
}

function start(initialTab) {
  if (optedOut()) return;
  lastTab = initialTab || null;
  send({ kind: 'pageview', tab: lastTab, ref: document.referrer || '', newVisitor: getIds().newVisitor });
  if (document.visibilityState === 'visible') visibleSince = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      visibleSince = Date.now();
    } else {
      if (visibleSince) visibleMs += Date.now() - visibleSince;
      visibleSince = null;
      // Cumulative visible time so far; the server keeps the session maximum
      send({ kind: 'leave', tab: lastTab, secs: Math.round(visibleMs / 1000) });
    }
  });
}

/** Call on every tab switch. */
export function trackTab(tab) {
  if (optedOut() || !tab || tab === lastTab) return;
  lastTab = tab;
  send({ kind: 'tab', tab });
}
