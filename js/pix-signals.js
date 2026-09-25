// ═══════════════════════════════════════════════════════════
// PIX SIGNALS — Real market signals from registered DLD evidence
// ═══════════════════════════════════════════════════════════
//
// Source: PropertyIndex signal engine over Dubai Land Department
// registered transactions. Snapshot 2026-09-25; open signals detected
// through 2026-09-24.
//
// Every row below is an actual detected event with a real detection
// date, a real registered value, and (where the signal type defines
// one) a real comparison baseline. Nothing here is authored,
// estimated, or illustrative. `area` is the community label for the
// engine's community_slug, added for display only.
//
// Signal-type semantics (they differ — do not mix them up):
//   top_sale       value = registered sale price (AED); baseline, when
//                  present, is the prior top sale for that entity.
//   record_psf     value = new record registered PSF; baseline = the
//                  previous record. magnitudePct = the increase.
//   momentum       value = registered sales in the last 3 months;
//                  baseline = the prior 3 months. magnitudePct = the
//                  increase in velocity. psf = current registered PSF.
//   psf_move       value = current registered PSF; baseline = the PSF
//                  on baselineDate. magnitudePct = the move, signed.
//   yield_leader   value = project gross yield as a decimal (0.1879 =
//                  18.79%). These are the extreme top of the yield
//                  distribution, not typical returns.
//   below_trend    value = current registered PSF; baseline = the
//                  project's own 12-month average PSF. magnitudePct =
//                  the discount. Persistent (streak ≥ 3 observations).
//   discount_trade value = registered PSF of a single trade; baseline
//                  = the project's median PSF. magnitudePct = the
//                  discount.
// ═══════════════════════════════════════════════════════════

export const PIX_SIGNALS_AS_OF = '2026-09-24';
export const PIX_SIGNALS_SOURCE = 'PropertyIndex signal engine over DLD registered transactions';

export const SIGNAL_TYPES = {
  top_sale:       { label: 'Top Sale',       tone: 'bullish' },
  record_psf:     { label: 'Record PSF',     tone: 'bullish' },
  momentum:       { label: 'Sales Momentum', tone: 'bullish' },
  psf_move:       { label: 'PSF Move',       tone: 'watch'   },
  yield_leader:   { label: 'Yield Leader',   tone: 'watch'   },
  below_trend:    { label: 'Below Trend',    tone: 'bearish' },
  discount_trade: { label: 'Discount Trade', tone: 'bearish' },
};

