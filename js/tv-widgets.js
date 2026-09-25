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
  // Different TradingView embeds read different keys: the advanced chart
  // wants `theme`, everything mounted here (tape, heatmaps, calendar, bond
  // desk) wants `colorTheme`. Only `theme` was being sent, so every one of
  // these widgets silently fell back to LIGHT mode on a dark site.
  theme: 'dark',
  colorTheme: 'dark',
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
    // A red "!" beside a symbol means TradingView is not serving that feed to
    // embeds — every US index/yield/vol feed under TVC:/NASDAQ:/CBOE: did it
    // (DXY, NDX, US10Y, VIX). The CFD mirrors from Forex.com and Capital.com
    // are the symbols TradingView's own tape demo uses, and they render.
    symbols: [
      { proName: 'FOREXCOM:SPXUSD',   title: 'S&P 500' },
      { proName: 'FOREXCOM:NSXUSD',   title: 'Nasdaq 100' },
      { proName: 'CAPITALCOM:DXY',    title: 'Dollar Index' },
      { proName: 'TVC:GOLD',          title: 'Gold' },
      { proName: 'TVC:USOIL',         title: 'WTI Crude' },
      { proName: 'TVC:UKOIL',         title: 'Brent Crude' },
      { proName: 'COINBASE:BTCUSD',   title: 'Bitcoin' },
      { proName: 'COINBASE:ETHUSD',   title: 'Ethereum' },
      { proName: 'FX:EURUSD',         title: 'EUR/USD' },
      { proName: 'FX:USDJPY',         title: 'USD/JPY' },
      { proName: 'CBOT:ZN1!',         title: 'US 10Y T-Note fut.' },
      { proName: 'CAPITALCOM:VIX',    title: 'VIX' },
      { proName: 'CAPITALCOM:UK100',  title: 'FTSE 100' },
      { proName: 'CAPITALCOM:J225',   title: 'Nikkei 225' },
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
    // The widget's own dataset menu is the ONE control that reliably reaches
    // every market: TradingView documents only two dataSource codes (SPX500,
    // ASX200) and silently draws the S&P 500 for any code it does not know,
    // which is what every guessed code did. Keep the menu on.
    isDataSetEnabled: true,
    isZoomEnabled: true,
    hasSymbolTooltip: true,
    isMonoSize: false,
    width: '100%',
    height: '100%',
  });
}

// ── Heatmap markets ──
// TradingView documents exactly two `dataSource` codes for the stock
// heatmap (SPX500, ASX200) and silently draws the S&P 500 for any code it
// does not recognise — which is what every guessed European, Asian and Gulf
// code did, three deploys in a row. So the chips below carry only codes
// with evidence, and the widget's own market menu (top-left header, "S&P
// 500 Index ▾") is the primary control: it lists DAX, Nikkei, FTSE, Hang
// Seng, Nifty, Tadawul and the rest, and it works today.
//
// GET /api/invest/tv-datasets reads the real code table out of
// TradingView's bundle from the deployed function; when it has been read,
// add the codes here with their evidence.
export const HEATMAP_MARKETS = [
  { region: 'Verified', items: [
    { key: 'SPX500', label: 'S&P 500',         evidence: 'TradingView widget docs' },
    { key: 'ASX200', label: 'Australia ASX 200', evidence: 'TradingView widget demo' },
  ]},
];

export const HEATMAP_KEYS = HEATMAP_MARKETS.flatMap(g => g.items.map(m => m.key));

