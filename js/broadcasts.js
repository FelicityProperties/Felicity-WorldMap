// ═══════════════════════════════════════════════════════════
// BROADCASTS — Live YouTube Embed Management with Fallbacks
// ═══════════════════════════════════════════════════════════

import { broadcastChannels } from './data.js';

export function initBroadcasts() {
  renderBroadcastCards();
  setupLazyLoading();
}

function renderBroadcastCards() {
  const grid = document.getElementById('broadcasts-grid');
  if (!grid) return;

  grid.innerHTML = broadcastChannels.map((ch, i) => `
    <div class="broadcast-card" data-channel-idx="${i}">
      <div class="broadcast-card__header">
        <div class="broadcast-card__channel">
          <div class="broadcast-card__logo" style="background:${ch.color}"></div>
          <span class="broadcast-card__name">${ch.name}</span>
        </div>
        <div class="broadcast-card__live">
          <span class="broadcast-card__live-dot"></span>
          LIVE
        </div>
      </div>
      <div class="broadcast-card__embed" data-channel-id="${ch.youtubeChannelId}" data-fallback-url="${ch.fallbackUrl}">
        <div class="broadcast-card__facade" data-facade="${i}">
          <div class="broadcast-card__play">
            <div class="broadcast-card__play-icon"></div>
          </div>
          <span class="broadcast-card__facade-text">Click to load live stream</span>
        </div>
        <div class="broadcast-card__fallback">
          <div class="broadcast-card__fallback-icon">\u25B6</div>
          <div class="broadcast-card__fallback-text">Live stream may be temporarily unavailable</div>
          <a class="broadcast-card__fallback-link" href="${ch.fallbackUrl}" target="_blank" rel="noopener noreferrer">Watch on ${ch.name} \u2197</a>
        </div>
      </div>
    </div>
  `).join('');

  // Click handlers for facades
  grid.addEventListener('click', e => {
    const facade = e.target.closest('.broadcast-card__facade');
    if (facade) {
      const embedContainer = facade.parentElement;
      loadEmbed(embedContainer);
      facade.remove();
    }
  });
}

function loadEmbed(container) {
  const channelId = container.dataset.channelId;
  const fallbackUrl = container.dataset.fallbackUrl;
  const fallbackEl = container.querySelector('.broadcast-card__fallback');

  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube-nocookie.com/embed/live_stream?channel=${channelId}&autoplay=1&mute=1`;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.loading = 'lazy';

  // Timeout fallback - if iframe doesn't load in 10 seconds
  const timeout = setTimeout(() => {
    showFallback(container, fallbackEl);
  }, 10000);

  iframe.addEventListener('load', () => {
    clearTimeout(timeout);
  });

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

// Lazy-load embeds when section scrolls into view
function setupLazyLoading() {
  const section = document.getElementById('section-broadcasts');
  if (!section) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Don't auto-load - let users click. Just observe for analytics.
        observer.disconnect();
      }
    });
  }, { threshold: 0.1 });

  observer.observe(section);
}
