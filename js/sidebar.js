// ═══════════════════════════════════════════════════════════
// SIDEBAR — Tab Switching, Card Rendering
// ═══════════════════════════════════════════════════════════

import { news, markets, flights, ships } from './data.js';
import { layerMeta } from './live-layers.js';
import { pixSignals, SIGNAL_TYPES, PIX_SIGNALS_AS_OF, signalCopy, signalAge } from './pix-signals.js';
import { escapeHtml as safeEscape, isSafeUrl } from './safe.js';
import { formatPrice } from './utils.js';
import { fetchLiveNews } from './news-live.js';
import { fetchLiveMarkets } from './markets-live.js';
import { refreshAlertBanner } from './hero.js';

let currentTab = 'news';
let isRefreshing = false;
let isRefreshingMarkets = false;

export function getCurrentTab() { return currentTab; }

export function initSidebar() {
  const content = document.getElementById('sidebar-content');
  if (!content) return;

  // Initial render
  renderTab('news', content);

  // Tab click delegation
  const tabContainer = document.getElementById('sidebar-tabs');
  if (tabContainer) {
    tabContainer.addEventListener('click', e => {
      const btn = e.target.closest('.stab');
      if (!btn) return;
      const tab = btn.dataset.tab;
      if (tab === currentTab) return;

      // Switch active tab
      tabContainer.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = tab;

      // Render with fade
      content.style.opacity = '0';
      setTimeout(() => {
        renderTab(tab, content);
        content.style.opacity = '1';
      }, 100);
    });
  }

  // Delegated click handlers for refresh buttons and news cards
  content.addEventListener('click', e => {
    // News refresh button
    const newsRefresh = e.target.closest('#news-refresh-btn');
    if (newsRefresh && !isRefreshing) {
      isRefreshing = true;
      newsRefresh.classList.add('is-loading');
      newsRefresh.textContent = 'Fetching...';
      fetchLiveNews().then(ok => {
        isRefreshing = false;
        newsRefresh.classList.remove('is-loading');
        newsRefresh.textContent = '\u21BB Refresh';
        content.innerHTML = renderNews();
        if (ok) refreshAlertBanner();
      }).catch(() => {
        isRefreshing = false;
        newsRefresh.classList.remove('is-loading');
        newsRefresh.textContent = '\u21BB Retry';
      });
      return;
    }

    // Markets refresh button
    const mktsRefresh = e.target.closest('#markets-refresh-btn');
    if (mktsRefresh && !isRefreshingMarkets) {
      isRefreshingMarkets = true;
      mktsRefresh.classList.add('is-loading');
      mktsRefresh.textContent = 'Fetching...';
      fetchLiveMarkets().then(ok => {
        isRefreshingMarkets = false;
        mktsRefresh.classList.remove('is-loading');
        mktsRefresh.textContent = '\u21BB Refresh';
        content.innerHTML = renderMarkets();
        if (window.__rebuildTicker) window.__rebuildTicker();
      });
      return;
    }

    // Flights refresh button

    // Ships refresh button

    // News card click
    const card = e.target.closest('[data-news-idx]');
    if (!card) return;
    const idx = parseInt(card.dataset.newsIdx);
    const n = news[idx];
    if (!n) return;
    // RSS feeds are external — never hand window.open a javascript: URL
    if (n.url && isSafeUrl(n.url)) {
      window.open(n.url, '_blank', 'noopener,noreferrer');
    } else if (window.__openModal) {
      window.__openModal(n.title, `${n.lbl} \u00b7 ${n.region} \u00b7 ${n.time} ago`);
    }
  });
}

function renderTab(tab, container) {
  const renderers = {
    news: renderNews,
    markets: renderMarkets,
    flights: renderFlights,
    ships: renderShips,
    signals: renderSignals,
  };

  const render = renderers[tab];
  if (render) {
    container.innerHTML = render();
    // Show footer only on signals tab
    const footer = document.getElementById('sidebar-footer');
    if (footer) {
      footer.style.display = tab === 'signals' ? 'block' : 'none';
    }
  }
}

export function refreshCurrentTab() {
  const container = document.getElementById('sidebar-content');
  if (!container) return;
  const renderers = { news: renderNews, markets: renderMarkets, flights: renderFlights, ships: renderShips, signals: renderSignals };
  const render = renderers[currentTab];
  if (render) container.innerHTML = render();
}

// ── News ──
const escapeHtml = safeEscape;

function reSignalClass(signal) {
  if (!signal) return 'neutral';
  const s = signal.toUpperCase();
  if (s.startsWith('BULLISH')) return 'bullish';
  if (s === 'WATCH' || s === 'WATCH-BULLISH') return 'watch';
  if (s.startsWith('BEARISH')) return 'bearish';
  return 'neutral';
}

