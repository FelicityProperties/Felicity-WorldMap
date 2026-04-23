// ═══════════════════════════════════════════════════════════
// APP — Main Orchestration, Tab Routing, Init
// ═══════════════════════════════════════════════════════════

import { initMap, renderDynLayers, animateTrackers, toggleLayer, setCountryClickHandler, getMap } from './map.js';
import { initSidebar, refreshCurrentTab, getCurrentTab } from './sidebar.js';
import { buildTicker } from './ticker.js';
import { showCountryPanel, initPanels } from './panels.js';
import { updateClock } from './utils.js';
import { loadFromAPI, dubaiSignals } from './data.js';
import { initHero, refreshAlertBanner } from './hero.js';
import { initMacro, updateMacroData } from './macro.js';
import { initBroadcasts } from './broadcasts.js';
import { initDubaiIntel } from './dubai-intel.js';
import { initRegionDrawer } from './regions.js';
import { initSP500 } from './sp500.js';
import { startLiveNewsRefresh } from './news-live.js';
import { startLiveMarketRefresh } from './markets-live.js';
import { DESK_CALLS, HISTORICAL_ANALOGS, renderConvictionBadge, extractConviction } from './prompts.js';

// ── State ──
let activeTab = 'overview';
let mapInitialized = false;

// ── Boot ──
async function boot() {
  // Try loading data from Neon via API (falls back to hardcoded)
  await loadFromAPI();

  // Init clock FIRST — it's in the topbar which is always visible
  const clockEl = document.getElementById('clock');
  if (clockEl) {
    updateClock(clockEl);
    setInterval(() => updateClock(clockEl), 1000);
  }

  // Init ticker
  buildTicker();

  // Init sections that render into their tab panels
  initHero();
  initMacro();
  initBroadcasts();
  initDubaiIntel();
  initSP500();
  initSignals();
  initDesk();
  initDeskCalls();
  initPlaybook();

  // Init panels + modals + region drawer
  initPanels();
  initRegionDrawer();

  // Expose buildTicker globally so sidebar refresh button can update it
  window.__rebuildTicker = buildTicker;

  // Live market data (CoinGecko + Yahoo Finance) — refreshes every 60s
  startLiveMarketRefresh(() => {
    buildTicker();
    if (getCurrentTab() === 'markets') refreshCurrentTab();
  });

  // Macro data fluctuation (slower)
  setInterval(updateMacroData, 8000);

  // Nav tab routing
  initTabRouting();

  // Overview card click navigation
  initOverviewCards();

  // Layer control handlers
  initLayerControls();

  // Sidebar toggle
  initSidebarToggle();

  // Start live news refresh (RSS feeds) — updates sidebar + hero alert
  startLiveNewsRefresh(() => {
    if (getCurrentTab() === 'news') refreshCurrentTab();
    refreshAlertBanner();
  });

  // Animate trackers continuously + auto-refresh sidebar if viewing flights/ships
  setInterval(() => {
    animateTrackers();
    const tab = getCurrentTab();
    if (tab === 'flights' || tab === 'ships') {
      refreshCurrentTab();
    }
  }, 1200);
}

// ── Tab Routing ──
function initTabRouting() {
  const navBtns = document.querySelectorAll('.nav-btn[data-tab]');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      if (tabId === activeTab) return;
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  const prevTab = activeTab;
  activeTab = tabId;

  // Update nav buttons
  const navBtns = document.querySelectorAll('.nav-btn[data-tab]');
  navBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));

  // Update tab panels
  const panels = document.querySelectorAll('.tab-panel');
  panels.forEach(p => p.classList.remove('is-active'));

  const targetPanel = document.getElementById('tab-' + tabId);
  if (targetPanel) targetPanel.classList.add('is-active');

  // Lazy-init the map on first visit to World Map tab
  if (tabId === 'worldmap' && !mapInitialized) {
    initMapTab();
  }

  // Invalidate map size when switching to map tab
  if (tabId === 'worldmap' && mapInitialized) {
    const map = getMap();
    if (map) {
      setTimeout(() => map.invalidateSize(), 50);
    }
  }
}

// ── Lazy Map Init ──
function initMapTab() {
  mapInitialized = true;

  // Init map
  initMap();

  // Init sidebar
  initSidebar();

  // Connect country click from map to panel
  setCountryClickHandler((name, score, region) => {
    showCountryPanel(name, score, region);
  });

  // Render dynamic map layers after brief delay for tiles to load
  setTimeout(() => renderDynLayers(), 600);

  // Invalidate map size after everything is laid out
  const map = getMap();
  if (map) {
    setTimeout(() => map.invalidateSize(), 100);
  }
}

// ── Overview Cards — Navigate to tabs ──
function initOverviewCards() {
  document.querySelectorAll('.overview-card[data-goto]').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.dataset.goto;
      if (target) switchTab(target);
    });
  });
}

// ── Layer Controls ──
function initLayerControls() {
  document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const layer = btn.dataset.layer;
      toggleLayer(layer, btn);
    });
  });
}

// ── Sidebar Toggle ──
function initSidebarToggle() {
  const toggleBtn = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('is-open');
    });
  }
}

