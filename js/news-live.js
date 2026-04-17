// ═══════════════════════════════════════════════════════════
// NEWS-LIVE — Real-time news from RSS feeds via CORS proxy
// ═══════════════════════════════════════════════════════════
//
// Uses api.allorigins.win as CORS proxy to fetch RSS XML directly.
// Parses XML in-browser, categorizes headlines, replaces data.news.
// Refreshes every 3 min. Falls back to hardcoded news on failure.
// ═══════════════════════════════════════════════════════════

import { news } from './data.js';

const CORS_PROXY = "https://api.allorigins.win/raw?url=";

const RSS_FEEDS = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC World" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", source: "NY Times" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", source: "Al Jazeera" },
  { url: "https://feeds.skynews.com/feeds/rss/world.xml", source: "Sky News" },
];

// ── Category Detection ──
function categorize(text) {
  const t = text.toLowerCase();
  if (/\b(war|conflict|strike|attack|killed|military|battle|missile|troop|ceasefire|gaza|ukraine|sudan|yemen|syria|bomb|soldier|weapon|army|navy|drone)\b/.test(t))
    return { cat: "conflict", lbl: "Conflict" };
  if (/\b(market|stock|oil|gold|bitcoin|crypto|inflation|rate|fed|ecb|yield|treasury|dollar|yuan|euro|trade|economy|gdp|recession|bank)\b/.test(t))
    return { cat: "markets", lbl: "Markets" };
  if (/\b(energy|opec|gas|lng|power|pipeline|nuclear|renewable|coal|solar|wind|electricity|fuel)\b/.test(t))
    return { cat: "energy", lbl: "Energy" };
  return { cat: "politics", lbl: "Politics" };
}

// ── Region Detection ──
function detectRegion(text) {
  const t = text.toLowerCase();
  const map = [
    [/\b(china|beijing|hong kong|taiwan|xi jinping)\b/, "China"],
    [/\b(russia|moscow|putin|kremlin)\b/, "Russia"],
    [/\b(ukraine|kyiv|zelensky|donbas)\b/, "Ukraine"],
    [/\b(israel|gaza|palestine|hamas|netanyahu|west bank)\b/, "Middle East"],
    [/\b(iran|tehran|khamenei)\b/, "Iran"],
    [/\b(us |usa|united states|washington|biden|trump|congress|pentagon)\b/, "USA"],
    [/\b(uk |britain|london|starmer|sunak)\b/, "UK"],
    [/\b(eu |europe|brussels|eurozone|france|germany|berlin|paris|spain|italy)\b/, "Europe"],
    [/\b(saudi|riyadh|uae|dubai|qatar|doha|bahrain|oman|kuwait)\b/, "GCC"],
    [/\b(india|delhi|modi|mumbai)\b/, "India"],
    [/\b(japan|tokyo|south korea|seoul|north korea|pyongyang)\b/, "East Asia"],
    [/\b(sudan|khartoum)\b/, "Sudan"],
    [/\b(africa|nigeria|ethiopia|kenya|south africa|congo|somalia|mali)\b/, "Africa"],
    [/\b(syria|damascus|aleppo)\b/, "Syria"],
    [/\b(yemen|houthi)\b/, "Yemen"],
    [/\b(lebanon|hezbollah|beirut)\b/, "Lebanon"],
    [/\b(australia|melbourne|sydney|canberra)\b/, "Oceania"],
    [/\b(brazil|argentina|mexico|colombia|venezuela)\b/, "Latin America"],
  ];
  for (const [re, region] of map) if (re.test(t)) return region;
  return "Global";
}

function timeAgo(dateStr) {
  if (!dateStr) return "now";
  const ms = Date.now() - new Date(dateStr).getTime();
  if (isNaN(ms) || ms < 0) return "now";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').trim();
}

// ── Parse single RSS feed XML ──
function parseRSSItems(xmlText, source) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    const items = doc.querySelectorAll('item');
    const results = [];

    items.forEach((item, idx) => {
      if (idx >= 8) return;
      const title = stripHtml(item.querySelector('title')?.textContent || "");
      if (!title || title.length < 10) return;

      const desc = stripHtml(item.querySelector('description')?.textContent || "");
      const link = item.querySelector('link')?.textContent?.trim() || null;
      const pubDate = item.querySelector('pubDate')?.textContent || "";
      const { cat, lbl } = categorize(title + " " + desc);

      results.push({
        cat, lbl, title,
        region: detectRegion(title + " " + desc),
        time: timeAgo(pubDate),
        url: link,
        source,
        _ts: pubDate ? new Date(pubDate).getTime() : Date.now() - idx * 60000,
      });
    });

    return results;
  } catch (e) {
    console.warn(`[news-live] XML parse error for ${source}:`, e.message);
    return [];
  }
}

// ── Fetch single feed ──
async function fetchFeed(feed) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(CORS_PROXY + encodeURIComponent(feed.url), { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseRSSItems(xml, feed.source);
  } catch (e) {
    console.warn(`[news-live] ${feed.source} failed:`, e.message);
    return [];
  }
}

// ── Main fetch — all feeds in parallel ──
export async function fetchLiveNews() {
  try {
    const results = await Promise.allSettled(RSS_FEEDS.map(fetchFeed));
    const all = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);

    if (!all.length) {
      console.log('[news-live] No items fetched, keeping existing news');
      return false;
    }

    // Sort newest first, dedupe by title similarity
    all.sort((a, b) => (b._ts || 0) - (a._ts || 0));
    const seen = new Set();
    const deduped = all.filter(item => {
      const key = item.title.slice(0, 60).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const top = deduped.slice(0, 24);
    news.length = 0;
    news.push(...top);

    const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    console.log(`[news-live] ${top.length} items loaded at ${ts}`);
    return true;
  } catch (e) {
    console.warn('[news-live] Fetch error:', e.message);
    return false;
  }
}

// ── Periodic Refresh ──
let refreshTimer = null;

export function startLiveNewsRefresh(onUpdate) {
  fetchLiveNews().then(ok => {
    if (ok && onUpdate) onUpdate();
  });

  refreshTimer = setInterval(async () => {
    const ok = await fetchLiveNews();
    if (ok && onUpdate) onUpdate();
  }, 3 * 60 * 1000);
}

export function stopLiveNewsRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}
