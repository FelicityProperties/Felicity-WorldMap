// ═══════════════════════════════════════════════════════════
// NIKKEI 225 HEATMAP — the one heatmap chip we draw ourselves
// ═══════════════════════════════════════════════════════════
//
// TradingView withholds Japan from embeds (a NI225 dataset is drawn as the
// S&P 500), so /api/invest/nikkei-heatmap serves the 225 constituents from
// Nikkei Inc.'s weight file with Yahoo's delayed moves (lib/nikkei.js), and
// this file lays them out: sectors first, then companies, each sized by its
// official index weight and coloured by the session's move.
//
// The quotes are delayed, so there is no LIVE badge and no pulse: the
// header prints the quote time in Tokyo. A constituent Yahoo did not quote,
// or whose last trade is from an earlier session, is hatched — never a
// colour a real move could produce — and listed under the map.
//
// Every tile is a button: tapping or focusing it shows its figures in the
// detail line, so a phone or keyboard reader gets what a mouse hover gets.
// ═══════════════════════════════════════════════════════════

import { squarify } from './treemap.js';
import { escapeHtml, safeUrl } from './safe.js';

const API = '/api/invest/nikkei-heatmap';
const SECTOR_STRIP = 16;   // px for the sector label

// Kept across re-mounts (fullscreen on/off rebuilds the picker): a re-mount
// draws the last real map at once and refreshes behind it, and a failed
// refresh never replaces a good map with "unavailable"
let lastGood = null;
let observer = null;   // one at a time: a re-mount disconnects the old one

// Session-move colours, TradingView-like: red through grey to green, ±3% saturates
const STOPS = [[-3, [242, 54, 69]], [-1.5, [178, 40, 56]], [-0.25, [92, 46, 54]], [0, [58, 61, 71]], [0.25, [40, 82, 64]], [1.5, [12, 130, 90]], [3, [8, 153, 129]]];
export function moveColour(chg) {
  if (chg == null || !Number.isFinite(chg)) return 'rgb(42, 46, 57)';
  const v = Math.max(-3, Math.min(3, chg));
  for (let i = 1; i < STOPS.length; i++) {
    const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i];
    if (v <= b) {
      const t = (v - a) / (b - a || 1);
      return `rgb(${ca.map((c, j) => Math.round(c + (cb[j] - c) * t)).join(', ')})`;
    }
  }
  return `rgb(${STOPS[STOPS.length - 1][1].join(', ')})`;
}

// Labels only — the full registered name stays in the detail line
export function shortName(name) {
  return String(name || '')
    .replace(/\b(HOLDINGS?|HLDGS?\.?|GROUP|CORPORATION|CORP\.?|CO\.,? ?LTD\.?|LTD\.?|INC\.?|K\.K\.)\b/gi, '')
    .replace(/[,.&]+\s*$/g, '').replace(/\s{2,}/g, ' ').trim() || String(name || '');
}

const fmtPct = v => v == null ? 'no quote' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
const fmtYen = v => v == null ? '—' : `¥${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
const fmtTokyo = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleString('en-GB', { timeZone: 'Asia/Tokyo', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })} Tokyo`;
};
const isPhone = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches;

/** Pure layout: sector boxes, then tiles inside each (tested in Node). */
export function layout(data, width, height) {
  const sectors = (data.sectors || []).map(name => {
    const tiles = data.tiles.filter(t => t.sector === name && t.size > 0);
    return { name, tiles, weight: tiles.reduce((s, t) => s + t.size, 0) };
  }).filter(s => s.tiles.length);
  const boxes = squarify(sectors.map(s => s.weight), 0, 0, width, height);
  return sectors.map((s, i) => {
    const b = boxes[i];
    if (!b) return null;
    const strip = b.h > SECTOR_STRIP * 3 && b.w > 60 ? SECTOR_STRIP : 0;
    const rects = squarify(s.tiles.map(t => t.size), b.x, b.y + strip, b.w, Math.max(0, b.h - strip));
    return { ...s, box: b, strip, tiles: s.tiles.map((t, j) => ({ ...t, rect: rects[j] })) };
  }).filter(Boolean);
}

/** One line a reader can act on — the hover tooltip, the button's label and the tap detail. */
export function tileSummary(t) {
  const move = t.changePct == null ? 'no quote from Yahoo'
    : t.stale ? `no trade this session — last move ${fmtPct(t.changePct)} on ${fmtTokyo(t.time)}`
    : fmtPct(t.changePct);
  // No weight figure: exact Nikkei weights are not published on this site
  return `${t.name} (${t.code}) · ${t.industry} · ${fmtYen(t.price)} · ${move}`;
}

