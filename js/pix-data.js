// ═══════════════════════════════════════════════════════════
// PIX DATA — Official Dubai market evidence (PIX© Pro)
// ═══════════════════════════════════════════════════════════
//
// Source: Dubai Land Department data modelled by PropertyIndex
// (propertyindex.ae). Snapshot 2026-08-24; last complete calendar
// month 2026-07. Every figure below is registered-transaction
// evidence — median registered sale PSF, median registered price,
// median registered annual rent — not an estimate or a listing.
//
// Yield = median registered annual rent PSF ÷ median registered sale
// PSF for the SAME property-type cohort in the SAME community, over
// the last 12 complete months. It is a gross, cohort-level registry
// yield: no service charges, voids, or fees are deducted, and it is
// not a projection for any individual unit.
// ═══════════════════════════════════════════════════════════

export const PIX_AS_OF = 'Jul 2026';
export const PIX_SOURCE = 'DLD data modelled by PropertyIndex';
export const PIX_WINDOW = 'Aug 2025 – Jul 2026';

// ── PIX Market Index (base Jan 2012 = 100) ──
export const pixIndex = {
  residential: { level: 205.98, momPct: -2.08, yoyPct: -2.62, medianPsf: 1672, txCount: 9582 },
  apartment:   { level: 200.58, momPct: -2.00, yoyPct: -3.26, medianPsf: 1688, txCount: 8746 },
  villa:       { level: 263.68, momPct: -2.63, yoyPct: 1.61,  medianPsf: 1510, txCount: 836 },
};

// Trailing 13 months, residential segment (index level)
export const pixSeries = [
  { month: 'Jul 25', level: 211.52 },
  { month: 'Aug 25', level: 213.34 },
  { month: 'Sep 25', level: 214.65 },
  { month: 'Oct 25', level: 216.98 },
  { month: 'Nov 25', level: 218.95 },
  { month: 'Dec 25', level: 223.16 },
  { month: 'Jan 26', level: 221.57 },
  { month: 'Feb 26', level: 220.21 },
  { month: 'Mar 26', level: 218.79 },
  { month: 'Apr 26', level: 217.62 },
  { month: 'May 26', level: 215.82 },
  { month: 'Jun 26', level: 210.37 },
  { month: 'Jul 26', level: 205.98 },
];

