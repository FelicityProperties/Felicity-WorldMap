// ═══════════════════════════════════════════════════════════
// INDEX HEATMAPS — the sixteen withheld markets, sized by market cap
// ═══════════════════════════════════════════════════════════
//
// /api/invest/index-heatmap?market=… (lib/index-heatmap.js) serves each
// index's members from its dated constituent list with Yahoo's delayed
// price, move, market cap and sector. This file only describes them; the
// drawing is shared with the Nikkei map (js/own-heatmap.js).
//
// Size is market capitalisation, as on TradingView's own heatmaps — not
// index weight. Every figure in a card is one the server fetched; a
// member it could not quote or size is listed in the About panel, never
// drawn at an invented size.
// ═══════════════════════════════════════════════════════════

import { mountOwnHeatmap, fmtPct, fmtTime, shortName } from './own-heatmap.js';
import { escapeHtml, safeUrl } from './safe.js';

const fmtNum = v => v.toLocaleString('en-US', { maximumFractionDigits: v < 10 ? 3 : 2 });
const fmtPrice = t => (t.price == null ? '—' : `${fmtNum(t.price)} ${t.currency || ''}`.trim());
export function fmtCap(v, cur) {
  if (v == null || !Number.isFinite(v)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(v);
  } catch {
    return `${cur} ${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v)}`;
  }
}

const when = d => {
  const m = d.market || {};
  return fmtTime(d.integrity?.quotesTo || d.index?.time, m.tz || 'UTC', m.city || 'UTC');
};

/** One line a reader can act on — the button's label and the screen-reader echo. */
export function tileSummary(t, cur) {
  const move = t.changePct == null ? 'no quote from Yahoo'
    : t.stale ? `no trade this session — last move ${fmtPct(t.changePct)}`
    : fmtPct(t.changePct);
  return `${t.name} (${t.code}) · ${t.sector}${t.industry ? ` / ${t.industry}` : ''} · ${fmtPrice(t)} · market cap ${fmtCap(t.size, cur)} · ${move}`;
}

function tipHtml(t, d) {
  const cur = d.market?.currency;
  const move = t.changePct == null ? 'No quote from Yahoo'
    : t.stale ? `No trade this session · last ${fmtPct(t.changePct)}` : fmtPct(t.changePct);
  const cls = t.changePct == null || t.stale ? '' : t.changePct >= 0 ? ' is-up' : ' is-down';
  return `<div class="nkhm__tip-name">${escapeHtml(shortName(t.name))} <span>${escapeHtml(t.code)}</span></div>
    <div class="nkhm__tip-move${cls}">${escapeHtml(move)}</div>
    <div class="nkhm__tip-meta">${escapeHtml(fmtPrice(t))} · market cap ${escapeHtml(fmtCap(t.size, cur))}</div>
    <div class="nkhm__tip-meta">${escapeHtml(t.sector)}${t.industry ? ` · ${escapeHtml(t.industry)}` : ''}</div>
    <div class="nkhm__tip-meta">${escapeHtml(t.name)}${t.localName ? ` · ${escapeHtml(t.localName)}` : ''}</div>`;
}

// How the constituent list is dated, in words
function listDate(d) {
  const i = d.integrity || {};
  switch (d.membersAsOfKind) {
    case 'revision': return `Wikipedia revision ${d.membersAsOf || '—'}`;
    case 'file': return `list dated ${d.membersAsOf || '—'}`;
    case 'live': return 'exchange listing, live';
    case 'undated': return `undated list, read ${(i.membersFetchedAt || '').slice(0, 10) || '—'}`;
    default: return `list read ${(i.membersFetchedAt || '').slice(0, 10) || '—'}`;
  }
}

function statusHtml(d) {
  const i = d.integrity || {};
  const hatched = (d.tiles || []).filter(t => t.stale).length;
  const gaps = (i.missing?.length || 0) + (i.unsized?.length || 0) + (i.unresolved?.length || 0);
  return `${escapeHtml(String(i.drawn))}/${escapeHtml(String(i.constituents))} drawn${hatched ? ` · ${hatched} hatched` : ''}${gaps ? ` · ${gaps} not drawn` : ''} · ${escapeHtml(listDate(d))}`;
}

const list = (arr, n = 24) => `${arr.slice(0, n).map(escapeHtml).join(', ')}${arr.length > n ? ` and ${arr.length - n} more` : ''}`;

