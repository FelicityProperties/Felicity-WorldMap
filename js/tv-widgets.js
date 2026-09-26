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
// TradingView's heatmap bundle carries TWO dataset menus: the full one used
// on tradingview.com and `_getWidgetDatasetsMenuItems()`, the shorter list
// an embed is allowed to draw. A `dataSource` outside the embed list is
// silently replaced by the S&P 500 — which is why three deploys of guessed
// codes (and real codes like CAC40 and NI225 that only the site menu holds)
// all drew the S&P. The embed entry point additionally rewrites every Korean
// dataset and UK100 to SPX500 and strips the KRX/LSE exchanges.
//
// Everything below was read from bundle 77485.033dcfdce90664483594.js via
// GET /api/invest/tv-datasets on 2026-09-26. Re-run it before changing this.
//
// The complete embed menu (Korea omitted: remapped to SPX500 on load):
export const TV_EMBED_DATASETS = [
  'BCBAIMV', 'AllAR', 'ASX200', 'AllAU', 'IBOV', 'IBXL', 'AllBR', 'AllCA', 'AllCL',
  'BVCICAP', 'AllCO', 'CSECYALTE', 'CSECYMAIN', 'CSECYGEN', 'CSECYHOTEL', 'CSECYFTSE20', 'AllCY',
  'OMXCOPOMXC25', 'AllDK', 'EGXEGX30', 'AllEG', 'OMXTSEOMXTGI', 'AllEE', 'HELSINKI25', 'AllFI',
  'DAX', 'MDAX', 'SDAX', 'TECDAX', 'AllDE', 'ATHEXGD', 'ATHEXFTSEA', 'ATHEXFTSEM', 'ATHEXFTSE', 'AllGRC',
  'HSTECH', 'HSCEI', 'BETBUX', 'AllHU', 'OMXICEOMXI15', 'AllIS', 'SENSEX',
  'IDX30', 'IDXBUMN20', 'SRIKEHATI', 'IDXHIDIV20', 'AllID', 'TA35', 'TA125', 'AllIL', 'FTSEMIB', 'AllIT',
  'KSEBKA', 'KSEBKM50', 'KSEBKM', 'KSEBKP', 'AllKW', 'OMXRSEOMXRGI', 'AllLV', 'OMXVSEOMXVGI', 'AllLT',
  'NSENGNGX30', 'AllNGA', 'F4GBIVA', 'FTBIVA', 'CSEMAMASI', 'AllMA',
  'PSXBKTI', 'PSXJSMFI', 'PSXKMI30', 'PSXKMIALLSHR', 'PSXKSE30', 'PSXKSE100', 'PSXALLSHR', 'PSXMZNPI', 'PSXNBPPGI', 'PSXNITPGI', 'PSXOGTI', 'PSXUPP9', 'AllPK',
  'GPWWIG20', 'AllPO', 'BVBBET', 'AllRO', 'IBEX35', 'BMEIS', 'BMEICC', 'BMEINDGRO15', 'BMEINDGROAS', 'AllES',
  'OMXS30', 'AllSWE', 'SIXSMI', 'AllCHE', 'ADXFADX15',
  'NASDAQ100', 'NASDAQCOMPOSITE', 'DJCA', 'DJDJI', 'DJDJT', 'DJDJU', 'NASDAQBKX', 'TVCRUI', 'TVCRUT', 'TVCRUA', 'SPX500', 'AllUSA',
  'BVCVIBC', 'BVCVIFINANCIE', 'BVCVIINDUSTR', 'AllVE',
];

// Markets that exist in TradingView's site menu but are withheld from
// embeds (a code from this list is drawn as the S&P 500). Shown on the page
// so nobody hunts for a chip that cannot exist.
export const TV_EMBED_WITHHELD = [
  'FTSE 100', 'CAC 40', 'Euro Stoxx 50', 'Stoxx 600', 'AEX', 'BEL 20', 'Nikkei 225', 'Hang Seng (HSI)',
  'Nifty 50', 'KOSPI', 'Straits Times', 'Taiwan 50', 'SET 50', 'BIST 100', 'Tadawul TASI', 'DFM General', 'Shenzhen Component',
];

