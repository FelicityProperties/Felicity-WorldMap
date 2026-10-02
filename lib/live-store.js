// ═══════════════════════════════════════════════════════════
// LIVE STORE — relayed feed payloads, one row per kind
// ═══════════════════════════════════════════════════════════
//
// OpenSky and GDELT drop TCP connections from every Vercel network (the
// diag showed UND_ERR_CONNECT_TIMEOUT from both the Node runtime in iad1
// and the Edge runtime in bom1 while Yahoo answered in under 100 ms). So
// those feeds are fetched by a GitHub Actions runner on a schedule
// (.github/workflows/live-layers.yml → scripts/live-layers-push.mjs) and
// pushed here through POST /api/data?layer=ingest with a shared token.
// The site serves the stored copy with the runner's own fetch time, so
// the age is always visible; nothing is invented between pushes.
//
// Postgres (DATABASE_URL, table created on demand). Works on both the
// Node and Edge runtimes through @neondatabase/serverless.
// ═══════════════════════════════════════════════════════════

export const KINDS = new Set(['flights', 'events', 'hormuz-headlines']);

async function sqlClient() {
  const cs = process.env.DATABASE_URL;
  if (!cs) return null;
  try {
    const { neon } = await import('@neondatabase/serverless');
    return neon(cs);
  } catch {
    return null;
  }
}

// Once per isolate (a failure clears the memo): every map request reads
// this table, and a CREATE … IF NOT EXISTS per read was a wasted round trip.
let tableReady = null;
function ensureTable(sql) {
  if (!tableReady) tableReady = createTable(sql).catch(e => { tableReady = null; throw e; });
  return tableReady;
}

async function createTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS live_layers (
      kind        TEXT PRIMARY KEY,
      fetched_at  TIMESTAMPTZ NOT NULL,
      payload     JSONB NOT NULL
    )`;
}

/** Store a relayed payload. Failures are returned, never thrown. */
export async function writeLayer(kind, payload) {
  if (!KINDS.has(kind)) return { stored: false, reason: `unknown kind ${kind}` };
  const sql = await sqlClient();
  if (!sql) return { stored: false, reason: 'DATABASE_URL not configured' };
  try {
    await ensureTable(sql);
    const fetchedAt = payload.fetchedAt || new Date().toISOString();
    await sql`INSERT INTO live_layers (kind, fetched_at, payload) VALUES (${kind}, ${fetchedAt}, ${JSON.stringify(payload)}::jsonb)
              ON CONFLICT (kind) DO UPDATE SET fetched_at = EXCLUDED.fetched_at, payload = EXCLUDED.payload`;
    return { stored: true, fetchedAt };
  } catch (e) {
    console.warn(`[live-store] ${kind} not stored:`, e.message);
    return { stored: false, reason: e.message };
  }
}

/** The stored payload for a kind, with its age in minutes, or null. */
export async function readLayer(kind) {
  const sql = await sqlClient();
  if (!sql) return null;
  try {
    await ensureTable(sql);
    const rows = await sql`SELECT fetched_at, payload FROM live_layers WHERE kind = ${kind}`;
    if (!rows.length) return null;
    const fetchedAt = new Date(rows[0].fetched_at).toISOString();
    return { payload: rows[0].payload, fetchedAt, ageMin: Math.round((Date.now() - Date.parse(fetchedAt)) / 60000) };
  } catch (e) {
    console.warn(`[live-store] ${kind} not read:`, e.message);
    return null;
  }
}

/** Constant-time-ish token check; never leaks which byte differed. */
export function tokenMatches(given, expected) {
  if (!given || !expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
