// ═══════════════════════════════════════════════════════════
// NIKKEI 225 HEATMAP — the one heatmap chip we draw ourselves
// ═══════════════════════════════════════════════════════════
//
// TradingView withholds Japan from embeds (a NI225 dataset is drawn as the
// S&P 500), so /api/invest/nikkei-heatmap serves the 225 constituents from
// Nikkei Inc.'s weight file with Yahoo's delayed day moves (lib/nikkei.js),
// and this file lays them out: sectors first, then companies, each sized by
// its official index weight and coloured by the day's move.
//
// The quotes are delayed, so there is no LIVE badge and no pulse: the
// header prints the quote time in Tokyo. A constituent Yahoo did not quote
// is drawn grey, says "no quote", and is listed under the map.
// ═══════════════════════════════════════════════════════════

import { squarify } from './treemap.js';
import { escapeHtml, safeUrl } from './safe.js';

const API = '/api/invest/nikkei-heatmap';
const SECTOR_STRIP = 16;   // px for the sector label

// Day-move colours, TradingView-like: red through grey to green, ±3% saturates
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

// Labels only — the full registered name stays in the tooltip
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

/** Pure layout: sector boxes, then tiles inside each (tested in Node). */
export function layout(data, width, height) {
  const sectors = (data.sectors || []).map(name => {
    const tiles = data.tiles.filter(t => t.sector === name && t.weightPct > 0);
    return { name, tiles, weight: tiles.reduce((s, t) => s + t.weightPct, 0) };
  }).filter(s => s.tiles.length);
  const boxes = squarify(sectors.map(s => s.weight), 0, 0, width, height);
  return sectors.map((s, i) => {
    const b = boxes[i];
    if (!b) return null;
    const strip = b.h > SECTOR_STRIP * 3 && b.w > 60 ? SECTOR_STRIP : 0;
    const rects = squarify(s.tiles.map(t => t.weightPct), b.x, b.y + strip, b.w, b.h - strip);
    return { ...s, box: b, strip, tiles: s.tiles.map((t, j) => ({ ...t, rect: rects[j] })) };
  }).filter(Boolean);
}

export function tileHtml(t) {
  const r = t.rect;
  if (!r) return '';
  const big = r.w > 64 && r.h > 40, mid = r.w > 38 && r.h > 24;
  const title = `${t.name} (${t.code}) — ${t.industry} · ${fmtYen(t.price)} · ${fmtPct(t.changePct)} · ${t.weightPct.toFixed(4)}% of the index`;
  const fs = Math.max(9, Math.min(15, Math.sqrt(r.w * r.h) / 6));
  return `<div class="nkhm__tile${t.changePct == null ? ' is-missing' : ''}" style="left:${r.x.toFixed(1)}px;top:${r.y.toFixed(1)}px;width:${Math.max(0, r.w - 1).toFixed(1)}px;height:${Math.max(0, r.h - 1).toFixed(1)}px;background:${moveColour(t.changePct)};font-size:${fs.toFixed(1)}px" title="${escapeHtml(title)}">${
    mid ? `<span class="nkhm__code">${escapeHtml(big ? shortName(t.name) : t.code)}</span><span class="nkhm__chg">${escapeHtml(fmtPct(t.changePct))}</span>` : ''
  }</div>`;
}

function render(host, data) {
  const map = host.querySelector('.nkhm__map');
  if (!map) return;
  const w = map.clientWidth, h = map.clientHeight;
  if (!w || !h) return;
  const groups = layout(data, w, h);
  map.innerHTML = groups.map(g => `
    <div class="nkhm__sector" style="left:${g.box.x.toFixed(1)}px;top:${g.box.y.toFixed(1)}px;width:${g.box.w.toFixed(1)}px;height:${g.box.h.toFixed(1)}px">
      ${g.strip ? `<span class="nkhm__sector-label">${escapeHtml(g.name)} · ${g.weight.toFixed(1)}%</span>` : ''}
    </div>
    ${g.tiles.map(tileHtml).join('')}`).join('');
}