// ── Signals Section Rendering ──
function signalSentimentClass(sentiment) {
  if (sentiment === 'bullish') return 'bullish';
  if (sentiment === 'bearish') return 'bearish';
  return 'neutral';
}

function signalActionClass(action) {
  if (!action) return 'neutral';
  const a = action.toUpperCase();
  if (a.includes('BULLISH') || a.includes('ACCUMULATE')) return 'bullish';
  if (a.includes('BEARISH')) return 'bearish';
  if (a.includes('WATCH') || a.includes('HOLD')) return 'watch';
  return 'neutral';
}

let signalFilters = { sentiment: 'all', segment: 'all', horizon: 'all' };

function initSignals() {
  const grid = document.getElementById('signals-grid');
  if (!grid || !dubaiSignals.length) return;

  // Insert filter controls before the grid
  const section = document.getElementById('section-signals');
  if (section && !document.getElementById('signal-filters')) {
    const filterHtml = `
      <div class="signal-filters" id="signal-filters">
        <div class="signal-filter-group">
          <button class="signal-filter-btn active" data-filter="sentiment" data-value="all">All</button>
          <button class="signal-filter-btn" data-filter="sentiment" data-value="bullish">Bullish</button>
          <button class="signal-filter-btn" data-filter="sentiment" data-value="neutral">Watch</button>
          <button class="signal-filter-btn" data-filter="sentiment" data-value="bearish">Bearish</button>
        </div>
        <div class="signal-filter-group">
          <button class="signal-filter-btn active" data-filter="segment" data-value="all">All</button>
          <button class="signal-filter-btn" data-filter="segment" data-value="Luxury">Luxury</button>
          <button class="signal-filter-btn" data-filter="segment" data-value="Premium">Premium</button>
          <button class="signal-filter-btn" data-filter="segment" data-value="Mid-market">Mid</button>
          <button class="signal-filter-btn" data-filter="segment" data-value="Affordable">Affordable</button>
        </div>
        <div class="signal-filter-group">
          <button class="signal-filter-btn active" data-filter="horizon" data-value="all">All</button>
          <button class="signal-filter-btn" data-filter="horizon" data-value="immediate">Immediate</button>
          <button class="signal-filter-btn" data-filter="horizon" data-value="short">Short</button>
          <button class="signal-filter-btn" data-filter="horizon" data-value="medium">Medium</button>
          <button class="signal-filter-btn" data-filter="horizon" data-value="long">Long</button>
        </div>
      </div>
    `;
    grid.insertAdjacentHTML('beforebegin', filterHtml);

    // Filter click handler
    document.getElementById('signal-filters').addEventListener('click', e => {
      const btn = e.target.closest('.signal-filter-btn');
      if (!btn) return;
      const filterType = btn.dataset.filter;
      const filterValue = btn.dataset.value;

      // Update active state within group
      btn.closest('.signal-filter-group').querySelectorAll('.signal-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      signalFilters[filterType] = filterValue;
      renderSignalCards(grid);
    });
  }

  // Signal card expand click handler
  grid.addEventListener('click', e => {
    const card = e.target.closest('.signal-list-card');
    if (!card) return;
    card.classList.toggle('is-expanded');
  });

  renderSignalCards(grid);
}

function renderSignalCards(grid) {
  const filtered = dubaiSignals.filter(s => {
    if (signalFilters.sentiment !== 'all' && s.sentiment !== signalFilters.sentiment) return false;
    if (signalFilters.segment !== 'all' && (s.segment || '') !== signalFilters.segment) return false;
    if (signalFilters.horizon !== 'all' && (s.timeHorizon || '') !== signalFilters.horizon) return false;
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="signal-empty">No signals match current filters</div>';
    return;
  }

  // Featured signal (first item)
  const featured = filtered[0];
  const rest = filtered.slice(1);

  const areasHtml = (areas) => (areas || []).map(a => `<span class="signal-area-tag">${a}</span>`).join('');
  const sentArrow = (s) => s.sentiment === 'bullish' ? '\u25B2' : s.sentiment === 'bearish' ? '\u25BC' : '\u25CF';

  const featuredHtml = `
    <div class="signal-featured signal-featured--${featured.sentiment}">
      <div class="signal-featured__header">
        <span class="signal-featured__trigger">${featured.trigger}</span>
        <span class="signal-featured__time">${featured.time} ago</span>
      </div>
      <div class="signal-featured__chain">${featured.chain}</div>
      <div class="signal-featured__areas">${areasHtml(featured.areas)}</div>
      <div class="signal-featured__footer">
        <span class="signal-featured__sector">${featured.sector}</span>
        <span class="signal-action-badge signal-action-badge--${signalActionClass(featured.action)}">${featured.action || ''}</span>
        <span class="signal-featured__impact signal-featured__impact--${featured.sentiment}">${featured.impact} ${sentArrow(featured)}</span>
      </div>
      <div class="signal-featured__detail">
        <div class="signal-detail-row"><span class="signal-detail-label">Magnitude</span><span class="signal-detail-value">${featured.magnitude || ''}</span></div>
        <div class="signal-detail-row"><span class="signal-detail-label">Time Horizon</span><span class="signal-detail-value">${featured.timeHorizon || ''}</span></div>
        <div class="signal-detail-row"><span class="signal-detail-label">Region</span><span class="signal-detail-value">${featured.triggerRegion || ''}</span></div>
        ${featured.historicalAnalog ? `<div class="signal-historical">${featured.historicalAnalog}</div>` : ''}
      </div>
    </div>
  `;

  const listHtml = rest.map((s, i) => `
    <div class="signal-list-card signal-list-card--${s.sentiment}" style="animation-delay:${(i + 1) * 60}ms">
      <div class="signal-list-card__header">
        <div class="signal-list-card__trigger">${s.trigger}</div>
        <span class="signal-list-card__time">${s.time} ago</span>
      </div>
      <div class="signal-list-card__chain">${s.chain}</div>
      <div class="signal-list-card__areas">${areasHtml(s.areas)}</div>
      <div class="signal-list-card__footer">
        <span class="signal-list-card__sector">${s.sector}</span>
        <span class="signal-action-badge signal-action-badge--${signalActionClass(s.action)}">${s.action || ''}</span>
        <span class="signal-list-card__sentiment signal-list-card__sentiment--${s.sentiment}">${s.impact} ${sentArrow(s)}</span>
      </div>
      <div class="signal-list-card__magnitude">
        <span class="signal-detail-label">Magnitude</span> ${s.magnitude || ''}
        <span class="signal-detail-label" style="margin-left:12px">Horizon</span> ${s.timeHorizon || ''}
      </div>
      <div class="signal-list-card__expandable">
        ${s.historicalAnalog ? `<div class="signal-historical">${s.historicalAnalog}</div>` : ''}
      </div>
    </div>
  `).join('');

  grid.innerHTML = featuredHtml + listHtml;
}

// ── Ask the Desk ──
function initDesk() {
  const input = document.getElementById('desk-input');
  const btn = document.getElementById('desk-btn');
  const responseEl = document.getElementById('desk-response');
  const convictionEl = document.getElementById('desk-conviction');
  const textEl = document.getElementById('desk-text');
  const suggestionsEl = document.getElementById('desk-suggestions');

  if (!input || !btn) return;

  async function askDesk(question) {
    if (!question.trim()) return;
    btn.disabled = true;
    btn.textContent = 'Thinking...';
    responseEl.style.display = 'block';
    convictionEl.innerHTML = '';
    textEl.textContent = 'Analyzing macro conditions and Dubai RE implications...';

    try {
      const res = await fetch('/api/desk/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      const data = await res.json();
      const conviction = data.conviction || extractConviction(data.response || '');
      if (conviction) convictionEl.innerHTML = renderConvictionBadge(conviction);
      textEl.textContent = data.response || 'No response generated.';
    } catch (e) {
      textEl.textContent = 'Error connecting to the Desk. Check API configuration.';
    }

    btn.disabled = false;
    btn.textContent = 'Ask →';
  }

  btn.addEventListener('click', () => askDesk(input.value));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') askDesk(input.value); });

  if (suggestionsEl) {
    suggestionsEl.addEventListener('click', e => {
      const s = e.target.closest('.desk-ask__suggestion');
      if (!s) return;
      input.value = s.dataset.q;
      askDesk(s.dataset.q);
    });
  }
}

// ── Active Calls ──
function initDeskCalls() {
  const grid = document.getElementById('desk-calls-grid');
  if (!grid) return;

  grid.innerHTML = DESK_CALLS.map(c => {
    const callClass = c.call.toLowerCase();
    const dots = Array.from({length: 5}, (_, i) =>
      `<span class="conviction-dot ${i < c.conviction ? 'conviction-dot--active' : ''}"></span>`
    ).join('');

    return `
      <div class="desk-call-card">
        <div class="desk-call-card__header">
          <div class="desk-call-card__area">${c.area}</div>
          <span class="desk-call-card__call desk-call-card__call--${callClass}">${c.call}</span>
        </div>
        <div class="desk-call-card__conviction">
          <div class="conviction-dots">${dots}</div>
          <span class="desk-call-card__conviction-label">${c.conviction}/5</span>
        </div>
        <div class="desk-call-card__thesis">${c.thesis}</div>
        <div class="desk-call-card__risk"><span class="desk-call-card__risk-label">Risk:</span> ${c.risk}</div>
        <div class="desk-call-card__badges">
          <span class="desk-call-card__badge">${c.horizon}</span>
          <span class="desk-call-card__badge">${c.segment}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ── Historical Playbook ──
function initPlaybook() {
  const el = document.getElementById('desk-playbook');
  if (!el) return;

  el.innerHTML = HISTORICAL_ANALOGS.map(a => `
    <div class="desk-playbook__item">
      <div class="desk-playbook__event">${a.event}</div>
      <div class="desk-playbook__impact">${a.impact}</div>
      <div class="desk-playbook__lesson">${a.lesson}</div>
    </div>
  `).join('');
}

// ── Init on DOM Ready ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
