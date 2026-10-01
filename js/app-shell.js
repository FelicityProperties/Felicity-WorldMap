// ═══════════════════════════════════════════════════════════
// APP SHELL — installable app behaviour
// ═══════════════════════════════════════════════════════════
//
// - Registers the service worker (sw.js): the app shell opens offline;
//   market and map data are never cached, so offline shows NO FEED rather
//   than an old number.
// - On phones, adds a "More" tab to the bottom bar that opens a sheet with
//   Signals, Broadcasts and Hormuz, plus "Install app".
// - Captures the browser's install prompt (Android / desktop Chrome) and
//   shows iOS "Add to Home Screen" instructions where there is no prompt.
// - Opens the tab named in ?tab= or #tab (the manifest's shortcuts use it).
// ═══════════════════════════════════════════════════════════

const MORE_TABS = [
  { tab: 'signals', label: 'Signals', sub: 'Registered DLD market signals', icon: '<path d="M2 12l4-3 2 1.5L14 4M14 4v3M14 4h-3"/>' },
  { tab: 'broadcasts', label: 'Broadcasts', sub: 'Live news channels', icon: '<rect x="2" y="3" width="12" height="9" rx="1"/><path d="M5 14h6"/>' },
  { tab: 'hormuz', label: 'Strait of Hormuz', sub: 'Daily transits, oil and headlines', icon: '<path d="M1.5 4.5c2-1.5 3.5-1.5 5.5 0s3.5 1.5 5.5 0M1.5 11.5c2-1.5 3.5-1.5 5.5 0s3.5 1.5 5.5 0M4.5 8h7l-1.2 2h-4.6z"/>' },
];
const svg = d => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

let deferredPrompt = null;
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;

function goTab(tab) {
  document.querySelector(`.nav > .nav-btn[data-tab="${tab}"]`)?.click();
}

function buildMore() {
  const nav = document.querySelector('.nav');
  if (!nav || document.querySelector('.nav-more')) return;

  const more = document.createElement('button');
  more.className = 'nav-btn nav-more';
  more.type = 'button';
  more.setAttribute('aria-haspopup', 'dialog');
  more.innerHTML = `${svg('<circle cx="3.5" cy="8" r="1"/><circle cx="8" cy="8" r="1"/><circle cx="12.5" cy="8" r="1"/>').replace('<svg', '<svg class="nav-btn__icon"')}<span class="nav-btn__label">More</span>`;
  nav.appendChild(more);

  const sheet = document.createElement('div');
  sheet.className = 'app-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', 'More');
  sheet.innerHTML = `
    <div class="app-sheet__scrim" data-close></div>
    <div class="app-sheet__panel">
      <div class="app-sheet__grab"></div>
      <div class="app-sheet__title">More</div>
      ${MORE_TABS.map(t => `<button class="app-sheet__item" data-sheet-tab="${t.tab}">${svg(t.icon)}<span>${t.label}<small>${t.sub}</small></span></button>`).join('')}
      <button class="app-sheet__item app-sheet__install" data-install hidden>${svg('<path d="M8 2v8M5 7l3 3 3-3M3 13h10"/>')}<span>Install the app<small>Full screen, on your home screen</small></span></button>
      <div class="app-sheet__ios" hidden>To install on iPhone: tap the <strong>Share</strong> button in Safari, then <strong>Add to Home Screen</strong>.</div>
    </div>`;
  document.body.appendChild(sheet);

  const open = () => { refreshInstallUI(); sheet.classList.add('is-open'); document.body.classList.add('app-sheet-open'); };
  const close = () => { sheet.classList.remove('is-open'); document.body.classList.remove('app-sheet-open'); };
  more.addEventListener('click', () => (sheet.classList.contains('is-open') ? close() : open()));
  sheet.addEventListener('click', async e => {
    if (e.target.closest('[data-close]')) return close();
    const go = e.target.closest('[data-sheet-tab]');
    if (go) { goTab(go.dataset.sheetTab); close(); return; }
    if (e.target.closest('[data-install]') && deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch { /* dismissed */ }
      deferredPrompt = null;
      refreshInstallUI();
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  // "More" lights up while one of its tabs is showing
  const sync = () => {
    const active = document.querySelector('.nav > .nav-btn.active[data-tab]')?.dataset.tab;
    if (active) document.body.dataset.tab = active;   // per-tab phone layout hooks
    const inMore = MORE_TABS.some(t => t.tab === active);
    more.classList.toggle('active', inMore);
    sheet.querySelectorAll('[data-sheet-tab]').forEach(b => b.classList.toggle('is-active', b.dataset.sheetTab === active));
  };
  new MutationObserver(sync).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
  sync();
}

function refreshInstallUI() {
  const btn = document.querySelector('[data-install]');
  const ios = document.querySelector('.app-sheet__ios');
  if (btn) btn.hidden = !deferredPrompt || isStandalone();
  if (ios) ios.hidden = !(isIOS() && !isStandalone());
}

function openRequestedTab() {
  const q = new URLSearchParams(location.search).get('tab') || location.hash.replace(/^#/, '');
  if (q && /^[a-z]+$/.test(q) && document.querySelector(`.nav > .nav-btn[data-tab="${q}"]`)) goTab(q);
}

export function initAppShell() {
  buildMore();
  openRequestedTab();
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; refreshInstallUI(); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; refreshInstallUI(); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('[app] service worker not registered:', e.message));
  }
}
