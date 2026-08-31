// ═══════════════════════════════════════════════════════════
// TRADINGVIEW WIDGETS — shared mounting helper
// ═══════════════════════════════════════════════════════════
//
// TradingView's embeds are <script> tags whose JSON config sits in the
// element's text content. Scripts injected via innerHTML never execute,
// so every widget must be created and appended programmatically.
//
// These are TradingView's own official embeds. Their data lives inside
// the iframe and never feeds our calculations — the platform's own
// numbers still come from Finnhub, Yahoo, CoinGecko and PropertyIndex.
// ═══════════════════════════════════════════════════════════

const TV_BASE = 'https://s3.tradingview.com/external-embedding/embed-widget-';

const THEME = {
  theme: 'dark',
  locale: 'en',
  backgroundColor: 'rgba(13, 17, 23, 1)',
  gridColor: 'rgba(255, 255, 255, 0.06)',
  isTransparent: false,
};

/**
 * Mount a TradingView widget into a host element.
 * @param {string|HTMLElement} host  container element or its id
 * @param {string} widget            embed name, e.g. 'ticker-tape'
 * @param {object} config            widget configuration
 * @param {string} failMessage       shown if the script cannot load
 */
export function mountWidget(host, widget, config, failMessage = 'Widget unavailable — TradingView could not be reached.') {
  const el = typeof host === 'string' ? document.getElementById(host) : host;
  if (!el) return;

  el.innerHTML = '<div class="tradingview-widget-container__widget"></div>';

  const s = document.createElement('script');
  s.type = 'text/javascript';
  s.async = true;
  s.src = `${TV_BASE}${widget}.js`;
  s.textContent = JSON.stringify({ ...config, support_host: 'https://www.tradingview.com' });
  s.onerror = () => { el.innerHTML = `<div class="tv-fail">${failMessage}</div>`; };

  el.appendChild(s);
}

// ── Ticker tape: scrolling live prices across asset classes ──
export function mountTickerTape(host) {
  mountWidget(host, 'ticker-tape', {
    ...THEME,
    displayMode: 'adaptive',
    showSymbolLogo: true,
    symbols: [
      { proName: 'FOREXCOM:SPXUSD',   title: 'S&P 500' },
      { proName: 'NASDAQ:NDX',        title: 'Nasdaq 100' },
      { proName: 'TVC:DXY',           title: 'Dollar Index' },
      { proName: 'TVC:GOLD',          title: 'Gold' },
      { proName: 'TVC:USOIL',         title: 'WTI Crude' },
      { proName: 'COINBASE:BTCUSD',   title: 'Bitcoin' },
      { proName: 'COINBASE:ETHUSD',   title: 'Ethereum' },
      { proName: 'FX:EURUSD',         title: 'EUR/USD' },
      { proName: 'FX:USDJPY',         title: 'USD/JPY' },
      { proName: 'TVC:US10Y',         title: 'US 10Y' },
      { proName: 'TVC:VIX',           title: 'VIX' },
      { proName: 'TVC:UKX',           title: 'FTSE 100' },
      { proName: 'TVC:NI225',         title: 'Nikkei 225' },
    ],
  });
}

// ── Heatmap: S&P 500 by sector, sized by market cap ──
export function mountHeatmap(host, dataSource = 'SPX500') {
  mountWidget(host, 'stock-heatmap', {
    ...THEME,
    exchanges: [],
    dataSource,
    grouping: 'sector',
    blockSize: 'market_cap_basic',
    blockColor: 'change',
    symbolUrl: '',
    hasTopBar: true,
    isDataSetEnabled: true,
    isZoomEnabled: true,
    hasSymbolTooltip: true,
    isMonoSize: false,
    width: '100%',
    height: '100%',
  });
}

// ── Crypto heatmap ──
export function mountCryptoHeatmap(host) {
  mountWidget(host, 'crypto-coins-heatmap', {
    ...THEME,
    dataSource: 'Crypto',
    blockSize: 'market_cap_calc',
    blockColor: 'change',
    hasTopBar: true,
    isDataSetEnabled: false,
    isZoomEnabled: true,
    hasSymbolTooltip: true,
    width: '100%',
    height: '100%',
  });
}

// ── Economic calendar: real scheduled macro events ──
export function mountEconomicCalendar(host) {
  mountWidget(host, 'events', {
    ...THEME,
    width: '100%',
    height: '100%',
    importanceFilter: '0,1',
    countryFilter: 'us,eu,gb,jp,cn,de,ae,in,kr',
  });
}

// ── Bond desk: government yields across the US and Asia ──
// Asian sovereign yields have no free live quote API we could serve honestly
// from our own endpoints, so this entire view is TradingView's market-quotes
// widget: every yield and daily change streams live inside the iframe from
// their feed, updated continuously — never stored or restated by us.
export function mountBondDesk(host) {
  mountWidget(host, 'market-quotes', {
    ...THEME,
    width: '100%',
    height: '100%',
    showSymbolLogo: true,
    symbolsGroups: [
      {
        name: 'US Treasuries',
        symbols: [
          { name: 'TVC:US02Y', displayName: 'US 2Y' },
          { name: 'TVC:US05Y', displayName: 'US 5Y' },
          { name: 'TVC:US10Y', displayName: 'US 10Y' },
          { name: 'TVC:US30Y', displayName: 'US 30Y' },
        ],
      },
      {
        name: 'Japan',
        symbols: [
          { name: 'TVC:JP02Y', displayName: 'Japan 2Y' },
          { name: 'TVC:JP05Y', displayName: 'Japan 5Y' },
          { name: 'TVC:JP10Y', displayName: 'Japan 10Y' },
          { name: 'TVC:JP30Y', displayName: 'Japan 30Y' },
        ],
      },
      {
        name: 'China',
        symbols: [
          { name: 'TVC:CN02Y', displayName: 'China 2Y' },
          { name: 'TVC:CN05Y', displayName: 'China 5Y' },
          { name: 'TVC:CN10Y', displayName: 'China 10Y' },
          { name: 'TVC:CN30Y', displayName: 'China 30Y' },
        ],
      },
      {
        name: 'Korea & India',
        symbols: [
          { name: 'TVC:KR02Y', displayName: 'Korea 2Y' },
          { name: 'TVC:KR10Y', displayName: 'Korea 10Y' },
          { name: 'TVC:IN02Y', displayName: 'India 2Y' },
          { name: 'TVC:IN10Y', displayName: 'India 10Y' },
        ],
      },
      {
        name: 'Asia-Pacific',
        symbols: [
          { name: 'TVC:SG10Y', displayName: 'Singapore 10Y' },
          { name: 'TVC:ID10Y', displayName: 'Indonesia 10Y' },
          { name: 'TVC:AU10Y', displayName: 'Australia 10Y' },
          { name: 'TVC:HK10Y', displayName: 'Hong Kong 10Y' },
        ],
      },
    ],
  });
}
