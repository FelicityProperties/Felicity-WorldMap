// ═══════════════════════════════════════════════════════════
// BROADCASTS — Live YouTube Embed + Premium Fallback Cards
// ═══════════════════════════════════════════════════════════
//
// Strategy:
//   - Channels with a known liveVideoId: embed via youtube-nocookie.com
//   - Channels marked embedBlocked (CNN, BBC): premium "Watch Live" card
//   - All embeds have iframe error handling + graceful fallback
// ═══════════════════════════════════════════════════════════

import { broadcastChannels } from './data.js';

export function initBroadcasts() {
  renderBroadcastCards();
}

function renderBroadcastCards() {
  const grid = document.getElementById('broadcasts-grid');
  if (!grid) return;

  grid.innerHTML = broadcastChannels.map((ch, i) => {
    if (ch.embedBlocked) {
      return renderWatchLiveCard(ch, i);
    }
    return renderEmbedCard(ch, i);
  }).join('');

  // Click handler for facades (iframe load on demand)
  grid.addEventListener('click', e => {
    const facade = e.target.closest('.broadcast-card__facade');
    if (facade) {
      const embedContainer = facade.parentElement;
      loadEmbed(embedContainer);
      facade.remove();
    }
  });
}

// ── Card with YouTube iframe (for embeddable channels) ──
function renderEmbedCard(ch, i) {
  return `
    <div class="broadcast-card" data-channel-idx="${i}">
      <div class="broadcast-card__header">
        <div class="broadcast-card__channel">
          <div class="broadcast-card__logo" style="background:${ch.color}"></div>
          <div>
            <div class="broadcast-card__name">${ch.name}</div>
            <div class="broadcast-card__sub">${ch.description}</div>
          </div>
        </div>
        <div class="broadcast-card__live">
          <span class="broadcast-card__live-dot"></span>
          LIVE
        </div>
      </div>
      <div class="broadcast-card__embed" data-video-id="${ch.liveVideoId || ''}" data-channel-id="${ch.youtubeChannelId}" data-fallback-url="${ch.fallbackUrl}" data-channel-name="${ch.name}">
        <div class="broadcast-card__facade" data-facade="${i}">
          <div class="broadcast-card__play" style="box-shadow:0 0 30px ${ch.color}55">
            <div class="broadcast-card__play-icon"></div>
          </div>
          <span class="broadcast-card__facade-text">Click to start live stream</span>
        </div>
        <div class="broadcast-card__fallback">
          <div class="broadcast-card__fallback-icon" style="color:${ch.color}">\u25B6</div>
          <div class="broadcast-card__fallback-text">Embed unavailable &mdash; watch on official stream</div>
          <a class="broadcast-card__fallback-link" href="${ch.fallbackUrl}" target="_blank" rel="noopener noreferrer">Watch on ${ch.name} \u2197</a>
        </div>
      </div>
    </div>
  `;
}

// ── Premium "Watch Live" card (for broadcaster-restricted channels) ──
function renderWatchLiveCard(ch, i) {
  return `
    <div class="broadcast-card" data-channel-idx="${i}">
      <div class="broadcast-card__header">
        <div class="broadcast-card__channel">
          <div class="broadcast-card__logo" style="background:${ch.color}"></div>
          <div>
            <div class="broadcast-card__name">${ch.name}</div>
            <div class="broadcast-card__sub">${ch.description}</div>
          </div>
        </div>
        <div class="broadcast-card__live">
          <span class="broadcast-card__live-dot"></span>
          LIVE
        </div>
      </div>
      <div class="broadcast-card__embed broadcast-card__embed--watchlive" style="background:linear-gradient(135deg, ${ch.color}26 0%, ${ch.color}08 60%, transparent 100%)">
        <div class="broadcast-card__watchlive">
          <div class="broadcast-card__watchlive-badge" style="background:${ch.color}">${ch.name}</div>
          <div class="broadcast-card__watchlive-title">Broadcasting live</div>
          <div class="broadcast-card__watchlive-sub">Embed restricted by broadcaster &mdash; open official stream to watch</div>
          <a class="broadcast-card__watchlive-btn" href="${ch.fallbackUrl}" target="_blank" rel="noopener noreferrer" style="background:${ch.color}">
            Watch Live \u2197
          </a>
        </div>
      </div>
    </div>
  `;
}

// ── Iframe load with video-id fallback chain ──
function loadEmbed(container) {
  const videoId = container.dataset.videoId;
  const channelId = container.dataset.channelId;
  const fallbackEl = container.querySelector('.broadcast-card__fallback');

  const src = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&rel=0`
    : `https://www.youtube-nocookie.com/embed/live_stream?channel=${channelId}&autoplay=1&mute=1`;

  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;

  const timeout = setTimeout(() => showFallback(container, fallbackEl), 12000);

  iframe.addEventListener('load', () => clearTimeout(timeout));
  iframe.addEventListener('error', () => {
    clearTimeout(timeout);
    showFallback(container, fallbackEl);
  });

  container.insertBefore(iframe, fallbackEl);
}

function showFallback(container, fallbackEl) {
  const iframe = container.querySelector('iframe');
  if (iframe) iframe.remove();
  if (fallbackEl) fallbackEl.classList.add('visible');
}
