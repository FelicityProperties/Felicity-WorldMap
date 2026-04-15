// ═══════════════════════════════════════════════════════════
// APP — Main Orchestration, State Management, Init
// ═══════════════════════════════════════════════════════════

import { initMap, renderDynLayers, animateTrackers, toggleLayer, setCountryClickHandler } from './map.js';
import { initSidebar, refreshCurrentTab, getCurrentTab } from './sidebar.js';
import { buildTicker, updateMarketData } from './ticker.js';
import { showCountryPanel, initPanels } from './panels.js';
import { updateClock } from './utils.js';
import { loadFromAPI } from './data.js';

// ── Boot ──
async function boot() {
  // Try loading data from Neon via API (falls back to hardcoded)
  await loadFromAPI();

  // Init map
  initMap();

  // Init ticker
  buildTicker();

  // Init clock
  const clockEl = document.getElementById('clock');
  if (clockEl) {
    updateClock(clockEl);
    setInterval(() => updateClock(clockEl), 1000);
  }

  // Init sidebar
  initSidebar();

  // Init panels + modals
  initPanels();

  // Connect country click from map to panel
  setCountryClickHandler((name, score, region) => {
    showCountryPanel(name, score, region);
  });

  // Render dynamic map layers after brief delay for tiles to load
  setTimeout(() => renderDynLayers(), 600);

  // Animate trackers
  setInterval(animateTrackers, 1200);

  // Market data fluctuation
  setInterval(() => {
    updateMarketData();
    buildTicker();
    if (getCurrentTab() === 'markets') {
      refreshCurrentTab();
    }
  }, 3500);

  // Nav button handlers
  initNav();

  // Layer control handlers
  initLayerControls();

  // Sidebar toggle
  initSidebarToggle();
}

// ── Navigation ──
function initNav() {
  const navBtns = document.querySelectorAll('.nav-btn');
  const sidebarTabs = document.querySelectorAll('.stab');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const view = btn.dataset.view;

      // Map tab→sidebar tab correspondence
      const tabMap = {
        flights: 'flights',
        ships: 'ships',
        markets: 'markets',
        intel: null
      };

      if (view === 'intel') {
        window.__openModal && window.__openModal(
          'AI Intelligence',
          'Connect your Anthropic API key to enable live global intelligence briefings powered by Claude.'
        );
        return;
      }

      const targetTab = tabMap[view];
      if (targetTab) {
        // Click the corresponding sidebar tab
        sidebarTabs.forEach(t => {
          if (t.dataset.tab === targetTab) t.click();
        });
      }
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
      const app = document.getElementById('app');
      const isCollapsed = app.classList.contains('sidebar-collapsed');

      if (isCollapsed) {
        app.classList.remove('sidebar-collapsed');
        sidebar.classList.add('is-open');
      } else {
        // On tablet, just toggle sidebar visibility
        sidebar.classList.toggle('is-open');
      }
    });
  }
}

// ── Init on DOM Ready ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
