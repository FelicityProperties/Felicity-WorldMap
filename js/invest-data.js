// ═══════════════════════════════════════════════════════════
// INVEST — Multi-asset universe for the Investing Cockpit
// ═══════════════════════════════════════════════════════════
//
// Every instrument declares WHERE its live price comes from, so the
// server can route the quote to the right real API:
//
//   source 'finnhub'   → /quote            (US equities)
//   source 'yahoo'     → /v8/finance/chart (indices, forex, futures)
//   source 'coingecko' → /simple/price     (crypto)
//
// `drivers` is domain knowledge about what fundamentally moves the
// instrument — never a price, forecast, or invented figure.
// ═══════════════════════════════════════════════════════════

import { sp500Companies } from './sp500-data.js';

export const ASSET_CLASSES = {
  all:         { label: 'All',         icon: '◆' },
  stocks:      { label: 'Stocks',      icon: '▤' },
  indices:     { label: 'Indices',     icon: '▦' },
  crypto:      { label: 'Crypto',      icon: '◈' },
  forex:       { label: 'Forex',       icon: '⇄' },
  commodities: { label: 'Commodities', icon: '⛏' },
};

// ── Indices ──
const INDICES = [
  { symbol: 'SPX',    name: 'S&P 500',            yahoo: '^GSPC',    tv: 'SP:SPX',
    drivers: 'US earnings breadth, Fed policy path, real yields, mega-cap concentration.' },
  { symbol: 'NDX',    name: 'Nasdaq 100',         yahoo: '^NDX',     tv: 'NASDAQ:NDX',
    drivers: 'Long-duration tech earnings, AI capex cycle, rate sensitivity — the highest beta to real yields.' },
  { symbol: 'DJI',    name: 'Dow Jones Industrial', yahoo: '^DJI',   tv: 'DJ:DJI',
    drivers: 'Price-weighted, industrial and financial cyclicals; less tech-sensitive than SPX or NDX.' },
  { symbol: 'RUT',    name: 'Russell 2000',       yahoo: '^RUT',     tv: 'TVC:RUT',
    drivers: 'US small caps — domestic demand, credit conditions and refinancing costs hit hardest here.' },
  { symbol: 'VIX',    name: 'CBOE Volatility',    yahoo: '^VIX',     tv: 'TVC:VIX',
    drivers: 'Implied 30-day S&P volatility. Mean-reverting; spikes on liquidity and event shocks.' },
  { symbol: 'FTSE',   name: 'FTSE 100',           yahoo: '^FTSE',    tv: 'TVC:UKX',
    drivers: 'Heavy energy, mining and banks; earns largely in USD so weak sterling flatters it.' },
  { symbol: 'DAX',    name: 'DAX 40',             yahoo: '^GDAXI',   tv: 'XETR:DAX',
    drivers: 'German industrial and export cycle, energy input costs, China demand.' },
  { symbol: 'N225',   name: 'Nikkei 225',         yahoo: '^N225',    tv: 'TVC:NI225',
    drivers: 'Yen direction, BoJ policy normalisation, corporate governance reform flows.' },
  { symbol: 'HSI',    name: 'Hang Seng',          yahoo: '^HSI',     tv: 'TVC:HSI',
    drivers: 'China policy stimulus, property sector credit, regulatory posture toward tech.' },
  { symbol: 'SX5E',   name: 'Euro Stoxx 50',      yahoo: '^STOXX50E', tv: 'TVC:SX5E',
    drivers: 'Eurozone growth, ECB path, energy costs, luxury and industrial exposure to China.' },
].map(a => ({ ...a, class: 'indices', source: 'yahoo' }));