function renderNews() {
  const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const hasLive = news.length > 0 && news[0].source;

  const header = `
    <div class="news-header">
      <div class="news-header__status">
        ${hasLive
          ? `<span class="news-header__live"><span class="news-header__live-dot"></span>LIVE</span> Updated ${ts}`
          : `<span class="news-header__static">Cached feed</span>`
        }
      </div>
      <button class="news-refresh-btn" id="news-refresh-btn">\u21BB Refresh</button>
    </div>
  `;

  const cards = news.map((n, i) => {
    const src = n.source ? ` \u00b7 ${escapeHtml(n.source)}` : '';
    const hasUrl = n.url ? ' has-link' : '';
    const signalClass = reSignalClass(n.reSignal);
    const reHtml = n.reImpact ? `
        <div class="news-card__re-impact">
          <span class="re-signal-badge re-signal-badge--${signalClass}">${n.reSignal || 'NEUTRAL'}</span>
          <span class="news-card__re-text">${escapeHtml(n.reImpact)}</span>
        </div>` : '';
    return `
      <div class="card-item${hasUrl}" data-news-idx="${i}">
        <div class="news-card__category news-card__category--${escapeHtml(n.cat)}">${escapeHtml(n.lbl)} \u00b7 ${escapeHtml(n.region)}</div>
        <div class="news-card__title">${escapeHtml(n.title)}</div>${reHtml}
        <div class="news-card__meta">${escapeHtml(n.time)} ago${src}</div>
      </div>
    `;
  }).join('');

  return header + cards;
}

