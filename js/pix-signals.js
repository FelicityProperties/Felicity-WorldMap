// ═══════════════════════════════════════════════════════════
// FELICITY PRICE INDEX SIGNALS — Real market signals from registered DLD evidence
// ═══════════════════════════════════════════════════════════
//
// Source: signal engine over Dubai Land Department registered
// transactions (PropertyIndex tools; public name Felicity Price Index). Snapshot 2026-10-06; open signals detected
// through 2026-10-06, DLD registrations loaded through September 2026.
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

export const PIX_SIGNALS_AS_OF = '2026-10-06';
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
  { type: 'top_sale', entity: 'Elysian Mansions', area: 'Tilal Al Ghaf', community: 'tilal-al-ghaf',
    detectedOn: '2026-10-06', direction: 1, value: 38500000, baseline: 27500000, magnitudePct: 40.00, psf: 2309.65, beds: 'Villa' },
  { type: 'top_sale', entity: 'IL Primo', area: 'Downtown Dubai', community: 'downtown-dubai',
    detectedOn: '2026-09-29', direction: 1, value: 28000000, baseline: null, psf: 5409.20, beds: '4 Bed' },
  { type: 'top_sale', entity: 'Eden Hills', area: 'MBR City', community: 'mohammed-bin-rashid-city',
    detectedOn: '2026-09-30', direction: 1, value: 23900000, baseline: null, psf: 2627.77, beds: 'Villa' },
  { type: 'top_sale', entity: 'Palm Jebel Ali Frond E', area: 'Palm Jebel Ali', community: 'palm-jebel-ali',
    detectedOn: '2026-10-01', direction: 1, value: 22217000, baseline: null, psf: 3013.18, beds: 'Villa' },
  { type: 'top_sale', entity: 'Mareva 2 The Oasis', area: 'The Oasis', community: 'the-oasis-by-emaar',
    detectedOn: '2026-10-02', direction: 1, value: 21627888, baseline: null, psf: 2093.02, beds: 'Villa' },
  { type: 'top_sale', entity: 'Lime Tree Valley', area: 'Jumeirah Golf Estates', community: 'jumeirah-golf-estates',
    detectedOn: '2026-09-25', direction: 1, value: 17500000, baseline: null, psf: 1895.56, beds: 'Villa' },
  { type: 'top_sale', entity: 'Chevalia Fields', area: 'Dubai Investment Park', community: 'dubai-investment-park-dip',
    detectedOn: '2026-10-04', direction: 1, value: 9308888, baseline: null, psf: 1638.73, beds: 'Villa' },

  // ── New record price per square foot ──
  { type: 'record_psf', entity: 'Springs 15', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-02', direction: 1, value: 2531.02, baseline: 1924.22, magnitudePct: 31.53 },
  { type: 'record_psf', entity: 'Windsor Manor', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-10-01', direction: 1, value: 1810.85, baseline: 1600.04, magnitudePct: 13.18 },
  { type: 'record_psf', entity: 'Springs 10', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-01', direction: 1, value: 1983.48, baseline: 1884.81, magnitudePct: 5.24 },
  { type: 'record_psf', entity: 'Paradise View 2', area: 'Majan', community: 'majan',
    detectedOn: '2026-09-22', direction: 1, value: 1700.01, baseline: 1600.00, magnitudePct: 6.25 },
  { type: 'record_psf', entity: 'Foxhill 1', area: 'Motor City', community: 'motor-city',
    detectedOn: '2026-10-06', direction: 1, value: 957.43, baseline: 890.44, magnitudePct: 7.52 },
  { type: 'record_psf', entity: 'Building 100', area: 'Discovery Gardens', community: 'discovery-gardens',
    detectedOn: '2026-09-30', direction: 1, value: 852.46, baseline: 807.85, magnitudePct: 5.52 },
  { type: 'record_psf', entity: 'Marina Gate 2', area: 'Dubai Marina', community: 'dubai-marina',
    detectedOn: '2026-10-02', direction: 1, value: 3548.84, baseline: 3407.69, magnitudePct: 4.14 },
  { type: 'record_psf', entity: 'Reem Townhouses', area: 'Town Square', community: 'town-square',
    detectedOn: '2026-10-06', direction: 1, value: 1532.56, baseline: 1484.93, magnitudePct: 3.21 },

  // ── Sales velocity: last 3 months against the prior 3 ──
  // Parent project nodes only — the engine also flags their individual
  // buildings and phases (Damac District Tower B beside Damac District,
  // Azizi Venice 6 Building H beside Azizi Venice 6, Trussardi Residences
  // Phase II beside Trussardi Residences), which would double-count the
  // same registrations.
  { type: 'momentum', entity: 'Arancia Yards By Beyond', area: 'City of Arabia', community: 'city-of-arabia',
    detectedOn: '2026-10-06', direction: 1, value: 239, baseline: 8, magnitudePct: 2887.5, streak: 5, psf: 1769.13 },
  { type: 'momentum', entity: 'Damac District', area: 'DAMAC Hills', community: 'damac-hills',
    detectedOn: '2026-10-06', direction: 1, value: 298, baseline: 67, magnitudePct: 344.78, streak: 25, psf: 1770.24 },
  { type: 'momentum', entity: 'Jebel Ali Village Townhouses', area: 'Jebel Ali', community: 'jebel-ali',
    detectedOn: '2026-10-06', direction: 1, value: 45, baseline: 10, magnitudePct: 350, streak: 25, psf: 1579.80 },
  { type: 'momentum', entity: 'Dubai Autodrome and Business Park', area: 'Motor City', community: 'motor-city',
    detectedOn: '2026-10-06', direction: 1, value: 403, baseline: 131, magnitudePct: 207.63, streak: 5, psf: 1686.40 },
  { type: 'momentum', entity: 'Mudon Al Ranim 6', area: 'Mudon', community: 'mudon',
    detectedOn: '2026-10-06', direction: 1, value: 31, baseline: 7, magnitudePct: 342.86, streak: 5, psf: 1730.51 },
  { type: 'momentum', entity: 'Trussardi Residences', area: 'Al Furjan', community: 'al-furjan',
    detectedOn: '2026-10-06', direction: 1, value: 33, baseline: 8, magnitudePct: 312.5, streak: 5, psf: 1554.19 },
  { type: 'momentum', entity: 'Azizi Venice 6', area: 'Dubai South', community: 'dubai-south-dubai-world-central',
    detectedOn: '2026-10-06', direction: 1, value: 674, baseline: 251, magnitudePct: 168.53, streak: 25, psf: 1885.20 },
  { type: 'momentum', entity: 'Azizi Venice 15', area: 'Dubai South', community: 'dubai-south-dubai-world-central',
    detectedOn: '2026-10-06', direction: 1, value: 512, baseline: 205, magnitudePct: 149.76, streak: 25, psf: 1587.18 },

  // ── Registered PSF moves against the project's prior print ──
  // The newest detection per project only: The Crescent and Springs 4 each
  // carry an earlier move in the opposite direction, now superseded.
  { type: 'psf_move', entity: 'Koro One', area: 'Al Satwa', community: 'al-satwa',
    detectedOn: '2026-09-25', direction: 1, value: 2234.04, baseline: 1175.92, baselineDate: '2026-09-24', magnitudePct: 89.98, salesL12m: 44 },
  { type: 'psf_move', entity: 'Springs 4', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-02', direction: 1, value: 997.95, baseline: 567.08, baselineDate: '2026-09-26', magnitudePct: 75.98, salesL12m: 24 },
  { type: 'psf_move', entity: 'Springs 9', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-02', direction: -1, value: 552.95, baseline: 1720.26, baselineDate: '2026-10-01', magnitudePct: -67.86, salesL12m: 27 },
  { type: 'psf_move', entity: 'JLT Cluster W', area: 'JLT', community: 'jumeirah-lake-towers',
    detectedOn: '2026-10-01', direction: 1, value: 2958.60, baseline: 1954.06, baselineDate: '2026-09-26', magnitudePct: 51.41, salesL12m: 56 },
  { type: 'psf_move', entity: 'Saba Tower 1', area: 'JLT', community: 'jumeirah-lake-towers',
    detectedOn: '2026-09-25', direction: 1, value: 1853.73, baseline: 1080.98, baselineDate: '2026-09-24', magnitudePct: 71.49, salesL12m: 13 },
  { type: 'psf_move', entity: 'The Crescent', area: 'Palm Jumeirah', community: 'palm-jumeirah',
    detectedOn: '2026-10-06', direction: -1, value: 5756.57, baseline: 8294.77, baselineDate: '2026-10-04', magnitudePct: -30.60, salesL12m: 283 },
  { type: 'psf_move', entity: 'Samana Lake Views', area: 'Dubai Production City', community: 'dubai-production-city-impz',
    detectedOn: '2026-09-29', direction: 1, value: 1161.01, baseline: 696.45, baselineDate: '2026-09-28', magnitudePct: 66.70, salesL12m: 12 },
  { type: 'psf_move', entity: 'Mercedes Benz Places by Binghatti', area: 'Downtown Dubai', community: 'downtown-dubai',
    detectedOn: '2026-10-04', direction: 1, value: 8132.19, baseline: 5590.67, baselineDate: '2026-10-02', magnitudePct: 45.46, salesL12m: 33 },

  // ── Highest registered gross yields (top of distribution) ──
  { type: 'yield_leader', entity: 'Platinum One', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-10-06', direction: 1, value: 0.1505, baseline: null, streak: 25 },
  { type: 'yield_leader', entity: 'Diamond Business Center Block A', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-10-06', direction: 1, value: 0.1339, baseline: null, streak: 25 },
  { type: 'yield_leader', entity: 'Aura Central', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-10-06', direction: 1, value: 0.1329, baseline: null, streak: 5 },
  { type: 'yield_leader', entity: 'Golf Panorama B', area: 'DAMAC Hills', community: 'damac-hills',
    detectedOn: '2026-10-06', direction: 1, value: 0.1297, baseline: null, streak: 25 },
  { type: 'yield_leader', entity: 'Building K05', area: 'International City', community: 'international-city',
    detectedOn: '2026-10-06', direction: 1, value: 0.1225, baseline: null, streak: 25 },
  { type: 'yield_leader', entity: 'Hyatt Regency Creek Heights Residences', area: 'Bur Dubai', community: 'bur-dubai',
    detectedOn: '2026-10-06', direction: 1, value: 0.1208, baseline: null, streak: 25 },
  { type: 'yield_leader', entity: 'Madison Columbus', area: 'Majan', community: 'majan',
    detectedOn: '2026-10-06', direction: 1, value: 0.1208, baseline: null, streak: 5 },
  { type: 'yield_leader', entity: 'Building Q01', area: 'International City', community: 'international-city',
    detectedOn: '2026-10-06', direction: 1, value: 0.1167, baseline: null, streak: 24 },

  // ── Projects printing persistently below their own 12-month average ──
  { type: 'below_trend', entity: 'Springs 9', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-06', direction: -1, value: 552.95, baseline: 1600.76, magnitudePct: -65.46, streak: 4, salesL12m: 27, offplanPct: 0 },
  { type: 'below_trend', entity: 'Rukan Tower A', area: 'Rukan', community: 'rukan',
    detectedOn: '2026-10-06', direction: -1, value: 575.67, baseline: 1158.52, magnitudePct: -50.31, streak: 25, salesL12m: 24, offplanPct: 33 },
  { type: 'below_trend', entity: 'Binghatti Royale', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-06', direction: -1, value: 1479.93, baseline: 2079.13, magnitudePct: -28.82, streak: 25, salesL12m: 141, offplanPct: 9 },
  { type: 'below_trend', entity: 'Hor Al Anz', area: 'Deira', community: 'deira',
    detectedOn: '2026-10-06', direction: -1, value: 519.63, baseline: 743.31, magnitudePct: -30.09, streak: 4, salesL12m: 98, offplanPct: 0 },
  { type: 'below_trend', entity: 'Mayfair Residency', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-10-06', direction: -1, value: 736.89, baseline: 1348.34, magnitudePct: -45.35, streak: 25, salesL12m: 20, offplanPct: 0 },
  { type: 'below_trend', entity: 'JLT Cluster Q', area: 'JLT', community: 'jumeirah-lake-towers',
    detectedOn: '2026-10-06', direction: -1, value: 1420.49, baseline: 1956.80, magnitudePct: -27.41, streak: 5, salesL12m: 123, offplanPct: 46 },
  { type: 'below_trend', entity: 'District 18', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-06', direction: -1, value: 1251.88, baseline: 1554.56, magnitudePct: -19.47, streak: 25, salesL12m: 535, offplanPct: 32 },
  { type: 'below_trend', entity: 'Springs 4', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-06', direction: -1, value: 997.95, baseline: 1558.52, magnitudePct: -35.97, streak: 10, salesL12m: 24, offplanPct: 0 },

  // ── Single trades registered materially below the project median ──
  // The engine's 2026-10-01 row for The Spirit (1,087.73 against 952.23,
  // +14%) is a trade ABOVE its baseline and is not a discount; it is left
  // out, and The Spirit's 2026-09-30 discount trade stands.
  { type: 'discount_trade', entity: 'Springs 9', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-02', direction: -1, value: 163.84, baseline: 677.63, magnitudePct: -75.82 },
  { type: 'discount_trade', entity: 'Springs 4', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-09-26', direction: -1, value: 220.38, baseline: 675.17, magnitudePct: -67.36 },
  { type: 'discount_trade', entity: 'The Spirit', area: 'Dubai Sports City', community: 'dubai-sports-city',
    detectedOn: '2026-09-30', direction: -1, value: 952.23, baseline: 2324.74, magnitudePct: -59.04 },
  { type: 'discount_trade', entity: 'The Grand', area: 'Dubai Creek Harbour', community: 'dubai-creek-harbour-the-lagoons',
    detectedOn: '2026-09-29', direction: -1, value: 1058.84, baseline: 1610.58, magnitudePct: -34.26 },
  { type: 'discount_trade', entity: 'Creekside 18 B', area: 'Dubai Creek Harbour', community: 'dubai-creek-harbour-the-lagoons',
    detectedOn: '2026-09-29', direction: -1, value: 795.74, baseline: 1979.49, magnitudePct: -59.80 },
  { type: 'discount_trade', entity: 'Burj Crown', area: 'Downtown Dubai', community: 'downtown-dubai',
    detectedOn: '2026-09-29', direction: -1, value: 986.34, baseline: 2611.73, magnitudePct: -62.23 },
  { type: 'discount_trade', entity: 'The Matrix', area: 'Dubai Sports City', community: 'dubai-sports-city',
    detectedOn: '2026-09-30', direction: -1, value: 906.93, baseline: 1343.66, magnitudePct: -32.50 },
  { type: 'discount_trade', entity: 'Rukan 3', area: 'Rukan', community: 'rukan',
    detectedOn: '2026-10-06', direction: -1, value: 844.00, baseline: 1282.39, magnitudePct: -34.18 },
  { type: 'discount_trade', entity: 'Urbana 2', area: 'Dubai South', community: 'dubai-south-dubai-world-central',
    detectedOn: '2026-09-26', direction: -1, value: 489.96, baseline: 796.85, magnitudePct: -38.51 },
  { type: 'discount_trade', entity: 'Sandoval Gardens 1', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-01', direction: -1, value: 596.71, baseline: 898.43, magnitudePct: -33.58 },
  { type: 'discount_trade', entity: 'Zada Tower', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-10-01', direction: -1, value: 1536.03, baseline: 2023.34, magnitudePct: -24.08 },
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