export function tileHtml(t, minFont = 9) {
  const r = t.rect;
  if (!r) return '';
  const fs = Math.max(minFont, Math.min(15, Math.sqrt(r.w * r.h) / 6));
  // A label only where it fits at this size; the rest are reached by tap
  const mid = r.w > fs * 4.2 && r.h > fs * 2.6, big = r.w > fs * 7 && r.h > fs * 3.6;
  const blank = t.changePct == null || t.stale;
  const label = t.changePct == null ? 'no quote' : t.stale ? 'no trade' : fmtPct(t.changePct);
  const summary = tileSummary(t);
  return `<button type="button" class="nkhm__tile${blank ? ' is-missing' : ''}" data-code="${escapeHtml(t.code)}" style="left:${r.x.toFixed(1)}px;top:${r.y.toFixed(1)}px;width:${Math.max(0, r.w - 1).toFixed(1)}px;height:${Math.max(0, r.h - 1).toFixed(1)}px;${blank ? '' : `background:${moveColour(t.changePct)};`}font-size:${fs.toFixed(1)}px" title="${escapeHtml(summary)}" aria-label="${escapeHtml(summary)}">${
    mid ? `<span class="nkhm__code">${escapeHtml(big ? shortName(t.name) : t.code)}</span><span class="nkhm__chg">${escapeHtml(label)}</span>` : ''
  }</button>`;
}

function render(root, data) {
  const map = root.querySelector('.nkhm__map');
  if (!map) return;
  // Last line of defence: a stylesheet that leaves the map without a height
  // (a missing rule, a cached old CSS) must not leave an empty box
  if (map.clientWidth > 0 && map.clientHeight < 120) map.style.height = '420px';
  const w = map.clientWidth, h = map.clientHeight;
  if (!w || !h) return;
  const minFont = isPhone() ? 11 : 9;
  map.innerHTML = layout(data, w, h).map(g => `
    <div class="nkhm__sector" style="left:${g.box.x.toFixed(1)}px;top:${g.box.y.toFixed(1)}px;width:${g.box.w.toFixed(1)}px;height:${g.box.h.toFixed(1)}px">
      ${g.strip ? `<span class="nkhm__sector-label">${escapeHtml(g.name)}</span>` : ''}
    </div>
    ${g.tiles.map(t => tileHtml(t, minFont)).join('')}`).join('');
}

function headerHtml(data) {
  const i = data.index;
  const integ = data.integrity || {};
  const idx = i ? `<span class="nkhm__level">Nikkei 225 ${escapeHtml(i.level.toLocaleString('en-US', { maximumFractionDigits: 2 }))}</span>
    <span class="nkhm__idxchg" style="color:${i.changePct == null ? 'inherit' : i.changePct >= 0 ? 'var(--semantic-green)' : 'var(--semantic-red)'}">${escapeHtml(fmtPct(i.changePct))}</span>` : '<span class="nkhm__level">Nikkei 225</span><span class="nkhm__asof">index level not quoted</span>';
  return `${idx}
    <span class="nkhm__badge" title="Yahoo Finance Tokyo quotes are delayed">DELAYED</span>
    <span class="nkhm__asof">quotes to ${escapeHtml(fmtTokyo(integ.quotesTo || i?.time))}</span>
    <span class="nkhm__asof">weights ${escapeHtml(data.weightsAsOf || '—')} · Nikkei Inc. · Yahoo</span>
    <button class="nkhm__refresh" type="button">Refresh</button>`;
}

const legendHtml = () => `<div class="nkhm__legend">${[-3, -2, -1, 0, 1, 2, 3].map(v => `<i style="background:${moveColour(v)}">${v > 0 ? '+' : ''}${v}%</i>`).join('')}<i class="is-missing">no quote / no trade</i></div>`;

