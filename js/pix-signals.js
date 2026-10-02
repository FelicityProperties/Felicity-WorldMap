// ═══════════════════════════════════════════════════════════
// FELICITY PRICE INDEX SIGNALS — Real market signals from registered DLD evidence
// ═══════════════════════════════════════════════════════════
//
// Source: signal engine over Dubai Land Department registered
// transactions (PropertyIndex tools; public name Felicity Price Index). Snapshot 2026-10-02; open signals detected
// through 2026-10-01, DLD registrations loaded through September 2026.
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

export const PIX_SIGNALS_AS_OF = '2026-10-01';
export const PIX_SIGNALS_SOURCE = 'Felicity Price Index signal feed over DLD registered transactions';

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
  { type: 'top_sale', entity: 'District One West Phase I', area: 'MBR City', community: 'mohammed-bin-rashid-city',
    detectedOn: '2026-09-19', direction: 1, value: 31500000, baseline: null, psf: 2942.07, beds: 'Villa' },
  { type: 'top_sale', entity: 'IL Primo', area: 'Downtown Dubai', community: 'downtown-dubai',
    detectedOn: '2026-09-29', direction: 1, value: 28000000, baseline: null, psf: 5409.20, beds: '4 Bed' },
  { type: 'top_sale', entity: 'Elysian Mansions', area: 'Tilal Al Ghaf', community: 'tilal-al-ghaf',
    detectedOn: '2026-09-26', direction: 1, value: 27500000, baseline: null, psf: 2772.65, beds: 'Villa' },
  { type: 'top_sale', entity: 'Five Palm Jumeirah', area: 'Palm Jumeirah', community: 'palm-jumeirah',
    detectedOn: '2026-09-18', direction: 1, value: 25000000, baseline: null, psf: 2031.63, beds: '5 Bed' },
  { type: 'top_sale', entity: 'Eden Hills', area: 'MBR City', community: 'mohammed-bin-rashid-city',
    detectedOn: '2026-09-30', direction: 1, value: 23900000, baseline: null, psf: 2627.77, beds: 'Villa' },
  { type: 'top_sale', entity: 'Palm Jebel Ali Frond E', area: 'Palm Jebel Ali', community: 'palm-jebel-ali',
    detectedOn: '2026-10-01', direction: 1, value: 22217000, baseline: null, psf: 3013.18, beds: 'Villa' },
  { type: 'top_sale', entity: 'Lime Tree Valley', area: 'Jumeirah Golf Estates', community: 'jumeirah-golf-estates',
    detectedOn: '2026-09-25', direction: 1, value: 17500000, baseline: null, psf: 1895.56, beds: 'Villa' },

  // ── New record price per square foot ──
  { type: 'record_psf', entity: 'Azizi Riviera 1', area: 'Meydan', community: 'meydan',
    detectedOn: '2026-09-29', direction: 1, value: 2714.84, baseline: 2303.71, magnitudePct: 17.85 },
  { type: 'record_psf', entity: 'Windsor Manor', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-10-01', direction: 1, value: 1810.85, baseline: 1600.04, magnitudePct: 13.18 },
  { type: 'record_psf', entity: 'Springs 10', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-01', direction: 1, value: 1983.48, baseline: 1884.81, magnitudePct: 5.24 },
  { type: 'record_psf', entity: 'Paradise View 2', area: 'Majan', community: 'majan',
    detectedOn: '2026-09-22', direction: 1, value: 1700.01, baseline: 1600.00, magnitudePct: 6.25 },
  { type: 'record_psf', entity: 'Building 100', area: 'Discovery Gardens', community: 'discovery-gardens',
    detectedOn: '2026-09-30', direction: 1, value: 852.46, baseline: 807.85, magnitudePct: 5.52 },
  { type: 'record_psf', entity: 'Foxhill 2', area: 'Motor City', community: 'motor-city',
    detectedOn: '2026-09-30', direction: 1, value: 826.30, baseline: 798.65, magnitudePct: 3.46 },
  { type: 'record_psf', entity: 'West Heights 3', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-09-26', direction: 1, value: 1866.16, baseline: 1820.65, magnitudePct: 2.50 },

  // ── Sales velocity: last 3 months against the prior 3 ──
  // Parent project nodes only — the engine also flags their individual
  // buildings and phases (Trussardi Residences Phase II beside Trussardi
  // Residences), which would double-count the same registrations.
  { type: 'momentum', entity: 'Arancia Yards By Beyond', area: 'City of Arabia', community: 'city-of-arabia',
    detectedOn: '2026-10-01', direction: 1, value: 239, baseline: 8, magnitudePct: 2887.5, streak: 1, psf: 1769.13 },
  { type: 'momentum', entity: 'Damac District', area: 'DAMAC Hills', community: 'damac-hills',
    detectedOn: '2026-10-01', direction: 1, value: 298, baseline: 67, magnitudePct: 344.78, streak: 21, psf: 1788.36 },
  { type: 'momentum', entity: 'Jebel Ali Village Townhouses', area: 'Jebel Ali', community: 'jebel-ali',
    detectedOn: '2026-10-01', direction: 1, value: 45, baseline: 10, magnitudePct: 350, streak: 21, psf: 1570.67 },
  { type: 'momentum', entity: 'Dubai Autodrome and Business Park', area: 'Motor City', community: 'motor-city',
    detectedOn: '2026-10-01', direction: 1, value: 403, baseline: 131, magnitudePct: 207.63, streak: 1, psf: 1796.81 },
  { type: 'momentum', entity: 'Trussardi Residences', area: 'Al Furjan', community: 'al-furjan',
    detectedOn: '2026-10-01', direction: 1, value: 33, baseline: 8, magnitudePct: 312.5, streak: 1, psf: 1554.19 },
  { type: 'momentum', entity: 'Azizi Venice 6', area: 'Dubai South', community: 'dubai-south-dubai-world-central',
    detectedOn: '2026-10-01', direction: 1, value: 674, baseline: 251, magnitudePct: 168.53, streak: 21, psf: 1962.47 },
  { type: 'momentum', entity: 'Azizi Venice 15', area: 'Dubai South', community: 'dubai-south-dubai-world-central',
    detectedOn: '2026-10-01', direction: 1, value: 512, baseline: 205, magnitudePct: 149.76, streak: 21, psf: 1699.29 },

  // ── Registered PSF moves against the project's prior print ──
  { type: 'psf_move', entity: 'Koro One', area: 'Al Satwa', community: 'al-satwa',
    detectedOn: '2026-09-25', direction: 1, value: 2234.04, baseline: 1175.92, baselineDate: '2026-09-24', magnitudePct: 89.98, salesL12m: 44 },
  { type: 'psf_move', entity: 'Al Waleed Garden', area: 'Al Jaddaf', community: 'al-jaddaf',
    detectedOn: '2026-09-25', direction: 1, value: 1315.57, baseline: 722.21, baselineDate: '2026-09-11', magnitudePct: 82.16, salesL12m: 15 },
  { type: 'psf_move', entity: 'Springs 4', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-09-26', direction: -1, value: 567.08, baseline: 1607.16, baselineDate: '2026-09-25', magnitudePct: -64.72, salesL12m: 24 },
  { type: 'psf_move', entity: 'JLT Cluster W', area: 'JLT', community: 'jumeirah-lake-towers',
    detectedOn: '2026-10-01', direction: 1, value: 2958.60, baseline: 1954.06, baselineDate: '2026-09-26', magnitudePct: 51.41, salesL12m: 56 },
  { type: 'psf_move', entity: 'Saba Tower 1', area: 'JLT', community: 'jumeirah-lake-towers',
    detectedOn: '2026-09-25', direction: 1, value: 1853.73, baseline: 1080.98, baselineDate: '2026-09-24', magnitudePct: 71.49, salesL12m: 13 },
  { type: 'psf_move', entity: 'Golf Place 2', area: 'Dubai Hills Estate', community: 'dubai-hills-estate',
    detectedOn: '2026-09-22', direction: 1, value: 2762.85, baseline: 1771.09, baselineDate: '2026-09-21', magnitudePct: 56.00, salesL12m: 16 },

  // ── Highest registered gross yields (top of distribution) ──
  { type: 'yield_leader', entity: 'Platinum One', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-10-01', direction: 1, value: 0.1505, baseline: null, streak: 21 },
  { type: 'yield_leader', entity: 'Diamond Business Center Block A', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-10-01', direction: 1, value: 0.1339, baseline: null, streak: 21 },
  { type: 'yield_leader', entity: 'Aura Central', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-10-01', direction: 1, value: 0.1329, baseline: null, streak: 1 },
  { type: 'yield_leader', entity: 'Golf Panorama B', area: 'DAMAC Hills', community: 'damac-hills',
    detectedOn: '2026-10-01', direction: 1, value: 0.1297, baseline: null, streak: 21 },
  { type: 'yield_leader', entity: 'Building K05', area: 'International City', community: 'international-city',
    detectedOn: '2026-10-01', direction: 1, value: 0.1225, baseline: null, streak: 21 },
  { type: 'yield_leader', entity: 'Hyatt Regency Creek Heights Residences', area: 'Bur Dubai', community: 'bur-dubai',
    detectedOn: '2026-10-01', direction: 1, value: 0.1208, baseline: null, streak: 21 },
  { type: 'yield_leader', entity: 'Madison Columbus', area: 'Majan', community: 'majan',
    detectedOn: '2026-10-01', direction: 1, value: 0.1208, baseline: null, streak: 1 },
  { type: 'yield_leader', entity: 'Building Q01', area: 'International City', community: 'international-city',
    detectedOn: '2026-10-01', direction: 1, value: 0.1167, baseline: null, streak: 20 },

  // ── Projects printing persistently below their own 12-month average ──
  { type: 'below_trend', entity: 'Springs 4', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-01', direction: -1, value: 567.08, baseline: 1558.52, magnitudePct: -63.61, streak: 6, salesL12m: 24, offplanPct: 0 },
  { type: 'below_trend', entity: 'Rukan Tower A', area: 'Rukan', community: 'rukan',
    detectedOn: '2026-10-01', direction: -1, value: 575.67, baseline: 1158.52, magnitudePct: -50.31, streak: 21, salesL12m: 24, offplanPct: 33 },
  { type: 'below_trend', entity: 'Mayfair Residency', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-10-01', direction: -1, value: 736.89, baseline: 1348.34, magnitudePct: -45.35, streak: 21, salesL12m: 20, offplanPct: 0 },
  { type: 'below_trend', entity: 'Address Fountain Views Hotel', area: 'Downtown Dubai', community: 'downtown-dubai',
    detectedOn: '2026-10-01', direction: -1, value: 3124.82, baseline: 4797.74, magnitudePct: -34.87, streak: 21, salesL12m: 23, offplanPct: 0 },
  { type: 'below_trend', entity: 'The Binary Tower', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-10-01', direction: -1, value: 2330.51, baseline: 3470.91, magnitudePct: -32.86, streak: 21, salesL12m: 31, offplanPct: 0 },
  { type: 'below_trend', entity: 'Binghatti Royale', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-01', direction: -1, value: 1479.93, baseline: 2079.13, magnitudePct: -28.82, streak: 21, salesL12m: 141, offplanPct: 9 },

  // ── Single trades registered materially below the project median ──
  { type: 'discount_trade', entity: 'Springs 4', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-09-26', direction: -1, value: 220.38, baseline: 675.17, magnitudePct: -67.36 },
  { type: 'discount_trade', entity: 'Burj Crown', area: 'Downtown Dubai', community: 'downtown-dubai',
    detectedOn: '2026-09-29', direction: -1, value: 986.34, baseline: 2611.73, magnitudePct: -62.23 },
  { type: 'discount_trade', entity: 'Creekside 18 B', area: 'Dubai Creek Harbour', community: 'dubai-creek-harbour-the-lagoons',
    detectedOn: '2026-09-29', direction: -1, value: 795.74, baseline: 1979.49, magnitudePct: -59.80 },
  { type: 'discount_trade', entity: 'The Spirit', area: 'Dubai Sports City', community: 'dubai-sports-city',
    detectedOn: '2026-09-30', direction: -1, value: 952.23, baseline: 2324.74, magnitudePct: -59.04 },
  { type: 'discount_trade', entity: 'Urbana 2', area: 'Dubai South', community: 'dubai-south-dubai-world-central',
    detectedOn: '2026-09-26', direction: -1, value: 489.96, baseline: 796.85, magnitudePct: -38.51 },
  { type: 'discount_trade', entity: 'The Grand', area: 'Dubai Creek Harbour', community: 'dubai-creek-harbour-the-lagoons',
    detectedOn: '2026-09-29', direction: -1, value: 1058.84, baseline: 1610.58, magnitudePct: -34.26 },
  { type: 'discount_trade', entity: 'Sandoval Gardens 1', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-01', direction: -1, value: 596.71, baseline: 898.43, magnitudePct: -33.58 },
  { type: 'discount_trade', entity: 'The Matrix', area: 'Dubai Sports City', community: 'dubai-sports-city',
    detectedOn: '2026-09-30', direction: -1, value: 906.93, baseline: 1343.66, magnitudePct: -32.50 },
  { type: 'discount_trade', entity: 'Zada Tower', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-10-01', direction: -1, value: 1536.03, baseline: 2023.34, magnitudePct: -24.08 },
  { type: 'discount_trade', entity: 'Princess Tower', area: 'Dubai Marina', community: 'dubai-marina',
    detectedOn: '2026-09-26', direction: -1, value: 1142.17, baseline: 1444.45, magnitudePct: -20.93 },
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

  return `LIVE MARKET SIGNALS — the Felicity Price Index signal feed, detected over DLD registered transactions through ${PIX_SIGNALS_AS_OF}. Refer to it as "our signal feed" or "the Felicity Price Index signals"; use no other name for it or its provider. These are real registered events. Cite them by name and date; never invent a comparable anecdote.

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
