// ═══════════════════════════════════════════════════════════
// TRADINGVIEW DATASET DISCOVERY — read the heatmap's real codes
// ═══════════════════════════════════════════════════════════
//
// The stock-heatmap embed accepts a `dataSource` code per market, and
// TradingView documents only two of them (SPX500, ASX200). Every guessed
// code is silently replaced by the S&P 500. The list lives somewhere in
// the widget's own JavaScript or is fetched by it at runtime; the deployed
// function can reach those files even though the development sandbox
// cannot.
//
// First run (Sep 2026) taught us the embed page's eight script tags hold
// only translation strings — ASX200 appears in none of them. So this now
// also reads the webpack runtime's chunk map and follows every lazy chunk
// it names, and it greps every file for the loader's own vocabulary
// (`dataSource`, `datasets`, scanner URLs, known codes) rather than only
// for the two documented codes.
//
// It is a diagnostic, not a feed: the output is read by a person and
// turned into the picker's key table.
// ═══════════════════════════════════════════════════════════

const EMBED_PAGE = 'https://www.tradingview-widget.com/embed-widget/stock-heatmap/?locale=en';
const CHUNK_BASE = 'https://www.tradingview-widget.com/static/bundles/embed/';
// The loader script a page embeds; it turns our JSON into the iframe URL.
const LOADER_SCRIPT = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
// Words the dataset loader must use, whatever the codes turn out to be.
// `permissionOverrides` / `extractWidgetSettings` are the embed's own
// settings validator — the place a valid code could still be dropped.
const NEEDLES = ['ASX200', 'dataSource', 'permissionOverrides', 'extractWidgetSettings', 'scanner.tradingview.com', 'heatmap-data'];
const MAX_SCRIPTS = 60;
const MAX_BYTES = 24 * 1024 * 1024;
const MAX_WINDOWS = 60;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36';

async function timedFetch(url, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { signal: c.signal, headers: { 'User-Agent': UA, Accept: '*/*' } });
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

/**
 * Lazy chunk URLs from a webpack runtime. The runtime carries a map of
 * chunk id → content hash (`{9756:"b0a5…",37036:"20ed…"}`) and sometimes a
 * map of id → name (`{9756:"en"}`); the file name is `<name|id>.<hash>.js`.
 */
export function chunkUrls(runtime, base = CHUNK_BASE) {
  const hashes = {};
  const names = {};
  for (const m of runtime.matchAll(/\{((?:\s*\d+\s*:\s*"[0-9a-f]{16,}"\s*,?)+)\}/g)) {
    for (const p of m[1].matchAll(/(\d+)\s*:\s*"([0-9a-f]{16,})"/g)) hashes[p[1]] = p[2];
  }
  for (const m of runtime.matchAll(/\{((?:\s*\d+\s*:\s*"[A-Za-z][\w-]*"\s*,?)+)\}/g)) {
    for (const p of m[1].matchAll(/(\d+)\s*:\s*"([A-Za-z][\w-]*)"/g)) names[p[1]] = p[2];
  }
  return Object.entries(hashes).map(([id, hash]) => `${base}${names[id] ? names[id] + '.' + id : id}.${hash}.js`);
}