function footHtml(data) {
  const i = data.integrity || {};
  const s = data.sources || {};
  const notes = [];
  if (i.constituents !== i.expected) notes.push(`<strong>The weight file lists ${escapeHtml(String(i.constituents))}, not ${escapeHtml(String(i.expected))}.</strong>`);
  if (i.missing?.length) notes.push(`Not quoted by Yahoo, hatched: ${i.missing.map(escapeHtml).join(', ')}${i.batchErrors?.length ? ` (${escapeHtml(i.batchErrors.join('; '))})` : ''}.`);
  if (i.staleQuotes?.length) notes.push(`No trade yet this session (${escapeHtml(data.sessionDay || '')}), hatched: ${i.staleQuotes.map(q => `${escapeHtml(q.code)} (last ${escapeHtml(q.day || '—')})`).join(', ')}.`);
  if (i.weightsRefreshError) notes.push(`<strong>Nikkei's weight file could not be refreshed (${escapeHtml(i.weightsRefreshError)}); showing the copy dated ${escapeHtml(data.weightsAsOf || '—')}.</strong>`);
  if (data.servedFromMemo) notes.push(`Pulled ${escapeHtml(String(data.memoAgeSec))}s ago.`);
  return `<span>${escapeHtml(String(i.quoted))}/${escapeHtml(String(i.constituents))} constituents quoted. ${notes.join(' ')} ${i.weightsSumOk === false ? '<strong>The weight file does not sum to 100%.</strong> ' : ''}Tile size: Nikkei's official index weight on ${escapeHtml(data.weightsAsOf || '—')}, rounded; exact weights are not shown. The Nikkei is price-weighted, so size is not market cap. Colour: the session's move, ±3% saturates.</span>
    <span>Constituents and weights © Nikkei Inc.${i.notices?.length ? ` — ${escapeHtml(i.notices[0])}` : ''}</span>
    <span>Sources: <a href="${safeUrl(s.constituents?.url)}" target="_blank" rel="noopener">${escapeHtml(s.constituents?.name || 'Nikkei Inc.')}</a> · <a href="${safeUrl(s.quotes?.url)}" target="_blank" rel="noopener">${escapeHtml(s.quotes?.name || 'Yahoo Finance')}</a>. Drawn by Felicity — TradingView does not serve Japan to embedded heatmaps.</span>`;
}

export function mountNikkeiHeatmap(host) {
  if (!host) return;
  host.innerHTML = `
    <div class="nkhm">
      <div class="nkhm__head"><span class="nkhm__level">Nikkei 225</span><span class="nkhm__asof">loading Nikkei's constituent file and Tokyo quotes…</span></div>
      <div class="nkhm__detail" aria-live="polite">Tap or focus a tile for its figures.</div>
      <div class="nkhm__map" role="group" aria-label="Nikkei 225 heatmap: constituents sized by official index weight, coloured by the session's move"></div>
      <div class="nkhm__foot"></div>
    </div>`;
  const root = host.querySelector('.nkhm');
  let data = null;
  let busy = false;

  const paint = d => {
    data = d;
    root.querySelector('.nkhm__head').innerHTML = headerHtml(d) + legendHtml();
    root.querySelector('.nkhm__foot').innerHTML = footHtml(d);
    render(root, d);
  };

  const load = async () => {
    if (busy) return;
    busy = true;
    const btn = root.querySelector('.nkhm__refresh');
    if (btn) { btn.disabled = true; btn.textContent = 'Refreshing…'; }
    try {
      const r = await fetch(API, { headers: { Accept: 'application/json' } });
      const d = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
      if (!d.ok) throw new Error(d.error || `HTTP ${r.status}`);
      lastGood = d;
      if (root.isConnected) paint(d);
    } catch (e) {
      if (!root.isConnected) return;
      // A failed refresh keeps the last real map and says so; with nothing
      // drawn yet the page says unavailable — never a placeholder market
      if (data) {
        const asof = root.querySelector('.nkhm__head .nkhm__asof');
        if (asof) asof.textContent = `refresh failed (${e.message}) — showing quotes to ${fmtTokyo(data.integrity?.quotesTo)}`;
      } else {
        root.querySelector('.nkhm__head').innerHTML = `<span class="nkhm__level">Nikkei 225</span><span class="nkhm__asof">Unavailable: ${escapeHtml(e.message)}</span><button class="nkhm__refresh" type="button">Retry</button>`;
      }
    } finally {
      busy = false;
      const b = root.querySelector('.nkhm__refresh');
      if (b) { b.disabled = false; if (b.textContent === 'Refreshing…') b.textContent = 'Refresh'; }
    }
  };

  const showDetail = code => {
    const t = data?.tiles.find(x => x.code === code);
    if (t) root.querySelector('.nkhm__detail').textContent = tileSummary(t);
  };
  root.addEventListener('click', e => {
    if (e.target.closest('.nkhm__refresh')) return load();
    const tile = e.target.closest('.nkhm__tile');
    if (tile) showDetail(tile.dataset.code);
  });
  root.addEventListener('focusin', e => {
    const tile = e.target.closest('.nkhm__tile');
    if (tile) showDetail(tile.dataset.code);
  });

  // The observer fires once on observe(), so a re-mount with a last good
  // payload draws at the real size straight away
  if (lastGood) paint(lastGood);
  observer?.disconnect();
  observer = null;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => { if (data && root.isConnected) render(root, data); });
    observer.observe(root.querySelector('.nkhm__map'));
  }
  load();
}