// ── Per-area registry evidence (L12M through Jul 2026) ──
//   sales/valueAed/rentals/projects — registered activity totals
//   psf/price/rent/yieldPct         — medians for the primary cohort
//   villa{}                         — separate villa cohort where the
//                                     community has meaningful volume
//   scope                           — set when the DLD master community
//                                     differs from the marketing name
export const pixAreas = {
  'Downtown Dubai': {
    sales: 3492, valueAed: 15639383166, rentals: 6353, projects: 133,
    cohort: 'Apartment', psf: 2894, price: 2900000, rent: 150000, yieldPct: 4.8,
    url: 'https://www.propertyindex.ae/communities/downtown-dubai',
  },
  'Dubai Marina': {
    sales: 2501, valueAed: 6997571130, rentals: 7257, projects: 121,
    cohort: 'Apartment', psf: 1998, price: 2150000, rent: 115000, yieldPct: 5.5,
    url: 'https://www.propertyindex.ae/communities/dubai-marina',
  },
  'Dubai Creek Harbour': {
    sales: 3029, valueAed: 8600775568, rentals: 3784, projects: 45,
    cohort: 'Apartment', psf: 2457, price: 2611888, rent: 133537, yieldPct: 5.3,
    url: 'https://www.propertyindex.ae/communities/dubai-creek-harbour',
  },
  'Dubai Hills Estate': {
    sales: 2986, valueAed: 11289329034, rentals: 3806, projects: 68,
    cohort: 'Apartment', psf: 2410, price: 2150000, rent: 115000, yieldPct: 6.0,
    villa: { psf: 2266, price: 9550000, rent: 305000, yieldPct: 4.5 },
    url: 'https://www.propertyindex.ae/communities/dubai-hills-estate',
  },
  'Business Bay': {
    sales: 9532, valueAed: 31113943119, rentals: 27000, projects: 164,
    cohort: 'Apartment', psf: 2534, price: 1719094, rent: 95000, yieldPct: 4.8,
    url: 'https://www.propertyindex.ae/communities/business-bay',
  },
  'Palm Jumeirah': {
    sales: 1257, valueAed: 12479156249, rentals: 2102, projects: 81,
    cohort: 'Apartment', psf: 3586, price: 5860590, rent: 198450, yieldPct: 3.4,
    villa: { psf: 5163, price: 26000000, rent: 675000, yieldPct: 3.3 },
    url: 'https://www.propertyindex.ae/communities/palm-jumeirah',
  },
  'JVC': {
    sales: 13672, valueAed: 16277420451, rentals: 15139, projects: 405,
    cohort: 'Apartment', psf: 1495, price: 1020000, rent: 69095, yieldPct: 6.5,
    villa: { psf: 1708, price: 3040000, rent: 184500, yieldPct: 6.1 },
    url: 'https://www.propertyindex.ae/communities/jumeirah-village-circle',
  },
  'Dubai South': {
    sales: 13061, valueAed: 18295885591, rentals: 3833, projects: 159,
    cohort: 'Apartment', psf: 1624, price: 766176, rent: 55000, yieldPct: 4.7,
    villa: { psf: 1296, price: 4151565, rent: 125000, yieldPct: 4.9 },
    url: 'https://www.propertyindex.ae/communities/dubai-south',
  },
  // Expo City projects register under the Dubai South master community
  'Expo City': {
    sales: 13061, valueAed: 18295885591, rentals: 3833, projects: 159,
    cohort: 'Apartment', psf: 1624, price: 766176, rent: 55000, yieldPct: 4.7,
    scope: 'Dubai South incl. Expo City',
    url: 'https://www.propertyindex.ae/communities/dubai-south',
  },
  'Mohammed Bin Rashid City': {
    sales: 325, valueAed: 3802795459, rentals: 772, projects: 39,
    cohort: 'Apartment', psf: 2078, price: 1827500, rent: 110000, yieldPct: 6.3,
    villa: { psf: 2248, price: 17250000, rent: 1000000, yieldPct: 5.9 },
    scope: 'MBR City District One',
    url: 'https://www.propertyindex.ae/communities/mohammed-bin-rashid-al-maktoum-city-district-one',
  },
  'DAMAC Hills': {
    sales: 1890, valueAed: 4833067950, rentals: 2596, projects: 52,
    cohort: 'Apartment', psf: 1631, price: 1245580, rent: 57000, yieldPct: 6.1,
    villa: { psf: 1703, price: 3950000, rent: 210000, yieldPct: 4.4 },
    url: 'https://www.propertyindex.ae/communities/damac-hills',
  },
  'JLT': {
    sales: 2117, valueAed: 4490557441, rentals: 5699, projects: 78,
    cohort: 'Apartment', psf: 1665, price: 1656579, rent: 85000, yieldPct: 6.1,
    url: 'https://www.propertyindex.ae/communities/jumeirah-lakes-towers',
  },
  'Meydan': {
    sales: 1424, valueAed: 2152771373, rentals: 4861, projects: 69,
    cohort: 'Apartment', psf: 2071, price: 923065, rent: 56000, yieldPct: 6.7,
    scope: 'Meydan One',
    url: 'https://www.propertyindex.ae/communities/meydan-one',
  },
  'Arjan': {
    sales: 3861, valueAed: 4321811385, rentals: 4972, projects: 85,
    cohort: 'Apartment', psf: 1543, price: 900000, rent: 58000, yieldPct: 6.6,
    url: 'https://www.propertyindex.ae/communities/arjan',
  },
  'Town Square': {
    sales: 2045, valueAed: 3233653242, rentals: 3178, projects: 41,
    cohort: 'Apartment', psf: 1474, price: 1264500, rent: 70000, yieldPct: 6.3,
    villa: { psf: 1443, price: 2920000, rent: 150000, yieldPct: 5.0 },
    url: 'https://www.propertyindex.ae/communities/town-square',
  },
  'Jumeirah': {
    sales: 105, valueAed: 5173355981, rentals: 0, projects: 4,
    cohort: 'All types', psf: 7918, price: 33036777, rent: null, yieldPct: null,
    note: 'No registered rentals in window — yield unavailable',
    url: 'https://www.propertyindex.ae/communities/jumeirah',
  },
  // DIFC operates its own property register; DLD coverage is partial
  'DIFC': {
    sales: 147, valueAed: 1118459450, rentals: 0, projects: 1,
    cohort: 'All types', psf: 4247, price: 6626250, rent: null, yieldPct: null,
    scope: 'DLD-registered only',
    note: 'No registered rentals in window — yield unavailable',
    url: 'https://www.propertyindex.ae/communities/dubai-international-financial-center',
  },
  // Emaar Beachfront sits inside the Dubai Harbour master community
  'Emaar Beachfront': {
    sales: 825, valueAed: 5852598665, rentals: 1010, projects: 19,
    cohort: 'Apartment', psf: 4000, price: 5292000, rent: 180000, yieldPct: 4.5,
    scope: 'Dubai Harbour',
    url: 'https://www.propertyindex.ae/communities/dubai-harbour',
  },
  // Dubai Islands registers under the legacy Palm Deira community
  'Dubai Islands': {
    sales: 3138, valueAed: 10242591802, rentals: 2, projects: 98,
    cohort: 'Apartment', psf: 2349, price: 2604934, rent: null, yieldPct: null,
    scope: 'Palm Deira',
    note: 'Too few registered rentals — yield unavailable',
    url: 'https://www.propertyindex.ae/communities/palm-deira',
  },
};

