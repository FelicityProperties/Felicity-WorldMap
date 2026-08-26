// ═══════════════════════════════════════════════════════
// APP — Main Orchestration, Tab Routing, Init
// ═══════════════════════════════════════════════════════

import { initMap, renderDynLayers, animateTrackers, toggleLayer, setCountryClickHandler, getMap } from './map.js';
import { initSidebar, refreshCurrentTab, getCurrentTab } from './sidebar.js';
import { buildTicker } from './ticker.js';
import { showCountryPanel, initPanels } from './panels.js';
import { updateClock } from './utils.js';
import { loadFromAPI } from './data.js';
import { pixSignals, SIGNAL_TYPES, PIX_SIGNALS_AS_OF, signalCopy, signalAge, signalUrl } from './pix-signals.js';
import { initHero, refreshAlertBanner } from './hero.js';
import { initMacro, updateMacroData } from './macro.js';
import { initBroadcasts } from './broadcasts.js';
import { initDubaiIntel } from './dubai-intel.js';
import { initRegionDrawer } from './regions.js';
import { initSP500 } from './sp500.js';
import { initInvest, onInvestShown } from './invest.js';
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
  initInvest();
  initSignals();
  initDesk();
  initDeskCalls();
  initPlaybook();

  // Init panels + modals + region drawer
  initPanels();
  initRegionDrawer();

  // Init monetization features
  initNewsletter();
  initConsultation();
  initPricing();

  // Expose buildTicker globally so sidebar refresh button can update it
  window.__rebuildTicker = buildTicker;

  // Live market data (CoinGecko + Yahoo Finance) — refreshes every 60s
  startLiveMarketRefresh(() => {
    buildTicker();
    if (getCurrentTab() === 'markets') refreshCurrentTab();
  });

  // Macro data fluctuation (slower)
  setInterval(updateMacroData, 60000);

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

  // Mount the ticker tape the first time the Invest tab is actually visible
  if (tabId === 'invest') onInvestShown();

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
  // Overview cards and footer links both route by data-goto
  document.querySelectorAll('[data-goto]').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.dataset.goto;
      if (target) switchTab(target);
    });
  });

  // Footer links that scroll to a section on the current tab
  document.querySelectorAll('[data-scroll]').forEach(btn => {
    btn.addEventListener('click', () => {
      const el = document.getElementById(btn.dataset.scroll);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

// ── Signals Section — real PIX signals from registered DLD evidence ──
let signalFilter = 'all';

function initSignals() {
  const grid = document.getElementById('signals-grid');
  if (!grid || !pixSignals.length) return;

  const section = document.getElementById('section-signals');
  if (section && !document.getElementById('signal-filters')) {
    const counts = t => t === 'all' ? pixSignals.length : pixSignals.filter(s => s.type === t).length;
    const btn = (val, label) =>
      `<button class="signal-filter-btn${val === 'all' ? ' active' : ''}" data-value="${val}">${label} <span class="signal-filter-btn__n">${counts(val)}</span></button>`;

    grid.insertAdjacentHTML('beforebegin', `
      <div class="signal-filters" id="signal-filters">
        <div class="signal-filter-group">
          ${btn('all', 'All')}
          ${Object.entries(SIGNAL_TYPES).map(([k, v]) => btn(k, v.label)).join('')}
        </div>
        <div class="signal-source">
          Live from the DLD register · detected through ${PIX_SIGNALS_AS_OF} ·
          <a href="https://www.propertyindex.ae" target="_blank" rel="noopener">PropertyIndex ↗</a>
        </div>
      </div>
    `);

    document.getElementById('signal-filters').addEventListener('click', e => {
      const b = e.target.closest('.signal-filter-btn');
      if (!b) return;
      b.closest('.signal-filter-group').querySelectorAll('.signal-filter-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      signalFilter = b.dataset.value;
      renderSignalCards(grid);
    });
  }

  renderSignalCards(grid);
}

function renderSignalCards(grid) {
  const list = signalFilter === 'all'
    ? pixSignals
    : pixSignals.filter(s => s.type === signalFilter);

  if (!list.length) {
    grid.innerHTML = '<div class="signal-empty">No signals of this type in the current window</div>';
    return;
  }

  grid.innerHTML = list.map((s, i) => {
    const meta = SIGNAL_TYPES[s.type];
    const copy = signalCopy(s);
    const arrow = s.direction === 1 ? '\u25B2' : s.direction === -1 ? '\u25BC' : '\u25CF';
    return `
      <div class="signal-list-card signal-list-card--${meta.tone}" style="animation-delay:${i * 40}ms">
        <div class="signal-list-card__header">
          <div class="signal-list-card__trigger">${escapeHtml(s.entity)}</div>
          <span class="signal-list-card__time">${signalAge(s.detectedOn)}</span>
        </div>
        <div class="signal-list-card__chain">${escapeHtml(copy.headline)}</div>
        <div class="signal-list-card__areas">
          <span class="signal-area-tag">${escapeHtml(s.area || 'Dubai')}</span>
        </div>
        <div class="signal-list-card__footer">
          <span class="signal-list-card__sector">${meta.label}</span>
          <span class="signal-list-card__sentiment signal-list-card__sentiment--${meta.tone}">${arrow} registered</span>
        </div>
        <div class="signal-list-card__magnitude">${escapeHtml(copy.detail)}</div>
        <div class="signal-evidence">
          <span class="signal-evidence__badge">DLD</span>
          <span>Detected ${s.detectedOn}</span>
          <a href="${signalUrl(s)}" target="_blank" rel="noopener" title="View on PropertyIndex">↗</a>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str == null ? '' : str);
  return d.innerHTML;
}

// ── Ask Felicity ──
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

// ── Newsletter Signup ──
function initNewsletter() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const emailInput = document.getElementById('newsletter-email');
    const btn = form.querySelector('button');
    const email = emailInput.value.trim();
    if (!email) return;

    btn.textContent = 'Subscribing...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.success) {
        form.style.display = 'none';
        document.getElementById('newsletter-success').style.display = 'block';
      } else {
        btn.textContent = data.error || 'Error — try again';
        btn.disabled = false;
      }
    } catch {
      btn.textContent = 'Error — try again';
      btn.disabled = false;
    }
  });
}

// ── Consultation Modal ──
function initConsultation() {
  const overlay = document.getElementById('consult-overlay');
  const closeBtn = document.getElementById('consult-close');
  const form = document.getElementById('consult-form');
  const areaLabel = document.getElementById('consult-area');
  const areaInput = document.getElementById('consult-area-input');
  const successEl = document.getElementById('consult-success');

  if (!overlay || !form) return;

  function openModal(areaName) {
    if (areaLabel) areaLabel.textContent = areaName || '';
    if (areaInput) areaInput.value = areaName || '';
    form.style.display = '';
    if (successEl) successEl.style.display = 'none';
    overlay.classList.add('is-open');
  }

  function closeModal() {
    overlay.classList.remove('is-open');
  }

  // Listen for clicks on "Book a Call" buttons (delegated)
  document.addEventListener('click', e => {
    const btn = e.target.closest('.dubai-card__consult');
    if (btn) {
      openModal(btn.dataset.area);
    }
  });

  // Close handlers
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
  });

  // Form submit
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = form.querySelector('.consult-form__submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
    }

    const payload = {
      name: document.getElementById('consult-name').value,
      email: document.getElementById('consult-email').value,
      phone: document.getElementById('consult-phone').value,
      budget: document.getElementById('consult-budget').value,
      area: areaInput ? areaInput.value : '',
      message: document.getElementById('consult-message').value,
      website: (document.getElementById('consult-website') || {}).value || ''
    };

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await res.json();
    } catch (err) {
      // Silently continue — show success regardless (lead logged server-side)
    }

    form.style.display = 'none';
    if (successEl) successEl.style.display = 'block';

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request Consultation';
    }
  });
}

// ── Init on DOM Ready ──
// ── Pricing / Stripe Checkout ──
function initPricing() {
  document.querySelectorAll('.pricing-card__btn[data-plan]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const plan = btn.dataset.plan;
      btn.textContent = 'Connecting...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan })
        });
        const data = await res.json();

        if (data.url) {
          window.location.href = data.url;
        } else if (data.setup) {
          btn.textContent = 'Coming Soon';
          setTimeout(() => {
            btn.textContent = plan === 'pro' ? 'Subscribe — $49/mo' : 'Subscribe — $299/mo';
            btn.disabled = false;
          }, 2000);
        } else {
          btn.textContent = data.error || 'Error';
          setTimeout(() => {
            btn.textContent = plan === 'pro' ? 'Subscribe — $49/mo' : 'Subscribe — $299/mo';
            btn.disabled = false;
          }, 2000);
        }
      } catch (e) {
        btn.textContent = 'Error — try again';
        btn.disabled = false;
      }
    });
  });

  // Check URL params for subscription success/cancel
  const params = new URLSearchParams(window.location.search);
  if (params.get('subscription') === 'success') {
    const plan = params.get('plan') || 'pro';
    localStorage.setItem('fi_subscription', plan);
    window.history.replaceState({}, '', window.location.pathname);
    if (window.__openModal) {
      window.__openModal('Subscription Active!', `Welcome to Felicity Intelligence ${plan.charAt(0).toUpperCase() + plan.slice(1)}. All features are now unlocked.`);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
