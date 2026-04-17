// ═══════════════════════════════════════════════════════════
// NEWS-LIVE — Real-time news fetching from RSS sources
// ═══════════════════════════════════════════════════════════
//
// Strategy:
//   - Fetch from multiple RSS feeds via rss2json.com (no API key)
//   - Categorize items by keyword matching (conflict/politics/markets/energy)
//   - Update news array in place and refresh UI
//   - Refresh every 3 minutes; graceful fallback to hardcoded news
// ═══════════════════════════════════════════════════════════

import { news } from './data.js';

// RSS feed sources (free, public, no API key needed)
const RSS_SOURCES = [
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", region: "Global" },
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", region: "Global" },
  { name: "Reuters World", url: "https://moxie.foxnews.com/google-publisher/world.xml", region: "Global" },
  { name: "AP News World", url: "https://rsshub.app/apnews/topics/apf-topnews", region: "Global" },
];

// rss2json.com: free RSS to JSON converter with CORS support
const RSS2JSON_ENDPOINT = "https://api.rss2json.com/v1/api.json?rss_url=";

// ── Category Detection ──
function categorize(title, description = "") {
  const text = (title + " " + description).toLowerCase();

  if (/\b(war|conflict|strike|attack|killed|military|combat|battle|missile|troops|ceasefire|gaza|ukraine|sudan|yemen|syria)\b/.test(text)) {
    return { cat: "conflict", lbl: "Conflict" };
  }
  if (/\b(market|stock|oil|gold|bitcoin|crypto|inflation|rates?|fed|ecb|boe|yield|treasury|dollar|yuan|euro|trading)\b/.test(text)) {
    return { cat: "markets", lbl: "Markets" };
  }
  if (/\b(energy|opec|gas|lng|power|grid|pipeline|nuclear|renewable|coal|electricity)\b/.test(text)) {
    return { cat: "energy", lbl: "Energy" };
  }
  return { cat: "politics", lbl: "Politics" };
}

// ── Region Detection ──
function detectRegion(title, description = "") {
  const text = (title + " " + description).toLowerCase();
  const regions = [
    { k: /\b(china|beijing|hong kong|taiwan)\b/, v: "China" },
    { k: /\b(russia|moscow|putin|kremlin)\b/, v: "Russia" },
    { k: /\b(ukraine|kyiv|kiev|zelensky)\b/, v: "Ukraine" },
    { k: /\b(israel|gaza|palestine|hamas|netanyahu)\b/, v: "Middle East" },
    { k: /\b(iran|tehran)\b/, v: "Iran" },
    { k: /\b(us|usa|united states|washington|biden|trump|white house|congress)\b/, v: "USA" },
    { k: /\b(uk|britain|london)\b/, v: "UK" },
    { k: /\b(eu|europe|brussels|eurozone)\b/, v: "Europe" },
    { k: /\b(saudi|riyadh|uae|dubai|qatar|doha)\b/, v: "GCC" },
    { k: /\b(india|delhi|modi)\b/, v: "India" },
    { k: /\b(japan|tokyo)\b/, v: "Japan" },
    { k: /\b(sudan|khartoum)\b/, v: "Sudan" },
    { k: /\b(africa|nigeria|ethiopia|kenya|south africa)\b/, v: "Africa" },
  ];
  for (const r of regions) if (r.k.test(text)) return r.v;
  return "Global";
}

// ── Time Ago Formatter ──
function timeAgo(pubDate) {
  if (!pubDate) return "now";
  const now = Date.now();
  const then = new Date(pubDate).getTime();
  if (isNaN(then)) return "now";
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ── HTML Strip ──
function stripHtml(html) {
  if (!html) return "";
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

// ── Fetch from single source ──
async function fetchSource(source) {
  try {
    const url = RSS2JSON_ENDPOINT + encodeURIComponent(source.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.status !== 'ok' || !Array.isArray(data.items)) {
      throw new Error('Invalid RSS response');
    }

    return data.items.slice(0, 6).map(item => {
      const title = stripHtml(item.title || "").slice(0, 200);
      const desc = stripHtml(item.description || "");
      const cat = categorize(title, desc);
      return {
        cat: cat.cat,
        lbl: cat.lbl,
        title,
        region: detectRegion(title, desc),
        time: timeAgo(item.pubDate),
        url: item.link || null,
        source: source.name,
        _ts: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
      };
    });
  } catch (e) {
    console.log(`[news-live] ${source.name} fetch failed:`, e.message);
    return [];
  }
}

// ── Replace news array in place ──
function replaceNews(items) {
  news.length = 0;
  news.push(...items);
}

// ── Main Fetch ──
export async function fetchLiveNews() {
  try {
    const results = await Promise.all(RSS_SOURCES.map(fetchSource));
    const all = results.flat();

    if (!all.length) {
      console.log('[news-live] No items fetched, keeping existing news');
      return false;
    }

    // Sort by timestamp (newest first), dedupe by title
    all.sort((a, b) => b._ts - a._ts);
    const seen = new Set();
    const deduped = all.filter(item => {
      const key = item.title.slice(0, 80).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const top = deduped.slice(0, 20);
    replaceNews(top);

    console.log(`[news-live] Loaded ${top.length} live news items`);
    return true;
  } catch (e) {
    console.log('[news-live] Fetch error:', e.message);
    return false;
  }
}

// ── Periodic Refresh ──
let refreshInterval = null;

export function startLiveNewsRefresh(onUpdate) {
  // Initial fetch
  fetchLiveNews().then(ok => {
    if (ok && onUpdate) onUpdate();
  });

  // Refresh every 3 minutes
  refreshInterval = setInterval(async () => {
    const ok = await fetchLiveNews();
    if (ok && onUpdate) onUpdate();
  }, 3 * 60 * 1000);
}

export function stopLiveNewsRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}
