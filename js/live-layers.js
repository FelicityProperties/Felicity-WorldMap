// ═══════════════════════════════════════════════════════════
// LIVE LAYERS (client) — flights and events for the World Map
// ═══════════════════════════════════════════════════════════
//
// Fills the `flights` and `events` arrays from /api/data?layer=… and
// keeps a meta record per layer (when it was fetched, what the feed said
// its own timestamp was, why it failed). The map and the sidebar read
// the arrays; the meta is what lets them say LIVE, STALE or unavailable
// truthfully. Nothing is seeded: before the first fetch both are empty.
//
// Polling belongs to the startPolling/stopPolling pair in app.js so a
// hidden tab spends nothing.
// ═══════════════════════════════════════════════════════════

import { flights, events } from './data.js';

export const layerMeta = {
  flights: { ok: false, fetchedAt: null, asOf: null, error: 'not fetched yet', source: null, auth: null, count: 0 },
  events:  { ok: false, fetchedAt: null, error: 'not fetched yet', source: null, count: 0, window: '24h' },
};

async function pull(layer) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 20000);
  try {
    const r = await fetch(`/api/data?layer=${layer}`, { signal: c.signal });
    const d = await r.json();
    if (!d || !d.ok) throw new Error((d && d.error) || `HTTP ${r.status}`);
    return d;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchLiveFlights() {
  try {
    const d = await pull('flights');
    if (!Array.isArray(d.flights)) throw new Error('payload had no flights array');
    flights.length = 0;
    flights.push(...d.flights);
    Object.assign(layerMeta.flights, { ok: true, fetchedAt: d.fetchedAt, asOf: d.asOf, error: null, source: d.source, auth: d.auth, count: d.count, received: d.received, onGround: d.onGround, noPosition: d.noPosition });
    return true;
  } catch (e) {
    // Previous real positions stand; the meta says the refresh failed
    Object.assign(layerMeta.flights, { ok: false, error: e.message });
    return false;
  }
}

export async function fetchLiveEvents() {
  try {
    const d = await pull('events');
    if (!Array.isArray(d.events)) throw new Error('payload had no events array');
    events.length = 0;
    events.push(...d.events);
    Object.assign(layerMeta.events, { ok: true, fetchedAt: d.fetchedAt, error: null, source: d.source, count: d.count, window: d.window });
    return true;
  } catch (e) {
    Object.assign(layerMeta.events, { ok: false, error: e.message });
    return false;
  }
}

let flightsTimer = null, eventsTimer = null;

// Flights every 10 minutes, events every 15: both endpoints are edge-cached
// longer than that, so a client can never make the upstream spend more.
export function startLiveLayersRefresh(onUpdate) {
  fetchLiveFlights().then(ok => onUpdate && onUpdate('flights', ok));
  fetchLiveEvents().then(ok => onUpdate && onUpdate('events', ok));
  flightsTimer = setInterval(async () => onUpdate && onUpdate('flights', await fetchLiveFlights()), 10 * 60 * 1000);
  eventsTimer = setInterval(async () => onUpdate && onUpdate('events', await fetchLiveEvents()), 15 * 60 * 1000);
}

export function stopLiveLayersRefresh() {
  if (flightsTimer) { clearInterval(flightsTimer); flightsTimer = null; }
  if (eventsTimer) { clearInterval(eventsTimer); eventsTimer = null; }
}
