// Vercel Serverless Function — Live market data (server-side)
//
// Fetches Yahoo Finance quotes + CoinGecko crypto directly server-side,
// so the browser never depends on flaky third-party CORS proxies.
// Returns [{sym, name, price, chg, type}] JSON with no-store caching.

const YAHOO_SYMBOLS = [
  // Indices
  { sym: 'DXY', yahoo: 'DX-Y.NYB', name: 'US Dollar Index', type: 'index' },
  { sym: 'SPX', yahoo: '^GSPC', name: 'S&P 500', type: 'index' },
  { sym: 'FTSE', yahoo: '^FTSE', name: 'FTSE 100', type: 'index' },
  { sym: 'NIKKEI', yahoo: '^N225', name: 'Nikkei 225', type: 'index' },
  // Energy
  { sym: 'WTI', yahoo: 'CL=F', name: 'Crude Oil', type: 'commodity' },
  { sym: 'BRENT', yahoo: 'BZ=F', name: 'Brent Crude', type: 'commodity' },
  { sym: 'NG', yahoo: 'NG=F', name: 'Natural Gas', type: 'commodity' },
  { sym: 'RBOB', yahoo: 'RB=F', name: 'RBOB Gasoline', type: 'commodity' },
  { sym: 'HO', yahoo: 'HO=F', name: 'Heating Oil', type: 'commodity' },
  // Precious metals
  { sym: 'XAU', yahoo: 'GC=F', name: 'Gold', type: 'commodity' },
  { sym: 'XAG', yahoo: 'SI=F', name: 'Silver', type: 'commodity' },
  { sym: 'XPT', yahoo: 'PL=F', name: 'Platinum', type: 'commodity' },
  { sym: 'XPD', yahoo: 'PA=F', name: 'Palladium', type: 'commodity' },
  // Base metals
  { sym: 'HG', yahoo: 'HG=F', name: 'Copper', type: 'commodity' },
  // Soft commodities
  { sym: 'ZW', yahoo: 'ZW=F', name: 'Wheat', type: 'commodity' },
];

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function fetchWithTimeout(url, ms = 7000, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCrypto() {
  try {
    const res = await fetchWithTimeout(COINGECKO_URL);
    if (!res.ok) return [];
    const data = await res.json();
    const out = [];
    if (data.bitcoin) {
      out.push({
        sym: 'BTC', name: 'Bitcoin', type: 'crypto',
        price: Math.round(data.bitcoin.usd),
        chg: Math.round((data.bitcoin.usd_24h_change || 0) * 100) / 100,
      });
    }
    if (data.ethereum) {
      out.push({
        sym: 'ETH', name: 'Ethereum', type: 'crypto',
        price: Math.round(data.ethereum.usd * 100) / 100,
        chg: Math.round((data.ethereum.usd_24h_change || 0) * 100) / 100,
      });
    }
    return out;
  } catch (e) {
    console.warn('[api/markets] CoinGecko failed:', e.message);
    return [];
  }
}

// Yahoo's batch quote endpoint — one request for all symbols.
async function fetchYahooBatch() {
  const symbols = YAHOO_SYMBOLS.map(s => s.yahoo).join(',');
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

  for (const host of hosts) {
    try {
      const url = `https://${host}/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
      const res = await fetchWithTimeout(url, 7000, { 'User-Agent': UA, 'Accept': 'application/json' });
      if (!res.ok) continue;
      const data = await res.json();
      const quotes = data?.quoteResponse?.result;
      if (!Array.isArray(quotes) || !quotes.length) continue;

      const byYahoo = {};
      quotes.forEach(q => { byYahoo[q.symbol] = q; });

      return YAHOO_SYMBOLS.map(item => {
        const q = byYahoo[item.yahoo];
        if (!q) return null;
        const price = q.regularMarketPrice ?? q.previousClose;
        if (price == null) return null;
        const chg = q.regularMarketChangePercent != null
          ? Math.round(q.regularMarketChangePercent * 100) / 100
          : 0;
        return { sym: item.sym, name: item.name, type: item.type, price: Math.round(price * 100) / 100, chg };
      }).filter(Boolean);
    } catch (e) {
      console.warn(`[api/markets] Yahoo batch via ${host} failed:`, e.message);
    }
  }

  // Fallback: per-symbol chart endpoint (slower but more tolerant)
  const results = await Promise.allSettled(YAHOO_SYMBOLS.map(async item => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.yahoo)}?interval=1d&range=2d`;
    const res = await fetchWithTimeout(url, 6000, { 'User-Agent': UA });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error('No chart data');
    const price = meta.regularMarketPrice || meta.previousClose;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    const chg = prevClose ? Math.round(((price - prevClose) / prevClose) * 10000) / 100 : 0;
    return { sym: item.sym, name: item.name, type: item.type, price: Math.round(price * 100) / 100, chg };
  }));
  return results.filter(r => r.status === 'fulfilled').map(r => r.value);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const [crypto, traditional] = await Promise.all([fetchCrypto(), fetchYahooBatch()]);
    const items = [...crypto, ...traditional];

    if (!items.length) {
      return res.status(200).json({ ok: false, items: [], error: 'All market sources unavailable' });
    }

    res.status(200).json({ ok: true, count: items.length, fetchedAt: new Date().toISOString(), items });
  } catch (e) {
    console.error('[api/markets] Error:', e.message);
    res.status(200).json({ ok: false, items: [], error: e.message });
  }
}
