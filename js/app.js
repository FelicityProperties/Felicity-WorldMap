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
import { startLiveNewsRefresh } from './news-live.js';
import { startLiveMarketRefresh } from './markets-live.js';

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
  initSignals();

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
function initSignals() {
  const grid = document.getElementById('signals-grid');
  if (!grid || !dubaiSignals.length) return;

  // Featured signal (first item)
  const featured = dubaiSignals[0];
  const rest = dubaiSignals.slice(1);

  const featuredHtml = `
    <div class="signal-featured">
      <div class="signal-featured__header">
        <span class="signal-featured__trigger">${featured.trigger}</span>
        <span class="signal-featured__time">${featured.time} ago</span>
      </div>
      <div class="signal-featured__chain">${featured.chain}</div>
      <div class="signal-featured__footer">
        <span class="signal-featured__sector">${featured.sector}</span>
        <span class="signal-featured__impact signal-featured__impact--${featured.sentiment}">${featured.impact} ${featured.sentiment === 'bullish' ? '\u25B2' : '\u25BC'}</span>
      </div>
    </div>
  `;

  const listHtml = rest.map((s, i) => `
    <div class="signal-list-card" style="animation-delay:${(i + 1) * 60}ms">
      <div class="signal-list-card__trigger">${s.trigger}</div>
      <div class="signal-list-card__chain">${s.chain}</div>
      <div class="signal-list-card__footer">
        <span class="signal-list-card__sector">${s.sector}</span>
        <span class="signal-list-card__sentiment signal-list-card__sentiment--${s.sentiment}">${s.impact} ${s.sentiment === 'bullish' ? '\u25B2' : '\u25BC'}</span>
      </div>
    </div>
  `).join('');

  grid.innerHTML = featuredHtml + listHtml;
}

// ── Init on DOM Ready ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
