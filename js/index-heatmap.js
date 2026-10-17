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

// The index's own quote time where Yahoo quotes it live: the newest member
// quote can be a foreign line trading hours later (Ferrovial on Nasdaq)
const when = d => {
  const m = d.market || {};
  const t = (!d.index?.close && d.index?.time) || d.integrity?.quotesTo || d.index?.time;
  return `${fmtTime(t, m.tz || 'UTC', m.city || 'UTC')}${d.index?.close && !d.integrity?.quotesTo ? ' close' : ''}`;
};

/** One line a reader can act on — the button's label and the screen-reader echo. */
export function tileSummary(t, cur) {
  const move = t.changePct == null ? (t.price != null ? 'no move from Yahoo' : 'no quote from Yahoo')
    : t.stale ? `no trade this session — last move ${fmtPct(t.changePct)}`
    : fmtPct(t.changePct);
  return `${t.name} (${t.code}) · ${t.sector}${t.industry ? ` / ${t.industry}` : ''} · ${fmtPrice(t)} · ${sizeWord(t)} ${fmtCap(t.size, cur)} · ${move}`;
}

function tipHtml(t, d) {
  const cur = d.market?.currency;
  const move = t.changePct == null ? (t.price != null ? 'No move from Yahoo' : 'No quote from Yahoo')
    : t.stale ? `No trade this session · last ${fmtPct(t.changePct)}` : fmtPct(t.changePct);
  const cls = t.changePct == null || t.stale ? '' : t.changePct >= 0 ? ' is-up' : ' is-down';
  return `<div class="nkhm__tip-name">${escapeHtml(shortName(t.name))} <span>${escapeHtml(t.code)}</span></div>
    <div class="nkhm__tip-move${cls}">${escapeHtml(move)}</div>
    <div class="nkhm__tip-meta">${escapeHtml(fmtPrice(t))} · ${sizeWord(t)} ${escapeHtml(fmtCap(t.size, cur))}</div>
    <div class="nkhm__tip-meta">${escapeHtml(t.sector)}${t.industry ? ` · ${escapeHtml(t.industry)}` : ''}</div>
    <div class="nkhm__tip-meta">${escapeHtml(t.name)}${t.localName ? ` · ${escapeHtml(t.localName)}` : ''}</div>`;
}

const fmtRead = iso => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : '—');
// What a tile's size is: Yahoo's (or a derived) company market cap, or the
// value of the listed line alone
const sizeWord = t => (t.lineValue ? 'listed-line value' : 'market cap');

// How the constituent list is dated, in words
function listDate(d) {
  const i = d.integrity || {};
  switch (d.membersAsOfKind) {
    case 'revision': return `Wikipedia revision ${d.membersAsOf || '—'}`;
    case 'file': return `list dated ${d.membersAsOf || '—'}`;
    case 'listing': return `exchange listing read ${fmtRead(i.membersFetchedAt)}`;
    case 'undated': return `undated list, read ${(i.membersFetchedAt || '').slice(0, 10) || '—'}`;
    default: return `list read ${fmtRead(i.membersFetchedAt)}`;
  }
}

function statusHtml(d) {
  const i = d.integrity || {};
  const hatched = (d.tiles || []).filter(t => t.changePct == null || t.stale).length;
  const gaps = (i.missing?.length || 0) + (i.unsized?.length || 0) + (i.unresolved?.length || 0) + (i.sameListing?.length || 0);
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
  if (i.sameListing?.length) notes.push(`Matched by Yahoo to a listing already drawn, so not drawn twice: ${list(i.sameListing)}.`);
  if (i.listingShort) notes.push(`<strong>Yahoo reports ${escapeHtml(String(i.listed))} equities but its listing returned ${escapeHtml(String(i.listed - i.listingShort))} while it was being read (its order moves with market caps); the rest are missing from this map.</strong>`);
  if (i.missing?.length) notes.push(`Not quoted by Yahoo, so not drawn: ${list(i.missing)}.`);
  if (i.unsized?.length) notes.push(`No market cap from Yahoo, so not drawn: ${list(i.unsized)}.`);
  if (i.noMove?.length) notes.push(`Quoted by Yahoo but with no move for the session, hatched: ${list(i.noMove)}.`);
  if (i.staleQuotes?.length) notes.push(`No trade yet this session (${escapeHtml(d.sessionDay || '')}), hatched: ${list(i.staleQuotes.map(q => `${q.code} (last ${q.day || '—'})`))}.`);
  const line = (d.tiles || []).filter(t => t.lineValue).map(t => t.symbol || t.code);
  if (line.length) notes.push(`Sized by the listed line's own value — its price × its shares, because Yahoo's market cap was missing or covered the whole company: ${list(line)}. For a company with more than one share class (Hong Kong H-shares, preference lines) that is less than its market cap, and the card says "listed-line value".`);
  const other = (i.capsDerived || []).filter(c => !/^price × shares/.test(c.basis)).map(c => `${c.code} (${c.basis})`);
  if (other.length) notes.push(`Market cap taken from ${list(other, 12)}.`);
  if (i.currencyInferred?.length) notes.push(`Yahoo gave no quote currency for ${list(i.currencyInferred)}; its reporting currency, the index's own, is used.`);
  const fx = Object.entries(i.fx || {});
  if (fx.length) notes.push(`Caps quoted in another currency are converted to ${escapeHtml(m.currency || '')} at Yahoo's spot rate: ${fx.map(([c, r]) => `1 ${escapeHtml(c)} = ${escapeHtml(r.toFixed(4))}`).join(', ')}.`);
  if (i.listed != null) notes.push(`Yahoo lists ${escapeHtml(String(i.listed))} equities on the exchange${i.leftOut ? `; ${escapeHtml(String(i.leftOut))} are left out by the rule in the source line below` : ''}.`);
  if (d.index?.close) notes.push(`The index level is ${escapeHtml(d.index.source || 'the official close')} of ${escapeHtml((d.index.time || '').slice(0, 10))} — Yahoo carries no live level for this index — and its move is Felicity's arithmetic: that close against the one before${d.index.changePct == null ? ' (no earlier close in the report, so none is shown)' : ''}. During a session the level is the previous close while the tiles move with today's quotes.`);
  if (i.batchErrors?.length) notes.push(`Upstream errors: ${list(i.batchErrors, 4)}.`);
  if (d.servedFromMemo) notes.push(`Pulled ${escapeHtml(String(d.memoAgeSec))}s ago.`);
  return `<p>${notes.join(' ')}</p>
    <p>${d.membersAsOfKind === 'listing' ? `Tiles are the market as Yahoo lists it, by the rule in the source line below — not the index provider's own file, which our servers cannot reach` : `Tiles are the members the list below gives`}, grouped by Yahoo Finance sector and sized by market capitalisation in ${escapeHtml(m.currency || '')} — not by index weight, which the index providers license. Colour is the session's move from delayed Yahoo Finance quotes; ±3% saturates.</p>
    <p>Constituents: <a href="${safeUrl(s.constituents?.url)}" target="_blank" rel="noopener">${escapeHtml(s.constituents?.name || '—')}</a>${d.membersAsOf && d.membersAsOfKind !== 'revision' ? `, ${escapeHtml(d.membersAsOf)}` : ''}. Quotes, market caps and sectors: <a href="${safeUrl(s.quotes?.url)}" target="_blank" rel="noopener">${escapeHtml(s.quotes?.name || 'Yahoo Finance')}</a>. Drawn by Felicity — TradingView does not serve this market to embedded heatmaps.</p>`;
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
