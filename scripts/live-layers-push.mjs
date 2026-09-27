// Fetches the live map layers from a network that OpenSky and GDELT accept
// (a GitHub Actions runner) and pushes them into the site's store.
//
//   LIVE_LAYERS_TOKEN   shared secret, also set on Vercel
//   LIVE_LAYERS_ORIGIN  site origin (default https://felicity-world-map.vercel.app)
//   OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET   optional, raises the OpenSky quota
//
// The first step is a probe of each upstream that prints status or the
// connection-level reason, so the run log doubles as the diagnostic. A
// feed that fails is reported and skipped — nothing stale is re-pushed
// and nothing is invented. Exit code is non-zero if every feed failed.

import { fetchFlights, fetchEvents } from '../lib/live-layers.js';
import { fetchHormuzHeadlines } from '../lib/hormuz.js';
import { fetchReason } from '../lib/fetch-reason.js';

const ORIGIN = process.env.LIVE_LAYERS_ORIGIN || 'https://felicity-world-map.vercel.app';
const TOKEN = process.env.LIVE_LAYERS_TOKEN || '';

async function probe(name, url) {
  const t0 = Date.now();
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), 15000);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { Accept: '*/*', 'User-Agent': 'FelicityIntelligence/1.0 (+https://felicity-world-map.vercel.app)' } });
    const body = await r.text();
    console.log(`probe ${name.padEnd(12)} HTTP ${r.status} ${body.length} bytes in ${Date.now() - t0} ms`);
  } catch (e) {
    console.log(`probe ${name.padEnd(12)} FAILED ${fetchReason(e, 15000)} after ${Date.now() - t0} ms`);
  } finally {
    clearTimeout(timer);
  }
}

async function push(kind, payload) {
  if (!TOKEN) { console.log(`push  ${kind.padEnd(16)} skipped: LIVE_LAYERS_TOKEN not set`); return false; }
  const r = await fetch(`${ORIGIN}/api/data?layer=ingest&kind=${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  console.log(`push  ${kind.padEnd(16)} HTTP ${r.status} ${text.slice(0, 160)}`);
  return r.ok;
}

console.log('── probes ──');
await probe('opensky', 'https://opensky-network.org/api/states/all?lamin=24&lomin=54&lamax=26&lomax=56');
await probe('gdelt-export', 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt');
await probe('gdelt-doc', 'https://api.gdeltproject.org/api/v2/doc/doc?query=%22Strait%20of%20Hormuz%22&mode=ArtList&format=json&maxrecords=1');
await probe('google-news', 'https://news.google.com/rss/search?q=%22Strait+of+Hormuz%22&hl=en-US&gl=US&ceid=US:en');

console.log('── feeds ──');
// GDELT answers a shared runner address with 429s and dropped connects
// some of the time; a couple of spaced retries recover most runs.
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function attempt(run, tries, gapMs) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try { return await run(); } catch (e) { last = e; if (i < tries) { console.log(`      retry ${i}/${tries - 1} after: ${e.message}`); await sleep(gapMs); } }
  }
  throw last;
}
const jobs = [
  ['flights', () => fetchFlights({ clientId: process.env.OPENSKY_CLIENT_ID, clientSecret: process.env.OPENSKY_CLIENT_SECRET, timeoutMs: 25000 }), 1],
  ['events', () => fetchEvents({ timeoutMs: 25000 }), 3],
  ['hormuz-headlines', () => fetchHormuzHeadlines({ timeoutMs: 25000 }), 2],
];
let okCount = 0;
for (const [kind, run, tries] of jobs) {
  try {
    const payload = await attempt(run, tries, 15000);
    const n = payload.count ?? payload.headlines?.length ?? '?';
    console.log(`fetch ${kind.padEnd(16)} ok · ${n} items · fetchedAt ${payload.fetchedAt}`);
    if (await push(kind, payload)) okCount++;
  } catch (e) {
    console.log(`fetch ${kind.padEnd(16)} FAILED ${e.message}`);
  }
}
if (!okCount) { console.log('no feed relayed'); process.exit(TOKEN ? 1 : 0); }
