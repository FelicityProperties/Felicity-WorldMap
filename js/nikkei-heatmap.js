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
  const fs = Math.max(minFont, Math.min(16, Math.sqrt(r.w * r.h) / 6));
  // A label only where it fits; every tile is still reachable by hover, tap or focus
  const fits = r.w > fs * 3.4 && r.h > fs * 2.5;
  const blank = t.changePct == null || t.stale;
  const label = t.changePct == null ? 'no quote' : t.stale ? 'no trade' : fmtPct(t.changePct);
  // TradingView prints the ticker; a company name reads better where it fits
  const name = shortName(t.name);
  const head = name.length * fs * 0.62 < r.w - 8 ? name : t.code;
  return `<button type="button" class="nkhm__tile${blank ? ' is-missing' : ''}" data-code="${escapeHtml(t.code)}" style="left:${r.x.toFixed(1)}px;top:${r.y.toFixed(1)}px;width:${Math.max(0, r.w - 1).toFixed(1)}px;height:${Math.max(0, r.h - 1).toFixed(1)}px;${blank ? '' : `background:${moveColour(t.changePct)};`}font-size:${fs.toFixed(1)}px" aria-label="${escapeHtml(tileSummary(t))}">${
    fits ? `<span class="nkhm__code">${escapeHtml(head)}</span><span class="nkhm__chg">${escapeHtml(label)}</span>` : ''
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

// The toolbar, laid out like TradingView's heatmap bar: what the map shows
// on the left, how it is sized and coloured in the middle, refresh on the right
function barHtml(data) {
  const i = data.index;
  const integ = data.integrity || {};
  const idx = i
    ? `<span class="nkhm__name">Nikkei 225</span><span class="nkhm__level">${escapeHtml(i.level.toLocaleString('en-US', { maximumFractionDigits: 2 }))}</span><span class="nkhm__idxchg ${i.changePct == null ? '' : i.changePct >= 0 ? 'is-up' : 'is-down'}">${escapeHtml(fmtPct(i.changePct))}</span>`
    : '<span class="nkhm__name">Nikkei 225</span><span class="nkhm__asof">index level not quoted</span>';
  return `<div class="nkhm__idx">${idx}<span class="nkhm__badge" title="Yahoo Finance Tokyo quotes are delayed">Delayed</span><span class="nkhm__asof">${escapeHtml(fmtTokyo(integ.quotesTo || i?.time))}</span></div>
    <div class="nkhm__basis"><span><b>Size</b> index weight</span><span><b>Colour</b> change, %</span></div>
    <button class="nkhm__refresh" type="button" title="Refresh" aria-label="Refresh"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
}

