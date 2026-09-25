// ═══════════════════════════════════════════════════════════
// PIX DATA — Official Dubai market evidence (PIX© Pro)
// ═══════════════════════════════════════════════════════════
//
// Source: Dubai Land Department data modelled by PropertyIndex
// (propertyindex.ae). Snapshot 2026-09-25; DLD registrations loaded
// through 2026-08 (last complete calendar month). PropertyIndex restates
// history as late registrations land — this snapshot moved the August
// index from 207.39 to 206.99 and the villa index by −4.6 points, so
// every figure below was re-pulled, not carried over. Every figure below
// is registered-transaction evidence — median registered sale PSF,
// median registered price, median registered annual rent — not an
// estimate or a listing.
//
// Yield = median registered annual rent PSF ÷ median registered sale
// PSF for the SAME property-type cohort in the SAME community, over
// the last 12 complete months (Sep 2025 – Aug 2026). It is a gross,
// cohort-level registry yield: no service charges, voids, or fees are
// deducted, and it is not a projection for any individual unit. The
// rent-PSF median covers only tenancies with a valid registered size,
// so it is a narrower set than the headline rent median.
//
// Activity totals (sales / valueAed / rentals) count registered sale
// facts and tenancy periods for the stated cohort only — never mixed
// property types. Query fields: sales are windowed on `sale_date`,
// rentals on `registration_date`.
// ═══════════════════════════════════════════════════════════

export const PIX_AS_OF = 'Aug 2026';
export const PIX_SOURCE = 'DLD data modelled by PropertyIndex';
export const PIX_WINDOW = 'Sep 2025 – Aug 2026';

// ── PIX Market Index (base Jan 2012 = 100), as of 2026-08 ──
export const pixIndex = {
  residential: { level: 206.99, momPct: -0.41, yoyPct: -2.46, medianPsf: 1696, txCount: 10667 },
  apartment:   { level: 199.92, momPct: -0.27, yoyPct: -2.63, medianPsf: 1701, txCount: 9506 },
  villa:       { level: 266.38, momPct: -1.20, yoyPct: -1.51, medianPsf: 1630, txCount: 1161 },
};

// Trailing 13 months, residential segment (index level).
// PropertyIndex restates history as late registrations land, so this
// series is re-pulled in full on every refresh — never appended to.
export const pixSeries = [
  { month: 'Aug 25', level: 212.21 },
  { month: 'Sep 25', level: 214.61 },
  { month: 'Oct 25', level: 216.14 },
  { month: 'Nov 25', level: 217.79 },
  { month: 'Dec 25', level: 218.99 },
  { month: 'Jan 26', level: 220.26 },
  { month: 'Feb 26', level: 219.09 },
  { month: 'Mar 26', level: 218.57 },
  { month: 'Apr 26', level: 219.84 },
  { month: 'May 26', level: 220.22 },
  { month: 'Jun 26', level: 213.78 },
  { month: 'Jul 26', level: 207.84 },
  { month: 'Aug 26', level: 206.99 },
];