function headerHtml(data) {
  const i = data.index;
  const integ = data.integrity || {};
  const idx = i ? `<span class="nkhm__level">Nikkei 225 ${escapeHtml(i.level.toLocaleString('en-US', { maximumFractionDigits: 2 }))}</span>
    <span class="nkhm__idxchg" style="color:${i.changePct == null ? 'inherit' : i.changePct >= 0 ? 'var(--semantic-green)' : 'var(--semantic-red)'}">${escapeHtml(fmtPct(i.changePct))}</span>` : '<span class="nkhm__level">Nikkei 225</span>';
  return `${idx}
    <span class="nkhm__badge" title="Yahoo Finance Tokyo quotes are delayed">DELAYED</span>
    <span class="nkhm__asof">quotes to ${escapeHtml(fmtTokyo(integ.quotesTo || i?.time))}</span>
    <button class="nkhm__refresh" type="button">Refresh</button>`;
}

function footHtml(data) {
  const i = data.integrity || {};
  const s = data.sources || {};
  const short = i.constituents !== i.expected ? ` <strong>The weight file lists ${i.constituents}, not ${i.expected}.</strong>` : '';
  const missing = i.missing?.length
    ? ` Not quoted by Yahoo, drawn grey: ${i.missing.map(escapeHtml).join(', ')}${i.batchErrors?.length ? ` (${escapeHtml(i.batchErrors.join('; '))})` : ''}.`
    : '';
  return `<span>${i.quoted}/${i.constituents} constituents quoted.${short}${missing} Tile size: official index weight on ${escapeHtml(data.weightsAsOf || '—')} (weights sum to ${escapeHtml(String(i.weightSumPct))}%); colour: the day's move, ±3% saturates.</span>
    <span>Sources: <a href="${safeUrl(s.constituents?.url)}" target="_blank" rel="noopener">${escapeHtml(s.constituents?.name || 'Nikkei Inc.')}</a> · <a href="${safeUrl(s.quotes?.url)}" target="_blank" rel="noopener">${escapeHtml(s.quotes?.name || 'Yahoo Finance')}</a>. Drawn by Felicity — TradingView does not serve Japan to embedded heatmaps.</span>`;
}

const legendHtml = () => `<span class="nkhm__legend">${[-3, -2, -1, 0, 1, 2, 3].map(v => `<i style="background:${moveColour(v)}">${v > 0 ? '+' : ''}${v}%</i>`).join('')}</span>`;

export function mountNikkeiHeatmap(host) {
  if (!host) return;
  host.innerHTML = `
    <div class="nkhm">
      <div class="nkhm__head"><span class="nkhm__level">Nikkei 225</span><span class="nkhm__asof">loading Nikkei's constituent file and Tokyo quotes…</span></div>
      <div class="nkhm__map" role="img" aria-label="Nikkei 225 heatmap: constituents sized by index weight, coloured by the day's move"></div>
      <div class="nkhm__foot"></div>
    </div>`;
  const root = host.querySelector('.nkhm');
  let data = null;

  const load = async () => {
    const head = root.querySelector('.nkhm__head');
    try {
      const r = await fetch(API, { headers: { Accept: 'application/json' } });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || `HTTP ${r.status}`);
      data = d;
      head.innerHTML = headerHtml(d) + legendHtml();
      root.querySelector('.nkhm__foot').innerHTML = footHtml(d);
      render(root, d);
    } catch (e) {
      // A failed refresh keeps the last real map and says so; with nothing
      // drawn yet the page says unavailable — never a placeholder market
      if (data) {
        head.querySelector('.nkhm__asof').textContent = `refresh failed (${e.message}) — showing quotes to ${fmtTokyo(data.integrity?.quotesTo)}`;
      } else {
        head.innerHTML = `<span class="nkhm__level">Nikkei 225</span><span class="nkhm__asof">Unavailable: ${escapeHtml(e.message)}</span><button class="nkhm__refresh" type="button">Retry</button>`;
      }
    }
  };

  root.addEventListener('click', e => { if (e.target.closest('.nkhm__refresh')) load(); });
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => { if (data) render(root, data); });
    ro.observe(root.querySelector('.nkhm__map'));
  }
  load();
}