// ── Crypto ──
const CRYPTO = [
  { symbol: 'BTC',  name: 'Bitcoin',   cg: 'bitcoin',       tv: 'COINBASE:BTCUSD',
    drivers: 'Global liquidity, ETF flows, halving supply schedule, real yields as opportunity cost.' },
  { symbol: 'ETH',  name: 'Ethereum',  cg: 'ethereum',      tv: 'COINBASE:ETHUSD',
    drivers: 'Staking yield, L2 activity and fee burn, ETF flows, developer share vs rival L1s.' },
  { symbol: 'SOL',  name: 'Solana',    cg: 'solana',        tv: 'COINBASE:SOLUSD',
    drivers: 'Network throughput and uptime record, DeFi/memecoin activity, validator economics.' },
  { symbol: 'XRP',  name: 'XRP',       cg: 'ripple',        tv: 'COINBASE:XRPUSD',
    drivers: 'Regulatory rulings, cross-border settlement adoption, escrow release schedule.' },
  { symbol: 'BNB',  name: 'BNB',       cg: 'binancecoin',   tv: 'BINANCE:BNBUSDT',
    drivers: 'Binance exchange volumes, BNB Chain activity, token burn schedule, regulatory overhang.' },
  { symbol: 'DOGE', name: 'Dogecoin',  cg: 'dogecoin',      tv: 'COINBASE:DOGEUSD',
    drivers: 'Retail risk appetite and social momentum. Inflationary supply, no fee burn.' },
  { symbol: 'ADA',  name: 'Cardano',   cg: 'cardano',       tv: 'COINBASE:ADAUSD',
    drivers: 'Protocol upgrade delivery, staking participation, ecosystem TVL relative to rivals.' },
  { symbol: 'AVAX', name: 'Avalanche', cg: 'avalanche-2',   tv: 'COINBASE:AVAXUSD',
    drivers: 'Subnet adoption by institutions, gaming and RWA deployments, validator staking.' },
  { symbol: 'LINK', name: 'Chainlink', cg: 'chainlink',     tv: 'COINBASE:LINKUSD',
    drivers: 'Oracle demand from DeFi and tokenised real-world assets, CCIP integration wins.' },
  { symbol: 'DOT',  name: 'Polkadot',  cg: 'polkadot',      tv: 'COINBASE:DOTUSD',
    drivers: 'Parachain auction demand, cross-chain messaging adoption, inflation vs staking rate.' },
].map(a => ({ ...a, class: 'crypto', source: 'coingecko' }));

// ── Forex ──
const FOREX = [
  { symbol: 'EURUSD', name: 'Euro / US Dollar',      yahoo: 'EURUSD=X', tv: 'FX:EURUSD',
    drivers: 'ECB vs Fed rate differential, eurozone growth gap, energy terms of trade.' },
  { symbol: 'GBPUSD', name: 'Sterling / US Dollar',  yahoo: 'GBPUSD=X', tv: 'FX:GBPUSD',
    drivers: 'BoE path against sticky UK services inflation, gilt risk premium, current account deficit.' },
  { symbol: 'USDJPY', name: 'US Dollar / Yen',       yahoo: 'USDJPY=X', tv: 'FX:USDJPY',
    drivers: 'US-Japan rate differential is the dominant driver; MoF intervention risk at extremes.' },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', yahoo: 'USDCHF=X', tv: 'FX:USDCHF',
    drivers: 'Franc is a haven — falls on risk-off. SNB tolerance for strength matters.' },
  { symbol: 'AUDUSD', name: 'Aussie / US Dollar',    yahoo: 'AUDUSD=X', tv: 'FX:AUDUSD',
    drivers: 'China growth and iron ore prices; the cleanest liquid proxy for China demand.' },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', yahoo: 'USDCAD=X', tv: 'FX:USDCAD',
    drivers: 'Crude oil (inverse), BoC vs Fed differential, US demand for Canadian exports.' },
  { symbol: 'NZDUSD', name: 'Kiwi / US Dollar',      yahoo: 'NZDUSD=X', tv: 'FX:NZDUSD',
    drivers: 'Dairy prices, RBNZ path, China demand. High beta to global risk appetite.' },
  { symbol: 'EURGBP', name: 'Euro / Sterling',       yahoo: 'EURGBP=X', tv: 'FX:EURGBP',
    drivers: 'Relative ECB/BoE policy and the UK vs eurozone growth and inflation gap.' },
  { symbol: 'USDCNY', name: 'US Dollar / Chinese Yuan', yahoo: 'USDCNY=X', tv: 'FX:USDCNY',
    drivers: 'PBoC daily fix management, capital flow controls, export competitiveness policy.' },
  { symbol: 'USDINR', name: 'US Dollar / Indian Rupee', yahoo: 'USDINR=X', tv: 'FX:USDINR',
    drivers: 'RBI reserve management, oil import bill, portfolio inflows into Indian equities and bonds.' },
].map(a => ({ ...a, class: 'forex', source: 'yahoo' }));