// ── Markets ──
function renderMarkets() {
  // Only instruments with a fetched price are listed; the header says LIVE
  // only when a fetch has actually landed, with the time it did.
  const priced = markets.filter(m => m.live && typeof m.price === 'number' && Number.isFinite(m.price));
  const lastAt = priced.reduce((t, m) => (m.at && m.at > t ? m.at : t), 0);
  const ts = lastAt ? new Date(lastAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

  const header = `
    <div class="news-header">
      <div class="news-header__status">
        ${priced.length
          ? `<span class="news-header__live"><span class="news-header__live-dot"></span>LIVE</span> Updated ${ts}`
          : `<span class="news-header__static">No live prices</span> nothing fetched yet`
        }
      </div>
      <button class="news-refresh-btn" id="markets-refresh-btn">\u21BB Refresh</button>
    </div>
  `;

  if (!priced.length) {
    return header + '<div class="card-item"><div class="market-row__sub">Prices appear here only once a real quote has been fetched \u2014 none is seeded.</div></div>';
  }

  const cards = priced.map(m => {
    const cls = m.chg >= 0 ? 'up' : 'dn';
    const sign = m.chg >= 0 ? '+' : '';
    const val = formatPrice(m.price, m.sym);
    const arrow = m.chg >= 0 ? '\u25B2' : '\u25BC';
    const dirClass = reSignalClass(m.reDirection);
    const reHtml = m.reCorrelation ? `
        <div class="market-row__re">
          <span class="re-signal-badge re-signal-badge--${dirClass}">${escapeHtml(m.reDirection || 'NEUTRAL')}</span>
          <span class="market-row__re-text">${escapeHtml(m.reCorrelation)}</span>
        </div>` : '';
    return `
      <div class="card-item">
        <div class="market-row">
          <div>
            <div class="market-row__name">${escapeHtml(m.sym)}</div>
            <div class="market-row__sub">${escapeHtml(m.name)}</div>
          </div>
          <div style="text-align:right">
            <div class="market-row__price">$${val}</div>
            <div class="market-row__change ${cls}">${arrow} ${sign}${m.chg.toFixed(2)}%</div>
          </div>
        </div>${reHtml}
      </div>
    `;
  }).join('');

  return header + cards;
}

// ── Flights ──
// Live OpenSky ADS-B positions (js/live-layers.js). The header says LIVE
// only after a real fetch, STALE when the latest refresh failed but earlier
// positions stand, and NO FEED before anything has landed. Ships below
// remain a labelled reference set — no free, licensed AIS feed exists.
const DXB = { lat: 25.25, lng: 55.36 };
function renderFlights() {
  const meta = layerMeta.flights;
  const at = meta.fetchedAt ? new Date(meta.fetchedAt).toISOString().slice(11, 16) + ' UTC' : '';
  const n = flights.length.toLocaleString('en-US');
  const status = meta.ok
    ? `<span class="news-header__live"><span class="news-header__live-dot"></span>LIVE</span> ${n} airborne of ${Number(meta.received || 0).toLocaleString('en-US')} heard \u00b7 OpenSky ADS-B (${escapeHtml(meta.auth || 'anonymous')}) \u00b7 ${at}`
    : flights.length
      ? `<span class="news-header__static">STALE</span> refresh failed (${escapeHtml(meta.error || '')}) \u2014 ${n} positions from ${at} stand`
      : `<span class="news-header__static">NO FEED</span> ${escapeHtml(meta.error || 'nothing fetched yet')}`;

  const header = `
    <div class="news-header">
      <div class="news-header__status">${status}</div>
    </div>
  `;

  if (!flights.length) {
    return header + '<div class="card-item"><div class="market-row__sub">Aircraft appear here only from a real OpenSky fetch \u2014 nothing is seeded.</div></div>';
  }

  // The forty aircraft nearest Dubai, with what the transponder reports
  const d2 = f => (f.lat - DXB.lat) ** 2 + ((f.lng - DXB.lng) * Math.cos(DXB.lat * Math.PI / 180)) ** 2;
  const nearest = [...flights].sort((x, y) => d2(x) - d2(y)).slice(0, 40);
  const cards = nearest.map(f => {
    const alt = f.alt != null ? `${Math.round(f.alt * 3.281).toLocaleString('en-US')} ft` : 'alt n/a';
    const spd = f.vel != null ? ` \u00b7 ${Math.round(f.vel * 1.944)} kn` : '';
    const hdg = f.hdg != null ? ` \u00b7 ${f.hdg}\u00b0` : '';
    return `
    <div class="card-item">
      <div class="track-card">
        <div>
          <div class="track-card__callsign">${escapeHtml(f.call || f.icao)}</div>
          <div class="track-card__route">${escapeHtml(f.country)}</div>
          <div class="track-card__detail">${alt}${spd}${hdg}</div>
        </div>
        <div class="track-card__coords">
          <div>${Math.abs(f.lat).toFixed(1)}\u00b0${f.lat >= 0 ? 'N' : 'S'}</div>
          <div>${Math.abs(f.lng).toFixed(1)}\u00b0${f.lng >= 0 ? 'E' : 'W'}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  return header + `<div class="card-item"><div class="market-row__sub">Nearest 40 to Dubai of ${n} airborne \u00b7 aircraft outside OpenSky sensor coverage (oceans, parts of Africa and Asia) are not seen</div></div>` + cards;
}

// ── Ships ──
function renderShips() {
  const tankers = ships.filter(s => s.type === 'tanker').length;
  const dark = ships.filter(s => s.type === 'dark').length;
  const cargo = ships.length - tankers - dark;

  const header = `
    <div class="news-header">
      <div class="news-header__status">
        <span class="news-header__ref">REFERENCE</span> ${cargo} cargo \u00b7 ${tankers} tanker${tankers !== 1 ? 's' : ''} \u00b7 ${dark} dark \u2014 major sea lanes, not a live AIS feed
      </div>
    </div>
  `;

  const cards = ships.map(s => {
    const badgeCls = s.type === 'tanker' ? 'tanker' : s.type === 'dark' ? 'dark' : 'cargo';
    return `
      <div class="card-item">
        <div class="track-card">
          <div>
            <div class="track-card__callsign">
              ${escapeHtml(s.name)}
              <span class="badge badge--${badgeCls}">${escapeHtml(String(s.type).toUpperCase())}</span>
            </div>
            <div class="track-card__route">${escapeHtml(s.dest)}</div>
            <div class="track-card__detail">${escapeHtml(s.speed)}</div>
          </div>
          <div class="track-card__coords">
            <div>${s.lat.toFixed(1)}\u00b0N</div>
            <div>${s.lng.toFixed(1)}\u00b0E</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return header + cards;
}

// ── Dubai RE Signals — real PIX signals from the DLD register ──
// A dated snapshot refreshed weekly, not a streaming feed: no pulsing
// live dot and no Refresh button, the same rule as flights and ships.
function renderSignals() {
  const up = pixSignals.filter(s => s.direction === 1).length;
  const dn = pixSignals.filter(s => s.direction === -1).length;

  const header = `
    <div class="news-header">
      <div class="news-header__status">
        <span class="news-header__ref">DLD</span> ${up} rising \u00b7 ${dn} falling \u00b7 detected through ${PIX_SIGNALS_AS_OF}
      </div>
    </div>
  `;

  const cards = pixSignals.map(s => {
    const meta = SIGNAL_TYPES[s.type];
    const copy = signalCopy(s);
    const arrow = s.direction === 1 ? '\u25b2' : s.direction === -1 ? '\u25bc' : '\u25cf';
    return `
    <div class="signal-card signal-card--${meta.tone}">
      <div class="signal-card__trigger">${escapeHtml(s.entity)}</div>
      <div class="signal-card__chain">${escapeHtml(copy.headline)}</div>
      <div class="signal-card__areas"><span class="signal-area-tag">${escapeHtml(s.area || 'Dubai')}</span></div>
      <div class="signal-card__footer">
        <span class="signal-card__sector">${meta.label}</span>
        <span class="signal-card__sentiment ${meta.tone}">${signalAge(s.detectedOn)} ${arrow}</span>
      </div>
      <div class="signal-card__magnitude"><span class="signal-detail-label">Evidence</span> ${escapeHtml(copy.detail)}</div>
    </div>
  `;
  }).join('');

  return header + cards;
}