function aboutHtml(d) {
  const i = d.integrity || {};
  const s = d.sources || {};
  const m = d.market || {};
  const notes = [];
  if (i.expected != null && i.constituents !== i.expected) notes.push(`<strong>The constituent list holds ${escapeHtml(String(i.constituents))} members; the ${escapeHtml(m.label || 'index')} has ${escapeHtml(String(i.expected))}.</strong>`);
  if (i.membersRefreshError) notes.push(`<strong>The constituent list could not be refreshed (${escapeHtml(i.membersRefreshError)}); showing the copy read ${escapeHtml((i.membersFetchedAt || '').slice(0, 10) || '—')}.</strong>`);
  if (i.unresolved?.length) notes.push(`Not yet matched to a Yahoo listing, so not drawn (each is matched once and remembered): ${list(i.unresolved)}.`);
  if (i.secondaryListings?.length) notes.push(`Yahoo lists ${list(i.secondaryListings)} only on a secondary venue; drawn from that line.`);
  if (i.missing?.length) notes.push(`Not quoted by Yahoo, so not drawn: ${list(i.missing)}.`);
  if (i.unsized?.length) notes.push(`No market cap from Yahoo, so not drawn: ${list(i.unsized)}.`);
  if (i.staleQuotes?.length) notes.push(`No trade yet this session (${escapeHtml(d.sessionDay || '')}), hatched: ${list(i.staleQuotes.map(q => `${q.code} (last ${q.day || '—'})`))}.`);
  if (i.capsDerived?.length) notes.push(`Market cap taken as price × shares, from the company's other listing or from Yahoo's key statistics for ${list(i.capsDerived.map(c => c.code))} — Yahoo's own figure was missing or disagreed.`);
  if (i.currencyInferred?.length) notes.push(`Yahoo gave no quote currency for ${list(i.currencyInferred)}; its reporting currency, the index's own, is used.`);
  const fx = Object.entries(i.fx || {});
  if (fx.length) notes.push(`Caps quoted in another currency are converted to ${escapeHtml(m.currency || '')} at Yahoo's spot rate: ${fx.map(([c, r]) => `1 ${escapeHtml(c)} = ${escapeHtml(r.toFixed(4))}`).join(', ')}.`);
  if (i.listed != null) notes.push(`Yahoo lists ${escapeHtml(String(i.listed))} equities on the exchange${i.leftOut ? `; ${escapeHtml(String(i.leftOut))} are left out by the rule in the source line below` : ''}.`);
  if (d.index?.close) notes.push(`The index level is ${escapeHtml(d.index.source || 'the official close')} of ${escapeHtml((d.index.time || '').slice(0, 10))}; its move is that close against the one before — Yahoo carries no live level for this index.`);
  if (i.batchErrors?.length) notes.push(`Upstream errors: ${list(i.batchErrors, 4)}.`);
  if (d.servedFromMemo) notes.push(`Pulled ${escapeHtml(String(d.memoAgeSec))}s ago.`);
  return `<p>${notes.join(' ')}</p>
    <p>Tiles are the ${escapeHtml(m.label || 'index')}'s members as the constituent list below gives them, grouped by Yahoo Finance sector and sized by market capitalisation in ${escapeHtml(m.currency || '')} — not by index weight, which the index providers license. Colour is the session's move from delayed Yahoo Finance quotes; ±3% saturates.</p>
    <p>Constituents: <a href="${safeUrl(s.constituents?.url)}" target="_blank" rel="noopener">${escapeHtml(s.constituents?.name || '—')}</a>${d.membersAsOf ? `, ${escapeHtml(d.membersAsOf)}` : ''}. Quotes, market caps and sectors: <a href="${safeUrl(s.quotes?.url)}" target="_blank" rel="noopener">${escapeHtml(s.quotes?.name || 'Yahoo Finance')}</a>. Drawn by Felicity — TradingView does not serve this market to embedded heatmaps.</p>`;
}

export function mountIndexHeatmap(host, market, label) {
  mountOwnHeatmap(host, {
    id: market,
    api: `/api/invest/index-heatmap?market=${encodeURIComponent(market)}`,
    title: label,
    loading: `loading the ${label}'s constituent list and delayed quotes…`,
    aria: `${label} heatmap: members sized by market cap, coloured by the session's move`,
    credit: null,
    sizeBasis: 'market cap',
    delayedTitle: 'Yahoo Finance quotes are delayed',
    when,
    summary: (t, d) => tileSummary(t, d?.market?.currency),
    tip: tipHtml,
    status: statusHtml,
    about: aboutHtml,
  });
}
