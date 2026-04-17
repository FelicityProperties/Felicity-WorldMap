// ═══════════════════════════════════════════════════════════
// BROADCASTS — Dynamic live stream discovery + embed
// ═══════════════════════════════════════════════════════════
//
// Instead of hardcoding YouTube video IDs (which expire when
// streams restart), we discover them at runtime:
//
//   1. Fetch YouTube oEmbed for @handle/live via CORS proxy
//   2. Extract current video ID from response
//   3. Embed with that fresh ID
//   4. Fallback chain: oEmbed → live_stream?channel= → link
//
// ═══════════════════════════════════════════════════════════

import { broadcastChannels } from './data.js';

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

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
      <div class="broadcast-card__embed" id="embed-${i}">
        <div class="broadcast-card__facade" data-idx="${i}">
          <div class="broadcast-card__play" style="box-shadow:0 0 30px ${ch.color}55">
            <div class="broadcast-card__play-icon"></div>
          </div>
          <span class="broadcast-card__facade-text">Click to load live stream</span>
        </div>
        <div class="broadcast-card__fallback" id="fallback-${i}">
          <div class="broadcast-card__fallback-icon" style="color:${ch.color}">\u25B6</div>
          <div class="broadcast-card__fallback-text">Stream temporarily unavailable</div>
          <a class="broadcast-card__fallback-link" href="${ch.fallbackUrl}" target="_blank" rel="noopener noreferrer">Watch on ${ch.name} \u2197</a>
        </div>
      </div>
    </div>
  `).join('');

  // Click facade → start loading the stream
  grid.addEventListener('click', e => {
    const facade = e.target.closest('.broadcast-card__facade');
    if (!facade) return;
    const idx = parseInt(facade.dataset.idx);
    facade.innerHTML = '<div class="broadcast-card__loading"><span class="broadcast-card__spinner"></span>Connecting to stream...</div>';
    loadStream(idx, facade);
  });
}

// ── Load stream: discover ID dynamically, then embed ──
async function loadStream(idx, facadeEl) {
  const ch = broadcastChannels[idx];
  const container = document.getElementById(`embed-${idx}`);
  const fallbackEl = document.getElementById(`fallback-${idx}`);

  // Try three strategies in order
  const videoId = await discoverVideoId(ch);

  if (videoId) {
    embedIframe(container, facadeEl, fallbackEl, videoId);
    return;
  }

  // Strategy 2: live_stream?channel= URL
  if (ch.channelId) {
    embedIframe(container, facadeEl, fallbackEl, null, ch.channelId);
    return;
  }

  // Strategy 3: give up, show fallback
  if (facadeEl) facadeEl.remove();
  showFallback(fallbackEl);
}

// ── Discover current live video ID via oEmbed ──
async function discoverVideoId(ch) {
  // Strategy 1: YouTube oEmbed API on @handle/live
  if (ch.handle) {
    try {
      const ytUrl = `https://www.youtube.com/@${ch.handle}/live`;
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(ytUrl)}&format=json`;
      const proxyUrl = CORS_PROXY + encodeURIComponent(oembedUrl);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const match = data.html?.match(/embed\/([a-zA-Z0-9_-]{11})/);
        if (match) {
          console.log(`[broadcasts] ${ch.name}: discovered video ID ${match[1]}`);
          return match[1];
        }
      }
    } catch (e) {
      console.warn(`[broadcasts] oEmbed failed for ${ch.name}:`, e.message);
    }
  }

  // Strategy 2: YouTube RSS feed — first entry is usually the live stream
  if (ch.channelId) {
    try {
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${ch.channelId}`;
      const proxyUrl = CORS_PROXY + encodeURIComponent(rssUrl);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const xml = await res.text();
        const match = xml.match(/<yt:videoId>([a-zA-Z0-9_-]{11})<\/yt:videoId>/);
        if (match) {
          console.log(`[broadcasts] ${ch.name}: discovered video ID ${match[1]} from RSS`);
          return match[1];
        }
      }
    } catch (e) {
      console.warn(`[broadcasts] RSS failed for ${ch.name}:`, e.message);
    }
  }

  return null;
}

// ── Create and insert iframe ──
function embedIframe(container, facadeEl, fallbackEl, videoId, channelId) {
  const src = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&rel=0`
    : `https://www.youtube-nocookie.com/embed/live_stream?channel=${channelId}&autoplay=1&mute=1`;

  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:0';

  const timeout = setTimeout(() => {
    console.warn('[broadcasts] Iframe load timeout');
    showFallback(fallbackEl);
  }, 15000);

  iframe.addEventListener('load', () => clearTimeout(timeout));
  iframe.addEventListener('error', () => {
    clearTimeout(timeout);
    showFallback(fallbackEl);
  });

  if (facadeEl) facadeEl.remove();
  container.insertBefore(iframe, fallbackEl);
}

function showFallback(fallbackEl) {
  if (fallbackEl) fallbackEl.classList.add('visible');
}
