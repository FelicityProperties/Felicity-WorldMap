// ═══════════════════════════════════════════════════════════
// FELICITY BOT — the desk, reachable from every tab
// ═══════════════════════════════════════════════════════════
//
// A floating launcher that sits beside the WhatsApp button and opens a
// conversation with the same desk brain as the Overview panel
// (/api/desk/ask), so a visitor can ask a question from the map, the
// cockpit or the signals feed without navigating away.
//
// The transcript lives in this browser's sessionStorage only. It is sent
// back with each question so the desk can follow a thread, and it is never
// written to any database.
//
// Everything the model returns is rendered as TEXT, never as markup — the
// answer is escaped before it reaches innerHTML.
// ═══════════════════════════════════════════════════════════

import { escapeHtml } from './safe.js';

const STORE_KEY = 'fi_bot_thread';
const MAX_TURNS = 20;

const OPENERS = [
  'Best Dubai area to own in 2026?',
  'Is now a good time to buy in Dubai Marina?',
  'What is the biggest risk to Dubai property right now?',
  'Apartments or villas for yield?',
];

let thread = [];
let busy = false;
let panel = null;

// ── Transcript (this browser only) ──
function loadThread() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORE_KEY) || '[]');
    return Array.isArray(raw)
      ? raw.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      : [];
  } catch { return []; }
}

function saveThread() {
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify(thread.slice(-MAX_TURNS))); } catch { /* private mode */ }
}

export function initFelicityBot() {
  thread = loadThread();

  const launcher = document.createElement('button');
  launcher.className = 'fbot-launcher';
  launcher.id = 'fbot-launcher';
  launcher.setAttribute('aria-label', 'Ask Felicity Bot');
  launcher.title = 'Ask Felicity Bot';
  launcher.innerHTML = `
    <span class="fbot-launcher__mark">F</span>
    <span class="fbot-launcher__label">Ask Felicity</span>`;
  document.body.appendChild(launcher);

  panel = document.createElement('div');
  panel.className = 'fbot';
  panel.id = 'fbot';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Felicity Bot');
  panel.innerHTML = `
    <div class="fbot__head">
      <div class="fbot__id">
        <span class="fbot__mark">F</span>
        <div>
          <div class="fbot__title">Felicity Bot</div>
          <div class="fbot__sub">Dubai property &amp; global macro desk</div>
        </div>
      </div>
      <div class="fbot__head-actions">
        <button class="fbot__reset" id="fbot-reset" title="Start a new conversation">Reset</button>
        <button class="fbot__close" id="fbot-close" aria-label="Close">&times;</button>
      </div>
    </div>
    <div class="fbot__thread" id="fbot-thread"></div>
    <form class="fbot__composer" id="fbot-form">
      <input class="fbot__input" id="fbot-input" type="text" autocomplete="off"
             placeholder="Ask about an area, a yield, a market…" maxlength="500">
      <button class="fbot__send" id="fbot-send" type="submit" aria-label="Send">&uarr;</button>
    </form>
    <div class="fbot__foot">Desk assessments and registered DLD evidence. Not personalised financial advice.</div>`;
  document.body.appendChild(panel);

  launcher.addEventListener('click', toggle);
  panel.querySelector('#fbot-close').addEventListener('click', close);
  panel.querySelector('#fbot-reset').addEventListener('click', () => {
    thread = [];
    saveThread();
    renderThread();
  });

  panel.querySelector('#fbot-form').addEventListener('submit', e => {
    e.preventDefault();
    const input = panel.querySelector('#fbot-input');
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    ask(q);
  });

  panel.querySelector('#fbot-thread').addEventListener('click', e => {
    const chip = e.target.closest('[data-opener]');
    if (chip) ask(chip.dataset.opener);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('is-open')) close();
  });

  renderThread();
}

function toggle() {
  panel.classList.contains('is-open') ? close() : open();
}

export function openFelicityBot(prefill) {
  if (!panel) return;
  open();
  if (prefill) {
    const input = panel.querySelector('#fbot-input');
    input.value = prefill;
    input.focus();
  }
}

function open() {
  panel.classList.add('is-open');
  document.getElementById('fbot-launcher')?.classList.add('is-open');
  document.body.classList.add('fbot-open');
  scrollThread();
  // Focusing on a phone opens the keyboard over the thread, so only steal
  // focus where there is room for both.
  if (window.innerWidth > 767) panel.querySelector('#fbot-input').focus();
}

function close() {
  panel.classList.remove('is-open');
  document.getElementById('fbot-launcher')?.classList.remove('is-open');
  document.body.classList.remove('fbot-open');
}

function scrollThread() {
  const t = panel.querySelector('#fbot-thread');
  requestAnimationFrame(() => { t.scrollTop = t.scrollHeight; });
}

function renderThread(pending = false) {
  const t = panel.querySelector('#fbot-thread');

  const intro = thread.length ? '' : `
    <div class="fbot__intro">
      <p>Ask the desk anything about Dubai property or the wider market. Answers lean on registered
         Land Department evidence where it exists, and are labelled as a desk view where it does not.</p>
      <div class="fbot__openers">
        ${OPENERS.map(o => `<button class="fbot__opener" data-opener="${escapeHtml(o)}">${escapeHtml(o)}</button>`).join('')}
      </div>
    </div>`;

  const msgs = thread.map(m => `
    <div class="fbot__msg fbot__msg--${m.role === 'user' ? 'me' : 'bot'}">
      ${m.role === 'assistant' && m.conviction
        ? `<span class="fbot__conviction">${escapeHtml(m.conviction)} conviction</span>` : ''}
      <div class="fbot__bubble">${escapeHtml(m.content)}</div>
    </div>`).join('');

  const wait = pending
    ? '<div class="fbot__msg fbot__msg--bot"><div class="fbot__bubble fbot__bubble--wait"><span></span><span></span><span></span></div></div>'
    : '';

  t.innerHTML = intro + msgs + wait;
  scrollThread();
}

async function ask(question) {
  if (busy) return;
  busy = true;

  const send = panel.querySelector('#fbot-send');
  send.disabled = true;

  thread.push({ role: 'user', content: question });
  saveThread();
  renderThread(true);

  try {
    const r = await fetch('/api/desk/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Send the turns before this question — the server re-validates them
      body: JSON.stringify({
        question,
        history: thread.slice(0, -1).slice(-8).map(({ role, content }) => ({ role, content })),
      }),
    });
    const d = await r.json();
    thread.push({
      role: 'assistant',
      content: d.response || d.error || 'No answer came back from the desk.',
      conviction: d.conviction || null,
    });
  } catch (e) {
    thread.push({
      role: 'assistant',
      content: `The desk is unreachable right now — ${e.message}. Nothing has been guessed in its place; try again shortly.`,
      conviction: null,
    });
  }

  thread = thread.slice(-MAX_TURNS);
  saveThread();
  busy = false;
  send.disabled = false;
  renderThread();
}
