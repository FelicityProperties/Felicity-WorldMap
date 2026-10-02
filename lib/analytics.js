// ═══════════════════════════════════════════════════════════
// ANALYTICS — first-party visit tracking, owner-only reporting
// ═══════════════════════════════════════════════════════════
//
// What is stored, per event, in Postgres (`analytics_events`):
//   time, kind (pageview | tab | leave), tab, referrer host, country /
//   region / city from Vercel's edge geo headers, device / browser / OS
//   parsed from the user agent, a random first-party visitor id and
//   session id the page keeps in localStorage / sessionStorage, and the
//   seconds visible (on `leave`).
//
// What is NOT stored: the IP address, the full user-agent string, the
// full referrer URL (only its host), or anything a visitor typed. Bots,
// crawlers, link-preview fetchers and headless browsers are dropped
// before the database. Visitors whose browser sends Do-Not-Track or
// Global Privacy Control are not tracked at all (enforced in the page).
//
// Reporting is behind ANALYTICS_KEY (a Vercel env var); without it the
// stats endpoint refuses rather than serving anyone's data.
// ═══════════════════════════════════════════════════════════

export const KINDS = new Set(['pageview', 'tab', 'leave']);
export const TABS = new Set(['overview', 'worldmap', 'invest', 'dubai', 'signals', 'broadcasts', 'hormuz']);
export const RANGES = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 };
const RETAIN_DAYS = 400;

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|whatsapp|telegram|discord|slack|headless|lighthouse|pagespeed|vercel|curl|wget|python|go-http|node-fetch|axios|java\/|okhttp|monitor|uptime|pingdom|phantom|puppeteer|playwright|selenium/i;

export const isBot = ua => !ua || BOT.test(ua);

/** Coarse device / browser / OS from a user-agent; the string itself is never stored. */
export function parseUA(ua = '') {
  const s = String(ua);
  const device = /iPad|Tablet|Nexus 7|SM-T|Kindle/i.test(s) ? 'tablet'
    : /Mobi|iPhone|Android/i.test(s) ? 'mobile' : 'desktop';
  const browser = /Edg\//.test(s) ? 'Edge'
    : /OPR\/|Opera/.test(s) ? 'Opera'
    : /SamsungBrowser/.test(s) ? 'Samsung Internet'
    : /Firefox\/|FxiOS/.test(s) ? 'Firefox'
    : /Chrome\/|CriOS/.test(s) ? 'Chrome'
    : /Safari\//.test(s) ? 'Safari' : 'Other';
  const os = /Windows/.test(s) ? 'Windows'
    : /iPhone|iPad|iPod/.test(s) ? 'iOS'
    : /Mac OS X|Macintosh/.test(s) ? 'macOS'
    : /Android/.test(s) ? 'Android'
    : /CrOS/.test(s) ? 'ChromeOS'
    : /Linux/.test(s) ? 'Linux' : 'Other';
  return { device, browser, os };
}

/** Host of a referrer, or '' for direct / same-site / unparseable. */
export function refHost(ref, siteHost) {
  try {
    const h = new URL(String(ref)).hostname.replace(/^www\./, '').toLowerCase();
    if (!h || h === String(siteHost || '').replace(/^www\./, '').toLowerCase()) return '';
    return h.slice(0, 80);
  } catch {
    return '';
  }
}

const idOk = v => typeof v === 'string' && /^[A-Za-z0-9_-]{8,40}$/.test(v);

/**
 * Validate a beacon body and the request it came on into a row, or explain
 * why not. Pure, so the test can pin it.
 */