export const pixSignals = [
  // ── Top registered sales ──
  { type: 'top_sale', entity: 'Como Residences', area: 'Palm Jumeirah', community: 'palm-jumeirah',
    detectedOn: '2026-09-22', direction: 1, value: 71241800, baseline: null, psf: 6083.09, beds: '5 Bed' },
  { type: 'top_sale', entity: 'Muraba Veil', area: 'Al Wasl', community: 'al-wasl',
    detectedOn: '2026-09-11', direction: 1, value: 36600000, baseline: null, psf: 7392.17, beds: '3 Bed' },
  { type: 'top_sale', entity: 'Block B3', area: 'Jumeirah', community: 'jumeirah',
    detectedOn: '2026-09-10', direction: 1, value: 36500000, baseline: null, psf: 6258.35, beds: '4 Bed' },
  { type: 'top_sale', entity: 'Redwood Avenue', area: 'Jumeirah Golf Estates', community: 'jumeirah-golf-estates',
    detectedOn: '2026-09-15', direction: 1, value: 34000000, baseline: null, psf: 2495.03, beds: 'Villa' },
  { type: 'top_sale', entity: 'District One West Phase I', area: 'MBR City', community: 'mohammed-bin-rashid-city',
    detectedOn: '2026-09-19', direction: 1, value: 31500000, baseline: null, psf: 2942.07, beds: 'Villa' },
  { type: 'top_sale', entity: 'Rosewood Residences', area: 'Jumeirah', community: 'jumeirah',
    detectedOn: '2026-09-12', direction: 1, value: 29830000, baseline: null, psf: 7679.92, beds: '3 Bed' },
  { type: 'top_sale', entity: 'Five Palm Jumeirah', area: 'Palm Jumeirah', community: 'palm-jumeirah',
    detectedOn: '2026-09-18', direction: 1, value: 25000000, baseline: null, psf: 2031.63, beds: '5 Bed' },

  // ── New record price per square foot ──
  { type: 'record_psf', entity: 'Nad Al Sheba 1', area: 'Nad Al Sheba', community: 'nad-al-sheba',
    detectedOn: '2026-09-10', direction: 1, value: 3498.86, baseline: 1283.02, magnitudePct: 172.71 },
  { type: 'record_psf', entity: 'Al Mizhar 2', area: 'Al Mizhar', community: 'al-mizhar',
    detectedOn: '2026-09-19', direction: 1, value: 673.47, baseline: 540.82, magnitudePct: 24.53 },
  { type: 'record_psf', entity: 'Evershine Gardens', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-09-16', direction: 1, value: 1044.09, baseline: 860.00, magnitudePct: 21.41 },
  { type: 'record_psf', entity: 'Terraced Apartments 1', area: 'Motor City', community: 'motor-city',
    detectedOn: '2026-09-15', direction: 1, value: 1189.25, baseline: 1026.36, magnitudePct: 15.87 },
  { type: 'record_psf', entity: 'Mirabella 2', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-09-10', direction: 1, value: 1647.93, baseline: 1482.34, magnitudePct: 11.17 },
  { type: 'record_psf', entity: 'Altia One', area: 'Dubai Silicon Oasis', community: 'dubai-silicon-oasis',
    detectedOn: '2026-09-10', direction: 1, value: 1886.93, baseline: 1745.29, magnitudePct: 8.12 },
  { type: 'record_psf', entity: 'Coursetia', area: 'DAMAC Hills 2', community: 'damac-hills-2',
    detectedOn: '2026-09-12', direction: 1, value: 1435.00, baseline: 1320.52, magnitudePct: 8.67 },
  { type: 'record_psf', entity: 'Summer', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-09-10', direction: 1, value: 1912.93, baseline: 1775.06, magnitudePct: 7.77 },
  { type: 'record_psf', entity: 'Binghatti Skyflame 2', area: 'Majan', community: 'majan',
    detectedOn: '2026-09-10', direction: 1, value: 1921.70, baseline: 1809.92, magnitudePct: 6.18 },
  { type: 'record_psf', entity: 'Mudon Al Ranim 6', area: 'Mudon', community: 'mudon',
    detectedOn: '2026-09-10', direction: 1, value: 2253.05, baseline: 2128.01, magnitudePct: 5.88 },
  { type: 'record_psf', entity: 'Al Majara 2', area: 'Dubai Marina', community: 'dubai-marina',
    detectedOn: '2026-09-12', direction: 1, value: 2508.96, baseline: 2378.17, magnitudePct: 5.50 },
  { type: 'record_psf', entity: 'Address Residences Zabeel 3', area: 'Zabeel', community: 'zabeel',
    detectedOn: '2026-09-10', direction: 1, value: 3817.70, baseline: 3645.98, magnitudePct: 4.71 },

  // ── Sales velocity: last 3 months against the prior 3 ──
  // Parent project nodes only — the engine also flags their individual
  // buildings, which would double-count the same registrations.
  { type: 'momentum', entity: 'Jebel Ali Village', area: 'Jebel Ali', community: 'jebel-ali',
    detectedOn: '2026-09-24', direction: 1, value: 177, baseline: 6, magnitudePct: 2850, streak: 14, psf: 1447.90 },
  { type: 'momentum', entity: 'Eltiera Views', area: 'Jumeirah Islands', community: 'jumeirah-islands',
    detectedOn: '2026-09-24', direction: 1, value: 559, baseline: 33, magnitudePct: 1593.9, streak: 14, psf: 2542.17 },
  { type: 'momentum', entity: 'Azizi Venice 6', area: 'Dubai South', community: 'dubai-south-dubai-world-central',
    detectedOn: '2026-09-24', direction: 1, value: 815, baseline: 67, magnitudePct: 1116.4, streak: 14, psf: 1957.40 },
  { type: 'momentum', entity: 'Azizi Venice 12', area: 'Dubai South', community: 'dubai-south-dubai-world-central',
    detectedOn: '2026-09-24', direction: 1, value: 528, baseline: 37, magnitudePct: 1327.0, streak: 14, psf: 1737.42 },
  { type: 'momentum', entity: 'Azizi Venice 15', area: 'Dubai South', community: 'dubai-south-dubai-world-central',
    detectedOn: '2026-09-24', direction: 1, value: 642, baseline: 69, magnitudePct: 830.4, streak: 14, psf: 1712.79 },
  { type: 'momentum', entity: 'Boulevard Park 1', area: 'Wasl Gate', community: 'wasl-gate',
    detectedOn: '2026-09-24', direction: 1, value: 154, baseline: 12, magnitudePct: 1183.3, streak: 14, psf: 1743.94 },
  { type: 'momentum', entity: 'Azizi Milan 30', area: 'City of Arabia', community: 'city-of-arabia',
    detectedOn: '2026-09-24', direction: 1, value: 262, baseline: 23, magnitudePct: 1039.1, streak: 14, psf: 1573.19 },

  // ── Registered PSF moves against the project's prior print ──
  { type: 'psf_move', entity: 'JLT Cluster C', area: 'JLT', community: 'jumeirah-lake-towers',
    detectedOn: '2026-09-18', direction: 1, value: 2497.67, baseline: 1424.89, baselineDate: '2026-09-16', magnitudePct: 75.29, salesL12m: 70 },
  { type: 'psf_move', entity: 'Al Mizhar 2', area: 'Al Mizhar', community: 'al-mizhar',
    detectedOn: '2026-09-19', direction: 1, value: 630.79, baseline: 332.05, baselineDate: '2026-09-18', magnitudePct: 89.97, salesL12m: 20 },
  { type: 'psf_move', entity: '15 Cascade', area: 'Motor City', community: 'motor-city',
    detectedOn: '2026-09-15', direction: -1, value: 921.76, baseline: 1673.55, baselineDate: '2026-09-14', magnitudePct: -44.92, salesL12m: 300 },
  { type: 'psf_move', entity: 'Binghatti Amberhall', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-09-11', direction: 1, value: 1150.08, baseline: 883.83, baselineDate: '2026-09-10', magnitudePct: 30.12, salesL12m: 660 },
  { type: 'psf_move', entity: 'Le Ciel', area: 'Jumeirah', community: 'jumeirah',
    detectedOn: '2026-09-18', direction: 1, value: 3469.02, baseline: 2234.09, baselineDate: '2026-09-16', magnitudePct: 55.28, salesL12m: 31 },
  { type: 'psf_move', entity: 'Business Tower', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-09-19', direction: 1, value: 2829.89, baseline: 1772.62, baselineDate: '2026-09-18', magnitudePct: 59.64, salesL12m: 20 },

  // ── Highest registered gross yields (top of distribution) ──
  { type: 'yield_leader', entity: 'Dubai Jewel Tower', area: 'Dubai Internet City', community: 'dubai-internet-city',
    detectedOn: '2026-09-24', direction: 1, value: 0.1879, baseline: null, streak: 14 },
  { type: 'yield_leader', entity: 'Platinum One', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-09-24', direction: 1, value: 0.1521, baseline: null, streak: 14 },
  { type: 'yield_leader', entity: 'Diamond Business Center Block A', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-09-24', direction: 1, value: 0.1412, baseline: null, streak: 14 },
  { type: 'yield_leader', entity: 'Golf Panorama B', area: 'DAMAC Hills', community: 'damac-hills',
    detectedOn: '2026-09-24', direction: 1, value: 0.1335, baseline: null, streak: 14 },
  { type: 'yield_leader', entity: 'Golf Panorama', area: 'DAMAC Hills', community: 'damac-hills',
    detectedOn: '2026-09-24', direction: 1, value: 0.1201, baseline: null, streak: 14 },
  { type: 'yield_leader', entity: 'Ashton Park', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-09-24', direction: 1, value: 0.1180, baseline: null, streak: 14 },
  { type: 'yield_leader', entity: 'Armada Tower 2', area: 'JLT', community: 'jumeirah-lake-towers',
    detectedOn: '2026-09-24', direction: 1, value: 0.1179, baseline: null, streak: 14 },
  { type: 'yield_leader', entity: 'Belvedere Residences', area: 'International City', community: 'international-city',
    detectedOn: '2026-09-24', direction: 1, value: 0.1162, baseline: null, streak: 13 },

  // ── Projects printing persistently below their own 12-month average ──
  { type: 'below_trend', entity: 'Rukan Tower A', area: 'Rukan', community: 'rukan',
    detectedOn: '2026-09-24', direction: -1, value: 575.67, baseline: 1160.29, magnitudePct: -50.39, streak: 14, salesL12m: 27, offplanPct: 37 },
  { type: 'below_trend', entity: 'Mayfair Residency', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-09-24', direction: -1, value: 736.89, baseline: 1406.26, magnitudePct: -47.60, streak: 14, salesL12m: 22, offplanPct: 0 },
  { type: 'below_trend', entity: 'Binghatti Royale', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-09-24', direction: -1, value: 1479.93, baseline: 2099.33, magnitudePct: -29.50, streak: 14, salesL12m: 150, offplanPct: 18 },
  { type: 'below_trend', entity: 'Acacia Avenues', area: 'Al Sufouh', community: 'al-sufouh',
    detectedOn: '2026-09-24', direction: -1, value: 654.29, baseline: 1431.76, magnitudePct: -54.30, streak: 14, salesL12m: 14, offplanPct: 0 },
  { type: 'below_trend', entity: 'Al Waleed Garden', area: 'Al Jaddaf', community: 'al-jaddaf',
    detectedOn: '2026-09-24', direction: -1, value: 722.21, baseline: 1525.19, magnitudePct: -52.65, streak: 13, salesL12m: 15, offplanPct: 0 },
  { type: 'below_trend', entity: 'Saba Tower 1', area: 'JLT', community: 'jumeirah-lake-towers',
    detectedOn: '2026-09-24', direction: -1, value: 1080.98, baseline: 2245.55, magnitudePct: -51.86, streak: 14, salesL12m: 13, offplanPct: 0 },

  // ── Single trades registered materially below the project median ──
  { type: 'discount_trade', entity: 'Burj Khalifa', area: 'Downtown Dubai', community: 'downtown-dubai',
    detectedOn: '2026-09-16', direction: -1, value: 1324.16, baseline: 2699.98, magnitudePct: -50.96 },
  { type: 'discount_trade', entity: 'One Beverly', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-09-10', direction: -1, value: 750.83, baseline: 1586.83, magnitudePct: -52.68 },
  { type: 'discount_trade', entity: 'Amargo', area: 'DAMAC Hills 2', community: 'damac-hills-2',
    detectedOn: '2026-09-18', direction: -1, value: 486.02, baseline: 1026.37, magnitudePct: -52.65 },
  { type: 'discount_trade', entity: 'Binghatti Skyflame 1', area: 'Majan', community: 'majan',
    detectedOn: '2026-09-10', direction: -1, value: 806.90, baseline: 1372.83, magnitudePct: -41.22 },
  { type: 'discount_trade', entity: 'MBL Royal', area: 'JLT', community: 'jumeirah-lake-towers',
    detectedOn: '2026-09-16', direction: -1, value: 1035.51, baseline: 2012.96, magnitudePct: -48.56 },
  { type: 'discount_trade', entity: 'Binghatti Skyterraces', area: 'Motor City', community: 'motor-city',
    detectedOn: '2026-09-10', direction: -1, value: 1151.96, baseline: 1885.53, magnitudePct: -38.91 },
  { type: 'discount_trade', entity: 'The Grand', area: 'Dubai Creek Harbour', community: 'dubai-creek-harbour-the-lagoons',
    detectedOn: '2026-09-18', direction: -1, value: 1610.58, baseline: 2583.34, magnitudePct: -37.65 },
  { type: 'discount_trade', entity: 'Binghatti Onyx', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-09-11', direction: -1, value: 527.58, baseline: 1262.97, magnitudePct: -58.23 },
  { type: 'discount_trade', entity: 'Seven Palm', area: 'Palm Jumeirah', community: 'palm-jumeirah',
    detectedOn: '2026-09-18', direction: -1, value: 2254.67, baseline: 3076.26, magnitudePct: -26.71 },
  { type: 'discount_trade', entity: 'The Matrix', area: 'Dubai Sports City', community: 'dubai-sports-city',
    detectedOn: '2026-09-12', direction: -1, value: 866.53, baseline: 1315.06, magnitudePct: -34.11 },
  { type: 'discount_trade', entity: 'The Fields', area: 'MBR City', community: 'mohammed-bin-rashid-city',
    detectedOn: '2026-09-12', direction: -1, value: 1290.50, baseline: 1604.84, magnitudePct: -19.59 },
];

// ── Display helpers ──
function aed(v) {
  if (v >= 1e6) return `AED ${(v / 1e6).toFixed(2)}M`;
  return `AED ${Math.round(v).toLocaleString('en-US')}`;
}

function psf(v) {
  return `${v.toLocaleString('en-US', { maximumFractionDigits: 0 })} AED/sqft`;
}

function times(magnitudePct) {
  return `${(1 + magnitudePct / 100).toFixed(1)}×`;
}

// Headline + supporting line, derived purely from the registered values
export function signalCopy(s) {
  switch (s.type) {
    case 'top_sale':
      return {
        headline: `${aed(s.value)} registered sale`,
        detail: s.baseline
          ? `Prior top sale ${aed(s.baseline)} — this trade came in ${Math.abs(s.magnitudePct).toFixed(1)}% ${s.magnitudePct < 0 ? 'below' : 'above'} it.`
          : `Highest registered sale detected for this project in the current window${s.psf ? ` — ${s.beds ? s.beds + ', ' : ''}${psf(s.psf)}` : ''}.`,
      };
    case 'record_psf':
      return {
        headline: `New record ${psf(s.value)}`,
        detail: `Previous record ${psf(s.baseline)} — up ${s.magnitudePct.toFixed(1)}%.`,
      };
    case 'momentum':
      return {
        headline: `${s.value.toLocaleString('en-US')} sales in 3 months, ${times(s.magnitudePct)} the prior 3`,
        detail: `${s.baseline.toLocaleString('en-US')} registered in the previous quarter. Current registered PSF ${psf(s.psf)}. Held for ${s.streak} consecutive observations.`,
      };
    case 'psf_move':
      return {
        headline: `${psf(s.value)} — ${s.magnitudePct > 0 ? 'up' : 'down'} ${Math.abs(s.magnitudePct).toFixed(1)}%`,
        detail: `Against ${psf(s.baseline)} on ${s.baselineDate}. ${s.salesL12m.toLocaleString('en-US')} registered sales in the last 12 months.`,
      };
    case 'yield_leader':
      return {
        headline: `${(s.value * 100).toFixed(2)}% gross yield`,
        detail: `Registered rents against registered sale prices. Held for ${s.streak} consecutive observations. Top of the yield distribution, not a typical return.`,
      };
    case 'below_trend':
      return {
        headline: `${Math.abs(s.magnitudePct).toFixed(1)}% below its own 12-month average`,
        detail: `Registering at ${psf(s.value)} against a ${psf(s.baseline)} trailing average, for ${s.streak} consecutive observations. ${s.salesL12m} sales in the last 12 months, ${s.offplanPct}% off-plan.`,
      };
    case 'discount_trade':
      return {
        headline: `${Math.abs(s.magnitudePct).toFixed(1)}% below the project median`,
        detail: `Registered at ${psf(s.value)} against a project median of ${psf(s.baseline)}.`,
      };
    default:
      return { headline: '', detail: '' };
  }
}

// Whole days between the detection date and now, rendered compactly
export function signalAge(detectedOn, now = new Date()) {
  const d = new Date(detectedOn + 'T00:00:00Z');
  const days = Math.floor((now - d) / 86400000);
  if (!isFinite(days) || days < 0) return 'today';
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// The engine's community_slug is the canonical /dubai/<slug> node
export function signalUrl(s) {
  return s.community
    ? `https://www.propertyindex.ae/dubai/${s.community}`
    : 'https://www.propertyindex.ae';
}

// Compact one-line summary used by the map sidebar
export function signalTone(s) {
  return SIGNAL_TYPES[s.type]?.tone || 'neutral';
}

// ── Shared AI context ──
// Injected into the Ask Felicity and newsletter-brief system prompts so the
// model cites real detected events instead of inventing market anecdotes.
export function buildSignalContext() {
  const group = t => pixSignals.filter(x => x.type === t)
    .map(x => {
      const c = signalCopy(x);
      return `  - ${x.entity} (${x.area || 'Dubai'}), ${x.detectedOn}: ${c.headline}. ${c.detail}`;
    }).join('\n');

  return `LIVE MARKET SIGNALS — detected by the PropertyIndex signal engine over DLD registered transactions, through ${PIX_SIGNALS_AS_OF}. These are real registered events. Cite them by name and date; never invent a comparable anecdote.

TOP REGISTERED SALES:
${group('top_sale')}

NEW RECORD PRICE PER SQFT:
${group('record_psf')}

SALES VELOCITY (registered sales, last 3 months vs the prior 3 — off-plan launches registering in bulk, not price strength):
${group('momentum')}

REGISTERED PSF MOVES (project-level, signed):
${group('psf_move')}

HIGHEST REGISTERED GROSS YIELDS (extreme top of the distribution — not typical returns):
${group('yield_leader')}

PROJECTS PRINTING PERSISTENTLY BELOW THEIR OWN 12-MONTH AVERAGE (evidence of the correction):
${group('below_trend')}

SINGLE TRADES REGISTERED BELOW THE PROJECT MEDIAN:
${group('discount_trade')}`;
}
