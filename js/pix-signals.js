// ═══════════════════════════════════════════════════════════
// PIX SIGNALS — Real market signals from registered DLD evidence
// ═══════════════════════════════════════════════════════════
//
// Source: PropertyIndex signal engine over Dubai Land Department
// registered transactions. Snapshot 2026-08-25.
//
// Every row below is an actual detected event with a real detection
// date, a real registered value, and (where the signal type defines
// one) a real comparison baseline. Nothing here is authored,
// estimated, or illustrative.
//
// Signal-type semantics (they differ — do not mix them up):
//   top_sale       value = registered sale price (AED). baseline, when
//                  present, is the prior top sale for that entity.
//   record_psf     value = new record registered PSF; baseline = the
//                  previous record. magnitude = the increase.
//   yield_leader   value = project gross yield as a decimal (0.1822 =
//                  18.22%). These are the extreme top of the yield
//                  distribution, not typical returns.
//   discount_trade value = registered PSF of the trade; baseline = the
//                  expected PSF for the cohort. magnitude = discount.
// ═══════════════════════════════════════════════════════════

export const PIX_SIGNALS_AS_OF = '2026-08-25';
export const PIX_SIGNALS_SOURCE = 'PropertyIndex signal engine over DLD registered transactions';

export const SIGNAL_TYPES = {
  top_sale:       { label: 'Top Sale',       tone: 'bullish' },
  record_psf:     { label: 'Record PSF',     tone: 'bullish' },
  yield_leader:   { label: 'Yield Leader',   tone: 'watch'   },
  discount_trade: { label: 'Discount Trade', tone: 'bearish' },
};

