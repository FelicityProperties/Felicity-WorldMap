// ═══════════════════════════════════════════════════════════
// BROADCASTS — live news channels, embedded by channel
// ═══════════════════════════════════════════════════════════
//
// Every card embeds YouTube's own live-stream resolver for the channel
// (`/embed/live_stream?channel=<id>`), which always points at whatever
// that channel is streaming right now. An earlier version first tried to
// discover the current video id through three third-party CORS proxies —
// slow, flaky, and one of them dead — before falling back to exactly this
// URL. The proxies are gone.
//
// Honesty rules for this panel:
//   - the LIVE badge is YouTube's claim about the channel, not ours: when
//     a channel is not streaming YouTube shows its own "unavailable"
//     screen inside the frame, so every card also carries the broadcaster's
//     own live page as a permanent link out;
//   - nothing autoplays with sound, and nothing loads until clicked.
// ═══════════════════════════════════════════════════════════

import { broadcastChannels } from './data.js';
import { escapeHtml, safeUrl } from './safe.js';

export function initBroadcasts() {
  renderCards();
}

function renderCards() {
  const grid = document.getElementById('broadcasts-grid');
  if (!grid) return;

  grid.innerHTML = broadcastChannels.map((ch, i) => `
    <div class="broadcast-card" data-idx="${i}">
      <div class="broadcast-card__header">
        <div class="broadcast-card__channel">
          <div class="broadcast-card__logo" style="background:${escapeHtml(ch.color)}"></div>
          <div>
            <div class="broadcast-card__name">${escapeHtml(ch.name)}</div>
            <div class="broadcast-card__sub">${escapeHtml(ch.description)}</div>
          </div>
        </div>
        <div class="broadcast-card__live" title="YouTube's live stream for this channel; if the channel is off air YouTube says so in the frame">
          <span class="broadcast-card__live-dot"></span>
          LIVE
        </div>
      </div>
      <div class="broadcast-card__embed" id="embed-${i}">
        <div class="broadcast-card__facade" data-idx="${i}">
          <div class="broadcast-card__play" style="box-shadow:0 0 30px ${escapeHtml(ch.color)}55">
            <div class="broadcast-card__play-icon"></div>
          </div>
          <span class="broadcast-card__facade-text">Click to load live stream</span>
        </div>
      </div>
      <div class="broadcast-card__links">
        <a href="${safeUrl(`https://www.youtube.com/channel/${ch.channelId}/live`)}" target="_blank" rel="noopener noreferrer">YouTube ↗</a>
        <a href="${safeUrl(ch.fallbackUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ch.name)} live page ↗</a>
      </div>
    </div>
  `).join('');

  grid.addEventListener('click', e => {
    const facade = e.target.closest('.broadcast-card__facade');
    if (!facade) return;
    const idx = parseInt(facade.dataset.idx, 10);
    const ch = broadcastChannels[idx];
    const container = document.getElementById(`embed-${idx}`);
    if (!ch || !container) return;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(ch.channelId)}&autoplay=1&mute=1&rel=0`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.title = `${ch.name} live stream`;
    iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:0';
    facade.remove();
    container.appendChild(iframe);
  });
}
