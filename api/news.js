// Vercel Serverless Function — Live world news from RSS feeds (server-side)
//
// Fetches RSS directly server-side (no CORS, no flaky third-party proxies),
// parses the XML with lightweight regex, categorizes/regionalizes each item,
// and returns clean JSON. The browser calls this same-origin endpoint so it
// is far more reliable than the client-side CORS-proxy chain.

const RSS_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC World' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: 'NY Times' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera' },
  { url: 'https://feeds.skynews.com/feeds/rss/world.xml', source: 'Sky News' },
  { url: 'https://moxie.foxnews.com/google-publisher/world.xml', source: 'Fox World' },
  { url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml', source: 'WSJ World' },
];

function categorize(text) {
  const t = text.toLowerCase();
  if (/\b(war|conflict|strike|attack|killed|military|battle|missile|troop|ceasefire|gaza|ukraine|sudan|yemen|syria|bomb|soldier|weapon|army|navy|drone|casualties|airstrike|shelling)\b/.test(t))
    return { cat: 'conflict', lbl: 'Conflict' };
  if (/\b(market|stock|oil|gold|bitcoin|crypto|inflation|rate|fed|ecb|yield|treasury|dollar|yuan|euro|trade|economy|gdp|recession|bank|invest|rally|crash|nasdaq|dow)\b/.test(t))
    return { cat: 'markets', lbl: 'Markets' };
  if (/\b(energy|opec|gas|lng|power|pipeline|nuclear|renewable|coal|solar|wind|electricity|fuel|barrel)\b/.test(t))
    return { cat: 'energy', lbl: 'Energy' };
  return { cat: 'politics', lbl: 'Politics' };
}

function detectRegion(text) {
  const t = text.toLowerCase();
  const map = [
    [/\b(china|beijing|hong kong|taiwan|xi jinping)\b/, 'China'],
    [/\b(russia|moscow|putin|kremlin)\b/, 'Russia'],
    [/\b(ukraine|kyiv|zelensky|donbas)\b/, 'Ukraine'],
    [/\b(israel|gaza|palestine|hamas|netanyahu|west bank)\b/, 'Middle East'],
    [/\b(iran|tehran|khamenei)\b/, 'Iran'],
    [/\b(us |usa|united states|washington|biden|trump|congress|pentagon)\b/, 'USA'],
    [/\b(uk |britain|london|starmer|sunak)\b/, 'UK'],
    [/\b(eu |europe|brussels|eurozone|france|germany|berlin|paris|spain|italy)\b/, 'Europe'],
    [/\b(saudi|riyadh|uae|dubai|qatar|doha|bahrain|oman|kuwait)\b/, 'GCC'],
    [/\b(india|delhi|modi|mumbai)\b/, 'India'],
    [/\b(japan|tokyo|south korea|seoul|north korea|pyongyang)\b/, 'East Asia'],
    [/\b(sudan|khartoum)\b/, 'Sudan'],
    [/\b(africa|nigeria|ethiopia|kenya|south africa|congo|somalia|mali)\b/, 'Africa'],
    [/\b(syria|damascus|aleppo)\b/, 'Syria'],
    [/\b(yemen|houthi)\b/, 'Yemen'],
    [/\b(lebanon|hezbollah|beirut)\b/, 'Lebanon'],
    [/\b(australia|melbourne|sydney)\b/, 'Oceania'],
    [/\b(brazil|argentina|mexico|colombia|venezuela)\b/, 'Latin America'],
  ];
  for (const [re, region] of map) if (re.test(t)) return region;
  return 'Global';
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"').replace(/&#8211;/g, '-')
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? m[1] : '';
}

function parseRSS(xml, source) {
  const out = [];
  const items = xml.split(/<item[\s>]/i).slice(1);
  for (let idx = 0; idx < items.length && idx < 10; idx++) {
    const block = items[idx];
    const title = stripHtml(tag(block, 'title'));
    if (!title || title.length < 10) continue;
    const desc = stripHtml(tag(block, 'description'));
    let link = stripHtml(tag(block, 'link'));
    // Some feeds (Atom-ish) put the link in an href attribute.
    if (!link) {
      const hm = block.match(/<link[^>]*href=["']([^"']+)["']/i);
      if (hm) link = hm[1];
    }
    const pubDate = stripHtml(tag(block, 'pubDate')) || stripHtml(tag(block, 'dc:date'));
    const { cat, lbl } = categorize(title + ' ' + desc);
    const ts = pubDate ? new Date(pubDate).getTime() : Date.now() - idx * 60000;
    out.push({
      cat, lbl, title,
      region: detectRegion(title + ' ' + desc),
      url: link || null,
      source,
      _ts: isNaN(ts) ? Date.now() - idx * 60000 : ts,
    });
  }
  return out;
}

async function fetchFeed(feed) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(feed.url + (feed.url.includes('?') ? '&' : '?') + `_cb=${Date.now()}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FelicityIntel/1.0; +https://felicity-world-map.vercel.app)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const xml = await res.text();
    if (!xml || xml.length < 100) return [];
    return parseRSS(xml, feed.source);
  } catch (e) {
    console.warn(`[api/news] ${feed.source} failed:`, e.message);
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  // Edge/browser must always re-hit the function; we control freshness here.
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const settled = await Promise.allSettled(RSS_FEEDS.map(fetchFeed));
    const all = settled.filter(r => r.status === 'fulfilled').flatMap(r => r.value);

    if (!all.length) {
      return res.status(200).json({ ok: false, items: [], error: 'All feeds unavailable' });
    }

    all.sort((a, b) => (b._ts || 0) - (a._ts || 0));
    const seen = new Set();
    const deduped = all.filter(item => {
      const key = item.title.slice(0, 60).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    res.status(200).json({
      ok: true,
      count: deduped.length,
      fetchedAt: new Date().toISOString(),
      items: deduped.slice(0, 30),
    });
  } catch (e) {
    console.error('[api/news] Error:', e.message);
    res.status(200).json({ ok: false, items: [], error: e.message });
  }
}
