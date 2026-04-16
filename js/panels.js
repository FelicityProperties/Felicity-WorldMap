// ═══════════════════════════════════════════════════════════
// PANELS — Country Panel + Modal System + Region Drawer Link
// ═══════════════════════════════════════════════════════════

import { ciiBarColor } from './utils.js';
import { openRegionDrawer, getRegionForCountry } from './regions.js';

let currentCountry = '';
let currentRegion = '';

// ── Country Panel ──
export function showCountryPanel(name, score, region) {
  currentCountry = name;
  currentRegion = region;

  const panel = document.getElementById('country-panel');
  const nameEl = document.getElementById('cp-name');
  const ciiEl = document.getElementById('cp-cii');
  const regEl = document.getElementById('cp-region');
  const barFill = document.getElementById('cp-bar-fill');
  const loadEl = document.getElementById('cp-loading');
  const intelEl = document.getElementById('cp-intel');

  if (!panel) return;

  nameEl.textContent = name;
  ciiEl.textContent = score ? score.toFixed(1) + '/10' : 'N/A';
  ciiEl.style.color = ciiBarColor(score);
  regEl.textContent = region || '\u2014';

  const pct = score ? (score / 10 * 100).toFixed(0) : 0;
  barFill.style.width = pct + '%';
  barFill.style.background = ciiBarColor(score);
  barFill.style.color = ciiBarColor(score);

  // Show brief summary instead of API call
  loadEl.classList.remove('visible');
  const riskLevel = score >= 7 ? 'High risk zone' : score >= 5 ? 'Elevated risk zone' : score >= 3 ? 'Moderate stability' : 'Stable region';
  intelEl.textContent = `${riskLevel}. CII score ${score ? score.toFixed(1) : 'N/A'}/10 indicates ${score >= 7 ? 'significant instability and security concerns' : score >= 5 ? 'notable geopolitical pressures and economic vulnerability' : score >= 3 ? 'manageable risks with moderate macro exposure' : 'strong institutional stability and low conflict risk'}. Click below for detailed region intelligence.`;

  panel.classList.add('is-open');
}

export function closeCountryPanel() {
  const panel = document.getElementById('country-panel');
  if (panel) panel.classList.remove('is-open');
}

// ── Modal System ──
export function openModal(title, body) {
  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');

  if (!overlay) return;

  titleEl.textContent = title;
  if (typeof body === 'string') {
    bodyEl.textContent = body;
  } else {
    bodyEl.innerHTML = '';
    bodyEl.appendChild(body);
  }

  overlay.classList.add('is-open');
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;

  overlay.classList.remove('is-open');
}

export function initPanels() {
  // Close panel button
  const closeBtn = document.getElementById('cp-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeCountryPanel);
  }

  // Region intelligence button (replaced the old "Full Brief" button)
  const regionBtn = document.getElementById('cp-region-btn');
  if (regionBtn) {
    regionBtn.addEventListener('click', () => {
      if (currentCountry) {
        const mappedRegion = getRegionForCountry(currentCountry);
        if (mappedRegion) {
          openRegionDrawer(mappedRegion);
        }
      }
    });
  }

  // Modal close handlers
  const modalOverlay = document.getElementById('modal-overlay');
  const modalClose = document.getElementById('modal-close');

  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', e => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  // Escape key closes panel + modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeCountryPanel();
    }
  });

  // Expose modal globally for inline onclick handlers
  window.__openModal = openModal;
}
