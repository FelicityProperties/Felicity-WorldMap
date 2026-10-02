// ═══════════════════════════════════════════════════════════
// FELICITY PRICE INDEX DATA — Official Dubai market evidence
// ═══════════════════════════════════════════════════════════
//
// Source: Dubai Land Department registered transactions (pulled through
// the PropertyIndex tools — that name never reaches the UI or the AI:
// the public name is the Felicity Price Index). Snapshot 2026-10-02; DLD
// registrations loaded through 2026-09 (last complete calendar month).
// History is restated as late registrations land — this snapshot moved
// the August residential index from 206.99 to 206.93 and the villa index
// from 266.38 to 266.23, so every figure below was re-pulled, not carried
// over. Every figure below is registered-transaction evidence — median
// registered sale PSF, median registered price, median registered annual
// rent — not an estimate or a listing.
//
// Yield = median registered annual rent PSF ÷ median registered sale
// PSF for the SAME property-type cohort in the SAME community, over
// the last 12 complete months (Oct 2025 – Sep 2026). It is a gross,
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

export const PIX_AS_OF = 'Sep 2026';
export const PIX_SOURCE = 'Felicity Price Index over Dubai Land Department registered transactions';
export const PIX_WINDOW = 'Oct 2025 – Sep 2026';

// ── Felicity Price Index (base Jan 2012 = 100), as of 2026-09 ──
export const pixIndex = {
  residential: { level: 205.98, momPct: -0.46, yoyPct: -3.97, medianPsf: 1652, txCount: 10079 },
  apartment:   { level: 198.56, momPct: -0.67, yoyPct: -4.46, medianPsf: 1659, txCount: 8793 },
  villa:       { level: 268.13, momPct: 0.72, yoyPct: -1.21, medianPsf: 1590, txCount: 1286 },
};

// Trailing 13 months, residential segment (index level).
// History is restated as late registrations land, so this series is
// re-pulled in full on every refresh — never appended to.
export const pixSeries = [
  { month: 'Sep 25', level: 214.50 },
  { month: 'Oct 25', level: 216.03 },
  { month: 'Nov 25', level: 217.70 },
  { month: 'Dec 25', level: 218.89 },
  { month: 'Jan 26', level: 220.17 },
  { month: 'Feb 26', level: 219.02 },
  { month: 'Mar 26', level: 218.48 },
  { month: 'Apr 26', level: 219.76 },
  { month: 'May 26', level: 220.14 },
  { month: 'Jun 26', level: 213.77 },
  { month: 'Jul 26', level: 207.81 },
  { month: 'Aug 26', level: 206.93 },
  { month: 'Sep 26', level: 205.98 },
];

