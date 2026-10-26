// ═══════════════════════════════════════════════════════════
// FELICITY PRICE INDEX DATA — Official Dubai market evidence
// ═══════════════════════════════════════════════════════════
//
// Source: Dubai Land Department registered transactions (pulled through
// the PropertyIndex tools — that name never reaches the UI or the AI:
// the public name is the Felicity Price Index). Snapshot 2026-10-26; DLD
// registrations loaded through 2026-09 (last complete calendar month).
// History is restated as registrations land and are corrected — this
// mid-month pull moved six residential months by up to 0.03 points
// (September 2025 214.30 → 214.28, May 219.95 → 219.92) and the villa
// index from 267.53 to 267.47, and the sample behind the September villa
// reading fell by 82 sales (1,259 → 1,177; its median PSF 1,578 → 1,532;
// the register itself holds 1,317 September villa sales), so every figure
// below was re-pulled, not carried over, even though the index month has
// not changed. Every figure below is registered-transaction evidence — median
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
  residential: { level: 205.79, momPct: -0.47, yoyPct: -3.96, medianPsf: 1647, txCount: 9926 },
  apartment:   { level: 198.41, momPct: -0.69, yoyPct: -4.47, medianPsf: 1661, txCount: 8749 },
  villa:       { level: 267.47, momPct: 0.78, yoyPct: -1.08, medianPsf: 1532, txCount: 1177 },
};

// Trailing 13 months: the residential level and its YoY reading, with
// the apartment and villa levels beside it. History is restated as
// registrations land, so this series is re-pulled in full on every
// refresh — never appended to. The market narrative in buildDeskContext()
// is computed from it; nothing in that prose is typed by hand.
export const pixSeries = [
  { month: 'Sep 25', level: 214.28, yoyPct: 11.31, apartment: 207.70, villa: 270.38 },
  { month: 'Oct 25', level: 215.83, yoyPct: 10.64, apartment: 208.95, villa: 274.27 },
  { month: 'Nov 25', level: 217.51, yoyPct: 12.43, apartment: 210.43, villa: 277.45 },
  { month: 'Dec 25', level: 218.71, yoyPct: 12.64, apartment: 211.24, villa: 281.51 },
  { month: 'Jan 26', level: 219.98, yoyPct: 12.14, apartment: 212.27, villa: 284.57 },
  { month: 'Feb 26', level: 218.83, yoyPct: 10.17, apartment: 211.36, villa: 281.65 },
  { month: 'Mar 26', level: 218.34, yoyPct: 8.70, apartment: 210.63, villa: 282.90 },
  { month: 'Apr 26', level: 219.56, yoyPct: 7.79, apartment: 211.36, villa: 287.80 },
  { month: 'May 26', level: 219.92, yoyPct: 6.92, apartment: 211.96, villa: 286.38 },
  { month: 'Jun 26', level: 213.60, yoyPct: 2.99, apartment: 205.47, villa: 281.10 },
  { month: 'Jul 26', level: 207.63, yoyPct: -0.32, apartment: 200.34, villa: 268.74 },
  { month: 'Aug 26', level: 206.76, yoyPct: -2.44, apartment: 199.80, villa: 265.40 },
  { month: 'Sep 26', level: 205.79, yoyPct: -3.96, apartment: 198.41, villa: 267.47 },
];