// ── Per-area registry evidence (L12M through Aug 2026) ──
//   sales/valueAed/rentals — registered activity for the stated cohort
//   psf/price/rent/yieldPct — medians for that cohort
//   villa{}                 — separate villa cohort where the community
//                             has meaningful registered volume
//   scope                   — set when the DLD master community differs
//                             from the marketing name
//
// DIFC is deliberately absent: it runs its own property register and
// the DLD file holds no registered sales or rentals for it in this
// window. The Dubai Intel card therefore shows the desk estimate with
// an `est` marker rather than a registry figure that does not exist.
export const pixAreas = {
  'Downtown Dubai': {
    sales: 2552, valueAed: 11.03e9, rentals: 9983,
    cohort: 'Apartment', psf: 2983, price: 2920000, rent: 144000, yieldPct: 4.5,
    url: 'https://www.propertyindex.ae/dubai/downtown-dubai',
  },
  'Dubai Marina': {
    sales: 2160, valueAed: 6.24e9, rentals: 15479,
    cohort: 'Apartment', psf: 2011, price: 2200000, rent: 110000, yieldPct: 5.3,
    url: 'https://www.propertyindex.ae/dubai/dubai-marina',
  },
  'Dubai Creek Harbour': {
    sales: 3947, valueAed: 11.36e9, rentals: 6229,
    cohort: 'Apartment', psf: 2558, price: 2600000, rent: 130000, yieldPct: 5.1,
    url: 'https://www.propertyindex.ae/dubai/dubai-creek-harbour-the-lagoons',
  },
  'Dubai Hills Estate': {
    sales: 2461, valueAed: 6.07e9, rentals: 5079,
    cohort: 'Apartment', psf: 2390, price: 2100000, rent: 115000, yieldPct: 5.9,
    villa: { sales: 309, psf: 2268, price: 9500000, rent: 303000, yieldPct: 4.5 },
    url: 'https://www.propertyindex.ae/dubai/dubai-hills-estate',
  },
  'Business Bay': {
    sales: 7251, valueAed: 19.62e9, rentals: 19339,
    cohort: 'Apartment', psf: 2542, price: 2000000, rent: 95000, yieldPct: 4.4,
    url: 'https://www.propertyindex.ae/dubai/business-bay',
  },
  'Palm Jumeirah': {
    sales: 1147, valueAed: 11.41e9, rentals: 4373,
    cohort: 'Apartment', psf: 3593, price: 5900000, rent: 196350, yieldPct: 3.4,
    villa: { sales: 84, psf: 4929, price: 37850000, rent: 949849, yieldPct: 2.8 },
    url: 'https://www.propertyindex.ae/dubai/palm-jumeirah',
  },
  'JVC': {
    sales: 12646, valueAed: 13.58e9, rentals: 31468,
    cohort: 'Apartment', psf: 1500, price: 1020000, rent: 65000, yieldPct: 6.1,
    villa: { sales: 217, psf: 1653, price: 3365000, rent: 180000, yieldPct: 5.2 },
    url: 'https://www.propertyindex.ae/dubai/jumeirah-village-circle',
  },
  'Dubai South': {
    sales: 13101, valueAed: 13.17e9, rentals: 5464,
    cohort: 'Apartment', psf: 1630, price: 785000, rent: 55000, yieldPct: 4.5,
    villa: { sales: 1450, psf: 1328, price: 4380000, rent: 125000, yieldPct: 4.8 },
    scope: 'Dubai World Central',
    url: 'https://www.propertyindex.ae/dubai/dubai-south-dubai-world-central',
  },
  // Expo City is now its own DLD master community, separate from Dubai South
  'Expo City': {
    sales: 1506, valueAed: 3.33e9, rentals: 1830,
    cohort: 'Apartment', psf: 2121, price: 2168000, rent: 86000, yieldPct: 4.3,
    url: 'https://www.propertyindex.ae/dubai/expo-city',
  },
  'Mohammed Bin Rashid City': {
    sales: 1857, valueAed: 3.89e9, rentals: 6281,
    cohort: 'Apartment', psf: 1997, price: 1743828, rent: 97500, yieldPct: 6.5,
    villa: { sales: 736, psf: 2481, price: 13700000, rent: 193561, yieldPct: 4.4 },
    url: 'https://www.propertyindex.ae/dubai/mohammed-bin-rashid-city',
  },
  'DAMAC Hills': {
    sales: 1451, valueAed: 1.90e9, rentals: 3403,
    cohort: 'Apartment', psf: 1677, price: 1243000, rent: 55000, yieldPct: 5.9,
    villa: { sales: 331, psf: 1685, price: 3850000, rent: 209426, yieldPct: 4.5 },
    url: 'https://www.propertyindex.ae/dubai/damac-hills',
  },
  'JLT': {
    sales: 1809, valueAed: 3.30e9, rentals: 9161,
    cohort: 'Apartment', psf: 1745, price: 1550000, rent: 85367, yieldPct: 5.8,
    url: 'https://www.propertyindex.ae/dubai/jumeirah-lake-towers',
  },
  'Meydan': {
    sales: 1958, valueAed: 3.08e9, rentals: 8516,
    cohort: 'Apartment', psf: 2082, price: 1249626, rent: 61100, yieldPct: 6.3,
    villa: { sales: 46, psf: 2268, price: 6700000, rent: 320000, yieldPct: 4.4 },
    url: 'https://www.propertyindex.ae/dubai/meydan',
  },
  'Arjan': {
    sales: 3783, valueAed: 3.95e9, rentals: 14580,
    cohort: 'Apartment', psf: 1556, price: 900000, rent: 60900, yieldPct: 5.4,
    url: 'https://www.propertyindex.ae/dubai/arjan',
  },
  'Town Square': {
    sales: 1924, valueAed: 2.58e9, rentals: 4418,
    cohort: 'Apartment', psf: 1556, price: 1300000, rent: 68000, yieldPct: 5.8,
    villa: { sales: 295, psf: 1358, price: 2900000, rent: 150000, yieldPct: 5.1 },
    url: 'https://www.propertyindex.ae/dubai/town-square',
  },
  // Jumeirah's apartment sales are new ultra-prime stock (median AED
  // 6,857/sqft) while its apartment tenancies are older low-rise units,
  // so dividing one by the other is not a like-for-like yield. The villa
  // cohort is the one where sales and rentals describe the same homes.
  'Jumeirah': {
    sales: 38, valueAed: 0.96e9, rentals: 3213,
    cohort: 'Villa', psf: 1519, price: 13366000, rent: 250470, yieldPct: 4.5,
    note: 'Villa cohort shown — apartment sales (438, median AED 6,857/sqft) are new ultra-prime stock not comparable with the older apartment rental base',
    url: 'https://www.propertyindex.ae/dubai/jumeirah',
  },
  // Emaar Beachfront sits inside the Dubai Harbour master community
  'Emaar Beachfront': {
    sales: 849, valueAed: 6.34e9, rentals: 1434,
    cohort: 'Apartment', psf: 4100, price: 5730000, rent: 175000, yieldPct: 4.3,
    scope: 'Dubai Harbour',
    url: 'https://www.propertyindex.ae/dubai/dubai-harbour',
  },
  // Dubai Islands is now registered under its own name (formerly Palm Deira)
  'Dubai Islands': {
    sales: 5003, valueAed: 16.80e9, rentals: 4,
    cohort: 'Apartment', psf: 2696, price: 2818000, rent: null, yieldPct: null,
    note: 'Only 4 registered rentals in window — yield unavailable',
    url: 'https://www.propertyindex.ae/dubai/dubai-islands',
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
    .sort((a, b) => b[1].sales - a[1].sales)
    .map(([name, p]) => {
      const y = p.yieldPct != null ? `${p.yieldPct.toFixed(1)}% gross yield` : 'yield n/a';
      const scope = p.scope ? ` [${p.scope}]` : '';
      const cohort = p.cohort !== 'Apartment' ? ` (${p.cohort.toLowerCase()} cohort)` : '';
      const villa = p.villa
        ? `; villas ${fmtCount(p.villa.psf)} AED/sqft, ${fmtPrice(p.villa.price)}, ${p.villa.yieldPct.toFixed(1)}% yield`
        : '';
      return `- ${name}${scope}${cohort}: ${fmtCount(p.sales)} sales (${fmtAedBillions(p.valueAed)}), median ${fmtCount(p.psf)} AED/sqft, median price ${fmtPrice(p.price)}, ${y}${villa}`;
    })
    .join('\n');

  // Rankings are computed here so "highest" and "lowest" are never a guess.
  // A model reading nineteen rows once called Dubai South's 4.8% the highest
  // villa yield in the register; JVC's 5.2% was two lines up.
  const rank = pick => Object.entries(pixAreas)
    .map(([name, p]) => [name, pick(p)])
    .filter(([, y]) => y != null)
    .sort((a, b) => b[1] - a[1])
    .map(([name, y]) => `${name} ${y.toFixed(1)}%`)
    .join(' > ');
  const aptRank = rank(p => p.cohort === 'Apartment' ? p.yieldPct : null);
  const villaRank = rank(p => p.villa ? p.villa.yieldPct : (p.cohort === 'Villa' ? p.yieldPct : null));

  return `LIVE MARKET EVIDENCE — PIX index + Dubai Land Department registry via PropertyIndex.
Index as of ${PIX_AS_OF}; area medians from registered transactions ${PIX_WINDOW}. Anchor every call to these numbers and cite them.

MARKET STATE (base Jan 2012 = 100):
- Residential index ${i.residential.level} — ${fmtPct(i.residential.yoyPct)} YoY, ${fmtPct(i.residential.momPct)} MoM. The market PLATEAUED around 220 from Jan to May 2026 (peak 220.26 in Jan) after a +12% YoY run through 2025, then dropped -2.9% in June and -2.8% in July and slipped -0.4% in August: three consecutive monthly declines, and YoY turned negative in July for the first time in the cycle.
- Apartments ${i.apartment.level} (${fmtPct(i.apartment.yoyPct)} YoY), median ${fmtCount(i.apartment.medianPsf)} AED/sqft.
- Villas ${i.villa.level} (${fmtPct(i.villa.yoyPct)} YoY), median ${fmtCount(i.villa.medianPsf)} AED/sqft. Villas are holding up better than apartments by about 1.1 points YoY, but both segments are now negative and the villa index fell -1.2% in August alone.
- Roughly ${fmtCount(i.residential.txCount)} registered residential transactions per month emirate-wide.

AREA REGISTRY MEDIANS (apartment cohort unless noted; gross yield = registered rent PSF / registered sale PSF, excludes service charges and voids):
${rows}

YIELD RANKINGS (use these before calling anything "highest" or "lowest" — do not rank by eye):
- Apartments: ${aptRank}
- Villas: ${villaRank}

Rules for using this evidence:
- The market is CORRECTING, not uniformly bullish. Never describe it as broadly rising.
- Historical analogs: you may describe how a prior Dubai cycle behaved in words, but you may not attach a percentage, AED figure or date to it unless that figure appears in this evidence. The 13-month index path above is the only price history you have. Never write "last time X happened, Y fell Z%" with an invented Z.
- Yields and prices above are registered medians, not projections for a specific unit. Say so when it matters.
- Highest registry apartment yields sit in MBR City (6.5%), Meydan (6.3%), JVC (6.1%), Dubai Hills, DAMAC Hills (5.9%), JLT and Town Square (5.8%); the prime waterfront (Palm Jumeirah 3.4%, Emaar Beachfront/Dubai Harbour 4.3%, Expo City 4.3%) trades yield for capital value. Villa yields run 2.8% (Palm) to 5.2% (JVC).
- Where yield is 'n/a' there were too few registered rentals in the window — do not invent one.
- DIFC is not in this list because the DLD register holds no DIFC sales or rentals in the window. Say the evidence is unavailable rather than quoting a number.`;
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
