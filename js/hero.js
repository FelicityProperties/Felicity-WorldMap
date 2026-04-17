// ═══════════════════════════════════════════════════════════
// HERO — Animated Counters, Breaking Alert Rotation
// ═══════════════════════════════════════════════════════════

import { ciiScores, confZones, markets, news, dubaiAreas } from './data.js';

let alertIndex = 0;
let alertInterval = null;

export function initHero() {
  initCounters();
  initAlertBanner();
}

// ── Animated Counters — fire immediately (no IntersectionObserver) ──
function initCounters() {
  const counters = document.querySelectorAll('.hero__counter-value');
  if (!counters.length) return;

  // Set data-target values from live data
  const targets = {
    countries: Object.keys(ciiScores).length,
    conflicts: confZones.length,
    markets: markets.length,
    dubaiAreas: dubaiAreas.length
  };

  counters.forEach(el => {
    const key = el.dataset.counter;
    if (key && targets[key] !== undefined) {
      el.dataset.target = targets[key];
    }
  });

  // Animate immediately — the overview tab is visible on load
  counters.forEach(el => animateCounter(el));
}

function animateCounter(el) {
  const target = parseInt(el.dataset.target) || 0;
  const duration = 1500;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * target);
    el.textContent = current.toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

// ── Breaking Alert Banner ──
function initAlertBanner() {
  const textEl = document.getElementById('alert-text');
  if (!textEl) return;

  // Show first alert from whatever data is available
  if (news.length) {
    showAlert(textEl);
  }

  // Rotate every 5 seconds
  alertInterval = setInterval(() => {
    if (!news.length) return;
    textEl.style.opacity = '0';
    setTimeout(() => {
      alertIndex = (alertIndex + 1) % news.length;
      showAlert(textEl);
      textEl.style.opacity = '1';
    }, 300);
  }, 5000);
}

function showAlert(el) {
  const item = news[alertIndex];
  if (item) {
    el.textContent = item.title;
  }
}

// Called when live news data refreshes — reset to top of feed
export function refreshAlertBanner() {
  alertIndex = 0;
  const textEl = document.getElementById('alert-text');
  if (textEl && news.length) {
    showAlert(textEl);
  }
}
