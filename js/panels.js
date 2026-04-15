// ═══════════════════════════════════════════════════════════
// PANELS — Country Panel + Modal System
// ═══════════════════════════════════════════════════════════

import { ciiBarColor } from './utils.js';

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

let currentCountry = '';

// ── Country Panel ──
export function showCountryPanel(name, score, region) {
  currentCountry = name;

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

  intelEl.textContent = '';
  loadEl.classList.add('visible');

  panel.classList.add('is-open');

  fetchIntel(name);
}

export function closeCountryPanel() {
  const panel = document.getElementById('country-panel');
  if (panel) panel.classList.remove('is-open');
}

async function fetchIntel(country) {
  const loadEl = document.getElementById('cp-loading');
  const intelEl = document.getElementById('cp-intel');

  try {
    const r = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `3-sentence geopolitical intelligence brief on ${country}: current security situation, key risk, one indicator to watch. Crisp and analytical, no preamble.`
        }]
      })
    });
    const d = await r.json();
    const txt = d.content?.find(c => c.type === 'text')?.text || 'Brief unavailable.';
    loadEl.classList.remove('visible');
    intelEl.textContent = txt;
  } catch (e) {
    loadEl.classList.remove('visible');
    intelEl.textContent = 'Connect an Anthropic API key to enable live intelligence briefs.';
  }
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
  document.body.style.overflow = 'hidden';
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;

  overlay.classList.remove('is-open');
  document.body.style.overflow = '';
}

export function initPanels() {
  // Close panel button
  const closeBtn = document.getElementById('cp-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeCountryPanel);
  }

  // Full brief button opens modal
  const briefBtn = document.getElementById('cp-brief-btn');
  if (briefBtn) {
    briefBtn.addEventListener('click', () => {
      if (currentCountry) {
        openModal(
          `Intelligence Brief: ${currentCountry}`,
          'To get a full intelligence brief, connect this dashboard to Claude.ai or add your Anthropic API key.'
        );
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
