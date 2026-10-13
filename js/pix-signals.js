// ═══════════════════════════════════════════════════════════
// FELICITY PRICE INDEX SIGNALS — Real market signals from registered DLD evidence
// ═══════════════════════════════════════════════════════════
//
// Source: signal engine over Dubai Land Department registered
// transactions (PropertyIndex tools; public name Felicity Price Index). Snapshot 2026-10-13; open signals detected
// through 2026-10-12, DLD registrations loaded through September 2026.
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
//                  = the evidence's project_median_psf, which is the
//                  median of the project's registered sales of the SAME
//                  unit type (bedrooms, property type, resale basis) over
//                  its whole registered history — not a project-wide or
//                  12-month median, which is why one project can show
//                  two baselines. The signal's own baseline_value is the
//                  previous trade on a repeat detection; never use it.
//                  magnitudePct = −below_median_pct. beds = the unit.
// ═══════════════════════════════════════════════════════════

export const PIX_SIGNALS_AS_OF = '2026-10-12';
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
  { type: 'top_sale', entity: 'Orla by Omniyat', area: 'Palm Jumeirah', community: 'palm-jumeirah',
    detectedOn: '2026-10-08', direction: 1, value: 49422470, baseline: null, psf: 6745.75, beds: '4 Bed' },
  { type: 'top_sale', entity: 'Eden Hills', area: 'MBR City', community: 'mohammed-bin-rashid-city',
    detectedOn: '2026-10-12', direction: 1, value: 43800000, baseline: 34900000, magnitudePct: 25.50, psf: 3390.96, beds: 'Villa' },
  { type: 'top_sale', entity: 'Elysian Mansions', area: 'Tilal Al Ghaf', community: 'tilal-al-ghaf',
    detectedOn: '2026-10-06', direction: 1, value: 38500000, baseline: 27500000, magnitudePct: 40.00, psf: 2309.65, beds: 'Villa' },
  { type: 'top_sale', entity: 'IL Primo', area: 'Downtown Dubai', community: 'downtown-dubai',
    detectedOn: '2026-09-29', direction: 1, value: 28000000, baseline: null, psf: 5409.20, beds: '4 Bed' },
  { type: 'top_sale', entity: 'Palm Jebel Ali Frond E', area: 'Palm Jebel Ali', community: 'palm-jebel-ali',
    detectedOn: '2026-10-01', direction: 1, value: 22217000, baseline: null, psf: 3013.18, beds: 'Villa' },
  { type: 'top_sale', entity: 'Mareva 2 The Oasis', area: 'The Oasis', community: 'the-oasis-by-emaar',
    detectedOn: '2026-10-02', direction: 1, value: 21627888, baseline: null, psf: 2093.02, beds: 'Villa' },
  { type: 'top_sale', entity: 'Chevalia Fields', area: 'Dubai Investment Park', community: 'dubai-investment-park-dip',
    detectedOn: '2026-10-04', direction: 1, value: 9308888, baseline: null, psf: 1638.73, beds: 'Villa' },

  // ── New record price per square foot ──
  { type: 'record_psf', entity: 'Springs 15', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-02', direction: 1, value: 2531.02, baseline: 1924.22, magnitudePct: 31.53 },
  { type: 'record_psf', entity: 'Alwan Residence 1', area: 'Dubai Production City', community: 'dubai-production-city-impz',
    detectedOn: '2026-10-07', direction: 1, value: 1202.59, baseline: 982.46, magnitudePct: 22.41 },
  { type: 'record_psf', entity: 'Windsor Manor', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-10-01', direction: 1, value: 1810.85, baseline: 1600.04, magnitudePct: 13.18 },
  { type: 'record_psf', entity: 'Al Majara 3', area: 'Dubai Marina', community: 'dubai-marina',
    detectedOn: '2026-10-12', direction: 1, value: 2640.91, baseline: 2362.98, magnitudePct: 11.76 },
  { type: 'record_psf', entity: 'Springs 10', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-01', direction: 1, value: 1983.48, baseline: 1884.81, magnitudePct: 5.24 },
  { type: 'record_psf', entity: 'Foxhill 1', area: 'Motor City', community: 'motor-city',
    detectedOn: '2026-10-06', direction: 1, value: 957.43, baseline: 890.44, magnitudePct: 7.52 },
  { type: 'record_psf', entity: 'Building 100', area: 'Discovery Gardens', community: 'discovery-gardens',
    detectedOn: '2026-09-30', direction: 1, value: 852.46, baseline: 807.85, magnitudePct: 5.52 },
  { type: 'record_psf', entity: 'Marina Gate 2', area: 'Dubai Marina', community: 'dubai-marina',
    detectedOn: '2026-10-02', direction: 1, value: 3548.84, baseline: 3407.69, magnitudePct: 4.14 },

  // ── Sales velocity: last 3 months against the prior 3 ──
  // A node is left out only when one of its ANCESTORS is also flagged —
  // the ancestor's registrations already include it (location_path in the
  // projects entity). 13 Oct: Damac District Tower B (under Damac
  // District), Azizi Venice 6 Building H and E (under Azizi Venice 6),
  // The Borough (under District 17) and Trussardi Residences Phase II
  // (under Trussardi Residences) are out on that rule. Standalone towers
  // with no flagged ancestor (Azizi Milan 30, Regalia, Sera Gardens) are
  // projects in their own right and stay in. The previous refresh kept
  // sub-communities only, which dropped them; the audit caught it.
  { type: 'momentum', entity: 'Arancia Yards By Beyond', area: 'City of Arabia', community: 'city-of-arabia',
    detectedOn: '2026-10-12', direction: 1, value: 239, baseline: 8, magnitudePct: 2887.5, streak: 8, psf: 1601.43 },
  { type: 'momentum', entity: 'Azizi Milan 30', area: 'City of Arabia', community: 'city-of-arabia',
    detectedOn: '2026-10-12', direction: 1, value: 284, baseline: 21, magnitudePct: 1252.38, streak: 28, psf: 1637.98 },
  { type: 'momentum', entity: 'Regalia By Deyaar', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-10-12', direction: 1, value: 54, baseline: 5, magnitudePct: 980, streak: 28, psf: 1796.09 },
  { type: 'momentum', entity: 'Sera Gardens by Vision', area: 'Dubai Production City', community: 'dubai-production-city-impz',
    detectedOn: '2026-10-12', direction: 1, value: 120, baseline: 16, magnitudePct: 650, streak: 8, psf: 1543.87 },
  { type: 'momentum', entity: 'Damac District', area: 'DAMAC Hills', community: 'damac-hills',
    detectedOn: '2026-10-12', direction: 1, value: 298, baseline: 67, magnitudePct: 344.78, streak: 28, psf: 1770.24 },
  { type: 'momentum', entity: 'Oxford Cove', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-12', direction: 1, value: 130, baseline: 31, magnitudePct: 319.35, streak: 8, psf: 1449.18 },
  { type: 'momentum', entity: 'Jebel Ali Village Townhouses', area: 'Jebel Ali', community: 'jebel-ali',
    detectedOn: '2026-10-12', direction: 1, value: 45, baseline: 10, magnitudePct: 350, streak: 28, psf: 1614.24 },
  { type: 'momentum', entity: 'The Horizon at Sobha Central', area: 'Jebel Ali', community: 'jebel-ali',
    detectedOn: '2026-10-12', direction: 1, value: 61, baseline: 15, magnitudePct: 306.67, streak: 8, psf: 2799.84 },

  // ── Registered PSF moves against the project's prior print ──
  // The NEWEST detection per project, ranked by that row's score. A PSF
  // move is a running measurement, so a later detection supersedes an
  // earlier one: 13 Oct, La Mer's −32.4% (7 Oct) became +16.5% on 8 Oct,
  // JLT Cluster W's +51.4% (1 Oct) went −19.3% then +14.9%, and The
  // Crescent's +76.8% (4 Oct) has newer detections through 12 Oct — each
  // newest row scores below the cut. Skyhills Astra Tower A (−43.7%, a
  // larger move than its parent's −30.2%) sits under Skyhills Astra, so its
  // registrations are already inside the parent's move: left out on the
  // same ancestor rule as momentum.
  { type: 'psf_move', entity: 'Springs 4', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-02', direction: 1, value: 997.95, baseline: 567.08, baselineDate: '2026-09-26', magnitudePct: 75.98, salesL12m: 24 },
  { type: 'psf_move', entity: '15 Cascade', area: 'Motor City', community: 'motor-city',
    detectedOn: '2026-10-07', direction: 1, value: 1338.08, baseline: 921.76, baselineDate: '2026-10-06', magnitudePct: 45.17, salesL12m: 178 },
  { type: 'psf_move', entity: 'Springs 9', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-02', direction: -1, value: 552.95, baseline: 1720.26, baselineDate: '2026-10-01', magnitudePct: -67.86, salesL12m: 27 },
  { type: 'psf_move', entity: 'The Metropolis', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-10-12', direction: 1, value: 2669.11, baseline: 1523.84, baselineDate: '2026-10-08', magnitudePct: 75.16, salesL12m: 17 },
  { type: 'psf_move', entity: 'Skyhills Astra', area: 'Dubai Science Park', community: 'dubai-science-park',
    detectedOn: '2026-10-07', direction: -1, value: 1416.30, baseline: 2029.40, baselineDate: '2026-10-06', magnitudePct: -30.21, salesL12m: 872 },
  { type: 'psf_move', entity: 'Samana Lake Views', area: 'Dubai Production City', community: 'dubai-production-city-impz',
    detectedOn: '2026-09-29', direction: 1, value: 1161.01, baseline: 696.45, baselineDate: '2026-09-28', magnitudePct: 66.70, salesL12m: 12 },
  { type: 'psf_move', entity: 'Rukan Tower A', area: 'Rukan', community: 'rukan',
    detectedOn: '2026-10-08', direction: 1, value: 875.50, baseline: 575.67, baselineDate: '2026-10-07', magnitudePct: 52.08, salesL12m: 24 },
  { type: 'psf_move', entity: 'CBD (Central Business District)', area: 'International City', community: 'international-city',
    detectedOn: '2026-10-12', direction: 1, value: 969.77, baseline: 760.27, baselineDate: '2026-10-08', magnitudePct: 27.56, salesL12m: 274 },

  // ── Highest registered gross yields (top of distribution) ──
  { type: 'yield_leader', entity: 'Platinum One', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-10-12', direction: 1, value: 0.1505, baseline: null, streak: 28 },
  { type: 'yield_leader', entity: 'Diamond Business Center Block A', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-10-12', direction: 1, value: 0.1339, baseline: null, streak: 28 },
  { type: 'yield_leader', entity: 'Aura Central', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-10-12', direction: 1, value: 0.1329, baseline: null, streak: 8 },
  { type: 'yield_leader', entity: 'Golf Panorama B', area: 'DAMAC Hills', community: 'damac-hills',
    detectedOn: '2026-10-12', direction: 1, value: 0.1297, baseline: null, streak: 28 },
  { type: 'yield_leader', entity: 'Building K05', area: 'International City', community: 'international-city',
    detectedOn: '2026-10-12', direction: 1, value: 0.1225, baseline: null, streak: 28 },
  { type: 'yield_leader', entity: 'Hyatt Regency Creek Heights Residences', area: 'Bur Dubai', community: 'bur-dubai',
    detectedOn: '2026-10-12', direction: 1, value: 0.1208, baseline: null, streak: 28 },
  { type: 'yield_leader', entity: 'Madison Columbus', area: 'Majan', community: 'majan',
    detectedOn: '2026-10-12', direction: 1, value: 0.1208, baseline: null, streak: 8 },
  { type: 'yield_leader', entity: 'Building Q01', area: 'International City', community: 'international-city',
    detectedOn: '2026-10-12', direction: 1, value: 0.1167, baseline: null, streak: 27 },

  // ── Projects printing persistently below their own 12-month average ──
  // Persistent means streak ≥ 3: The Hamilton (Town Square, streak 1 on
  // 12 Oct) is left out until it holds.
  { type: 'below_trend', entity: 'Springs 9', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-12', direction: -1, value: 552.95, baseline: 1600.76, magnitudePct: -65.46, streak: 7, salesL12m: 27, offplanPct: 0 },
  { type: 'below_trend', entity: 'Binghatti Royale', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-12', direction: -1, value: 1495.82, baseline: 2079.13, magnitudePct: -28.06, streak: 28, salesL12m: 141, offplanPct: 9 },
  { type: 'below_trend', entity: 'Hor Al Anz', area: 'Deira', community: 'deira',
    detectedOn: '2026-10-12', direction: -1, value: 519.63, baseline: 743.31, magnitudePct: -30.09, streak: 7, salesL12m: 98, offplanPct: 0 },
  { type: 'below_trend', entity: 'Mayfair Residency', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-10-12', direction: -1, value: 736.89, baseline: 1348.34, magnitudePct: -45.35, streak: 28, salesL12m: 20, offplanPct: 0 },
  { type: 'below_trend', entity: 'Seven Palm', area: 'Palm Jumeirah', community: 'palm-jumeirah',
    detectedOn: '2026-10-12', direction: -1, value: 2271.39, baseline: 3383.56, magnitudePct: -32.87, streak: 28, salesL12m: 62, offplanPct: 18 },
  { type: 'below_trend', entity: 'JLT Cluster Q', area: 'JLT', community: 'jumeirah-lake-towers',
    detectedOn: '2026-10-12', direction: -1, value: 1421.26, baseline: 1956.80, magnitudePct: -27.37, streak: 8, salesL12m: 123, offplanPct: 46 },
  { type: 'below_trend', entity: 'Le Ciel 1', area: 'Jumeirah', community: 'jumeirah',
    detectedOn: '2026-10-12', direction: -1, value: 2020.35, baseline: 3351.94, magnitudePct: -39.73, streak: 8, salesL12m: 22, offplanPct: 32 },
  { type: 'below_trend', entity: 'Springs 4', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-12', direction: -1, value: 997.95, baseline: 1558.52, magnitudePct: -35.97, streak: 13, salesL12m: 24, offplanPct: 0 },

  // ── Single trades registered materially below their unit-type median ──
  // Baseline and discount come from the engine's EVIDENCE
  // (project_median_psf, below_median_pct), not the signal's
  // baseline_value: on a repeat detection that field holds the previous
  // trade, which made The Grand read "34% below 1,611" when its evidence
  // says 59% below 2,583 (its 2-bed median). Each row is a separate registered trade
  // (its own thread), so The Spirit's Studio on 29 Sep and 1-Bed on 30 Sep
  // both count. Top 12 by score.
  { type: 'discount_trade', entity: 'Springs 9', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-02', direction: -1, value: 163.84, baseline: 677.63, magnitudePct: -75.82, beds: '3 Bed villa' },
  { type: 'discount_trade', entity: 'The Spirit', area: 'Dubai Sports City', community: 'dubai-sports-city',
    detectedOn: '2026-09-30', direction: -1, value: 952.23, baseline: 2324.74, magnitudePct: -59.04, beds: 'Studio' },
  { type: 'discount_trade', entity: 'The Grand', area: 'Dubai Creek Harbour', community: 'dubai-creek-harbour-the-lagoons',
    detectedOn: '2026-09-29', direction: -1, value: 1058.84, baseline: 2583.34, magnitudePct: -59.01, beds: '2 Bed' },
  { type: 'discount_trade', entity: 'Creekside 18 B', area: 'Dubai Creek Harbour', community: 'dubai-creek-harbour-the-lagoons',
    detectedOn: '2026-09-29', direction: -1, value: 795.74, baseline: 1979.49, magnitudePct: -59.80, beds: '2 Bed' },
  { type: 'discount_trade', entity: 'Burj Crown', area: 'Downtown Dubai', community: 'downtown-dubai',
    detectedOn: '2026-09-29', direction: -1, value: 986.34, baseline: 2611.73, magnitudePct: -62.23, beds: '2 Bed' },
  { type: 'discount_trade', entity: 'Ocean Heights', area: 'Dubai Marina', community: 'dubai-marina',
    detectedOn: '2026-10-07', direction: -1, value: 885.47, baseline: 1550.85, magnitudePct: -42.90, beds: '3 Bed' },
  { type: 'discount_trade', entity: 'The Spirit', area: 'Dubai Sports City', community: 'dubai-sports-city',
    detectedOn: '2026-10-01', direction: -1, value: 1087.73, baseline: 2006.24, magnitudePct: -45.78, beds: '1 Bed' },
  { type: 'discount_trade', entity: 'Damac Heights', area: 'Dubai Marina', community: 'dubai-marina',
    detectedOn: '2026-10-07', direction: -1, value: 948.91, baseline: 1812.09, magnitudePct: -47.63, beds: '3 Bed' },
  { type: 'discount_trade', entity: 'MBL Royal', area: 'JLT', community: 'jumeirah-lake-towers',
    detectedOn: '2026-10-12', direction: -1, value: 1034.43, baseline: 1979.10, magnitudePct: -47.73, beds: '1 Bed' },
  { type: 'discount_trade', entity: 'The Matrix', area: 'Dubai Sports City', community: 'dubai-sports-city',
    detectedOn: '2026-09-30', direction: -1, value: 906.93, baseline: 1343.66, magnitudePct: -32.50, beds: 'Studio' },
  { type: 'discount_trade', entity: 'Rukan 3', area: 'Rukan', community: 'rukan',
    detectedOn: '2026-10-06', direction: -1, value: 844.00, baseline: 1282.39, magnitudePct: -34.18, beds: '1 Bed villa' },
  { type: 'discount_trade', entity: 'Sandoval Gardens 1', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-01', direction: -1, value: 596.71, baseline: 898.43, magnitudePct: -33.58, beds: '1 Bed' },
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
        headline: `${Math.abs(s.magnitudePct).toFixed(1)}% below the median for its unit type`,
        detail: `${s.beds ? `A ${s.beds} registered` : 'Registered'} at ${psf(s.value)} against ${psf(s.baseline)}, the median of the project's registered ${s.beds ? `${s.beds} ` : ''}resales across its history.`,
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

  return `LIVE MARKET SIGNALS — the highest-scoring signals from the Felicity Price Index signal feed, detected over DLD registered transactions through ${PIX_SIGNALS_AS_OF}. Refer to them as "our signal list" or "the Felicity Price Index signals"; use no other name for them or their provider. These are real registered events. Cite them by name and date; never invent a comparable anecdote.
This is an EXTRACT: each section holds only the top of its type (the feed holds hundreds of PSF moves and below-trend runs). A project or district missing from these lists is not evidence that the feed has nothing there — never write "the feed shows no …"; say "none of the signals on our list".

TOP REGISTERED SALES:
${group('top_sale')}

NEW RECORD PRICE PER SQFT:
${group('record_psf')}

SALES VELOCITY (registered sales, last 3 months vs the prior 3 — often launches registering in bulk; velocity, not price strength):
${group('momentum')}

REGISTERED PSF MOVES (project-level, signed):
${group('psf_move')}

HIGHEST REGISTERED GROSS YIELDS (extreme top of the distribution — not typical returns):
${group('yield_leader')}

PROJECTS PRINTING PERSISTENTLY BELOW THEIR OWN 12-MONTH AVERAGE (the trailing average includes developer first sales, so a project moving from launch pricing to resale can print well below it without a like-for-like fall of that size):
${group('below_trend')}

SINGLE TRADES REGISTERED BELOW THE MEDIAN FOR THEIR UNIT TYPE (the median of the project's registered resales of the same bedrooms across its whole history — not a current price level):
${group('discount_trade')}`;
}