// ── Commodities ──
const COMMODITIES = [
  { symbol: 'WTI',   name: 'WTI Crude Oil',   yahoo: 'CL=F', tv: 'TVC:USOIL',
    drivers: 'OPEC+ quota policy, US shale supply response, global demand, inventory draws.' },
  { symbol: 'BRENT', name: 'Brent Crude Oil', yahoo: 'BZ=F', tv: 'TVC:UKOIL',
    drivers: 'The seaborne global benchmark — more exposed to Middle East supply risk than WTI.' },
  { symbol: 'NG',    name: 'Natural Gas',     yahoo: 'NG=F', tv: 'NYMEX:NG1!',
    drivers: 'Weather-driven demand, LNG export capacity, storage levels. Structurally volatile.' },
  { symbol: 'XAU',   name: 'Gold',            yahoo: 'GC=F', tv: 'TVC:GOLD',
    drivers: 'Real yields (inverse), dollar strength, central bank buying, geopolitical hedging demand.' },
  { symbol: 'XAG',   name: 'Silver',          yahoo: 'SI=F', tv: 'TVC:SILVER',
    drivers: 'Dual monetary and industrial demand — solar and electronics. Higher beta than gold.' },
  { symbol: 'HG',    name: 'Copper',          yahoo: 'HG=F', tv: 'COMEX:HG1!',
    drivers: 'The global growth bellwether: China construction, grid buildout, EV and mine supply.' },
  { symbol: 'XPT',   name: 'Platinum',        yahoo: 'PL=F', tv: 'TVC:PLATINUM',
    drivers: 'Autocatalyst demand, South African supply and power disruption, substitution vs palladium.' },
  { symbol: 'XPD',   name: 'Palladium',       yahoo: 'PA=F', tv: 'TVC:PALLADIUM',
    drivers: 'Gasoline autocatalyst demand facing structural EV displacement; Russian supply concentration.' },
  { symbol: 'ZW',    name: 'Wheat',           yahoo: 'ZW=F', tv: 'CBOT:ZW1!',
    drivers: 'Black Sea export flows, weather in key growing belts, export restrictions.' },
  { symbol: 'ZC',    name: 'Corn',            yahoo: 'ZC=F', tv: 'CBOT:ZC1!',
    drivers: 'US growing conditions, ethanol mandate demand, feed demand, substitution with wheat.' },
].map(a => ({ ...a, class: 'commodities', source: 'yahoo' }));

// ── Stocks (from the existing S&P 500 dataset) ──
const STOCKS = sp500Companies.map(c => ({
  symbol: c.ticker,
  name: c.name,
  class: 'stocks',
  source: 'finnhub',
  tv: c.ticker,
  sector: c.sector,
  hq: c.hq,
  drivers: `${c.sector} sector fundamentals, earnings delivery versus consensus, and sector-relative multiple.`,
}));

export const investUniverse = [...INDICES, ...CRYPTO, ...FOREX, ...COMMODITIES, ...STOCKS];

export function findAsset(symbol) {
  if (!symbol) return null;
  const s = String(symbol).toUpperCase();
  return investUniverse.find(a => a.symbol.toUpperCase() === s) || null;
}

export function assetsByClass(cls) {
  return cls === 'all' ? investUniverse : investUniverse.filter(a => a.class === cls);
}

export function classCount(cls) {
  return assetsByClass(cls).length;
}