export const pixSignals = [
  // ── Top registered sales ──
  { type: 'top_sale', entity: 'ORLA Infinity by OMNIYAT', area: 'Palm Jumeirah', community: 'palm-jumeirah',
    detectedOn: '2026-08-13', direction: 1, value: 79000000, baseline: null },
  { type: 'top_sale', entity: 'Emirates Hills', area: 'Al Thanayah Fourth', community: 'emirates-hills',
    detectedOn: '2026-08-15', direction: -1, value: 75000000, baseline: 97750000, magnitudePct: -23.27 },
  { type: 'top_sale', entity: 'Bugatti Residences by Binghatti', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-08-19', direction: 1, value: 63000000, baseline: null },
  { type: 'top_sale', entity: 'Aman Residences Dubai', area: 'Jumeirah Second', community: 'jumeirah',
    detectedOn: '2026-08-12', direction: 1, value: 57555304, baseline: null },
  { type: 'top_sale', entity: 'Elysian Mansions', area: 'Al Hebiah Fourth', community: 'tilal-al-ghaf',
    detectedOn: '2026-08-25', direction: 1, value: 48350000, baseline: 39000000, magnitudePct: 23.97 },
  { type: 'top_sale', entity: 'Liv Waterside', area: 'Marsa Dubai', community: 'dubai-marina',
    detectedOn: '2026-08-18', direction: 1, value: 30612500, baseline: null },
  { type: 'top_sale', entity: 'Address Hillcrest', area: 'Hadaeq Sheikh Mohammed Bin Rashid', community: 'dubai-hills-estate',
    detectedOn: '2026-08-20', direction: 1, value: 26000000, baseline: null },

  // ── New record price per square foot ──
  { type: 'record_psf', entity: 'Burj Binghatti Jacob & Co. Residences', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-08-14', direction: 1, value: 6406.32, baseline: 5260.64, magnitudePct: 21.78 },
  { type: 'record_psf', entity: 'World Trade Centre Residences', area: 'Trade Center Second', community: '',
    detectedOn: '2026-08-19', direction: 1, value: 3198.79, baseline: 2843.37, magnitudePct: 12.50 },
  { type: 'record_psf', entity: 'Regalia', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-08-15', direction: 1, value: 2879.06, baseline: 2652.52, magnitudePct: 8.54 },
  { type: 'record_psf', entity: 'Package 1A', area: 'Al Thanyah Fifth', community: 'jumeirah-park',
    detectedOn: '2026-08-19', direction: 1, value: 2229.01, baseline: 1645.73, magnitudePct: 35.44 },
  { type: 'record_psf', entity: 'ZaZEN One', area: 'Al Barsha South Fifth', community: 'jumeirah-village-triangle',
    detectedOn: '2026-08-14', direction: 1, value: 1751.34, baseline: 1425.51, magnitudePct: 22.86 },
  // Record PSF inside areas tracked on the Dubai Intel tab
  { type: 'record_psf', entity: 'Mercer House', area: 'Al Thanyah Fifth', community: 'dmcc-ez1',
    detectedOn: '2026-08-25', direction: 1, value: 3091.27, baseline: 3024.57, magnitudePct: 2.21 },
  { type: 'record_psf', entity: 'Royal Oceanic Tower', area: 'Marsa Dubai', community: 'dubai-marina',
    detectedOn: '2026-08-20', direction: 1, value: 2279.21, baseline: 2131.32, magnitudePct: 6.94 },
  { type: 'record_psf', entity: 'Samana Waves', area: 'Al Barsha South Fourth', community: 'jumeirah-village-circle',
    detectedOn: '2026-08-20', direction: 1, value: 2006.23, baseline: 1851.69, magnitudePct: 8.35 },
  { type: 'record_psf', entity: 'Diamond Views 3 - Villas B', area: 'Al Barsha South Fourth', community: 'jumeirah-village-circle',
    detectedOn: '2026-08-19', direction: 1, value: 1691.12, baseline: 1574.07, magnitudePct: 7.44 },

  // ── Highest registered gross yields (top of distribution) ──
  { type: 'yield_leader', entity: 'U-bora Towers', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-08-25', direction: 1, value: 0.1989, baseline: null, streak: 42 },
  { type: 'yield_leader', entity: 'Equiti Home', area: 'Jabal Ali First', community: 'al-furjan',
    detectedOn: '2026-08-25', direction: 1, value: 0.1822, baseline: null, streak: 21 },
  { type: 'yield_leader', entity: 'Vincitore Boulevard', area: 'Al Barshaa South Third', community: 'arjan',
    detectedOn: '2026-08-25', direction: 1, value: 0.1749, baseline: null, streak: 42 },
  { type: 'yield_leader', entity: 'Casa Flores And Eden Apartments', area: 'Al Hebiah First', community: 'motor-city',
    detectedOn: '2026-08-25', direction: 1, value: 0.1528, baseline: null, streak: 42 },
  { type: 'yield_leader', entity: 'Vincitore Benessere', area: 'Al Barshaa South Third', community: 'arjan',
    detectedOn: '2026-08-25', direction: 1, value: 0.1506, baseline: null, streak: 42 },

  // ── Trades registered materially below cohort trend ──
  { type: 'discount_trade', entity: 'The Spirit', area: 'Al Hebiah Fourth', community: 'dubai-sports-city',
    detectedOn: '2026-08-11', direction: -1, value: 1035.22, baseline: 2227.05, magnitudePct: -53.52 },
  { type: 'discount_trade', entity: 'Verdana Residence 4', area: 'Dubai Investment Park First', community: 'dubai-investment-park-first',
    detectedOn: '2026-08-13', direction: -1, value: 465.30, baseline: 901.33, magnitudePct: -48.38 },
  { type: 'discount_trade', entity: 'Forest City Tower', area: 'Wadi Al Safa 3', community: 'majan',
    detectedOn: '2026-08-14', direction: -1, value: 663.53, baseline: 1215.10, magnitudePct: -45.39 },
  { type: 'discount_trade', entity: 'Samana Resorts', area: "Me'Aisem First", community: 'international-media-production-zone',
    detectedOn: '2026-08-25', direction: -1, value: 842.02, baseline: 1461.44, magnitudePct: -42.38 },
  { type: 'discount_trade', entity: 'Erin', area: 'Al Wasl', community: 'city-walk',
    detectedOn: '2026-08-20', direction: -1, value: 1535.76, baseline: 2564.23, magnitudePct: -40.11 },
  { type: 'discount_trade', entity: 'Crest Grande', area: 'Al Merkadh', community: 'sobha-hartland',
    detectedOn: '2026-08-19', direction: -1, value: 1148.54, baseline: 1849.98, magnitudePct: -37.92 },
];

// ── Display helpers ──
function aed(v) {
  if (v >= 1e6) return `AED ${(v / 1e6).toFixed(2)}M`;
  return `AED ${Math.round(v).toLocaleString('en-US')}`;
}

function psf(v) {
  return `${v.toLocaleString('en-US', { maximumFractionDigits: 0 })} AED/sqft`;
}

// Headline + supporting line, derived purely from the registered values
export function signalCopy(s) {
  switch (s.type) {
    case 'top_sale':
      return {
        headline: `${aed(s.value)} registered sale`,
        detail: s.baseline
          ? `Prior top sale ${aed(s.baseline)} — this trade came in ${Math.abs(s.magnitudePct).toFixed(1)}% ${s.magnitudePct < 0 ? 'below' : 'above'} it.`
          : `Highest registered sale detected for this project in the current window.`,
      };
    case 'record_psf':
      return {
        headline: `New record ${psf(s.value)}`,
        detail: `Previous record ${psf(s.baseline)} — up ${s.magnitudePct.toFixed(1)}%.`,
      };
    case 'yield_leader':
      return {
        headline: `${(s.value * 100).toFixed(2)}% gross yield`,
        detail: `Registered rents against registered sale prices. Held for ${s.streak} consecutive observations. Top of the yield distribution, not a typical return.`,
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

export function signalUrl(s) {
  return s.community
    ? `https://www.propertyindex.ae/communities/${s.community}`
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

HIGHEST REGISTERED GROSS YIELDS (extreme top of the distribution — not typical returns):
${group('yield_leader')}

TRADES REGISTERED BELOW COHORT TREND (evidence of the correction):
${group('discount_trade')}`;
}
