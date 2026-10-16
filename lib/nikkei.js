// ═══════════════════════════════════════════════════════════
// NIKKEI 225 HEATMAP — drawn by us, because TradingView will not
// ═══════════════════════════════════════════════════════════
//
// TradingView withholds Japan from embedded heatmaps: a NI225 dataset is
// silently drawn as the S&P 500 (CLAUDE.md, heatmap datasets). So this
// heatmap is built from two real sources, both checked from Vercel's own
// network before anything was written (diag, 2026-10-16, region iad1):
//
//   Constituents, sectors and tile sizes — Nikkei Inc.'s own weight file,
//   nikkei_stock_average_weight_en.csv: every member's code, name, Nikkei
//   industry, sector and official index weight, dated (2026/09/30 on the
//   first pull). The HTML component page sits behind a Cloudflare
//   challenge that answers datacenters with 403; the CSV does not.
//
//   Day moves — Yahoo Finance's spark endpoint, 20 Tokyo symbols per
//   request ("7203.T", "285A.T"), which carries regularMarketPrice and
//   regularMarketChangePercent. The v7 quote endpoint answers 401 without
//   a crumb, so market caps are not available — and not needed: the
//   official weight IS the index's composition (price-weighted).
//
// Nothing is filled in. A constituent Yahoo did not quote is kept with a
// null move and listed in `integrity.missing`; a weight file whose header
// changed fails loudly with the fields it saw.
// ═══════════════════════════════════════════════════════════

import { fetchReason } from './fetch-reason.js';

export const NIKKEI_WEIGHTS_URL = 'https://indexes.nikkei.co.jp/en/nkave/archives/file/nikkei_stock_average_weight_en.csv';
export const NIKKEI_SOURCE = {
  name: 'Nikkei Inc. — Nikkei 225 constituents and index weights',
  url: 'https://indexes.nikkei.co.jp/en/nkave/index/component?idx=nk225',
};
export const QUOTES_SOURCE = {
  name: 'Yahoo Finance — Tokyo Stock Exchange quotes, delayed',
  url: 'https://finance.yahoo.com/quote/%5EN225/',
};
export const EXPECTED_CONSTITUENTS = 225;
export const SPARK_BATCH = 20;

// Nikkei's own sector order
export const SECTOR_ORDER = ['Technology', 'Financials', 'Consumer Goods', 'Materials', 'Capital Goods/Others', 'Transportation and Utilities', 'Information and Communications'];

// The request shape the diag confirmed from Vercel for both hosts — the
// weight file sits behind Cloudflare, so do not swap in a browser UA.
const UA = 'FelicityIntelligence/1.0 (+https://felicity-world-map.vercel.app)';

// A number only when Yahoo sent a real one: Number(null) is 0, and a JSON
// null turned into a "0.00%" tile or a Nikkei level of 0 is an invented
// figure. A price can never be zero or negative.
const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
const pos = v => { const n = num(v); return n != null && n > 0 ? n : null; };
// Tokyo calendar day of an ISO time (JST has no daylight saving)
export const tokyoDay = iso => (iso ? new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 10) : null);

async function timedFetch(url, ms, fetchImpl) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetchImpl(url, { signal: c.signal, headers: { 'User-Agent': UA, Accept: '*/*' } });
  } catch (e) {
    throw new Error(fetchReason(e, ms));
  } finally {
    clearTimeout(t);
  }
}

/** RFC-4180-ish CSV: quoted fields, "" escapes, commas inside quotes, CRLF. */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const s = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some(f => f !== '')) rows.push(row);
  return rows;
}

/**
 * The weight file → constituents. Throws when the header no longer names
 * the columns this depends on, rather than guessing which column is which.
 */
