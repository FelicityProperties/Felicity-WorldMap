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
export const SECTOR_ORDER = ['Technology', 'Financials', 'Consumer Goods', 'Materials', 'Capital Goods/Others', 'Transportation and Utilities'];

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

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
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('Nikkei weight file is empty');
  const header = rows[0].map(h => h.trim());
  const col = name => header.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const idx = {
    date: col('Date of Data'), code: col('Code'), name: col('Company Name'),
    industry: col('Nikkei Industrial Classification'), sector: col('Sector'), weight: col('Weight'),
  };
  const absent = Object.entries(idx).filter(([, i]) => i < 0).map(([k]) => k);
  if (absent.length) throw new Error(`Nikkei weight file schema changed: missing ${absent.join(', ')}; header was "${header.join(' | ')}"`);

  const constituents = [];
  const seen = new Set();
  let rowsMalformed = 0, duplicates = 0;
  const dates = new Set();
  for (const r of rows.slice(1)) {
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
  return { asOf, dates: [...dates].map(d => d.replace(/\//g, '-')), constituents, rowsMalformed, duplicates };
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
    const price = Number(meta.regularMarketPrice);
    const chg = Number(meta.regularMarketChangePercent);
    out[r.symbol] = {
      price: Number.isFinite(price) ? price : null,
      changePct: Number.isFinite(chg) ? Math.round(chg * 100) / 100 : null,
      prevClose: Number.isFinite(Number(meta.chartPreviousClose)) ? Number(meta.chartPreviousClose) : null,
      time: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
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
  if (weightsMemo && now - weightsMemo.at < WEIGHTS_TTL_MS) return { ...weightsMemo.parsed, cached: true };
  const r = await timedFetch(NIKKEI_WEIGHTS_URL, timeoutMs, fetchImpl);
  if (!r.ok) throw new Error(`Nikkei weight file HTTP ${r.status}`);
  const parsed = parseWeights(await r.text());
  if (!parsed.constituents.length) throw new Error('Nikkei weight file held no constituent rows');
  weightsMemo = { at: now, parsed };
  return { ...parsed, cached: false };
}

export function _resetNikkeiMemo() { weightsMemo = null; }

async function sparkBatch(symbols, timeoutMs, fetchImpl) {
  let lastError = 'no response';
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await timedFetch(sparkUrl(symbols, host), timeoutMs, fetchImpl);
        if (r.status === 429 && attempt === 0) { lastError = 'HTTP 429'; await new Promise(res => setTimeout(res, 600)); continue; }
        if (!r.ok) { lastError = `HTTP ${r.status}`; break; }
        return { quotes: parseSpark(await r.json()), error: null };
      } catch (e) {
        lastError = e.message;
        break;
      }
    }
  }
  return { quotes: {}, error: lastError };
}

/**
 * The full heatmap payload. Never throws for a quote outage — the tiles are
 * kept with null moves and the outage is in `integrity`. Throws only when
 * the constituent list itself cannot be read.
 */
export async function fetchNikkeiHeatmap({ timeoutMs = 8000, fetchImpl = fetch, now = Date.now(), concurrency = 4 } = {}) {
  const w = await loadWeights(timeoutMs, fetchImpl, now);

  const symbols = ['^N225', ...w.constituents.map(c => yahooSymbol(c.code))];
  const batches = [];
  for (let i = 0; i < symbols.length; i += SPARK_BATCH) batches.push(symbols.slice(i, i + SPARK_BATCH));

  const quotes = {};
  const batchErrors = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, async () => {
    while (next < batches.length) {
      const b = batches[next++];
      const { quotes: q, error } = await sparkBatch(b, timeoutMs, fetchImpl);
      Object.assign(quotes, q);
      if (error) batchErrors.push(error);
    }
  }));

  const tiles = w.constituents.map(c => {
    const q = quotes[yahooSymbol(c.code)];
    return {
      ...c,
      symbol: yahooSymbol(c.code),
      price: q?.price ?? null,
      changePct: q?.changePct ?? null,
      time: q?.time ?? null,
    };
  });
  const missing = tiles.filter(t => t.changePct == null).map(t => t.code);
  const times = tiles.map(t => t.time).filter(Boolean).sort();
  const idx = quotes['^N225'];

  return {
    ok: tiles.length > missing.length,
    fetchedAt: new Date(now).toISOString(),
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
    },
    sources: { constituents: NIKKEI_SOURCE, quotes: QUOTES_SOURCE },
    method: 'Tiles are the Nikkei 225 constituents in Nikkei Inc.\'s weight file, sized by their official index weight on the file\'s date and coloured by Yahoo Finance\'s delayed day move. Constituents Yahoo did not quote are drawn grey and listed.',
  };
}
