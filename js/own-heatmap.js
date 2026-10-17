// ═══════════════════════════════════════════════════════════
// OWN HEATMAPS — the drawing shared by every map Felicity draws itself
// ═══════════════════════════════════════════════════════════
//
// TradingView withholds seventeen markets from embedded heatmaps (it draws
// the S&P 500 in their place), so those are drawn here: the Nikkei 225
// (js/nikkei-heatmap.js, sized by Nikkei's official weights) and sixteen
// more (js/index-heatmap.js, sized by market cap). This file is the part
// they share, laid out like TradingView's own heatmap:
//
//   a toolbar (index level and move, a Delayed badge, the quote time in
//   the exchange's city, what size and colour mean, refresh); sector boxes
//   holding company tiles, each sized by the map's basis and coloured by
//   the session's move; a hover card; the colour legend; an About panel.
//
// The quotes are delayed, so there is no LIVE badge and no pulse. A member
// with no quote, or whose last trade is from an earlier session, is
// hatched — never a colour a real move could produce — and listed.
//
// Every tile is a button: tapping or focusing it shows its card, so a
// phone or keyboard reader gets what a mouse hover gets.
// ═══════════════════════════════════════════════════════════

import { squarify } from './treemap.js';
import { escapeHtml } from './safe.js';

const SECTOR_STRIP = 16;   // px for the sector label

// Kept across re-mounts (fullscreen on/off rebuilds the picker), per map:
// a re-mount draws the last real map at once and refreshes behind it, and
// a failed refresh never replaces a good map with "unavailable"
const lastGood = new Map();
let observer = null;   // one map on screen at a time: a re-mount disconnects the old one

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

// Labels only — the full registered name stays in the card
export function shortName(name) {
  let s = String(name || '').replace(/\b(HOLDINGS?|HLDGS?\.?|GROUP|CORPORATION|CORP\.?|CO\.,? ?LTD\.?|LTD\.?|INC\.?|K\.K\.)\b/gi, '');
  // Legal forms only at the end of the name ("AB InBev" keeps its AB)
  for (let i = 0; i < 3; i++) s = s.replace(/[\s,]+(PLC|P\.L\.C\.|LIMITED|PJSC|P\.J\.S\.C\.?|S\.A\.?|SA|AG|N\.V\.?|NV|SE|S\.P\.A\.?|SPA|T\.A\.Ş\.?|A\.Ş\.?|A\.O\.?|TBK|PCL|BHD|ASA|OYJ|AB)[.\s]*$/i, '');
  return s.replace(/[,.&]+\s*$/g, '').replace(/\s{2,}/g, ' ').trim() || String(name || '');
}

