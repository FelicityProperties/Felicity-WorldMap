// ═══════════════════════════════════════════════════════════
// NIKKEI 225 HEATMAP — drawn by us, sized by Nikkei's official weights
// ═══════════════════════════════════════════════════════════
//
// TradingView withholds Japan from embeds (a NI225 dataset is drawn as the
// S&P 500), so /api/invest/nikkei-heatmap serves the 225 constituents from
// Nikkei Inc.'s weight file with Yahoo's delayed moves (lib/nikkei.js).
// The drawing is shared with the other own-drawn maps (js/own-heatmap.js);
// what is Nikkei's own is here: tiles are sized by the official index
// weight, rounded (the index is price-weighted, so size is not market cap),
// exact weights are never printed, and the map credits © Nikkei Inc.
// ═══════════════════════════════════════════════════════════

import { mountOwnHeatmap, tileHtml as ownTileHtml, fmtPct, fmtTime, shortName } from './own-heatmap.js';
import { escapeHtml, safeUrl } from './safe.js';

export { moveColour, shortName, layout } from './own-heatmap.js';

const fmtYen = v => v == null ? '—' : `¥${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
const fmtTokyo = iso => fmtTime(iso, 'Asia/Tokyo', 'Tokyo');

/** One line a reader can act on — the button's label and the screen-reader echo. */
export function tileSummary(t) {
  const move = t.changePct == null ? 'no quote from Yahoo'
    : t.stale ? `no trade this session — last move ${fmtPct(t.changePct)} on ${fmtTokyo(t.time)}`
    : fmtPct(t.changePct);
  // No weight figure: exact Nikkei weights are not published on this site
  return `${t.name} (${t.code}) · ${t.industry} · ${fmtYen(t.price)} · ${move}`;
}

export const tileHtml = (t, minFont = 9) => ownTileHtml(t, minFont, tileSummary);

function statusHtml(data) {
  const i = data.integrity || {};
  const gaps = (i.missing?.length || 0) + (i.staleQuotes?.length || 0);
  return `${escapeHtml(String(i.quoted))}/${escapeHtml(String(i.constituents))} quoted${gaps ? ` · ${gaps} hatched` : ''} · weights ${escapeHtml(data.weightsAsOf || '—')}, rounded`;
}

function aboutHtml(data) {
  const i = data.integrity || {};
  const s = data.sources || {};
  const notes = [];
  if (i.constituents !== i.expected) notes.push(`<strong>The weight file lists ${escapeHtml(String(i.constituents))}, not ${escapeHtml(String(i.expected))}.</strong>`);
  if (i.missing?.length) notes.push(`Not quoted by Yahoo, hatched: ${i.missing.map(escapeHtml).join(', ')}${i.batchErrors?.length ? ` (${escapeHtml(i.batchErrors.join('; '))})` : ''}.`);
  if (i.staleQuotes?.length) notes.push(`No trade yet this session (${escapeHtml(data.sessionDay || '')}), hatched: ${i.staleQuotes.map(q => `${escapeHtml(q.code)} (last ${escapeHtml(q.day || '—')})`).join(', ')}.`);
  if (i.weightsRefreshError) notes.push(`<strong>Nikkei's weight file could not be refreshed (${escapeHtml(i.weightsRefreshError)}); showing the copy dated ${escapeHtml(data.weightsAsOf || '—')}.</strong>`);
  if (i.weightsSumOk === false) notes.push('<strong>The weight file does not sum to 100%.</strong>');
  if (data.servedFromMemo) notes.push(`Pulled ${escapeHtml(String(data.memoAgeSec))}s ago.`);
  return `<p>${notes.join(' ')} Tiles are the Nikkei 225's constituents, grouped by Nikkei sector and sized by Nikkei's official index weight on ${escapeHtml(data.weightsAsOf || '—')}, rounded — exact weights are not shown. The Nikkei is price-weighted, so size is not market cap. Colour is the session's move from delayed Yahoo Finance quotes; ±3% saturates.</p>
    <p>Constituents and weights © Nikkei Inc.${i.notices?.length ? ` — ${escapeHtml(i.notices[0])}` : ''}</p>
    <p>Sources: <a href="${safeUrl(s.constituents?.url)}" target="_blank" rel="noopener">${escapeHtml(s.constituents?.name || 'Nikkei Inc.')}</a> · <a href="${safeUrl(s.quotes?.url)}" target="_blank" rel="noopener">${escapeHtml(s.quotes?.name || 'Yahoo Finance')}</a>. Drawn by Felicity — TradingView does not serve Japan to embedded heatmaps.</p>`;
}

// The hover / tap card, like TradingView's symbol tooltip
function tipHtml(t) {
  const move = t.changePct == null ? 'No quote from Yahoo'
    : t.stale ? `No trade this session · last ${fmtPct(t.changePct)}` : fmtPct(t.changePct);
  const cls = t.changePct == null || t.stale ? '' : t.changePct >= 0 ? ' is-up' : ' is-down';
  return `<div class="nkhm__tip-name">${escapeHtml(shortName(t.name))} <span>${escapeHtml(t.code)}</span></div>
    <div class="nkhm__tip-move${cls}">${escapeHtml(move)}</div>
    <div class="nkhm__tip-meta">${escapeHtml(fmtYen(t.price))} · ${escapeHtml(t.industry)}</div>
    <div class="nkhm__tip-meta">${escapeHtml(t.name)}</div>`;
}

export function mountNikkeiHeatmap(host) {
  mountOwnHeatmap(host, {
    id: 'nikkei225',
    api: '/api/invest/nikkei-heatmap',
    title: 'Nikkei 225',
    loading: "loading Nikkei's constituent file and Tokyo quotes…",
    aria: "Nikkei 225 heatmap: constituents sized by official index weight, coloured by the session's move",
    credit: '© Nikkei Inc.',
    sizeBasis: 'index weight',
    delayedTitle: 'Yahoo Finance Tokyo quotes are delayed',
    when: d => fmtTokyo(d.integrity?.quotesTo || d.index?.time),
    summary: tileSummary,
    tip: tipHtml,
    status: statusHtml,
    about: aboutHtml,
  });
}