export function buildEvent(body, headers, siteHost) {
  const get = k => (typeof headers.get === 'function' ? headers.get(k) : headers[k]) || '';
  const ua = get('user-agent');
  if (isBot(ua)) return { skip: 'bot' };
  if (!body || typeof body !== 'object') return { skip: 'bad body' };
  if (!KINDS.has(body.kind)) return { skip: 'bad kind' };
  if (!idOk(body.vid) || !idOk(body.sid)) return { skip: 'bad ids' };
  const tab = TABS.has(body.tab) ? body.tab : null;
  const secs = body.kind === 'leave' ? Math.max(0, Math.min(6 * 3600, Math.round(Number(body.secs) || 0))) : null;
  const dec = v => { try { return decodeURIComponent(v); } catch { return v; } };
  const { device, browser, os } = parseUA(ua);
  return {
    event: {
      kind: body.kind,
      tab,
      ref: body.kind === 'pageview' ? refHost(body.ref, siteHost) : '',
      country: get('x-vercel-ip-country').slice(0, 2).toUpperCase(),
      region: dec(get('x-vercel-ip-country-region')).slice(0, 40),
      city: dec(get('x-vercel-ip-city')).slice(0, 60),
      device, browser, os,
      visitor: body.vid,
      session: body.sid,
      secs,
      isNew: body.kind === 'pageview' && body.newVisitor === true,
    },
  };
}

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

// Once per isolate: a CREATE … IF NOT EXISTS on every beacon cost two extra
// round trips and took a lock that queued concurrent inserts. A failure
// clears the memo so the next call retries.
let tableReady = null;
function ensureTable(sql) {
  if (!tableReady) tableReady = createTable(sql).catch(e => { tableReady = null; throw e; });
  return tableReady;
}