export function parseWeights(text) {
  if (/^\s*</.test(String(text || '').replace(/^\uFEFF/, ''))) throw new Error('Nikkei weight file came back as HTML, not CSV (a challenge page?)');
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('Nikkei weight file is empty');
  const header = rows[0].map(h => h.trim());
  const col = name => header.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const idx = {
    date: col('Date of Data'), code: col('Code'), name: col('Company Name'),
    industry: col('Nikkei Industrial Classification'), sector: col('Sector'), weight: col('Weight'),
  };
  const absent = Object.entries(idx).filter(([, i]) => i < 0).map(([k]) => k);
  // Bounded: the header is upstream text and travels to logs and the page
  if (absent.length) throw new Error(`Nikkei weight file schema changed: missing ${absent.join(', ')}; header was "${header.slice(0, 10).map(h => h.slice(0, 40)).join(' | ').slice(0, 300)}"`);

  const constituents = [];
  const seen = new Set();
  const notices = [];
  let rowsMalformed = 0, duplicates = 0;
  const dates = new Set();
  for (const r of rows.slice(1)) {
    // The file ends with Nikkei's copyright line, a single field: a notice
    // to carry, not a malformed constituent
    if (r.length === 1 && r[0].trim().length > 20) { notices.push(r[0].trim().slice(0, 300)); continue; }
    const code = (r[idx.code] || '').trim().toUpperCase();
    const weight = parseFloat(String(r[idx.weight] || '').replace('%', ''));
    if (!/^[0-9][0-9A-Z]{3}$/.test(code) || !Number.isFinite(weight)) { rowsMalformed++; continue; }
    if (seen.has(code)) { duplicates++; continue; }
    seen.add(code);
    const date = (r[idx.date] || '').trim();
    if (date) dates.add(date);
    constituents.push({
      code,
      name: (r[idx.name] || '').trim(),
      industry: (r[idx.industry] || '').trim(),
      sector: (r[idx.sector] || '').trim(),
      weightPct: weight,
    });
  }
  // "2026/09/30" → "2026-09-30"; more than one date in the file is reported, not hidden
  const asOf = [...dates].sort().pop()?.replace(/\//g, '-') || null;
  return { asOf, dates: [...dates].map(d => d.replace(/\//g, '-')), constituents, rowsMalformed, duplicates, notices };
}

export const yahooSymbol = code => `${code}.T`;

export function sparkUrl(symbols, host = 'query1.finance.yahoo.com') {
  return `https://${host}/v7/finance/spark?symbols=${encodeURIComponent(symbols.join(','))}&range=1d&interval=1d`;
}

/** Spark payload → { [symbol]: quote }. Only Yahoo's own day move is used. */
export function parseSpark(json) {
  const out = {};
  for (const r of json?.spark?.result || []) {
    const meta = r?.response?.[0]?.meta;
    if (!meta || !r.symbol) continue;
    const price = pos(meta.regularMarketPrice);
    const chg = num(meta.regularMarketChangePercent);
    const t = pos(meta.regularMarketTime);
    out[r.symbol] = {
      price,
      // No price means no move either: a change on a missing price is not evidence
      changePct: price != null && chg != null ? Math.round(chg * 100) / 100 : null,
      prevClose: pos(meta.chartPreviousClose),
      time: t ? new Date(t * 1000).toISOString() : null,
      currency: meta.currency || null,
      name: meta.shortName || meta.longName || null,
    };
  }
  return out;
}

// The weight file changes when Nikkei rebalances; a warm instance keeps
// the last good copy for six hours rather than refetching per visitor.
let weightsMemo = null;   // { at, parsed }
const WEIGHTS_TTL_MS = 6 * 3600 * 1000;

async function loadWeights(timeoutMs, fetchImpl, now) {
  if (weightsMemo && (now - weightsMemo.at < WEIGHTS_TTL_MS || now < (weightsMemo.retryAfter || 0))) {
    return { ...weightsMemo.parsed, cached: true, refreshError: weightsMemo.refreshError || null };
  }
  try {
    const r = await timedFetch(NIKKEI_WEIGHTS_URL, timeoutMs, fetchImpl);
    if (!r.ok) throw new Error(`Nikkei weight file HTTP ${r.status}`);
    const parsed = parseWeights(await r.text());
    if (!parsed.constituents.length) throw new Error('Nikkei weight file held no constituent rows');
    weightsMemo = { at: now, parsed };
    return { ...parsed, cached: false, refreshError: null };
  } catch (e) {
    // A dated copy already parsed on this instance beats "unavailable": it
    // is served with the refresh failure stated, and retried in ten minutes
    // rather than making every visitor wait out the timeout
    if (!weightsMemo) throw e;
    weightsMemo.retryAfter = now + 10 * 60e3;
    weightsMemo.refreshError = e.message;
    return { ...weightsMemo.parsed, cached: true, refreshError: e.message };
  }
}

// The last payload, shared by concurrent and back-to-back requests on a warm
// instance: a complete pull for two minutes, a partial one for thirty
// seconds, so a Yahoo throttle cannot turn every visit into twelve calls.
let payloadMemo = null;   // { at, payload, ttl }
let inflight = null;

export function _resetNikkeiMemo() { weightsMemo = null; payloadMemo = null; inflight = null; }

async function sparkBatch(symbols, timeoutMs, fetchImpl, deadline) {
  let lastError = 'no response';
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - Date.now();
      if (left < 500) return { quotes: {}, error: 'time budget exceeded', throttled: false };
      try {
        const r = await timedFetch(sparkUrl(symbols, host), Math.min(timeoutMs, left), fetchImpl);
        if (r.status === 429) {
          lastError = 'HTTP 429';
          if (attempt === 0) { await new Promise(res => setTimeout(res, 600)); continue; }
          // query2 shares the same per-IP throttle: stop here
          return { quotes: {}, error: lastError, throttled: true };
        }
        if (!r.ok) { lastError = `HTTP ${r.status}`; break; }
        return { quotes: parseSpark(await r.json()), error: null, throttled: false };
      } catch (e) {
        lastError = e.message;
        break;
      }
    }
  }
  return { quotes: {}, error: lastError, throttled: false };
}

/**
 * The full heatmap payload. Never throws for a quote outage — the tiles are
 * kept with null moves and the outage is in `integrity`. Throws only when
 * the constituent list itself cannot be read.
 */
export async function fetchNikkeiHeatmap(opts = {}) {
  const now = opts.now ?? Date.now();
  if (payloadMemo && now - payloadMemo.at < payloadMemo.ttl) {
    return { ...payloadMemo.payload, servedFromMemo: true, memoAgeSec: Math.round((now - payloadMemo.at) / 1000) };
  }
  if (inflight) return inflight;
  inflight = pullNikkeiHeatmap({ ...opts, now }).then(p => {
    payloadMemo = { at: now, payload: p, ttl: p.complete ? 120e3 : 30e3 };
    return p;
  }).finally(() => { inflight = null; });
  return inflight;
}

async function pullNikkeiHeatmap({ timeoutMs = 8000, fetchImpl = fetch, now = Date.now(), concurrency = 4, budgetMs = 25000 } = {}) {
  const deadline = Date.now() + budgetMs;
  const w = await loadWeights(Math.min(timeoutMs, budgetMs), fetchImpl, now);

  const symbols = ['^N225', ...w.constituents.map(c => yahooSymbol(c.code))];
  const batches = [];
  for (let i = 0; i < symbols.length; i += SPARK_BATCH) batches.push(symbols.slice(i, i + SPARK_BATCH));

  const quotes = {};
  const batchErrors = [];
  let next = 0, throttled = false;
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, async () => {
    while (next < batches.length) {
      const b = batches[next++];
      // Once Yahoo throttles this address, further batches only feed it
      if (throttled) { batchErrors.push('not asked: Yahoo was throttling (HTTP 429)'); continue; }
      const r = await sparkBatch(b, timeoutMs, fetchImpl, deadline);
      Object.assign(quotes, r.quotes);
      if (r.throttled) throttled = true;
      if (r.error) batchErrors.push(r.error);
    }
  }));

  const idx = quotes['^N225'];
  const allTimes = w.constituents.map(c => quotes[yahooSymbol(c.code)]?.time).filter(Boolean).sort();
  // The session the map describes: the index's own quote day in Tokyo (a
  // single bad constituent timestamp cannot move it), else the newest quote
  const sessionDay = tokyoDay(idx?.time || allTimes[allTimes.length - 1]);
  const tiles = w.constituents.map(c => {
    const q = quotes[yahooSymbol(c.code)];
    const day = tokyoDay(q?.time);
    return {
      ...c,
      symbol: yahooSymbol(c.code),
      price: q?.price ?? null,
      changePct: q?.changePct ?? null,
      time: q?.time ?? null,
      // Quoted, but its last trade is from an earlier session (halted, at a
      // daily limit with no trade, or not yet traded today): its move is not
      // today's, so it is drawn as such, not coloured as today
      stale: !!(q?.changePct != null && day && sessionDay && day < sessionDay),
    };
  });
  const missing = tiles.filter(t => t.changePct == null).map(t => t.code);
  const staleQuotes = tiles.filter(t => t.stale).map(t => ({ code: t.code, day: tokyoDay(t.time) }));
  const times = tiles.map(t => t.time).filter(Boolean).sort();

  const complete = tiles.length === EXPECTED_CONSTITUENTS && !missing.length && !staleQuotes.length && !batchErrors.length && !w.refreshError && !!idx?.price;
  return {
    ok: tiles.length > missing.length,
    complete,
    fetchedAt: new Date(now).toISOString(),
    sessionDay,
    index: idx && idx.price != null ? { level: idx.price, changePct: idx.changePct, time: idx.time } : null,
    weightsAsOf: w.asOf,
    tiles,
    sectors: [...SECTOR_ORDER.filter(s => tiles.some(t => t.sector === s)),
              ...[...new Set(tiles.map(t => t.sector))].filter(s => !SECTOR_ORDER.includes(s))],
    integrity: {
      constituents: tiles.length,
      expected: EXPECTED_CONSTITUENTS,
      quoted: tiles.length - missing.length,
      missing,
      weightSumPct: Math.round(tiles.reduce((s, t) => s + t.weightPct, 0) * 100) / 100,
      rowsMalformed: w.rowsMalformed,
      duplicates: w.duplicates,
      weightDates: w.dates,
      batches: batches.length,
      batchesFailed: batchErrors.length,
      batchErrors: [...new Set(batchErrors)],
      quotesFrom: times[0] || null,
      quotesTo: times[times.length - 1] || null,
      weightsCached: w.cached,
      weightsRefreshError: w.refreshError || null,
      notices: w.notices || [],
      staleQuotes,
      indexQuoted: !!idx?.price,
    },
    sources: { constituents: NIKKEI_SOURCE, quotes: QUOTES_SOURCE },
    method: 'Tiles are the Nikkei 225 constituents in Nikkei Inc.\'s weight file, sized by their official index weight on the file\'s date (the index is price-weighted, so this is not market cap) and coloured by Yahoo Finance\'s delayed move for the session. Constituents Yahoo did not quote, or whose last trade is from an earlier session, are hatched and listed — never coloured as today.',
  };
}
