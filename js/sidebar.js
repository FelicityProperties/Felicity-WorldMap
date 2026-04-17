// ═══════════════════════════════════════════════════════════
// SIDEBAR — Tab Switching, Card Rendering
// ═══════════════════════════════════════════════════════════

import { news, markets, flights, ships, dubaiSignals } from './data.js';
import { formatPrice } from './utils.js';
import { fetchLiveNews } from './news-live.js';
import { refreshAlertBanner } from './hero.js';

let currentTab = 'news';
let onNewsClick = null;
let isRefreshing = false;

export function setNewsClickHandler(fn) { onNewsClick = fn; }

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

  // News card click: open real article URL if available, else modal
  content.addEventListener('click', e => {
    // Refresh button handler
    const refreshBtn = e.target.closest('#news-refresh-btn');
    if (refreshBtn && !isRefreshing) {
      isRefreshing = true;
      refreshBtn.classList.add('is-loading');
      refreshBtn.textContent = 'Fetching...';
      fetchLiveNews().then(ok => {
        isRefreshing = false;
        refreshBtn.classList.remove('is-loading');
        refreshBtn.textContent = '\u21BB Refresh';
        if (ok) {
          content.innerHTML = renderNews();
          refreshAlertBanner();
        }
      });
      return;
    }

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
  if (currentTab === 'markets') container.innerHTML = renderMarkets();
  if (currentTab === 'news') container.innerHTML = renderNews();
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
  return markets.map(m => {
    const cls = m.chg >= 0 ? 'up' : 'dn';
    const sign = m.chg >= 0 ? '+' : '';
    const val = formatPrice(m.price, m.sym);
    return `
      <div class="card-item">
        <div class="market-row">
          <div>
            <div class="market-row__name">${m.sym}</div>
            <div class="market-row__sub">${m.name}</div>
          </div>
          <div style="text-align:right">
            <div class="market-row__price">$${val}</div>
            <div class="market-row__change ${cls}">${sign}${m.chg.toFixed(2)}%</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Flights ──
function renderFlights() {
  return flights.map(f => `
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
}

// ── Ships ──
function renderShips() {
  return ships.map(s => {
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
}

// ── Dubai RE Signals ──
function renderSignals() {
  return dubaiSignals.map(s => `
    <div class="signal-card">
      <div class="signal-card__trigger">${s.trigger}</div>
      <div class="signal-card__chain">${s.chain}</div>
      <div class="signal-card__footer">
        <span class="signal-card__sector">${s.sector}</span>
        <span class="signal-card__sentiment ${s.sentiment}">${s.impact} ${s.sentiment === 'bullish' ? '\u25b2' : '\u25bc'}</span>
      </div>
    </div>
  `).join('');
}