// ── Per-area registry evidence (L12M through Sep 2026) ──
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
    sales: 2488, valueAed: 10.63e9, rentals: 10167,
    cohort: 'Apartment', psf: 3007, price: 2885322, rent: 140000, yieldPct: 4.4,
    url: 'https://www.propertyindex.ae/dubai/downtown-dubai',
  },
  'Dubai Marina': {
    sales: 2039, valueAed: 5.83e9, rentals: 15774,
    cohort: 'Apartment', psf: 1993, price: 2200000, rent: 110000, yieldPct: 5.3,
    url: 'https://www.propertyindex.ae/dubai/dubai-marina',
  },
  'Dubai Creek Harbour': {
    sales: 3923, valueAed: 11.36e9, rentals: 6430,
    cohort: 'Apartment', psf: 2558, price: 2600000, rent: 130000, yieldPct: 5.0,
    url: 'https://www.propertyindex.ae/dubai/dubai-creek-harbour-the-lagoons',
  },
  'Dubai Hills Estate': {
    sales: 2325, valueAed: 5.78e9, rentals: 5380,
    cohort: 'Apartment', psf: 2396, price: 2150000, rent: 115000, yieldPct: 5.8,
    villa: { sales: 296, psf: 2275, price: 9500000, rent: 300000, yieldPct: 4.4 },
    url: 'https://www.propertyindex.ae/dubai/dubai-hills-estate',
  },
  'Business Bay': {
    sales: 6285, valueAed: 17.62e9, rentals: 19931,
    cohort: 'Apartment', psf: 2474, price: 2038706, rent: 95000, yieldPct: 4.5,
    url: 'https://www.propertyindex.ae/dubai/business-bay',
  },
  'Palm Jumeirah': {
    sales: 1087, valueAed: 10.94e9, rentals: 4450,
    cohort: 'Apartment', psf: 3579, price: 5900000, rent: 195252, yieldPct: 3.4,
    villa: { sales: 78, psf: 4870, price: 36000000, rent: 949698, yieldPct: 2.7 },
    url: 'https://www.propertyindex.ae/dubai/palm-jumeirah',
  },
  'JVC': {
    sales: 11434, valueAed: 12.29e9, rentals: 32195,
    cohort: 'Apartment', psf: 1483, price: 1013519, rent: 65000, yieldPct: 6.1,
    villa: { sales: 208, psf: 1667, price: 3337500, rent: 180000, yieldPct: 5.1 },
    url: 'https://www.propertyindex.ae/dubai/jumeirah-village-circle',
  },
  'Dubai South': {
    sales: 13198, valueAed: 13.17e9, rentals: 5481,
    cohort: 'Apartment', psf: 1637, price: 759425, rent: 55000, yieldPct: 4.5,
    villa: { sales: 1269, psf: 1328, price: 4430000, rent: 125000, yieldPct: 4.8 },
    scope: 'Dubai World Central',
    url: 'https://www.propertyindex.ae/dubai/dubai-south-dubai-world-central',
  },
  // Expo City is its own DLD master community, separate from Dubai South
  'Expo City': {
    sales: 1491, valueAed: 3.27e9, rentals: 1814,
    cohort: 'Apartment', psf: 2123, price: 2015000, rent: 86000, yieldPct: 4.3,
    url: 'https://www.propertyindex.ae/dubai/expo-city',
  },
  'Mohammed Bin Rashid City': {
    sales: 1787, valueAed: 3.72e9, rentals: 6504,
    cohort: 'Apartment', psf: 1997, price: 1745000, rent: 95000, yieldPct: 6.4,
    villa: { sales: 707, psf: 2477, price: 13700000, rent: 190000, yieldPct: 4.4 },
    url: 'https://www.propertyindex.ae/dubai/mohammed-bin-rashid-city',
  },
  'DAMAC Hills': {
    sales: 1432, valueAed: 1.85e9, rentals: 3428,
    cohort: 'Apartment', psf: 1707, price: 1242120, rent: 55000, yieldPct: 5.8,
    villa: { sales: 332, psf: 1659, price: 3850000, rent: 205000, yieldPct: 4.6 },
    url: 'https://www.propertyindex.ae/dubai/damac-hills',
  },
  'JLT': {
    sales: 1671, valueAed: 3.00e9, rentals: 9395,
    cohort: 'Apartment', psf: 1677, price: 1500000, rent: 85000, yieldPct: 6.0,
    url: 'https://www.propertyindex.ae/dubai/jumeirah-lake-towers',
  },
  'Meydan': {
    sales: 1915, valueAed: 3.04e9, rentals: 8708,
    cohort: 'Apartment', psf: 2082, price: 1266290, rent: 60000, yieldPct: 6.2,
    villa: { sales: 45, psf: 2262, price: 6500000, rent: 320000, yieldPct: 4.4 },
    url: 'https://www.propertyindex.ae/dubai/meydan',
  },
  'Arjan': {
    sales: 3693, valueAed: 3.88e9, rentals: 14935,
    cohort: 'Apartment', psf: 1564, price: 905000, rent: 60243, yieldPct: 5.4,
    url: 'https://www.propertyindex.ae/dubai/arjan',
  },
  'Town Square': {
    sales: 1802, valueAed: 2.43e9, rentals: 4418,
    cohort: 'Apartment', psf: 1560, price: 1301388, rent: 68270, yieldPct: 5.9,
    villa: { sales: 283, psf: 1349, price: 2920000, rent: 150000, yieldPct: 5.1 },
    url: 'https://www.propertyindex.ae/dubai/town-square',
  },
  // Jumeirah's apartment sales are new ultra-prime stock (median AED
  // 6,825/sqft) while its apartment tenancies are older low-rise units,
  // so dividing one by the other (1.6%) is not a like-for-like yield. The
  // villa cohort is the one where sales and rentals describe the same homes.
  'Jumeirah': {
    sales: 33, valueAed: 0.73e9, rentals: 3247,
    cohort: 'Villa', psf: 1397, price: 13520000, rent: 252000, yieldPct: 5.0,
    note: 'Villa cohort shown — apartment sales (414, median AED 6,825/sqft) are new ultra-prime stock not comparable with the older apartment rental base; villa yield rests on 33 registered villa sales',
    url: 'https://www.propertyindex.ae/dubai/jumeirah',
  },
  // Emaar Beachfront sits inside the Dubai Harbour master community
  'Emaar Beachfront': {
    sales: 817, valueAed: 6.01e9, rentals: 1558,
    cohort: 'Apartment', psf: 4071, price: 5500000, rent: 170000, yieldPct: 4.2,
    scope: 'Dubai Harbour',
    url: 'https://www.propertyindex.ae/dubai/dubai-harbour',
  },
  // Dubai Islands is registered under its own name (formerly Palm Deira)
  'Dubai Islands': {
    sales: 4676, valueAed: 15.87e9, rentals: 10,
    cohort: 'Apartment', psf: 2730, price: 2850000, rent: null, yieldPct: null,
    note: 'Only 10 registered rentals in window, none with a valid registered size — yield unavailable',
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

  return `LIVE MARKET EVIDENCE — the Felicity Price Index and the Dubai Land Department registry.
NAMING: the index is "the Felicity Price Index" (or "our price index") and its source is the Dubai Land Department register. Use no other name for the index or its provider.
Index as of ${PIX_AS_OF}; area medians from registered transactions ${PIX_WINDOW}. Anchor every call to these numbers and cite them.

MARKET STATE (base Jan 2012 = 100):
- Residential index ${i.residential.level} — ${fmtPct(i.residential.yoyPct)} YoY, ${fmtPct(i.residential.momPct)} MoM. The market PLATEAUED around 220 from Jan to May 2026 (peak 220.17 in Jan) after a +12% YoY run through 2025, then dropped -2.9% in June and -2.8% in July, slipped -0.4% in August and -0.5% in September: four consecutive monthly declines, YoY negative since July and now at its weakest of the cycle.
- Apartments ${i.apartment.level} (${fmtPct(i.apartment.yoyPct)} YoY), median ${fmtCount(i.apartment.medianPsf)} AED/sqft — the weaker segment, down every month since May.
- Villas ${i.villa.level} (${fmtPct(i.villa.yoyPct)} YoY), median ${fmtCount(i.villa.medianPsf)} AED/sqft. Villas are holding up better than apartments by about 3.3 points YoY, and the villa index rose +0.7% in September, its first monthly gain after three declines. One month is not a turn; say so if you mention it.
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

// Inline SVG sparkline of the 13-month Felicity Price Index residential series
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