/** Text windows around each needle, and the quoted upper-case tokens inside them. */
export function extractWindows(text, span = 700, needles = NEEDLES) {
  const windows = [];
  const tokens = new Set();
  const hits = {};
  for (const needle of needles) {
    let i = -1;
    let n = 0;
    while ((i = text.indexOf(needle, i + 1)) !== -1) {
      n++;
      // Translation tables ("#SPX500-symbol-description") are noise, not the loader
      if (text[i - 1] === '#') continue;
      if (windows.length < MAX_WINDOWS && !windows.some(w => Math.abs(w.at - i) < span)) {
        const w = text.slice(Math.max(0, i - span), i + span);
        windows.push({ needle, at: i, text: w });
        for (const t of w.matchAll(/["']([A-Z][A-Z0-9]{2,14})["']/g)) tokens.add(t[1]);
      }
    }
    if (n) hits[needle] = n;
  }
  return { windows, tokens: [...tokens].sort(), hits };
}

/**
 * The complete DataSets enum (`e.DAX="DAX",…`) from the chunk that defines
 * it, the dataset → index-symbol label table, and every dataset menu the
 * chunk builds (group → codes). These are the facts the picker needs.
 */
export function extractTables(text) {
  const out = { datasets: [], labels: {}, menus: [] };
  const at = text.indexOf('DataSets:()=>');
  if (at !== -1) {
    const body = text.slice(at, at + 12000);
    const end = body.indexOf('}({})');
    for (const m of (end === -1 ? body : body.slice(0, end)).matchAll(/\b\w\.(\w+)="(\w+)"/g)) out.datasets.push(m[2]);
  }
  for (const m of text.matchAll(/\[\w\.DataSets\.(\w+)\]:\(\)=>\w\(\{description:"([^"]+)",pro_name:"([^"]+)"/g)) out.labels[m[1]] = `${m[2]} (${m[3]})`;
  for (const m of text.matchAll(/\w\(\w+\.(\w+),[^[\]]{0,80}\[((?:\w\(\w\.DataSets\.\w+\),?)+)\]/g)) {
    out.menus.push({ group: m[1], codes: [...m[2].matchAll(/DataSets\.(\w+)/g)].map(x => x[1]) });
  }
  return out;
}

/** Absolute tradingview URLs mentioned in a bundle — where the loader fetches from. */
export function endpointUrls(text) {
  const out = new Set();
  for (const m of text.matchAll(/https?:\/\/[a-z0-9.-]*tradingview[a-z0-9.-]*\/[^\s"'`)]{0,120}/gi)) out.add(m[0]);
  return [...out].slice(0, 40);
}

export async function discoverDatasets({ timeoutMs = 10000, budgetMs = 40000 } = {}) {
  const deadline = Date.now() + budgetMs;
  const left = () => Math.max(0, deadline - Date.now());
  const page = await timedFetch(EMBED_PAGE, Math.min(timeoutMs, left()));
  if (!page.ok) throw new Error(`embed page HTTP ${page.status}`);
  const html = await page.text();
  const tagged = scriptUrls(html, EMBED_PAGE);
  const inline = extractWindows(html);
  const queue = [...tagged];
  const seen = new Set(queue);
  const scripts = [];
  let bytes = 0;
  while (queue.length && scripts.length < MAX_SCRIPTS) {
    const u = queue.shift();
    if (bytes > MAX_BYTES) { scripts.push({ url: u, error: 'skipped: byte budget spent' }); continue; }
    if (left() < 1000) { scripts.push({ url: u, error: 'skipped: overall time budget spent' }); continue; }
    try {
      const r = await timedFetch(u, Math.min(timeoutMs, left()));
      if (!r.ok) { scripts.push({ url: u, error: `HTTP ${r.status}` }); continue; }
      const text = await r.text();
      bytes += text.length;
      const found = extractWindows(text);
      const entry = { url: u, bytes: text.length, hits: found.hits, endpoints: endpointUrls(text), windows: found.windows.slice(0, 6).map(w => `[${w.needle}] ${w.text}`) };
      const tables = extractTables(text);
      if (tables.datasets.length) entry.datasets = tables.datasets;
      if (Object.keys(tables.labels).length) entry.labels = tables.labels;
      if (tables.menus.length) entry.menus = tables.menus;
      if (/runtime/.test(u)) {
        const lazy = chunkUrls(text);
        entry.chunksInRuntime = lazy.length;
        for (const c of lazy) if (!seen.has(c)) { seen.add(c); queue.push(c); }
      }
      scripts.push(entry);
    } catch (e) {
      scripts.push({ url: u, error: e.message });
    }
  }
  const unfetched = queue.length;
  // The loader script itself — how our JSON becomes the iframe URL
  let loader;
  try {
    const r = await timedFetch(LOADER_SCRIPT, Math.min(timeoutMs, Math.max(1000, left())));
    const text = r.ok ? await r.text() : '';
    loader = r.ok ? { url: LOADER_SCRIPT, bytes: text.length, text: text.length <= 40000 ? text : text.slice(0, 40000) + ' …[truncated]' } : { url: LOADER_SCRIPT, error: `HTTP ${r.status}` };
  } catch (e) {
    loader = { url: LOADER_SCRIPT, error: e.message };
  }
  return {
    ok: true,
    fetchedAt: new Date().toISOString(),
    page: { bytes: html.length, hits: inline.hits, scriptUrls: tagged },
    scripts,
    unfetched,
    loader,
    method: 'Embed page, its script tags, and every lazy chunk named in the webpack runtime. Each file is grepped for the settings validator and dataset vocabulary (700-char windows, translation-table hits skipped), and the chunk defining the DataSets enum yields the full code list, the code → index label table and every dataset menu (group → codes). The s3 loader script is returned whole. Read by a person, not by the site.',
  };
}
