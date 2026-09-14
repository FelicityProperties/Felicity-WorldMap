// ═══════════════════════════════════════════════════════════
// DESK VIEW — Active calls, historical playbook, conviction ladder
// ═══════════════════════════════════════════════════════════
//
// The Active Calls are the desk's positioned opinions. An intelligence
// product is allowed a view — but every NUMBER inside a call is pulled
// from the PIX registry files at load time and carries a `reg` marker,
// so a call can never quote a figure the register does not hold. An
// earlier version hard-coded "JVC yield 7.2% vs prime 4.8%" and "DIFC
// rents up 18% YoY"; the register said 6.1% and 3.4%, and holds no DIFC
// rents at all. Numbers in prose drift; numbers from the data file do
// not.
//
// The Historical Playbook is desk memory: how Dubai property behaved
// around past macro shocks. No registry series exists for those periods
// in this product, so the entries carry DIRECTIONS ONLY — no invented
// percentages. If a number cannot be sourced, it is not written.
//
// The old copy of the desk system prompt that lived here was a stale
// duplicate of api/desk/ask.js and has been removed; the server owns it.
// ═══════════════════════════════════════════════════════════

import { pixAreas, pixIndex, PIX_AS_OF, fmtCount, fmtPrice } from './pix-data.js';
import { pixSignals, PIX_SIGNALS_AS_OF } from './pix-signals.js';

const reg = '<span class="metric-src metric-src--reg" title="Registered DLD evidence via PropertyIndex">reg</span>';
const A = name => pixAreas[name] || {};
const sig = (entity, type) => pixSignals.find(s => s.entity === entity && s.type === type);
const pct = v => v != null ? `${v.toFixed(1)}%${reg}` : 'n/a';
const psf = v => v != null ? `${fmtCount(v)} AED/sqft${reg}` : 'n/a';
const price = v => v != null ? `${fmtPrice(v)}${reg}` : 'n/a';
const below = (entity) => {
  const s = sig(entity, 'below_trend');
  return s ? `${entity} ${Math.abs(s.magnitudePct).toFixed(1)}% below its own 12-month average for ${s.streak} consecutive observations${reg}` : null;
};
const join = parts => parts.filter(Boolean).join('; ');

const jvc = A('JVC'), mbr = A('Mohammed Bin Rashid City'), palm = A('Palm Jumeirah'),
      south = A('Dubai South'), hills = A('Dubai Hills Estate'), marina = A('Dubai Marina');
const venice = sig('Azizi Venice 6', 'momentum');
const fields = sig('The Fields', 'discount_trade');

export const DESK_CALLS_NOTE = `Desk view as of ${PIX_SIGNALS_AS_OF}. Figures marked reg are registered DLD medians (${PIX_AS_OF}); everything else is the desk's opinion, not evidence.`;