export const fmtPct = v => v == null ? 'no quote' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
export const fmtTime = (iso, tz, city) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleString('en-GB', { timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })} ${city}`;
};
const isPhone = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches;
const REFRESH_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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

/** One tile as a button; `summary` is the reader-facing line for its label. */
export function tileHtml(t, minFont = 9, summary = x => x.name) {
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
  return `<button type="button" class="nkhm__tile${blank ? ' is-missing' : ''}" data-code="${escapeHtml(t.code)}" style="left:${r.x.toFixed(1)}px;top:${r.y.toFixed(1)}px;width:${Math.max(0, r.w - 1).toFixed(1)}px;height:${Math.max(0, r.h - 1).toFixed(1)}px;${blank ? '' : `background:${moveColour(t.changePct)};`}font-size:${fs.toFixed(1)}px" aria-label="${escapeHtml(summary(t))}">${
    fits ? `<span class="nkhm__code">${escapeHtml(head)}</span><span class="nkhm__chg">${escapeHtml(label)}</span>` : ''
  }</button>`;
}

// TradingView's legend: labels over coloured steps
const legendHtml = () => `<div class="nkhm__legend">${[-3, -2, -1, 0, 1, 2, 3].map(v => `<span><em>${v > 0 ? '+' : ''}${v}%</em><i style="background:${moveColour(v)}"></i></span>`).join('')}<span><em>no trade</em><i class="is-missing"></i></span></div>`;

/**
 * Mount one map. `cfg` describes it:
 *   id, api                 memo key and endpoint
 *   title                   the index name in the toolbar
 *   loading, aria           placeholder text and the map's accessible label
 *   credit                  a credit line drawn on the map, or null
 *   sizeBasis               what tile size means ("index weight", "market cap")
 *   delayedTitle            the Delayed badge's tooltip
 *   when(data)              the quote time, formatted for the toolbar
 *   summary(t, d), tip(t, d) a tile's one-line summary and its hover card
 *   status(d), about(d)     the line under the map and the About panel (HTML)
 */
export function mountOwnHeatmap(host, cfg) {
  if (!host) return;
  // TradingView leaves inline sizes on the container it mounted into; they
  // must not size this map
  host.removeAttribute('style');
  host.innerHTML = `
    <div class="nkhm" data-map="${escapeHtml(cfg.id)}">
      <div class="nkhm__bar"><div class="nkhm__idx"><span class="nkhm__name">${escapeHtml(cfg.title)}</span><span class="nkhm__asof">${escapeHtml(cfg.loading)}</span></div></div>
      <div class="nkhm__stage">
        <div class="nkhm__map" role="group" aria-label="${escapeHtml(cfg.aria)}"></div>
        <div class="nkhm__tip" hidden></div>
        ${cfg.credit ? `<span class="nkhm__credit">${escapeHtml(cfg.credit)}</span>` : ''}
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

  const barHtml = d => {
    const i = d.index;
    // An official close (Taiwan 50, from TWSE) is dated as a close, and its
    // move — our arithmetic, close against the previous close — is marked
    const move = i?.close && i.changePct == null ? 'no prior close' : fmtPct(i?.changePct);
    const idx = i
      ? `<span class="nkhm__name">${escapeHtml(cfg.title)}</span><span class="nkhm__level">${escapeHtml(i.level.toLocaleString('en-US', { maximumFractionDigits: 2 }))}</span><span class="nkhm__idxchg ${i.changePct == null ? '' : i.changePct >= 0 ? 'is-up' : 'is-down'}">${escapeHtml(move)}</span>${
        i.close ? `${i.changePct == null ? '' : '<span class="nkhm__badge" title="Felicity calc: this close against the previous close">calc</span>'}<span class="nkhm__asof">${escapeHtml(i.source || 'close')} ${escapeHtml(new Date(i.time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }))}</span>` : ''}`
      : `<span class="nkhm__name">${escapeHtml(cfg.title)}</span><span class="nkhm__asof">index level not quoted</span>`;
    return `<div class="nkhm__idx">${idx}<span class="nkhm__badge" title="${escapeHtml(cfg.delayedTitle)}">Delayed</span><span class="nkhm__asof">${escapeHtml(cfg.when(d))}</span></div>
      <div class="nkhm__basis"><span><b>Size</b> ${escapeHtml(cfg.sizeBasis)}</span><span><b>Colour</b> change, %</span></div>
      <button class="nkhm__refresh" type="button" title="Refresh" aria-label="Refresh">${REFRESH_SVG}</button>`;
  };

  const render = () => {
    const map = root.querySelector('.nkhm__map');
    if (!map || !data) return;
    // Last line of defence: a stylesheet that leaves the map without a
    // height (a missing rule, a cached old CSS) must not leave an empty box
    if (map.clientWidth > 0 && map.clientHeight < 120) map.style.height = '420px';
    const w = map.clientWidth, h = map.clientHeight;
    if (!w || !h) return;
    const minFont = isPhone() ? 11 : 9;
    map.innerHTML = layout(data, w, h).map(g => `
      <div class="nkhm__sector" style="left:${g.box.x.toFixed(1)}px;top:${g.box.y.toFixed(1)}px;width:${g.box.w.toFixed(1)}px;height:${g.box.h.toFixed(1)}px">
        ${g.strip ? `<span class="nkhm__sector-label">${escapeHtml(g.name)}</span>` : ''}
      </div>
      ${g.tiles.map(t => tileHtml(t, minFont, x => cfg.summary(x, data))).join('')}`).join('');
  };

  const paint = d => {
    data = d;
    root.querySelector('.nkhm__bar').innerHTML = barHtml(d);
    root.querySelector('.nkhm__legend-slot').innerHTML = legendHtml();
    root.querySelector('.nkhm__status').innerHTML = cfg.status(d);
    root.querySelector('.nkhm__about-body').innerHTML = cfg.about(d);
    hideTip();
    render();
  };

  const load = async () => {
    if (busy) return;
    busy = true;
    const btn = root.querySelector('.nkhm__refresh');
    if (btn) { btn.disabled = true; btn.classList.add('is-busy'); }
    try {
      const r = await fetch(cfg.api, { headers: { Accept: 'application/json' } });
      const d = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
      if (!d.ok) throw new Error(d.error || `HTTP ${r.status}`);
      lastGood.set(cfg.id, d);
      if (root.isConnected) paint(d);
    } catch (e) {
      if (!root.isConnected) return;
      // A failed refresh keeps the last real map and says so; with nothing
      // drawn yet the page says unavailable — never a placeholder market
      if (data) {
        const asof = root.querySelector('.nkhm__bar .nkhm__asof:last-of-type');
        if (asof) asof.textContent = `refresh failed (${e.message}) — showing ${cfg.when(data)}`;
      } else {
        root.querySelector('.nkhm__bar').innerHTML = `<div class="nkhm__idx"><span class="nkhm__name">${escapeHtml(cfg.title)}</span><span class="nkhm__asof">Unavailable: ${escapeHtml(e.message)}</span></div><button class="nkhm__refresh" type="button" title="Retry" aria-label="Retry">${REFRESH_SVG}</button>`;
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
    tip.innerHTML = cfg.tip(t, data);
    tip.hidden = false;
    const sw = stage.clientWidth, sh = stage.clientHeight, tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = x + 14, top = y + 14;
    if (left + tw > sw - 4) left = Math.max(4, x - tw - 14);
    if (top + th > sh - 4) top = Math.max(4, y - th - 14);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    root.querySelector('.nkhm__sr').textContent = cfg.summary(t, data);
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
  if (lastGood.has(cfg.id)) paint(lastGood.get(cfg.id));
  observer?.disconnect();
  observer = null;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => { if (data && root.isConnected) { hideTip(); render(); } });
    observer.observe(root.querySelector('.nkhm__map'));
  }
  load();
}