// TradingView's legend: labels over coloured steps
const legendHtml = () => `<div class="nkhm__legend">${[-3, -2, -1, 0, 1, 2, 3].map(v => `<span><em>${v > 0 ? '+' : ''}${v}%</em><i style="background:${moveColour(v)}"></i></span>`).join('')}<span><em>no trade</em><i class="is-missing"></i></span></div>`;

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
  if (!host) return;
  // TradingView leaves inline sizes on the container it mounted into; they
  // must not size this map
  host.removeAttribute('style');
  host.innerHTML = `
    <div class="nkhm">
      <div class="nkhm__bar"><div class="nkhm__idx"><span class="nkhm__name">Nikkei 225</span><span class="nkhm__asof">loading Nikkei's constituent file and Tokyo quotes…</span></div></div>
      <div class="nkhm__stage">
        <div class="nkhm__map" role="group" aria-label="Nikkei 225 heatmap: constituents sized by official index weight, coloured by the session's move"></div>
        <div class="nkhm__tip" hidden></div>
        <span class="nkhm__credit">© Nikkei Inc.</span>
      </div>
      <div class="nkhm__bottom"><div class="nkhm__legend-slot"></div><div class="nkhm__status"></div></div>
      <details class="nkhm__about"><summary>About this map</summary><div class="nkhm__about-body"></div></details>
      <div class="nkhm__sr" aria-live="polite"></div>
    </div>`;
  const root = host.querySelector('.nkhm');
  const stage = root.querySelector('.nkhm__stage');
  const tip = root.querySelector('.nkhm__tip');
  let data = null;
  let busy = false;
  let pinned = null;   // a tapped tile keeps its card until the next tap

  const paint = d => {
    data = d;
    root.querySelector('.nkhm__bar').innerHTML = barHtml(d);
    root.querySelector('.nkhm__legend-slot').innerHTML = legendHtml();
    root.querySelector('.nkhm__status').innerHTML = statusHtml(d);
    root.querySelector('.nkhm__about-body').innerHTML = aboutHtml(d);
    hideTip();
    render(root, d);
  };

  const load = async () => {
    if (busy) return;
    busy = true;
    const btn = root.querySelector('.nkhm__refresh');
    if (btn) { btn.disabled = true; btn.classList.add('is-busy'); }
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
        const asof = root.querySelector('.nkhm__bar .nkhm__asof');
        if (asof) asof.textContent = `refresh failed (${e.message}) — showing ${fmtTokyo(data.integrity?.quotesTo)}`;
      } else {
        root.querySelector('.nkhm__bar').innerHTML = `<div class="nkhm__idx"><span class="nkhm__name">Nikkei 225</span><span class="nkhm__asof">Unavailable: ${escapeHtml(e.message)}</span></div><button class="nkhm__refresh" type="button" title="Retry" aria-label="Retry"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
      }
    } finally {
      busy = false;
      const b = root.querySelector('.nkhm__refresh');
      if (b) { b.disabled = false; b.classList.remove('is-busy'); }
    }
  };

  // Card placement: beside the pointer (or the tile's centre), kept inside the stage
  const showTip = (code, x, y) => {
    const t = data?.tiles.find(v => v.code === code);
    if (!t) return;
    tip.innerHTML = tipHtml(t);
    tip.hidden = false;
    const sw = stage.clientWidth, sh = stage.clientHeight, tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = x + 14, top = y + 14;
    if (left + tw > sw - 4) left = Math.max(4, x - tw - 14);
    if (top + th > sh - 4) top = Math.max(4, y - th - 14);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    root.querySelector('.nkhm__sr').textContent = tileSummary(t);
  };
  const hideTip = () => { tip.hidden = true; pinned = null; };
  const local = e => { const b = stage.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const centre = el => { const b = stage.getBoundingClientRect(), r = el.getBoundingClientRect(); return [r.left - b.left + r.width / 2, r.top - b.top + r.height / 2]; };

  stage.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || pinned) return;
    const tile = e.target.closest('.nkhm__tile');
    if (tile) showTip(tile.dataset.code, ...local(e)); else tip.hidden = true;
  });
  stage.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !pinned) tip.hidden = true; });
  root.addEventListener('click', e => {
    if (e.target.closest('.nkhm__refresh')) return load();
    const tile = e.target.closest('.nkhm__tile');
    if (!tile) return;
    // Tap (touch) or click pins the card; tapping the same tile again closes it
    if (pinned === tile.dataset.code) return hideTip();
    pinned = tile.dataset.code;
    showTip(tile.dataset.code, ...(e.detail === 0 ? centre(tile) : local(e)));
  });
  root.addEventListener('focusin', e => {
    const tile = e.target.closest('.nkhm__tile');
    if (tile) showTip(tile.dataset.code, ...centre(tile));
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape') hideTip(); });

  // The observer fires once on observe(), so a re-mount with a last good
  // payload draws at the real size straight away
  if (lastGood) paint(lastGood);
  observer?.disconnect();
  observer = null;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => { if (data && root.isConnected) { hideTip(); render(root, data); } });
    observer.observe(root.querySelector('.nkhm__map'));
  }
  load();
}