export const DESK_CALLS = [
  {
    area: 'JVC — off-plan secondary', call: 'AVOID', conviction: 4, horizon: '12 months', segment: 'Mid-market',
    thesis: `The registry median of ${psf(jvc.psf)} at ${pct(jvc.yieldPct)} gross yield looks healthy; the project tape does not. ${
      join([below('Binghatti Royale'), below('Binghatti Onyx')]) || 'The signal feed shows persistent below-trend printing inside the district'
    }. Dispersion that wide inside one district is a shakeout. Completed, cash-flowing stock is a different asset from second-hand off-plan paper here.`,
    risk: 'The below-trend printers stop and the record-PSF printers in the same district set the tone.',
  },
  {
    area: 'MBR City — completed apartments', call: 'ACCUMULATE', conviction: 4, horizon: '18 months', segment: 'Mid-market',
    thesis: `Top of the apartment yield ranking at ${pct(mbr.yieldPct)} on a ${price(mbr.price)} median. The correction has touched it${
      fields ? ` — The Fields registered ${Math.abs(fields.magnitudePct).toFixed(1)}% below cohort trend${reg}` : ''
    } — but as a single trade, not a district-wide pattern. Highest registry yield in the set with the shallowest dislocation is the cleanest entry in a correcting market. Completed stock only.`,
    risk: 'The correction broadens from single trades to persistent below-trend printing, as it has in JVC.',
  },
  {
    area: 'Palm Jumeirah villas', call: 'HOLD', conviction: 3, horizon: '36 months', segment: 'Ultra-luxury',
    thesis: `${psf(palm.villa?.psf)} and a ${price(palm.villa?.price)} median on ${palm.villa?.sales != null ? `${fmtCount(palm.villa.sales)}${reg}` : 'few'} registered villa sales in the window — you own this for scarcity, not carry: ${pct(palm.villa?.yieldPct)} gross. Trophy prints keep landing at the very top of the register, but they are single trades on thin volume, not a re-rating.`,
    risk: `The residential index (${pixIndex.residential.level}${reg}, ${pixIndex.residential.yoyPct.toFixed(1)}% YoY${reg}) keeps falling and thin volume cannot defend the mark.`,
  },
  {
    area: 'Dubai South — off-plan apartments', call: 'AVOID', conviction: 3, horizon: 'Near-term', segment: 'Affordable',
    thesis: `${fmtCount(south.sales)}${reg} registered apartment sales in twelve months — the deepest primary market in the set — at a ${pct(south.yieldPct)} yield. ${
      venice ? `Azizi Venice 6 alone registered ${fmtCount(venice.value)} sales in three months, ${(1 + venice.magnitudePct / 100).toFixed(1)}× the prior quarter${reg}: ` : ''
    }bulk registration compresses the district's realised PSF and sets the forward comp. Let the launches clear first.`,
    risk: 'The Al Maktoum airport build-out pulls end-user demand forward faster than the launch pipeline clears.',
  },
  {
    area: 'Dubai Hills Estate villas', call: 'ACCUMULATE', conviction: 3, horizon: '24 months', segment: 'Premium',
    thesis: `${psf(hills.villa?.psf)}, ${price(hills.villa?.price)} median, ${pct(hills.villa?.yieldPct)} gross. The villa index is holding better than apartments (${pixIndex.villa.yoyPct.toFixed(1)}%${reg} vs ${pixIndex.apartment.yoyPct.toFixed(1)}%${reg} YoY), and no bulk-registration velocity signal appears here — no supply overhang clearing at distressed prices.`,
    risk: 'The villa index turns negative in earnest and the premium villa communities stop decoupling from the apartment correction.',
  },
  {
    area: 'Dubai Marina — completed apartments', call: 'HOLD', conviction: 2, horizon: '12 months', segment: 'Premium',
    thesis: `${fmtCount(marina.rentals)}${reg} registered tenancies in the window on ${psf(marina.psf)} — one of the deepest rental markets in the set, ${pct(marina.yieldPct)} gross. Liquidity is the argument, not upside: it is the community you can exit in a correcting market.`,
    risk: 'Rents soften with the sale index and the yield that justifies holding compresses.',
  },
];

// Directions only. The product holds no registry series for these years,
// so no percentage is attached — a number that cannot be sourced is not
// written.
export const PLAYBOOK_NOTE = 'Desk memory — directions only. No registered price series exists in this product for these periods, so no percentages are attached.';

export const HISTORICAL_ANALOGS = [
  { event: '2008 GFC', impact: 'Prime fell hard; recovery took years', lesson: 'Flight capital dried up and leverage unwound at the same time' },
  { event: '2011 Arab Spring', impact: 'Regional instability, Dubai bid', lesson: 'Regional instability produced a safe-haven bid for Dubai property' },
  { event: '2014 Oil Crash', impact: 'Mid-market hit harder than luxury', lesson: 'Oil sensitivity sits in the mid-market; the top end proved more resilient' },
  { event: '2017 Saudi Corruption Purge', impact: 'Fast Saudi HNW inflow', lesson: 'Saudi capital moved quickly; Palm and Downtown were the first destinations' },
  { event: '2020 COVID', impact: 'Sharp drop, then a strong multi-year recovery', lesson: 'Dubai reopened early and recovered faster than most global property markets' },
  { event: '2022 Russia–Ukraine War', impact: 'Prime re-rated on flight capital', lesson: 'European and Russian HNW inflows transformed the luxury segment' },
  { event: '2023 UK Non-Dom Signalling', impact: 'British relocation demand rose', lesson: 'Tax-policy signals drive relocation decisions well before the law changes' },
  { event: '2024 BRICS Expansion', impact: 'New capital corridors opened', lesson: 'Geopolitical realignment creates new buyer corridors into Dubai' },
];

export function renderConvictionBadge(level) {
  const levels = { 'MAXIMUM': 5, 'VERY HIGH': 4, 'HIGH': 3, 'MODERATE': 2, 'LOW': 1 };
  const n = levels[level?.toUpperCase()] || 0;
  const labels = { 5: 'Bet the book', 4: 'Size up', 3: 'Meaningful position', 2: 'Small allocation', 1: 'Watch, don\'t position' };
  const dots = Array.from({length: 5}, (_, i) =>
    `<span class="conviction-dot ${i < n ? 'conviction-dot--active' : ''}"></span>`
  ).join('');
  return `<div class="conviction-badge"><div class="conviction-dots">${dots}</div><span class="conviction-level">${level || 'N/A'}</span><span class="conviction-desc">${labels[n] || ''}</span></div>`;
}

export function extractConviction(text) {
  const match = text.match(/\b(MAXIMUM|VERY HIGH|HIGH|MODERATE|LOW)\b/i);
  return match ? match[1].toUpperCase() : null;
}