// ── Per-area registry evidence (L12M through Sep 2026) ──
//   sales/valueAed/rentals — registered activity for the stated cohort
//   psf/price/rent/yieldPct — medians for that cohort
//   villa{}                 — separate villa cohort where the community
//                             has meaningful registered volume
//   scope                   — set when the DLD master community differs
//                             from the marketing name, or when the row is
//                             a sub-node of one (Emaar Beachfront)
//
// DIFC is deliberately absent: it runs its own property register and
// the DLD file holds no registered sales or rentals for it in this
// window. The Dubai Intel card therefore shows the desk estimate with
// an `est` marker rather than a registry figure that does not exist.
export const pixAreas = {
  'Downtown Dubai': {
    sales: 2489, valueAed: 10.64e9, rentals: 10163,
    cohort: 'Apartment', psf: 3007, price: 2887944, rent: 140000, yieldPct: 4.4,
    url: 'https://www.propertyindex.ae/dubai/downtown-dubai',
  },
  'Dubai Marina': {
    sales: 2039, valueAed: 5.83e9, rentals: 15767,
    cohort: 'Apartment', psf: 1993, price: 2200000, rent: 110000, yieldPct: 5.3,
    url: 'https://www.propertyindex.ae/dubai/dubai-marina',
  },
  'Dubai Creek Harbour': {
    sales: 3922, valueAed: 11.36e9, rentals: 6427,
    cohort: 'Apartment', psf: 2558, price: 2600000, rent: 130000, yieldPct: 5.0,
    url: 'https://www.propertyindex.ae/dubai/dubai-creek-harbour-the-lagoons',
  },
  'Dubai Hills Estate': {
    sales: 2325, valueAed: 5.78e9, rentals: 5330,
    cohort: 'Apartment', psf: 2396, price: 2150000, rent: 115000, yieldPct: 5.8,
    villa: { sales: 297, psf: 2276, price: 9500000, rent: 300000, yieldPct: 4.4 },
    url: 'https://www.propertyindex.ae/dubai/dubai-hills-estate',
  },
  'Business Bay': {
    sales: 6283, valueAed: 17.61e9, rentals: 19927,
    cohort: 'Apartment', psf: 2473, price: 2038706, rent: 95000, yieldPct: 4.5,
    url: 'https://www.propertyindex.ae/dubai/business-bay',
  },
  'Palm Jumeirah': {
    sales: 1087, valueAed: 10.94e9, rentals: 4446,
    cohort: 'Apartment', psf: 3579, price: 5900000, rent: 195252, yieldPct: 3.4,
    villa: { sales: 78, psf: 4870, price: 36000000, rent: 949698, yieldPct: 2.7 },
    url: 'https://www.propertyindex.ae/dubai/palm-jumeirah',
  },
  'JVC': {
    sales: 11424, valueAed: 12.28e9, rentals: 32188,
    cohort: 'Apartment', psf: 1482, price: 1004307, rent: 65000, yieldPct: 6.1,
    villa: { sales: 208, psf: 1667, price: 3337500, rent: 180000, yieldPct: 5.1 },
    url: 'https://www.propertyindex.ae/dubai/jumeirah-village-circle',
  },
  'Dubai South': {
    sales: 13196, valueAed: 13.17e9, rentals: 5481,
    cohort: 'Apartment', psf: 1636, price: 757175, rent: 55000, yieldPct: 4.5,
    villa: { sales: 1258, psf: 1327, price: 4430000, rent: 125000, yieldPct: 4.8 },
    scope: 'Dubai World Central',
    url: 'https://www.propertyindex.ae/dubai/dubai-south-dubai-world-central',
  },
  // Expo City is its own DLD master community, separate from Dubai South
  'Expo City': {
    sales: 1491, valueAed: 3.27e9, rentals: 1815,
    cohort: 'Apartment', psf: 2123, price: 2015000, rent: 86000, yieldPct: 4.3,
    url: 'https://www.propertyindex.ae/dubai/expo-city',
  },
  'Mohammed Bin Rashid City': {
    sales: 1787, valueAed: 3.72e9, rentals: 6502,
    cohort: 'Apartment', psf: 1997, price: 1745000, rent: 95000, yieldPct: 6.4,
    villa: { sales: 707, psf: 2477, price: 13700000, rent: 190000, yieldPct: 4.4 },
    url: 'https://www.propertyindex.ae/dubai/mohammed-bin-rashid-city',
  },
  'DAMAC Hills': {
    sales: 1431, valueAed: 1.84e9, rentals: 3425,
    cohort: 'Apartment', psf: 1708, price: 1242000, rent: 55000, yieldPct: 5.8,
    villa: { sales: 332, psf: 1659, price: 3850000, rent: 205000, yieldPct: 4.6 },
    url: 'https://www.propertyindex.ae/dubai/damac-hills',
  },
  'JLT': {
    sales: 1671, valueAed: 3.00e9, rentals: 9393,
    cohort: 'Apartment', psf: 1677, price: 1500000, rent: 85000, yieldPct: 6.0,
    url: 'https://www.propertyindex.ae/dubai/jumeirah-lake-towers',
  },
  'Meydan': {
    sales: 1915, valueAed: 3.04e9, rentals: 8705,
    cohort: 'Apartment', psf: 2082, price: 1266290, rent: 60000, yieldPct: 6.2,
    villa: { sales: 45, psf: 2262, price: 6500000, rent: 320000, yieldPct: 4.4 },
    url: 'https://www.propertyindex.ae/dubai/meydan',
  },
  'Arjan': {
    sales: 3692, valueAed: 3.87e9, rentals: 14933,
    cohort: 'Apartment', psf: 1565, price: 905000, rent: 60900, yieldPct: 5.5,
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
    sales: 33, valueAed: 0.73e9, rentals: 3245,
    cohort: 'Villa', psf: 1397, price: 13520000, rent: 252000, yieldPct: 5.0,
    note: 'Villa cohort shown — apartment sales (414, median AED 6,825/sqft) are new ultra-prime stock not comparable with the older apartment rental base; villa yield rests on 33 registered villa sales',
    url: 'https://www.propertyindex.ae/dubai/jumeirah',
  },
  // Emaar Beachfront is a subcommunity of the Dubai Harbour master
  // community, and these figures are the Emaar Beachfront node's own. The
  // rest of Dubai Harbour (W Residences, the Dubai Beach Edition, Dubai
  // Harbour Residences, Sobha Seahaven, Damac Bay 1 and 2) sold only
  // off-plan in the window and holds no tenancies, so the community-wide
  // sale median (4,071) set Emaar Beachfront's rents against other
  // projects' launch prices — a 4.2% yield that was not cohort-matched.
  'Emaar Beachfront': {
    sales: 414, valueAed: 2.18e9, rentals: 1557,
    cohort: 'Apartment', psf: 3562, price: 4000000, rent: 170000, yieldPct: 4.8,
    scope: 'subcommunity of Dubai Harbour',
    url: 'https://www.propertyindex.ae/dubai/dubai-harbour-emaar-beachfront',
  },
  // Dubai Islands is registered under its own name (formerly Palm Deira)
  'Dubai Islands': {
    sales: 4671, valueAed: 15.85e9, rentals: 10,
    cohort: 'Apartment', psf: 2730, price: 2850000, rent: null, yieldPct: null,
    note: 'Only 10 registered rentals in window, 4 of them with a valid registered size — too few to set against 4,671 sales, so there is no registry yield; a yield on this card is the desk estimate',
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

  // The narrative is computed from the series: every refresh restates
  // history (13 Oct moved the whole line ~0.2 points), and prose written
  // by hand went stale three times ("peak 220.17", "after three declines",
  // a typed "+12% YoY run" no data file could reproduce).
  const pts = pixSeries;
  const last = pts[pts.length - 1];
  const movesOf = key => pts.slice(1).map((p, k) => ({ month: p.month, chg: (p[key] / pts[k][key] - 1) * 100 }));
  // Length of the run of falls (or rises) that ends at the latest month
  const runAtEnd = (ms, falling) => {
    let n = 0;
    for (let k = ms.length - 1; k >= 0 && (falling ? ms[k].chg < 0 : ms[k].chg > 0); k--) n++;
    return n;
  };
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const moves = movesOf('level');
  const peakAt = pts.reduce((best, p, k) => (p.level > pts[best].level ? k : best), 0);
  const peak = pts[peakAt];
  // The plateau is the run of months around the peak within 1% of it
  let p0 = peakAt, p1 = peakAt;
  while (p0 > 0 && pts[p0 - 1].level >= peak.level * 0.99) p0--;
  while (p1 < pts.length - 1 && pts[p1 + 1].level >= peak.level * 0.99) p1++;
  const plateau = pts.slice(p0, p1 + 1).map(p => p.level);
  const top = p1 - p0 >= 2
    ? `PLATEAUED between ${Math.min(...plateau).toFixed(2)} and ${Math.max(...plateau).toFixed(2)} from ${pts[p0].month} to ${pts[p1].month} (peak ${peak.level.toFixed(2)} in ${peak.month})`
    : `peaked at ${peak.level.toFixed(2)} in ${peak.month}`;
  // The run-up is the months before the plateau (or the peak), so the
  // sentence never says the plateau came "after" its own months
  const runUp = pts.slice(0, p0).map(p => p.yoyPct);
  const before = runUp.length
    ? ` after YoY readings of ${fmtPct(Math.min(...runUp))} to ${fmtPct(Math.max(...runUp))} from ${pts[0].month} to ${pts[p0 - 1].month}`
    : '';
  const declineRun = runAtEnd(moves, true);
  const lastMoves = moves.slice(-4).map(m => `${m.month} ${fmtPct(m.chg)}`).join(', ');
  const after = declineRun
    ? `then fell month on month — ${lastMoves} — ${plural(declineRun, 'consecutive monthly decline')}`
    : `then moved ${lastMoves}`;
  let negYoy = 0;
  for (let k = pts.length - 1; k >= 0 && pts[k].yoyPct < 0; k--) negYoy++;
  const yoyWords = negYoy ? `, YoY negative since ${pts[pts.length - negYoy].month}` : '';
  const lowest = pts.every(p => p.level >= last.level) ? ', and the latest level is the lowest in the 13-month series' : '';

  const aptRun = runAtEnd(movesOf('apartment'), true);
  const aptWords = `${i.apartment.yoyPct < i.villa.yoyPct ? 'the weaker segment' : 'the stronger segment'}${aptRun ? `, down ${plural(aptRun, 'month')} running since ${pts[pts.length - 1 - aptRun].month}` : ''}`;

  const vMoves = movesOf('villa');
  const vLast = vMoves[vMoves.length - 1];
  let villaWords;
  if (vLast.chg > 0) {
    let k = vMoves.length - 2, falls = 0;
    while (k >= 0 && vMoves[k].chg < 0) { falls++; k--; }
    villaWords = `the villa index rose ${fmtPct(vLast.chg)} in ${vLast.month}${falls ? `, its first monthly gain${k >= 0 ? ` since ${vMoves[k].month}` : ' in the series'}, after ${plural(falls, 'consecutive decline')}` : ''}. One month is not a turn; say so if you mention it.`;
  } else if (vLast.chg < 0) {
    villaWords = `the villa index fell ${Math.abs(vLast.chg).toFixed(1)}% in ${vLast.month}, ${plural(runAtEnd(vMoves, true), 'consecutive monthly decline')}.`;
  } else {
    villaWords = `the villa index was flat in ${vLast.month}.`;
  }
  const gap = i.villa.yoyPct - i.apartment.yoyPct;

  return `LIVE MARKET EVIDENCE — the Felicity Price Index and the Dubai Land Department registry.
NAMING: the index is "the Felicity Price Index" (or "our price index") and its source is the Dubai Land Department register. Use no other name for the index or its provider.
Index as of ${PIX_AS_OF}; area medians from registered transactions ${PIX_WINDOW}. Anchor every call to these numbers and cite them.

MARKET STATE (base Jan 2012 = 100):
- Residential index ${i.residential.level} — ${fmtPct(i.residential.yoyPct)} YoY, ${fmtPct(i.residential.momPct)} MoM. The market ${top}${before}, ${after}${yoyWords}${lowest}.
- Apartments ${i.apartment.level} (${fmtPct(i.apartment.yoyPct)} YoY), median ${fmtCount(i.apartment.medianPsf)} AED/sqft — ${aptWords}.
- Villas ${i.villa.level} (${fmtPct(i.villa.yoyPct)} YoY), median ${fmtCount(i.villa.medianPsf)} AED/sqft. ${gap > 0 ? `Villas are holding up better than apartments by about ${gap.toFixed(1)} points YoY, and ` : gap < 0 ? `Villas are weaker than apartments by about ${Math.abs(gap).toFixed(1)} points YoY, and ` : ''}${villaWords}
- ${fmtCount(i.residential.txCount)} registered residential sales stand behind the ${PIX_AS_OF} index reading (apartments ${fmtCount(i.apartment.txCount)}, villas ${fmtCount(i.villa.txCount)}). That is the index's sample for one month — not a monthly average, and not every registration in the month.

AREA REGISTRY MEDIANS (apartment cohort unless noted; gross yield = registered rent PSF / registered sale PSF, excludes service charges and voids):
${rows}

YIELD RANKINGS (use these before calling anything "highest" or "lowest" — do not rank by eye):
- Apartments: ${aptRank}
- Villas: ${villaRank}

Rules for using this evidence:
- The market is CORRECTING, not uniformly bullish. Never describe it as broadly rising.
- Historical analogs: you may describe how a prior Dubai cycle behaved in words, but you may not attach a percentage, AED figure or date to it unless that figure appears in this evidence. The 13-month index path above is the only price history you have. Never write "last time X happened, Y fell Z%" with an invented Z.
- Yields and prices above are registered medians, not projections for a specific unit. Say so when it matters.
- For any yield comparison, quote the YIELD RANKINGS above — they are computed from the area rows on every refresh. Do not carry a yield from memory or from an earlier answer.
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
