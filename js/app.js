// ═══════════════════════════════════════════════════════════
// APP — Main Orchestration, State Management, Init
// ═══════════════════════════════════════════════════════════

import { initMap, renderDynLayers, animateTrackers, toggleLayer, setCountryClickHandler, getMap } from './map.js';
import { initSidebar, refreshCurrentTab, getCurrentTab } from './sidebar.js';
import { buildTicker } from './ticker.js';
import { showCountryPanel, initPanels } from './panels.js';
import { updateClock } from './utils.js';
import { loadFromAPI, dubaiSignals } from './data.js';
import { initHero } from './hero.js';
import { initMacro, updateMacroData } from './macro.js';
import { initBroadcasts } from './broadcasts.js';
import { initDubaiIntel } from './dubai-intel.js';
import { initRegionDrawer } from './regions.js';
import { startLiveNewsRefresh } from './news-live.js';
import { startLiveMarketRefresh } from './markets-live.js';
import { refreshAlertBanner } from './hero.js';

// ── Boot ──
async function boot() {
  // Try loading data from Neon via API (falls back to hardcoded)
  await loadFromAPI();

  // Init new sections
  initHero();
  initMacro();
  initBroadcasts();
  initDubaiIntel();
  initSignals();

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

  // Init panels + modals + region drawer
  initPanels();
  initRegionDrawer();

  // Connect country click from map to panel
  setCountryClickHandler((name, score, region) => {
    showCountryPanel(name, score, region);
  });

  // Render dynamic map layers after brief delay for tiles to load
  setTimeout(() => renderDynLayers(), 600);

  // Invalidate map size when scrolled into view
  initMapResize();

  // Animate trackers
  setInterval(animateTrackers, 1200);

  // Expose buildTicker globally so sidebar refresh button can update it
  window.__rebuildTicker = buildTicker;

  // Live market data (CoinGecko + Yahoo Finance) — refreshes every 60s
  startLiveMarketRefresh(() => {
    buildTicker();
    if (getCurrentTab() === 'markets') refreshCurrentTab();
  });

  // Macro data fluctuation (slower)
  setInterval(updateMacroData, 8000);

  // Nav button handlers (section scrolling)
  initNav();

  // Layer control handlers
  initLayerControls();

  // Sidebar toggle
  initSidebarToggle();

  // Section reveal animations
  initSectionReveal();

  // Start live news refresh (RSS feeds) — updates sidebar + hero alert
  startLiveNewsRefresh(() => {
    if (getCurrentTab() === 'news') refreshCurrentTab();
    refreshAlertBanner();
  });
}

// ── Navigation (Section Scrolling) ──
function initNav() {
  const navBtns = document.querySelectorAll('.nav-btn');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sectionId = btn.dataset.section;
      const section = document.getElementById(sectionId);
      if (section) {
        const navHeight = document.querySelector('.nav')?.offsetHeight || 44;
        const top = section.getBoundingClientRect().top + window.scrollY - navHeight;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // Intersection Observer to update active nav button on scroll
  const sections = document.querySelectorAll('section[id^="section-"]');
  if (!sections.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navBtns.forEach(b => b.classList.toggle('active', b.dataset.section === id));
      }
    });
  }, { threshold: 0.15, rootMargin: '-10% 0px -10% 0px' });

  sections.forEach(s => observer.observe(s));
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

// ── Map Resize on Scroll Into View ──
function initMapResize() {
  const mapSection = document.getElementById('section-map');
  const map = getMap();
  if (!mapSection || !map) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setTimeout(() => map.invalidateSize(), 100);
      }
    });
  }, { threshold: 0.1 });

  observer.observe(mapSection);
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

// ── Section Reveal Animations ──
function initSectionReveal() {
  const sections = document.querySelectorAll('.section, .section--full');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
      }
    });
  }, { threshold: 0.05 });

  sections.forEach(s => {
    if (!s.classList.contains('hero') && !s.classList.contains('map-section')) {
      s.classList.add('section-reveal');
      observer.observe(s);
    }
  });
}

// ── Init on DOM Ready ──
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
