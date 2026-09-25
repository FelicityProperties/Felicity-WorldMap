// ═══════════════════════════════════════════════════════════
// TRADINGVIEW DATASET DISCOVERY — read the heatmap's real codes
// ═══════════════════════════════════════════════════════════
//
// The stock-heatmap embed accepts a `dataSource` code per market, and
// TradingView documents only two of them (SPX500, ASX200). Every guessed
// code is silently replaced by the S&P 500. The list lives inside the
// widget's own JavaScript bundle, which the deployed function can fetch
// even though the development sandbox cannot.
//
// This fetches the embed page, follows its script tags, and returns every
// window of text around a known-good code plus the quoted UPPERCASE
// tokens found in those windows. It is a diagnostic, not a feed: the
// output is read by a person and turned into the picker's key table.
// ═══════════════════════════════════════════════════════════

const EMBED_PAGE = 'https://www.tradingview-widget.com/embed-widget/stock-heatmap/?locale=en';
const KNOWN = ['SPX500', 'ASX200'];
const MAX_SCRIPTS = 8;
const MAX_BYTES = 8 * 1024 * 1024;

async function timedFetch(url, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { signal: c.signal, headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36', Accept: '*/*' } });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? `timeout after ${ms}ms` : e.message);
  } finally {
    clearTimeout(t);
  }
}

/** Script URLs referenced by an HTML page, absolute. */
export function scriptUrls(html, base) {
  const out = new Set();
  for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    try { out.add(new URL(m[1], base).href); } catch { /* skip */ }
  }
  return [...out];
}

/** Text windows around each known code, and the quoted upper-case tokens inside them. */
export function extractWindows(text, span = 700) {
  const windows = [];
  const tokens = new Set();
  for (const code of KNOWN) {
    let i = -1;
    while ((i = text.indexOf(code, i + 1)) !== -1 && windows.length < 40) {
      const w = text.slice(Math.max(0, i - span), i + span);
      windows.push({ code, at: i, text: w });
      for (const t of w.matchAll(/["']([A-Z][A-Z0-9]{2,14})["']/g)) tokens.add(t[1]);
    }
  }
  return { windows, tokens: [...tokens].sort() };
}

export async function discoverDatasets({ timeoutMs = 10000 } = {}) {
  const page = await timedFetch(EMBED_PAGE, timeoutMs);
  if (!page.ok) throw new Error(`embed page HTTP ${page.status}`);
  const html = await page.text();
  const urls = scriptUrls(html, EMBED_PAGE).slice(0, MAX_SCRIPTS);
  const inline = extractWindows(html);
  const scripts = [];
  let bytes = 0;
  for (const u of urls) {
    if (bytes > MAX_BYTES) break;
    try {
      const r = await timedFetch(u, timeoutMs);
      if (!r.ok) { scripts.push({ url: u, error: `HTTP ${r.status}` }); continue; }
      const text = await r.text();
      bytes += text.length;
      const found = extractWindows(text);
      scripts.push({ url: u, bytes: text.length, hits: found.windows.length, tokens: found.tokens, windows: found.windows.slice(0, 6).map(w => w.text) });
    } catch (e) {
      scripts.push({ url: u, error: e.message });
    }
  }
  return {
    ok: true,
    fetchedAt: new Date().toISOString(),
    page: { bytes: html.length, hits: inline.windows.length, tokens: inline.tokens, scriptUrls: urls },
    scripts,
    method: 'Windows of text around the documented codes SPX500/ASX200 in the embed page and its script bundles; quoted UPPERCASE tokens in those windows are candidate dataset codes. Read by a person, not by the site.',
  };
}
