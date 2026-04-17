// ═══════════════════════════════════════════════════════════
// MARKETS-LIVE — Real-time market data from free APIs
// ═══════════════════════════════════════════════════════════
//
// Crypto: CoinGecko API (free, no key, CORS-enabled)
// Traditional: Yahoo Finance v8 chart API via CORS proxy
// Auto-refreshes every 60 seconds
// ═══════════════════════════════════════════════════════════

import { markets } from './data.js';

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true';

const YAHOO_SYMBOLS = [
  { sym: 'XAU', yahoo: 'GC=F', name: 'Gold', type: 'commodity' },
  { sym: 'WTI', yahoo: 'CL=F', name: 'Crude Oil', type: 'commodity' },
  { sym: 'DXY', yahoo: 'DX-Y.NYB', name: 'US Dollar Index', type: 'index' },
  { sym: 'SPX', yahoo: '^GSPC', name: 'S&P 500', type: 'index' },
  { sym: 'FTSE', yahoo: '^FTSE', name: 'FTSE 100', type: 'index' },
  { sym: 'NIKKEI', yahoo: '^N225', name: 'Nikkei 225', type: 'index' },
];

// ── Fetch crypto from CoinGecko ──
async function fetchCrypto() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(COINGECKO_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const results = [];
    if (data.bitcoin) {
      results.push({
        sym: 'BTC', name: 'Bitcoin',
        price: Math.round(data.bitcoin.usd),
        chg: Math.round((data.bitcoin.usd_24h_change || 0) * 100) / 100,
        type: 'crypto'
      });
    }
    if (data.ethereum) {
      results.push({
        sym: 'ETH', name: 'Ethereum',
        price: Math.round(data.ethereum.usd * 100) / 100,
        chg: Math.round((data.ethereum.usd_24h_change || 0) * 100) / 100,
        type: 'crypto'
      });
    }
    return results;
  } catch (e) {
    console.warn('[markets-live] CoinGecko failed:', e.message);
    return [];
  }
}

// ── Fetch single Yahoo Finance symbol ──
async function fetchYahooSymbol(item) {
  try {
    const chartUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.yahoo)}?interval=1d&range=2d`;
    const proxyUrl = CORS_PROXY + encodeURIComponent(chartUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error('No chart data');

    const price = meta.regularMarketPrice || meta.previousClose;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    const chg = prevClose ? Math.round(((price - prevClose) / prevClose) * 10000) / 100 : 0;

    return {
      sym: item.sym,
      name: item.name,
      price: Math.round(price * 100) / 100,
      chg,
      type: item.type
    };
  } catch (e) {
    console.warn(`[markets-live] Yahoo ${item.sym} failed:`, e.message);
    return null;
  }
}

// ── Fetch all traditional markets ──
async function fetchTraditional() {
  const results = await Promise.allSettled(YAHOO_SYMBOLS.map(fetchYahooSymbol));
  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

// ── Update markets array in place ──
function updateMarkets(newData) {
  if (!newData.length) return false;

  const bySymbol = {};
  newData.forEach(m => { bySymbol[m.sym] = m; });

  let updated = 0;
  markets.forEach((m, i) => {
    if (bySymbol[m.sym]) {
      markets[i] = { ...m, ...bySymbol[m.sym] };
      updated++;
    }
  });

  return updated > 0;
}

// ── Main fetch — all sources in parallel ──
export async function fetchLiveMarkets() {
  try {
    const [crypto, traditional] = await Promise.all([
      fetchCrypto(),
      fetchTraditional()
    ]);

    const all = [...crypto, ...traditional];
    if (!all.length) {
      console.log('[markets-live] No data fetched, keeping existing');
      return false;
    }

    const ok = updateMarkets(all);
    const ts = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    console.log(`[markets-live] ${all.length} prices updated at ${ts}`);
    return ok;
  } catch (e) {
    console.warn('[markets-live] Fetch error:', e.message);
    return false;
  }
}

// ── Periodic Refresh ──
let refreshTimer = null;

export function startLiveMarketRefresh(onUpdate) {
  fetchLiveMarkets().then(ok => {
    if (ok && onUpdate) onUpdate();
  });

  refreshTimer = setInterval(async () => {
    const ok = await fetchLiveMarkets();
    if (ok && onUpdate) onUpdate();
  }, 60 * 1000);
}

export function stopLiveMarketRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}