const EV = 'TradingView embed menu, read from the widget bundle 2026-09-26';
export const HEATMAP_MARKETS = [
  { region: 'Americas', items: [
    { key: 'SPX500',          label: 'S&P 500',              evidence: EV },
    { key: 'NASDAQ100',       label: 'Nasdaq 100',           evidence: EV },
    { key: 'DJDJI',           label: 'Dow Jones',            evidence: EV },
    { key: 'TVCRUT',          label: 'Russell 2000',         evidence: EV },
    { key: 'AllUSA',          label: 'All US stocks',        evidence: EV },
    { key: 'AllCA',           label: 'Canada (all)',         evidence: EV },
    { key: 'IBOV',            label: 'Brazil Bovespa',       evidence: EV },
    { key: 'BCBAIMV',         label: 'Argentina Merval',     evidence: EV },
  ]},
  { region: 'Europe', items: [
    { key: 'DAX',             label: 'DAX',                  evidence: EV },
    { key: 'MDAX',            label: 'MDAX',                 evidence: EV },
    { key: 'TECDAX',          label: 'TecDAX',               evidence: EV },
    { key: 'IBEX35',          label: 'IBEX 35',              evidence: EV },
    { key: 'FTSEMIB',         label: 'FTSE MIB',             evidence: EV },
    { key: 'SIXSMI',          label: 'Swiss SMI',            evidence: EV },
    { key: 'OMXS30',          label: 'OMX Stockholm 30',     evidence: EV },
    { key: 'OMXCOPOMXC25',    label: 'Copenhagen 25',        evidence: EV },
    { key: 'HELSINKI25',      label: 'Helsinki 25',          evidence: EV },
    { key: 'GPWWIG20',        label: 'Warsaw WIG20',         evidence: EV },
    { key: 'ATHEXGD',         label: 'Athens Composite',     evidence: EV },
    { key: 'TA35',            label: 'Tel Aviv 35',          evidence: EV },
  ]},
  { region: 'Asia-Pacific', items: [
    { key: 'ASX200',          label: 'ASX 200',              evidence: EV },
    { key: 'HSTECH',          label: 'Hang Seng Tech',       evidence: EV },
    { key: 'HSCEI',           label: 'HS China Enterprises', evidence: EV },
    { key: 'SENSEX',          label: 'India Sensex',         evidence: EV },
    { key: 'IDX30',           label: 'Indonesia IDX 30',     evidence: EV },
    { key: 'PSXKSE100',       label: 'Pakistan KSE 100',     evidence: EV },
  ]},
  { region: 'Middle East & Africa', items: [
    { key: 'ADXFADX15',       label: 'Abu Dhabi FTSE ADX 15', evidence: EV },
    { key: 'KSEBKP',          label: 'Kuwait Premier',       evidence: EV },
    { key: 'EGXEGX30',        label: 'Egypt EGX 30',         evidence: EV },
    { key: 'CSEMAMASI',       label: 'Morocco MASI',         evidence: EV },
    { key: 'NSENGNGX30',      label: 'Nigeria NGX 30',       evidence: EV },
  ]},
];

export const HEATMAP_KEYS = HEATMAP_MARKETS.flatMap(g => g.items.map(m => m.key));

// The last chip chosen, so a re-mount (fullscreen on/off re-mounts the
// widget at the new size) keeps the market the reader picked.
let lastHeatmapKey = null;

// Chips for every market TradingView serves to embeds, grouped by region,
// and a plain statement of the markets it withholds.
export function mountHeatmapPicker(hostId, initial = lastHeatmapKey || 'SPX500') {
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
        <span class="hm-picker__region">Not served to embeds</span>
        <span class="hm-picker__hint">TradingView withholds ${TV_EMBED_WITHHELD.join(', ')} from embedded heatmaps and draws the S&amp;P 500 in their place, so there is no chip for them. The widget's own menu (top-left header) lists the same ${TV_EMBED_DATASETS.length} datasets as the chips. For a withheld market, <a href="https://www.tradingview.com/heatmap/stock/" target="_blank" rel="noopener">open the heatmap on tradingview.com</a>.</span>
      </div>
    </div>
    <div class="hm-picker__note" id="${hostId}-note"></div>
    <div class="tradingview-widget-container hm-picker__widget" id="${hostId}-widget"><div class="tradingview-widget-container__widget"></div></div>`;

  const note = host.querySelector(`#${hostId}-note`);
  const show = key => {
    lastHeatmapKey = key;
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
