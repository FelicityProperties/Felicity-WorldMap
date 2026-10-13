// ═══════════════════════════════════════════════════════════
// DESK VIEW — Active calls, historical playbook, conviction ladder
// ═══════════════════════════════════════════════════════════
//
// The Active Calls are the desk's positioned opinions. An intelligence
// product is allowed a view — but every NUMBER inside a call is pulled
// from the Felicity Price Index registry files at load time and carries a `reg` marker,
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

const reg = '<span class="metric-src metric-src--reg" title="Registered Dubai Land Department evidence · Felicity Price Index">reg</span>';
const A = name => pixAreas[name] || {};
const sig = (entity, type) => pixSignals.find(s => s.entity === entity && s.type === type);
const pct = v => v != null ? `${v.toFixed(1)}%${reg}` : 'n/a';
const psf = v => v != null ? `${fmtCount(v)} AED/sqft${reg}` : 'n/a';
const price = v => v != null ? `${fmtPrice(v)}${reg}` : 'n/a';
const below = (entity) => {
  const s = sig(entity, 'below_trend');
  return s ? `${entity} ${Math.abs(s.magnitudePct).toFixed(1)}% below its own 12-month average for ${s.streak} consecutive observations, on ${fmtCount(s.salesL12m)} sales in twelve months, ${s.offplanPct}% of them off-plan${reg}` : null;
};
const join = parts => parts.filter(Boolean).join('; ');

const jvc = A('JVC'), mbr = A('Mohammed Bin Rashid City'), palm = A('Palm Jumeirah'),
      south = A('Dubai South'), hills = A('Dubai Hills Estate'), marina = A('Dubai Marina');

// What the signal feed currently holds for a district. Calls that lean on
// signals read them here, so a refresh that drops a signal changes the
// sentence instead of leaving it asserting evidence that is gone.
const inArea = (area, ...types) => pixSignals.filter(s => s.area === area && types.includes(s.type));
const jvcBelow = inArea('JVC', 'below_trend');
const jvcRecord = inArea('JVC', 'record_psf');
const mbrDislocation = inArea('MBR City', 'below_trend', 'discount_trade');
const aptYieldRank = name => {
  const ranked = Object.entries(pixAreas).filter(([, p]) => p.cohort === 'Apartment' && p.yieldPct != null).sort((a, b) => b[1].yieldPct - a[1].yieldPct);
  return ranked.findIndex(([n]) => n === name) + 1;
};
const mbrRank = aptYieldRank('Mohammed Bin Rashid City');
const southDeepest = Object.values(pixAreas).every(p => p.cohort !== 'Apartment' || p.sales <= south.sales);
// "On our list": the signal file holds the top of each type, not the whole
// feed. The 13 Oct audit found "the feed holds no discount trade in MBR"
// true of the list and false of the feed (MAG Eye sat just below the cut),
// so these sentences name what they can see.
const hillsVelocity = pixSignals.filter(s => s.community === 'dubai-hills-estate' && s.type === 'momentum');
const southVelocity = pixSignals.filter(s => s.community === 'dubai-south-dubai-world-central' && s.type === 'momentum');
const ordinal = n => n === 1 ? 'Top of' : n === 2 ? 'Second in' : n === 3 ? 'Third in' : `Number ${n} in`;
const rankWord = n => ['', 'deepest', 'second-deepest', 'third-deepest', 'fourth-deepest', 'fifth-deepest'][n] || null;
const rentalRank = name => Object.entries(pixAreas).sort((a, b) => b[1].rentals - a[1].rentals).findIndex(([n]) => n === name) + 1;
const marinaRentalWord = rankWord(rentalRank('Dubai Marina'));
// Of the below-trend projects cited for JVC, how many sales were off-plan
const jvcBelowSales = jvcBelow.reduce((n, s) => n + (s.salesL12m || 0), 0);
const jvcBelowOffplan = jvcBelow.reduce((n, s) => n + (s.salesL12m || 0) * (s.offplanPct || 0) / 100, 0);
const jvcMostlyCompleted = jvcBelowSales > 0 && jvcBelowOffplan / jvcBelowSales < 0.5;
// The largest registered sale on the list, and whether it is on the Palm
const topSale = pixSignals.filter(s => s.type === 'top_sale').sort((a, b) => b.value - a.value)[0];

export const DESK_CALLS_NOTE = `Desk view as of ${PIX_SIGNALS_AS_OF}. Figures marked reg are registered DLD medians (${PIX_AS_OF}) for the community's whole apartment or villa cohort, ready and off-plan together; everything else is the desk's opinion, not evidence.`;

