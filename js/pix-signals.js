// ═══════════════════════════════════════════════════════════
// PIX SIGNALS — Real market signals from registered DLD evidence
// ═══════════════════════════════════════════════════════════
//
// Source: PropertyIndex signal engine over Dubai Land Department
// registered transactions. Snapshot 2026-09-14; open signals detected
// through 2026-09-13.
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
//                  = the expected PSF for the cohort. magnitudePct =
//                  the discount.
// ═══════════════════════════════════════════════════════════

export const PIX_SIGNALS_AS_OF = '2026-09-13';
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
  { type: 'top_sale', entity: 'Muraba Veil', area: 'Al Wasl', community: 'al-wasl',
    detectedOn: '2026-09-11', direction: 1, value: 36600000, baseline: null, psf: 7392.17, beds: '3 Bed' },
  { type: 'top_sale', entity: 'Block B3', area: 'Jumeirah', community: 'jumeirah',
    detectedOn: '2026-09-10', direction: 1, value: 36500000, baseline: null, psf: 6258.35, beds: '4 Bed' },
  { type: 'top_sale', entity: 'Rosewood Residences', area: 'Jumeirah', community: 'jumeirah',
    detectedOn: '2026-09-12', direction: 1, value: 29830000, baseline: null, psf: 7679.92, beds: '3 Bed' },

  // ── New record price per square foot ──
  { type: 'record_psf', entity: 'Nad Al Sheba 1', area: 'Nad Al Sheba', community: 'nad-al-sheba',
    detectedOn: '2026-09-10', direction: 1, value: 3498.86, baseline: 1283.02, magnitudePct: 172.71 },
  { type: 'record_psf', entity: 'Mirabella 2', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-09-10', direction: 1, value: 1647.93, baseline: 1482.34, magnitudePct: 11.17 },
  { type: 'record_psf', entity: 'Altia One', area: 'Dubai Silicon Oasis', community: 'dubai-silicon-oasis',
    detectedOn: '2026-09-10', direction: 1, value: 1886.93, baseline: 1745.29, magnitudePct: 8.12 },
  { type: 'record_psf', entity: 'Binghatti Skyflame 2', area: 'Majan', community: 'majan',
    detectedOn: '2026-09-10', direction: 1, value: 1921.70, baseline: 1809.92, magnitudePct: 6.18 },
  { type: 'record_psf', entity: 'Summer', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-09-10', direction: 1, value: 1912.93, baseline: 1775.06, magnitudePct: 7.77 },
  { type: 'record_psf', entity: 'Coursetia', area: 'DAMAC Hills 2', community: 'damac-hills-2',
    detectedOn: '2026-09-12', direction: 1, value: 1435.00, baseline: 1320.52, magnitudePct: 8.67 },
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
    detectedOn: '2026-09-13', direction: 1, value: 177, baseline: 6, magnitudePct: 2850, streak: 4, psf: 1482.47 },
  { type: 'momentum', entity: 'Eltiera Views', area: 'Jumeirah Islands', community: 'jumeirah-islands',
    detectedOn: '2026-09-13', direction: 1, value: 559, baseline: 33, magnitudePct: 1593.9, streak: 4, psf: 2529.39 },
  { type: 'momentum', entity: 'Azizi Venice 6', area: 'Dubai South', community: 'dubai-south-dubai-world-central',
    detectedOn: '2026-09-13', direction: 1, value: 815, baseline: 67, magnitudePct: 1116.4, streak: 4, psf: 1946.62 },
  { type: 'momentum', entity: 'Azizi Venice 12', area: 'Dubai South', community: 'dubai-south-dubai-world-central',
    detectedOn: '2026-09-13', direction: 1, value: 528, baseline: 37, magnitudePct: 1327.0, streak: 4, psf: 1752.49 },
  { type: 'momentum', entity: 'Boulevard Park 1', area: 'Wasl Gate', community: 'wasl-gate',
    detectedOn: '2026-09-13', direction: 1, value: 154, baseline: 12, magnitudePct: 1183.3, streak: 4, psf: 1745.08 },
  { type: 'momentum', entity: 'Azizi Venice 15 Building B', area: 'Dubai South', community: 'dubai-south-dubai-world-central',
    detectedOn: '2026-09-13', direction: 1, value: 524, baseline: 50, magnitudePct: 948.0, streak: 4, psf: 1659.38 },

  // ── Registered PSF moves against the project's prior print ──
  { type: 'psf_move', entity: 'Binghatti Amberhall', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-09-11', direction: 1, value: 1150.08, baseline: 883.83, baselineDate: '2026-09-10', magnitudePct: 30.12, salesL12m: 660 },
  { type: 'psf_move', entity: 'Al Waleed Garden', area: 'Al Jaddaf', community: 'al-jaddaf',
    detectedOn: '2026-09-11', direction: -1, value: 722.21, baseline: 1524.23, baselineDate: '2026-09-10', magnitudePct: -52.62, salesL12m: 15 },
  { type: 'psf_move', entity: 'Forest City Tower', area: 'Majan', community: 'majan',
    detectedOn: '2026-09-12', direction: 1, value: 1088.37, baseline: 851.58, baselineDate: '2026-09-11', magnitudePct: 27.81, salesL12m: 106 },
  { type: 'psf_move', entity: 'Binghatti Onyx', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-09-11', direction: -1, value: 912.05, baseline: 1296.52, baselineDate: '2026-09-10', magnitudePct: -29.65, salesL12m: 74 },
  { type: 'psf_move', entity: 'Verdana 10', area: 'Dubai Investment Park', community: 'dubai-investment-park-dip',
    detectedOn: '2026-09-12', direction: 1, value: 1039.67, baseline: 823.80, baselineDate: '2026-09-11', magnitudePct: 26.20, salesL12m: 128 },
  { type: 'psf_move', entity: 'Le Blanc Residence by Imtiaz', area: 'Dubailand Residence Complex', community: 'dubai-land-residence-complex',
    detectedOn: '2026-09-12', direction: -1, value: 1199.41, baseline: 1545.27, baselineDate: '2026-09-11', magnitudePct: -22.38, salesL12m: 293 },

  // ── Highest registered gross yields (top of distribution) ──
  { type: 'yield_leader', entity: 'Hera Tower', area: 'Dubai Sports City', community: 'dubai-sports-city',
    detectedOn: '2026-09-13', direction: 1, value: 0.1150, baseline: null, streak: 3 },
  { type: 'yield_leader', entity: 'Dubai Jewel Tower', area: 'Dubai Internet City', community: 'dubai-internet-city',
    detectedOn: '2026-09-13', direction: 1, value: 0.1879, baseline: null, streak: 4 },
  { type: 'yield_leader', entity: 'Diamond Business Center Block A', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-09-13', direction: 1, value: 0.1412, baseline: null, streak: 4 },
  { type: 'yield_leader', entity: 'Armada Tower 2', area: 'JLT', community: 'jumeirah-lake-towers',
    detectedOn: '2026-09-13', direction: 1, value: 0.1184, baseline: null, streak: 4 },
  { type: 'yield_leader', entity: 'Ashton Park', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-09-13', direction: 1, value: 0.1197, baseline: null, streak: 4 },
  { type: 'yield_leader', entity: 'Platinum One', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-09-13', direction: 1, value: 0.1521, baseline: null, streak: 4 },
  { type: 'yield_leader', entity: 'Belvedere Residences', area: 'International City', community: 'international-city',
    detectedOn: '2026-09-13', direction: 1, value: 0.1162, baseline: null, streak: 3 },
  { type: 'yield_leader', entity: 'Golf Panorama', area: 'DAMAC Hills', community: 'damac-hills',
    detectedOn: '2026-09-13', direction: 1, value: 0.1201, baseline: null, streak: 4 },

  // ── Projects printing persistently below their own 12-month average ──
  { type: 'below_trend', entity: 'Rukan Tower A', area: 'Rukan', community: 'rukan',
    detectedOn: '2026-09-13', direction: -1, value: 575.67, baseline: 1160.29, magnitudePct: -50.39, streak: 4, salesL12m: 27, offplanPct: 37 },
  { type: 'below_trend', entity: 'Binghatti Royale', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-09-13', direction: -1, value: 1426.78, baseline: 2095.65, magnitudePct: -31.92, streak: 4, salesL12m: 151, offplanPct: 18.5 },
  { type: 'below_trend', entity: 'Binghatti Onyx', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-09-13', direction: -1, value: 912.05, baseline: 1439.47, magnitudePct: -36.64, streak: 3, salesL12m: 74, offplanPct: 1.4 },
  { type: 'below_trend', entity: 'Mayfair Residency', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-09-13', direction: -1, value: 736.89, baseline: 1406.26, magnitudePct: -47.60, streak: 4, salesL12m: 22, offplanPct: 0 },
  { type: 'below_trend', entity: 'Acacia Avenues', area: 'Al Sufouh', community: 'al-sufouh',
    detectedOn: '2026-09-13', direction: -1, value: 654.29, baseline: 1431.76, magnitudePct: -54.30, streak: 4, salesL12m: 14, offplanPct: 0 },
  { type: 'below_trend', entity: 'Al Waleed Garden', area: 'Al Jaddaf', community: 'al-jaddaf',
    detectedOn: '2026-09-13', direction: -1, value: 722.21, baseline: 1525.19, magnitudePct: -52.65, streak: 3, salesL12m: 15, offplanPct: 0 },

  // ── Single trades registered materially below cohort trend ──
  { type: 'discount_trade', entity: 'One Beverly', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-09-10', direction: -1, value: 750.83, baseline: 1586.83, magnitudePct: -52.68 },
  { type: 'discount_trade', entity: 'Binghatti Skyflame 1', area: 'Majan', community: 'majan',
    detectedOn: '2026-09-10', direction: -1, value: 806.90, baseline: 1372.83, magnitudePct: -41.22 },
  { type: 'discount_trade', entity: 'Binghatti Skyterraces', area: 'Motor City', community: 'motor-city',
    detectedOn: '2026-09-10', direction: -1, value: 1151.96, baseline: 1885.53, magnitudePct: -38.91 },
  { type: 'discount_trade', entity: 'Binghatti Onyx', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-09-11', direction: -1, value: 527.58, baseline: 1262.97, magnitudePct: -58.23 },
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
        headline: `${Math.abs(s.magnitudePct).toFixed(1)}% below cohort trend`,
        detail: `Registered at ${psf(s.value)} against an expected ${psf(s.baseline)}.`,
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

SINGLE TRADES REGISTERED BELOW COHORT TREND:
${group('discount_trade')}`;
}
