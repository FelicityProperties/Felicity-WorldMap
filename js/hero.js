// ═══════════════════════════════════════════════════════════
// HERO — Animated Counters, Breaking Alert Rotation
// ═══════════════════════════════════════════════════════════

import { ciiScores, confZones, markets, news } from './data.js';

let alertIndex = 0;
let alertInterval = null;

export function initHero() {
  initCounters();
  initAlertBanner();
}

// ── Animated Counters ──
function initCounters() {
  const counters = document.querySelectorAll('.hero__counter-value');
  if (!counters.length) return;

  // Set data-target values from live data
  const targets = {
    countries: Object.keys(ciiScores).length,
    conflicts: confZones.length,
    markets: markets.length
  };

  counters.forEach(el => {
    const key = el.dataset.counter;
    if (key && targets[key] !== undefined) {
      el.dataset.target = targets[key];
    }
  });

  // Use IntersectionObserver to trigger animation on viewport entry
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        counters.forEach(el => animateCounter(el));
        observer.disconnect();
      }
    });
  }, { threshold: 0.3 });

  const heroSection = document.getElementById('section-hero');
  if (heroSection) observer.observe(heroSection);
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
  if (!textEl || !news.length) return;

  // Show first alert immediately
  showAlert(textEl);

  // Rotate every 5 seconds
  alertInterval = setInterval(() => {
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