// Verified chips plus a clear pointer to the widget's own market menu.
export function mountHeatmapPicker(hostId, initial = 'SPX500') {
  const host = document.getElementById(hostId);
  if (!host) return;
  host.innerHTML = `
    <div class="hm-picker" id="${hostId}-picker">
      ${HEATMAP_MARKETS.map(g => `
        <div class="hm-picker__group">
          <span class="hm-picker__region">${g.region}</span>
          ${g.items.map(m => `<button class="hm-picker__chip${m.key === initial ? ' is-on' : ''}" data-ds="${m.key}" title="${m.evidence}">${m.label}</button>`).join('')}
        </div>`).join('')}
      <div class="hm-picker__group hm-picker__group--menu">
        <span class="hm-picker__region">Every other market</span>
        <span class="hm-picker__hint">DAX, CAC 40, FTSE 100, Nikkei 225, Hang Seng, KOSPI, Nifty 50, Tadawul, DFM/ADX and 60+ more: open the <strong>market menu in the widget's top-left header</strong> (it reads "S&P 500 Index ▾") and pick from TradingView's own list.</span>
      </div>
    </div>
    <div class="hm-picker__note" id="${hostId}-note"></div>
    <div class="tradingview-widget-container hm-picker__widget" id="${hostId}-widget"><div class="tradingview-widget-container__widget"></div></div>`;

  const note = host.querySelector(`#${hostId}-note`);
  const show = key => {
    const m = HEATMAP_MARKETS.flatMap(g => g.items).find(x => x.key === key);
    note.textContent = `Showing ${m ? m.label : key} (TradingView dataset ${key}). The widget's header names the market it is drawing.`;
    const w = host.querySelector(`#${hostId}-widget`);
    if (w) w.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
    mountHeatmap(`${hostId}-widget`, key);
  };
  show(initial);

  host.querySelector(`#${hostId}-picker`).addEventListener('click', e => {
    const b = e.target.closest('[data-ds]');
    if (!b) return;
    host.querySelectorAll('.hm-picker__chip').forEach(x => x.classList.remove('is-on'));
    b.classList.add('is-on');
    show(b.dataset.ds);
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
//
// Two feeds, each doing what it demonstrably can:
//
//   US curve — TradingView does NOT license its US yield symbols (US02Y,
//   US10Y…) for embedding, so that group rendered as an empty header. The
//   US tenors are therefore priced by OUR OWN live feed — the same Yahoo
//   yield indices (^IRX/^FVX/^TNX/^TYX) the bonds list already quotes —
//   and rendered as cards with the day's move in basis points.
//
//   Japan + Asia-Pacific — no free quote API covers JGBs/CGBs/KTBs, and
//   TradingView's JP/CN/KR/IN/SG/ID/AU symbols DO embed (Japan rendered
//   fine while US sat empty). Those stay in the market-quotes widget,
//   streamed live inside the iframe.
const US_CURVE = [
  { symbol: 'US3M',  label: '3M'  },
  { symbol: 'US5Y',  label: '5Y'  },
  { symbol: 'US10Y', label: '10Y' },
  { symbol: 'US30Y', label: '30Y' },
];

export function mountBondDesk(host) {
  const el = typeof host === 'string' ? document.getElementById(host) : host;
  if (!el) return;

  el.innerHTML = `
    <div class="bonddesk">
      <div class="bonddesk__us">
        <div class="bonddesk__head">
          <span class="bonddesk__title">US Treasury curve</span>
          <span class="bonddesk__src">live · our feed (Yahoo yield indices)</span>
        </div>
        <div class="bonddesk__cards">
          ${US_CURVE.map(c => `
            <div class="bonddesk__card" data-us="${c.symbol}">
              <span class="bonddesk__tenor">${c.label}</span>
              <span class="bonddesk__val">…</span>
              <span class="bonddesk__chg"></span>
            </div>`).join('')}
        </div>
      </div>
      <div class="bonddesk__head">
        <span class="bonddesk__title">Japan &amp; Asia-Pacific</span>
        <span class="bonddesk__src">streamed live by TradingView</span>
      </div>
      <div class="bonddesk__tv tradingview-widget-container" id="bonddesk-tv">
        <div class="tradingview-widget-container__widget"></div>
      </div>
    </div>`;

  // US cards from our own quote endpoint — real numbers or a plain failure
  US_CURVE.forEach(async ({ symbol }) => {
    const card = el.querySelector(`[data-us="${symbol}"]`);
    try {
      const r = await fetch(`/api/invest/quote?symbol=${symbol}`);
      const d = await r.json();
      if (!d.ok || !d.quote || d.quote.price == null) throw new Error(d.error || 'unavailable');
      if (!card.isConnected) return;
      const bp = (d.quote.change ?? 0) * 100;
      card.querySelector('.bonddesk__val').textContent = `${Number(d.quote.price).toFixed(2)}%`;
      const chg = card.querySelector('.bonddesk__chg');
      chg.textContent = `${bp >= 0 ? '+' : ''}${bp.toFixed(1)} bp`;
      chg.classList.add(bp >= 0 ? 'up' : 'dn');
    } catch {
      if (!card.isConnected) return;
      card.querySelector('.bonddesk__val').textContent = '—';
      card.querySelector('.bonddesk__chg').textContent = 'unavailable';
    }
  });

  mountWidget('bonddesk-tv', 'market-quotes', {
    ...THEME,
    width: '100%',
    height: '100%',
    showSymbolLogo: true,
    symbolsGroups: [
      {
        name: 'Japan curve',
        symbols: [
          { name: 'TVC:JP02Y', displayName: 'Japan 2Y' },
          { name: 'TVC:JP10Y', displayName: 'Japan 10Y' },
          { name: 'TVC:JP30Y', displayName: 'Japan 30Y' },
        ],
      },
      {
        name: 'Asia 10-year benchmarks',
        symbols: [
          { name: 'TVC:CN10Y', displayName: 'China 10Y' },
          { name: 'TVC:KR10Y', displayName: 'Korea 10Y' },
          { name: 'TVC:IN10Y', displayName: 'India 10Y' },
          { name: 'TVC:SG10Y', displayName: 'Singapore 10Y' },
          { name: 'TVC:ID10Y', displayName: 'Indonesia 10Y' },
          { name: 'TVC:AU10Y', displayName: 'Australia 10Y' },
        ],
      },
    ],
  });
}