export const DESK_CALLS = [
  {
    area: 'JVC — secondary apartments', call: 'AVOID', conviction: 4, horizon: '12 months', segment: 'Mid-market',
    thesis: `The registry median of ${psf(jvc.psf)} at ${pct(jvc.yieldPct)} gross yield looks healthy; the project tape does not. ${
      join(jvcBelow.map(s => below(s.entity))) || 'None of the below-trend signals on our list is inside the district, so this is the desk\'s structural view rather than a live signal'
    }. ${jvcMostlyCompleted
      ? 'Most of those sales were completed units, so the weakness is in resale stock, not only off-plan paper: pick the building, not the postcode.'
      : 'Completed, cash-flowing stock is a different asset from second-hand off-plan paper here.'}`,
    risk: jvcRecord.length
      ? 'The below-trend printers stop and the record-PSF printers in the same district set the tone.'
      : 'The below-trend printing stops and the district median holds its level through the correction.',
  },
  {
    area: 'MBR City — apartments', call: 'ACCUMULATE', conviction: 4, horizon: '18 months', segment: 'Mid-market',
    thesis: `${ordinal(mbrRank)} the apartment yield ranking at ${pct(mbr.yieldPct)} on a ${price(mbr.price)} median. ${
      mbrDislocation.length
        ? `The correction has touched it — ${mbrDislocation.map(s => `${s.entity} registered ${Math.abs(s.magnitudePct).toFixed(1)}% below ${s.type === 'below_trend' ? 'its own 12-month average' : 'its project median'}${reg}`).join('; ')} — but not as a district-wide pattern.`
        : 'None of the below-trend or discount signals on our list is in the district.'
    } A high registry yield without persistent below-trend printing is the cleanest entry in a correcting market. Completed stock only.`,
    risk: `The correction broadens into persistent below-trend printing${jvcBelow.length ? ', as it has in JVC' : ''}.`,
  },
  {
    area: 'Palm Jumeirah villas', call: 'HOLD', conviction: 3, horizon: '36 months', segment: 'Ultra-luxury',
    thesis: `${psf(palm.villa?.psf)} and a ${price(palm.villa?.price)} median on ${palm.villa?.sales != null ? `${fmtCount(palm.villa.sales)}${reg}` : 'few'} registered villa sales in the window — you own this for scarcity, not carry: ${pct(palm.villa?.yieldPct)} gross. ${topSale && topSale.community === 'palm-jumeirah'
      ? `The largest registered sale on our list is on the Palm (${topSale.entity}, ${fmtPrice(topSale.value)}${reg}), but trophy prints are single trades on thin volume, not a re-rating.`
      : 'Trophy prints are single trades on thin volume, not a re-rating.'}`,
    risk: `The residential index (${pixIndex.residential.level}${reg}, ${pixIndex.residential.yoyPct.toFixed(1)}% YoY${reg}) keeps falling and thin volume cannot defend the mark.`,
  },
  {
    area: 'Dubai South — off-plan apartments', call: 'AVOID', conviction: 3, horizon: 'Near-term', segment: 'Affordable',
    thesis: `${fmtCount(south.sales)}${reg} registered apartment sales in twelve months${southDeepest ? ' — the most of any community in the set —' : ''} at a ${pct(south.yieldPct)} yield. ${
      southVelocity.length
        ? `${southVelocity[0].entity} alone registered ${fmtCount(southVelocity[0].value)} sales in three months, ${(1 + southVelocity[0].magnitudePct / 100).toFixed(1)}× the prior quarter, at ${psf(southVelocity[0].psf)} against a district median of ${psf(south.psf)}: launch volume on that scale is the supply a resale buyer will compete with.`
        : 'Volume on that scale is the supply a resale buyer will compete with.'
    } Let the launches clear first.`,
    risk: 'The Al Maktoum airport build-out pulls end-user demand forward faster than the launch pipeline clears.',
  },
  {
    area: 'Dubai Hills Estate villas', call: 'ACCUMULATE', conviction: 3, horizon: '24 months', segment: 'Premium',
    thesis: `${psf(hills.villa?.psf)}, ${price(hills.villa?.price)} median, ${pct(hills.villa?.yieldPct)} gross. The villa index is holding better than apartments (${pixIndex.villa.yoyPct.toFixed(1)}%${reg} vs ${pixIndex.apartment.yoyPct.toFixed(1)}%${reg} YoY)${hillsVelocity.length
      ? `, though our list flags sales velocity at ${hillsVelocity.map(s => s.entity).join(' and ')}${reg} — watch whether that is supply clearing.`
      : ', and none of the sales-velocity signals on our list is here.'}`,
    risk: 'The villa index turns negative in earnest and the premium villa communities stop decoupling from the apartment correction.',
  },
  {
    area: 'Dubai Marina — apartments', call: 'HOLD', conviction: 2, horizon: '12 months', segment: 'Premium',
    thesis: `${fmtCount(marina.rentals)}${reg} registered tenancies in the window on ${psf(marina.psf)} — ${marinaRentalWord ? `the ${marinaRentalWord} rental market in the set` : 'a deep rental market'}, ${pct(marina.yieldPct)} gross. Liquidity is the argument, not upside: it is the community you can exit in a correcting market.`,
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
