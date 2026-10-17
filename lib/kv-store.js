// A small key → JSON store in Postgres (DATABASE_URL, table created on
// demand), for state that must outlive a serverless instance but is not a
// feed: the index heatmaps' last good constituent lists and the ISIN →
// Yahoo symbol map the STOXX Europe 600 needs (lib/index-heatmap.js).
// Without a database every call is a no-op that says so; nothing throws.

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

let tableReady = null;
function ensureTable(sql) {
  if (!tableReady) {
    tableReady = sql`CREATE TABLE IF NOT EXISTS kv_store (
      key         TEXT PRIMARY KEY,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      value       JSONB NOT NULL
    )`.catch(e => { tableReady = null; throw e; });
  }
  return tableReady;
}

/** { value, updatedAt } or null (no database, no row, or a read error). */
export async function kvGet(key) {
  const sql = await sqlClient();
  if (!sql) return null;
  try {
    await ensureTable(sql);
    const rows = await sql`SELECT value, updated_at FROM kv_store WHERE key = ${key}`;
    return rows.length ? { value: rows[0].value, updatedAt: new Date(rows[0].updated_at).toISOString() } : null;
  } catch (e) {
    console.warn(`[kv-store] ${key} not read:`, e.message);
    return null;
  }
}

/** Like kvGet, but a failed read throws (so a caller can tell it from "no row"). */
export async function kvGetStrict(key) {
  const sql = await sqlClient();
  if (!sql) return null;
  await ensureTable(sql);
  const rows = await sql`SELECT value, updated_at FROM kv_store WHERE key = ${key}`;
  return rows.length ? { value: rows[0].value, updatedAt: new Date(rows[0].updated_at).toISOString() } : null;
}

/**
 * Merge keys into a stored JSON object (jsonb ||), so two instances adding
 * entries at once do not overwrite each other. A null value marks an entry
 * withdrawn. Returns { stored, reason? }; never throws.
 */
export async function kvMerge(key, entries) {
  const sql = await sqlClient();
  if (!sql) return { stored: false, reason: 'DATABASE_URL not configured' };
  try {
    await ensureTable(sql);
    await sql`INSERT INTO kv_store (key, updated_at, value) VALUES (${key}, now(), ${JSON.stringify(entries)}::jsonb)
              ON CONFLICT (key) DO UPDATE SET updated_at = now(), value = kv_store.value || EXCLUDED.value`;
    return { stored: true };
  } catch (e) {
    console.warn(`[kv-store] ${key} not merged:`, e.message);
    return { stored: false, reason: e.message };
  }
}

/** Store a value. Returns { stored, reason? }; never throws. */
export async function kvSet(key, value) {
  const sql = await sqlClient();
  if (!sql) return { stored: false, reason: 'DATABASE_URL not configured' };
  try {
    await ensureTable(sql);
    await sql`INSERT INTO kv_store (key, updated_at, value) VALUES (${key}, now(), ${JSON.stringify(value)}::jsonb)
              ON CONFLICT (key) DO UPDATE SET updated_at = now(), value = EXCLUDED.value`;
    return { stored: true };
  } catch (e) {
    console.warn(`[kv-store] ${key} not stored:`, e.message);
    return { stored: false, reason: e.message };
  }
}
