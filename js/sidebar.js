// ═══════════════════════════════════════════════════════════
// SIDEBAR — Tab Switching, Card Rendering
// ═══════════════════════════════════════════════════════════

import { news, markets, flights, ships, dubaiSignals } from './data.js';
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
    const flightsRefresh = e.target.closest('#flights-refresh-btn');
    if (flightsRefresh) {
      content.innerHTML = renderFlights();
      return;
    }

    // Ships refresh button
    const shipsRefresh = e.target.closest('#ships-refresh-btn');
    if (shipsRefresh) {
      content.innerHTML = renderShips();
      return;
    }

    // RE Signals refresh button
    const signalsRefresh = e.target.closest('#signals-refresh-btn');
    if (signalsRefresh) {
      content.innerHTML = renderSignals();
      return;
    }

    // News card click
    const card = e.target.closest('[data-news-idx]');
    if (!card) return;
    const idx = parseInt(card.dataset.newsIdx);
    const n = news[idx];
    if (!n) return;
    if (n.url) {
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
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str || '');
  return div.innerHTML;
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
    return `
      <div class="card-item${hasUrl}" data-news-idx="${i}">
        <div class="news-card__category news-card__category--${n.cat}">${escapeHtml(n.lbl)} \u00b7 ${escapeHtml(n.region)}</div>
        <div class="news-card__title">${escapeHtml(n.title)}</div>
        <div class="news-card__meta">${escapeHtml(n.time)} ago${src}</div>
      </div>
    `;
  }).join('');

  return header + cards;
}

// ── Markets ──
function renderMarkets() {
  const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const header = `
    <div class="news-header">
      <div class="news-header__status">
        <span class="news-header__live"><span class="news-header__live-dot"></span>LIVE</span> Updated ${ts}
      </div>
      <button class="news-refresh-btn" id="markets-refresh-btn">\u21BB Refresh</button>
    </div>
  `;

  const cards = markets.map(m => {
    const cls = m.chg >= 0 ? 'up' : 'dn';
    const sign = m.chg >= 0 ? '+' : '';
    const val = formatPrice(m.price, m.sym);
    const arrow = m.chg >= 0 ? '\u25B2' : '\u25BC';
    return `
      <div class="card-item">
        <div class="market-row">
          <div>
            <div class="market-row__name">${m.sym}</div>
            <div class="market-row__sub">${m.name}</div>
          </div>
          <div style="text-align:right">
            <div class="market-row__price">$${val}</div>
            <div class="market-row__change ${cls}">${arrow} ${sign}${m.chg.toFixed(2)}%</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return header + cards;
}

// ── Flights ──
function renderFlights() {
  const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const mil = flights.filter(f => f.type === 'mil').length;
  const com = flights.length - mil;

  const header = `
    <div class="news-header">
      <div class="news-header__status">
        <span class="news-header__live"><span class="news-header__live-dot"></span>TRACKING</span> ${com} commercial \u00b7 ${mil} military \u00b7 ${ts}
      </div>
      <button class="news-refresh-btn" id="flights-refresh-btn">\u21BB Refresh</button>
    </div>
  `;

  const cards = flights.map(f => `
    <div class="card-item">
      <div class="track-card">
        <div>
          <div class="track-card__callsign">
            ${f.call}
            <span class="badge badge--${f.type === 'mil' ? 'mil' : 'com'}">${f.type === 'mil' ? 'MIL' : 'COM'}</span>
          </div>
          <div class="track-card__route">${f.from} \u2192 ${f.to}</div>
          <div class="track-card__detail">${f.alt}</div>
        </div>
        <div class="track-card__coords">
          <div>${f.lat.toFixed(1)}\u00b0N</div>
          <div>${f.lng.toFixed(1)}\u00b0E</div>
        </div>
      </div>
    </div>
  `).join('');

  return header + cards;
}

// ── Ships ──
function renderShips() {
  const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const tankers = ships.filter(s => s.type === 'tanker').length;
  const dark = ships.filter(s => s.type === 'dark').length;
  const cargo = ships.length - tankers - dark;

  const header = `
    <div class="news-header">
      <div class="news-header__status">
        <span class="news-header__live"><span class="news-header__live-dot"></span>TRACKING</span> ${cargo} cargo \u00b7 ${tankers} tanker${tankers !== 1 ? 's' : ''} \u00b7 ${dark} dark \u00b7 ${ts}
      </div>
      <button class="news-refresh-btn" id="ships-refresh-btn">\u21BB Refresh</button>
    </div>
  `;

  const cards = ships.map(s => {
    const badgeCls = s.type === 'tanker' ? 'tanker' : s.type === 'dark' ? 'dark' : 'cargo';
    return `
      <div class="card-item">
        <div class="track-card">
          <div>
            <div class="track-card__callsign">
              ${s.name}
              <span class="badge badge--${badgeCls}">${s.type.toUpperCase()}</span>
            </div>
            <div class="track-card__route">${s.dest}</div>
            <div class="track-card__detail">${s.speed}</div>
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

// ── Dubai RE Signals ──
function renderSignals() {
  const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const bullish = dubaiSignals.filter(s => s.sentiment === 'bullish').length;
  const bearish = dubaiSignals.length - bullish;

  const header = `
    <div class="news-header">
      <div class="news-header__status">
        <span class="news-header__live"><span class="news-header__live-dot"></span>LIVE</span> ${bullish} bullish \u00b7 ${bearish} bearish \u00b7 ${ts}
      </div>
      <button class="news-refresh-btn" id="signals-refresh-btn">\u21BB Refresh</button>
    </div>
  `;

  const cards = dubaiSignals.map(s => `
    <div class="signal-card">
      <div class="signal-card__trigger">${s.trigger}</div>
      <div class="signal-card__chain">${s.chain}</div>
      <div class="signal-card__footer">
        <span class="signal-card__sector">${s.sector}</span>
        <span class="signal-card__sentiment ${s.sentiment}">${s.impact} ${s.sentiment === 'bullish' ? '\u25b2' : '\u25bc'}</span>
      </div>
    </div>
  `).join('');

  return header + cards;
}