async function createTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id       BIGSERIAL PRIMARY KEY,
      ts       TIMESTAMPTZ NOT NULL DEFAULT now(),
      kind     TEXT NOT NULL,
      tab      TEXT,
      ref      TEXT,
      country  TEXT,
      region   TEXT,
      city     TEXT,
      device   TEXT,
      browser  TEXT,
      os       TEXT,
      visitor  TEXT NOT NULL,
      session  TEXT NOT NULL,
      secs     INTEGER,
      is_new   BOOLEAN NOT NULL DEFAULT false
    )`;
  await sql`CREATE INDEX IF NOT EXISTS analytics_events_ts ON analytics_events (ts)`;
}

/** Store one event. Failures are returned, never thrown. */
export async function recordEvent(e) {
  const sql = await sqlClient();
  if (!sql) return { stored: false, reason: 'DATABASE_URL not configured' };
  try {
    await ensureTable(sql);
    await sql`INSERT INTO analytics_events (kind, tab, ref, country, region, city, device, browser, os, visitor, session, secs, is_new)
              VALUES (${e.kind}, ${e.tab}, ${e.ref}, ${e.country}, ${e.region}, ${e.city}, ${e.device}, ${e.browser}, ${e.os}, ${e.visitor}, ${e.session}, ${e.secs}, ${e.isNew})`;
    // Prune now and then rather than on a schedule
    if (Math.floor(Date.now() / 1000) % 97 === 0) await sql`DELETE FROM analytics_events WHERE ts < now() - make_interval(days => ${RETAIN_DAYS})`;
    return { stored: true };
  } catch (err) {
    console.warn('[analytics] not stored:', err.message);
    return { stored: false, reason: err.message };
  }
}

/**
 * One point per hour/day from `since` to `now` (UTC, as date_trunc buckets
 * them). The query only returns buckets with events, so a quiet day used to
 * vanish and the chart's even spacing hid the gap; it is now a real zero.
 */
export function fillSeries(rows, since, now, bucket) {
  const step = bucket === 'hour' ? 3600000 : 86400000;
  const by = new Map(rows.map(r => [new Date(r.t).getTime(), r]));
  const out = [];
  for (let t = Math.floor(Date.parse(since) / step) * step; t <= Date.parse(now); t += step) {
    const r = by.get(t);
    out.push({ t: new Date(t).toISOString(), pageviews: Number(r?.pageviews || 0), visitors: Number(r?.visitors || 0) });
  }
  return out;
}

/** Everything the dashboard shows for a range. Throws on a database failure. */
export async function readStats(range = '7d') {
  const sql = await sqlClient();
  if (!sql) throw new Error('DATABASE_URL not configured');
  await ensureTable(sql);
  const days = RANGES[range] || 7;
  const hourly = days === 1;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const bucket = hourly ? 'hour' : 'day';

  const [totals, series, countries, cities, refs, tabs, devices, browsers, oses, recent, live] = await Promise.all([
    sql`SELECT
          count(*) FILTER (WHERE kind = 'pageview')                         AS pageviews,
          count(DISTINCT visitor)                                            AS visitors,
          count(DISTINCT visitor) FILTER (WHERE is_new)                      AS new_visitors,
          count(DISTINCT session)                                            AS sessions,
          count(*) FILTER (WHERE kind = 'tab')                               AS tab_views,
          round(avg(secs) FILTER (WHERE kind = 'leave' AND secs > 0))        AS avg_secs
        FROM analytics_events WHERE ts >= ${since}`,
    sql`SELECT date_trunc(${bucket}, ts) AS t,
               count(*) FILTER (WHERE kind = 'pageview') AS pageviews,
               count(DISTINCT visitor) AS visitors
        FROM analytics_events WHERE ts >= ${since} GROUP BY 1 ORDER BY 1`,
    sql`SELECT country AS k, count(DISTINCT visitor) AS n FROM analytics_events WHERE ts >= ${since} AND country <> '' GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    sql`SELECT city || CASE WHEN country <> '' THEN ', ' || country ELSE '' END AS k, count(DISTINCT visitor) AS n FROM analytics_events WHERE ts >= ${since} AND city <> '' GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    sql`SELECT CASE WHEN ref = '' THEN 'Direct / unknown' ELSE ref END AS k, count(*) AS n FROM analytics_events WHERE ts >= ${since} AND kind = 'pageview' GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    sql`SELECT tab AS k, count(*) AS n FROM analytics_events WHERE ts >= ${since} AND kind IN ('pageview', 'tab') AND tab IS NOT NULL GROUP BY 1 ORDER BY 2 DESC`,
    sql`SELECT device AS k, count(DISTINCT visitor) AS n FROM analytics_events WHERE ts >= ${since} GROUP BY 1 ORDER BY 2 DESC`,
    sql`SELECT browser AS k, count(DISTINCT visitor) AS n FROM analytics_events WHERE ts >= ${since} GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
    sql`SELECT os AS k, count(DISTINCT visitor) AS n FROM analytics_events WHERE ts >= ${since} GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
    sql`SELECT session, min(ts) AS started, max(ts) AS last_seen,
               max(country) AS country, max(city) AS city, max(device) AS device, max(browser) AS browser, max(os) AS os,
               max(ref) AS ref, bool_or(is_new) AS is_new,
               count(*) FILTER (WHERE kind IN ('pageview', 'tab')) AS views,
               max(secs) AS secs,
               string_agg(DISTINCT tab, ', ') AS tabs
        FROM analytics_events WHERE ts >= ${since}
        GROUP BY session ORDER BY max(ts) DESC LIMIT 60`,
    sql`SELECT count(DISTINCT visitor) AS n FROM analytics_events WHERE ts >= now() - interval '5 minutes'`,
  ]);

  const num = v => (v == null ? null : Number(v));
  const list = rows => rows.map(r => ({ k: r.k, n: Number(r.n) }));
  const t = totals[0] || {};
  return {
    ok: true,
    range,
    generatedAt: new Date().toISOString(),
    totals: {
      pageviews: num(t.pageviews) || 0,
      visitors: num(t.visitors) || 0,
      newVisitors: num(t.new_visitors) || 0,
      sessions: num(t.sessions) || 0,
      tabViews: num(t.tab_views) || 0,
      avgSecs: num(t.avg_secs),
      liveNow: num(live[0]?.n) || 0,
    },
    bucket,
    series: fillSeries(series, since, new Date().toISOString(), bucket),
    countries: list(countries),
    cities: list(cities),
    referrers: list(refs),
    tabs: list(tabs),
    devices: list(devices),
    browsers: list(browsers),
    os: list(oses),
    recent: recent.map(r => ({
      started: new Date(r.started).toISOString(),
      lastSeen: new Date(r.last_seen).toISOString(),
      country: r.country || '', city: r.city || '',
      device: r.device || '', browser: r.browser || '', os: r.os || '',
      ref: r.ref || '', isNew: !!r.is_new,
      views: Number(r.views) || 0,
      secs: num(r.secs),
      tabs: r.tabs || '',
    })),
  };
}
