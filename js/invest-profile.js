// ═══════════════════════════════════════════════════════════
// INVEST — Watchlist + Investor Profile
// ═══════════════════════════════════════════════════════════
//
// PRIVACY: both live in this browser's localStorage only. The profile
// is attached to an analysis request so Felicity Bot can size a
// position in real money, and is never written to any database or
// logged server-side. Clearing it here erases it completely.
// ═══════════════════════════════════════════════════════════

const WATCH_KEY = 'fi_watchlist';
const PROFILE_KEY = 'fi_investor_profile';

// ── Watchlist ──
export function getWatchlist() {
  try {
    const raw = JSON.parse(localStorage.getItem(WATCH_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(s => typeof s === 'string') : [];
  } catch { return []; }
}

function saveWatchlist(list) {
  try { localStorage.setItem(WATCH_KEY, JSON.stringify(list.slice(0, 200))); } catch { /* quota */ }
}

export function isWatched(symbol) {
  return getWatchlist().includes(symbol);
}

export function toggleWatch(symbol) {
  const list = getWatchlist();
  const i = list.indexOf(symbol);
  if (i >= 0) list.splice(i, 1);
  else list.unshift(symbol);
  saveWatchlist(list);
  return list.includes(symbol);
}

export function removeWatch(symbol) {
  saveWatchlist(getWatchlist().filter(s => s !== symbol));
}

export function clearWatchlist() {
  saveWatchlist([]);
}

// ── Investor profile ──
export const RISK_LEVELS = {
  conservative: 'Conservative — capital preservation first',
  balanced:     'Balanced — measured growth, some drawdown tolerated',
  aggressive:   'Aggressive — maximum growth, large drawdowns acceptable',
};

export const HORIZONS = {
  short:  'Short — under 1 year',
  medium: 'Medium — 1 to 3 years',
  long:   'Long — 3 years or more',
};

export const EXPERIENCE = {
  beginner:     'Beginner — new to markets',
  intermediate: 'Intermediate — comfortable with equities and ETFs',
  professional: 'Professional — trades actively, understands leverage and derivatives',
};

export const CURRENCIES = ['USD', 'AED', 'EUR', 'GBP', 'SAR', 'INR'];

export function getProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    if (!p || typeof p !== 'object') return null;
    if (!p.capital || !isFinite(p.capital) || p.capital <= 0) return null;
    return p;
  } catch { return null; }
}

export function saveProfile(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch { /* quota */ }
}

export function clearProfile() {
  try { localStorage.removeItem(PROFILE_KEY); } catch { /* noop */ }
}

export function hasProfile() {
  return getProfile() !== null;
}

// Human summary for the profile chip
export function profileSummary(p) {
  if (!p) return 'Not set';
  const cap = Number(p.capital).toLocaleString('en-US');
  return `${p.currency} ${cap} · ${p.risk} · ${p.horizon}`;
}

// ── Profile modal ──
export function openProfileModal(onSaved) {
  const existing = getProfile() || {
    capital: '', currency: 'USD', risk: 'balanced',
    horizon: 'medium', experience: 'intermediate', maxLossPct: 10, notes: '',
  };

  const opts = (obj, sel) => Object.entries(obj)
    .map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${v}</option>`).join('');

  const overlay = document.createElement('div');
  overlay.className = 'profile-overlay is-open';
  overlay.innerHTML = `
    <div class="profile-modal">
      <div class="profile-modal__header">
        <div>
          <h3 class="profile-modal__title">Your Investor Profile</h3>
          <p class="profile-modal__sub">Felicity Bot uses this to size positions in real money instead of percentages.</p>
        </div>
        <button class="profile-modal__close" id="profile-close">&times;</button>
      </div>

      <form class="profile-form" id="profile-form">
        <div class="profile-form__row">
          <label class="profile-form__field">
            <span class="profile-form__label">Investable capital *</span>
            <input type="number" id="pf-capital" class="profile-form__input" min="1" step="any"
                   placeholder="100000" value="${existing.capital}" required>
          </label>
          <label class="profile-form__field profile-form__field--narrow">
            <span class="profile-form__label">Currency</span>
            <select id="pf-currency" class="profile-form__select">
              ${CURRENCIES.map(c => `<option value="${c}"${c === existing.currency ? ' selected' : ''}>${c}</option>`).join('')}
            </select>
          </label>
        </div>

        <label class="profile-form__field">
          <span class="profile-form__label">Risk tolerance</span>
          <select id="pf-risk" class="profile-form__select">${opts(RISK_LEVELS, existing.risk)}</select>
        </label>

        <label class="profile-form__field">
          <span class="profile-form__label">Time horizon</span>
          <select id="pf-horizon" class="profile-form__select">${opts(HORIZONS, existing.horizon)}</select>
        </label>

        <label class="profile-form__field">
          <span class="profile-form__label">Experience</span>
          <select id="pf-experience" class="profile-form__select">${opts(EXPERIENCE, existing.experience)}</select>
        </label>

        <label class="profile-form__field">
          <span class="profile-form__label">Most you would accept losing on a single position (%)</span>
          <input type="number" id="pf-maxloss" class="profile-form__input" min="1" max="100" step="1"
                 value="${existing.maxLossPct}">
        </label>

        <label class="profile-form__field">
          <span class="profile-form__label">Existing exposure or constraints (optional)</span>
          <textarea id="pf-notes" class="profile-form__textarea" rows="3"
            placeholder="e.g. already 40% in Dubai property, no leverage, avoid tobacco and defence">${existing.notes || ''}</textarea>
        </label>

        <div class="profile-form__privacy">
          <strong>Stored in this browser only.</strong> It is sent with an analysis request so the model can do the
          arithmetic, and is never saved to a database or logged on our side. Clearing it below erases it completely.
        </div>

        <div class="profile-form__actions">
          <button type="submit" class="profile-form__save">Save profile</button>
          <button type="button" class="profile-form__clear" id="profile-clear">Clear</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close tears down its own key listener, so closing via the X or the
  // overlay does not leak one handler per open.
  function onEsc(e) { if (e.key === 'Escape') close(); }
  function close() {
    document.removeEventListener('keydown', onEsc);
    overlay.remove();
  }
  overlay.querySelector('#profile-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onEsc);

  overlay.querySelector('#profile-clear').addEventListener('click', () => {
    clearProfile();
    close();
    if (onSaved) onSaved(null);
  });

  overlay.querySelector('#profile-form').addEventListener('submit', e => {
    e.preventDefault();
    const capital = parseFloat(overlay.querySelector('#pf-capital').value);
    if (!capital || capital <= 0) return;

    const profile = {
      capital,
      currency: overlay.querySelector('#pf-currency').value,
      risk: overlay.querySelector('#pf-risk').value,
      horizon: overlay.querySelector('#pf-horizon').value,
      experience: overlay.querySelector('#pf-experience').value,
      maxLossPct: parseFloat(overlay.querySelector('#pf-maxloss').value) || 10,
      notes: overlay.querySelector('#pf-notes').value.trim().slice(0, 500),
    };
    saveProfile(profile);
    close();
    if (onSaved) onSaved(profile);
  });
}