// ── Formatting helpers ──
export function fmtAedBillions(v) {
  if (v >= 1e9) return `AED ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `AED ${(v / 1e6).toFixed(0)}M`;
  return `AED ${Math.round(v).toLocaleString('en-US')}`;
}

export function fmtPrice(v) {
  if (v == null) return '—';
  if (v >= 1e6) return `AED ${(v / 1e6).toFixed(2)}M`;
  return `AED ${Math.round(v / 1000)}K`;
}

export function fmtRent(v) {
  if (v == null) return '—';
  return `AED ${Math.round(v / 1000)}K/yr`;
}

export function fmtCount(n) {
  return n.toLocaleString('en-US');
}

export function fmtPct(p) {
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(1)}%`;
}

// Rank a gross yield for colour-coding (Dubai registry context)
export function yieldClass(y) {
  if (y == null) return 'na';
  if (y >= 6) return 'high';
  if (y >= 5) return 'mid';
  return 'low';
}

// ── Shared AI context ──
// Single source of truth for the market state injected into the
// Ask Felicity desk and the Mon/Thu newsletter brief system prompts.
export function buildDeskContext() {
  const i = pixIndex;
  const rows = Object.entries(pixAreas)
    // Expo City duplicates Dubai South's registry scope — list it once
    .filter(([name]) => name !== 'Expo City')
    .sort((a, b) => b[1].sales - a[1].sales)
    .map(([name, p]) => {
      const y = p.yieldPct != null ? `${p.yieldPct.toFixed(1)}% gross yield` : 'yield n/a';
      const scope = p.scope ? ` [${p.scope}]` : '';
      return `- ${name}${scope}: ${fmtCount(p.sales)} sales (${fmtAedBillions(p.valueAed)}), median ${fmtCount(p.psf)} AED/sqft, median price ${fmtPrice(p.price)}, ${y}`;
    })
    .join('\n');

  return `LIVE MARKET EVIDENCE — PIX index + Dubai Land Department registry via PropertyIndex.
Index as of ${PIX_AS_OF}; area medians from registered transactions ${PIX_WINDOW}. Anchor every call to these numbers and cite them.

MARKET STATE (base Jan 2012 = 100):
- Residential index ${i.residential.level} — ${fmtPct(i.residential.yoyPct)} YoY, ${fmtPct(i.residential.momPct)} MoM. The market has ROLLED OVER from its Dec 2025 peak of 223.2 after a +14% YoY run in mid-2025. Six consecutive monthly declines.
- Apartments ${i.apartment.level} (${fmtPct(i.apartment.yoyPct)} YoY), median ${fmtCount(i.apartment.medianPsf)} AED/sqft.
- Villas ${i.villa.level} (${fmtPct(i.villa.yoyPct)} YoY), median ${fmtCount(i.villa.medianPsf)} AED/sqft. Villas are outperforming apartments by roughly 5 points YoY.
- Roughly ${fmtCount(i.residential.txCount)} registered residential transactions per month emirate-wide.

AREA REGISTRY MEDIANS (apartment cohort unless noted; gross yield = registered rent PSF / registered sale PSF, excludes service charges and voids):
${rows}

Rules for using this evidence:
- The market is CORRECTING, not uniformly bullish. Never describe it as broadly rising.
- Yields and prices above are registered medians, not projections for a specific unit. Say so when it matters.
- Highest registry yields sit in Meydan One, Arjan, JVC, Town Square, MBR City and JLT (6.1-6.7%); the prime waterfront (Palm Jumeirah 3.4%, Emaar Beachfront/Dubai Harbour 4.5%) trades yield for capital value.
- Where yield is 'n/a' there were too few registered rentals in the window — do not invent one.`;
}

// Inline SVG sparkline of the 13-month PIX residential series
export function pixSparkline(width = 120, height = 32) {
  const levels = pixSeries.map(p => p.level);
  const min = Math.min(...levels);
  const max = Math.max(...levels);
  const range = max - min || 1;
  const pts = levels.map((v, i) => {
    const x = (i / (levels.length - 1)) * width;
    const y = height - 3 - ((v - min) / range) * (height - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const lastY = height - 3 - ((levels[levels.length - 1] - min) / range) * (height - 6);
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" aria-hidden="true">
    <polyline points="${pts}" stroke="#00d4ff" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${width}" cy="${lastY.toFixed(1)}" r="2.5" fill="#f0715c"/>
  </svg>`;
}
