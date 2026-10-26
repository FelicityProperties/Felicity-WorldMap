// ═══════════════════════════════════════════════════════════
// FELICITY PRICE INDEX SIGNALS — Real market signals from registered DLD evidence
// ═══════════════════════════════════════════════════════════
//
// Source: signal engine over Dubai Land Department registered
// transactions (PropertyIndex tools; public name Felicity Price Index). Snapshot 2026-10-26; open signals detected
// 2026-10-12 to 2026-10-24, DLD registrations loaded through September 2026.
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

export const PIX_SIGNALS_AS_OF = '2026-10-24';
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
  // ── Top registered sales (the whole feed for this type, by value) ──
  // Each row is one registered trade; Eden Hills appears twice because it
  // registered two (its 15 Oct trade came in below the 9 Oct top sale).
  // Balqis Residences-Beach Villas is registered as an apartment, so it is
  // tagged by bedrooms, not as a villa.
  { type: 'top_sale', entity: 'Balqis Residences-Beach Villas', area: 'Palm Jumeirah', community: 'palm-jumeirah',
    detectedOn: '2026-10-24', direction: 1, value: 55000000, baseline: null, psf: 3953.26, beds: '5 Bed' },
  { type: 'top_sale', entity: 'W Residences', area: 'Palm Jumeirah', community: 'palm-jumeirah',
    detectedOn: '2026-10-16', direction: 1, value: 53700555, baseline: null, psf: 4128.04, beds: '4 Bed' },
  { type: 'top_sale', entity: 'Fleur De Jardin Villas', area: 'MBR City', community: 'mohammed-bin-rashid-city',
    detectedOn: '2026-10-14', direction: 1, value: 49484953, baseline: null, psf: 5338.44, beds: 'Villa' },
  { type: 'top_sale', entity: 'Eden Hills', area: 'MBR City', community: 'mohammed-bin-rashid-city',
    detectedOn: '2026-10-12', direction: 1, value: 43800000, baseline: 34900000, magnitudePct: 25.50, psf: 3390.96, beds: 'Villa' },
  { type: 'top_sale', entity: 'Golf Place 2', area: 'Dubai Hills Estate', community: 'dubai-hills-estate',
    detectedOn: '2026-10-13', direction: 1, value: 35000000, baseline: null, psf: 2662.65, beds: 'Villa' },
  { type: 'top_sale', entity: 'Eden Hills', area: 'MBR City', community: 'mohammed-bin-rashid-city',
    detectedOn: '2026-10-15', direction: -1, value: 33300000, baseline: 43800000, magnitudePct: -23.97, psf: 2747.81, beds: 'Villa' },
  { type: 'top_sale', entity: 'Elysian Mansions', area: 'Tilal Al Ghaf', community: 'tilal-al-ghaf',
    detectedOn: '2026-10-20', direction: -1, value: 28000000, baseline: 38500000, magnitudePct: -27.27, psf: 3141.65, beds: 'Villa' },
  { type: 'top_sale', entity: 'Mareva The Oasis', area: 'The Oasis', community: 'the-oasis-by-emaar',
    detectedOn: '2026-10-17', direction: 1, value: 27479888, baseline: null, psf: 1866.05, beds: 'Villa' },
  { type: 'top_sale', entity: 'Victory Heights', area: 'Dubai Sports City', community: 'dubai-sports-city',
    detectedOn: '2026-10-21', direction: 1, value: 25000000, baseline: null, psf: 1486.24, beds: 'Villa' },

  // ── New record price per square foot ──
  { type: 'record_psf', entity: 'Rokane G22', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-20', direction: 1, value: 1764.88, baseline: 1486.69, magnitudePct: 18.71 },
  { type: 'record_psf', entity: 'Al Reem 1', area: 'Arabian Ranches', community: 'arabian-ranches',
    detectedOn: '2026-10-13', direction: 1, value: 2242.46, baseline: 2075.92, magnitudePct: 8.02 },
  { type: 'record_psf', entity: 'Al Majara 3', area: 'Dubai Marina', community: 'dubai-marina',
    detectedOn: '2026-10-12', direction: 1, value: 2640.91, baseline: 2362.98, magnitudePct: 11.76 },
  { type: 'record_psf', entity: 'Al Khushkar', area: 'Palm Jumeirah', community: 'palm-jumeirah',
    detectedOn: '2026-10-20', direction: 1, value: 2537.83, baseline: 2318.17, magnitudePct: 9.48 },
  { type: 'record_psf', entity: 'Massakin Al Furjan Block E', area: 'Al Furjan', community: 'al-furjan',
    detectedOn: '2026-10-14', direction: 1, value: 1425.67, baseline: 1291.82, magnitudePct: 10.36 },
  { type: 'record_psf', entity: 'Weston Court 1', area: 'Motor City', community: 'motor-city',
    detectedOn: '2026-10-24', direction: 1, value: 1402.01, baseline: 1300.00, magnitudePct: 7.85 },
  { type: 'record_psf', entity: 'Norton Court 4', area: 'Motor City', community: 'motor-city',
    detectedOn: '2026-10-13', direction: 1, value: 1089.55, baseline: 1001.96, magnitudePct: 8.74 },
  { type: 'record_psf', entity: 'Claverton House 1', area: 'Motor City', community: 'motor-city',
    detectedOn: '2026-10-15', direction: 1, value: 1196.63, baseline: 1094.50, magnitudePct: 9.33 },

  // ── Sales velocity: last 3 months against the prior 3 ──
  // A node is left out only when one of its ANCESTORS is also flagged —
  // the ancestor's registrations already include it (location_path in the
  // projects entity). 26 Oct: Damac District Tower B (the feed's top score,
  // under Damac District), Azizi Venice 6 Building H (under Azizi Venice 6),
  // The Borough (under District 17) and Trussardi Residences Phase II
  // (under Trussardi Residences) are out on that rule, and so is Binghatti
  // Skyterraces, whose figures are identical to its flagged parent Dubai
  // Autodrome and Business Park's. Standalone towers with no flagged
  // ancestor (Azizi Milan 30, Regalia, Sera Gardens) are projects in their
  // own right and stay in.
  { type: 'momentum', entity: 'Arancia Yards By Beyond', area: 'City of Arabia', community: 'city-of-arabia',
    detectedOn: '2026-10-24', direction: 1, value: 239, baseline: 8, magnitudePct: 2887.5, streak: 18, psf: 1601.43 },
  { type: 'momentum', entity: 'Azizi Milan 30', area: 'City of Arabia', community: 'city-of-arabia',
    detectedOn: '2026-10-24', direction: 1, value: 284, baseline: 21, magnitudePct: 1252.38, streak: 38, psf: 1628.95 },
  { type: 'momentum', entity: 'Regalia By Deyaar', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-10-24', direction: 1, value: 54, baseline: 5, magnitudePct: 980, streak: 38, psf: 1789.94 },
  { type: 'momentum', entity: 'Sera Gardens by Vision', area: 'Dubai Production City', community: 'dubai-production-city-impz',
    detectedOn: '2026-10-24', direction: 1, value: 120, baseline: 16, magnitudePct: 650, streak: 18, psf: 1543.87 },
  { type: 'momentum', entity: 'Damac District', area: 'DAMAC Hills', community: 'damac-hills',
    detectedOn: '2026-10-24', direction: 1, value: 298, baseline: 67, magnitudePct: 344.78, streak: 38, psf: 1771.99 },
  { type: 'momentum', entity: 'Oxford Cove', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-24', direction: 1, value: 130, baseline: 31, magnitudePct: 319.35, streak: 18, psf: 1575.01 },
  { type: 'momentum', entity: 'Jebel Ali Village Townhouses', area: 'Jebel Ali', community: 'jebel-ali',
    detectedOn: '2026-10-24', direction: 1, value: 45, baseline: 10, magnitudePct: 350, streak: 38, psf: 1653.46 },
  { type: 'momentum', entity: 'The Horizon at Sobha Central', area: 'Jebel Ali', community: 'jebel-ali',
    detectedOn: '2026-10-24', direction: 1, value: 61, baseline: 15, magnitudePct: 306.67, streak: 18, psf: 2800.50 },

  // ── Registered PSF moves against the project's prior print ──
  // The NEWEST detection per project, ranked by that row's score. A PSF
  // move is a running measurement, so a later detection supersedes an
  // earlier one: 26 Oct, J ONE's +70.8% (14 Oct) became −11.5% on 17 Oct
  // and The Metropolis's +75.2% (12 Oct) −8.4% on 20 Oct, each scoring
  // below the cut; Chic Tower's newest row reverses its own −11.7% of
  // 12 Oct. No project here has a flagged ancestor (the same rule as
  // momentum: a tower under a flagged project is inside its move).
  { type: 'psf_move', entity: 'Chic Tower', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-10-24', direction: 1, value: 4852.77, baseline: 1942.65, baselineDate: '2026-10-12', magnitudePct: 149.80, salesL12m: 23 },
  { type: 'psf_move', entity: 'Springs 9', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-20', direction: 1, value: 1201.59, baseline: 552.95, baselineDate: '2026-10-19', magnitudePct: 117.31, salesL12m: 27 },
  { type: 'psf_move', entity: 'Aykon City Tower B', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-10-24', direction: 1, value: 2676.20, baseline: 1680.97, baselineDate: '2026-10-21', magnitudePct: 59.21, salesL12m: 110 },
  { type: 'psf_move', entity: 'Kempinski BLVD', area: 'Downtown Dubai', community: 'downtown-dubai',
    detectedOn: '2026-10-17', direction: 1, value: 4808.15, baseline: 3385.75, baselineDate: '2026-10-16', magnitudePct: 42.01, salesL12m: 45 },
  { type: 'psf_move', entity: 'Beach Isle', area: 'Dubai Harbour', community: 'dubai-harbour',
    detectedOn: '2026-10-15', direction: 1, value: 4300.32, baseline: 2848.03, baselineDate: '2026-10-14', magnitudePct: 50.99, salesL12m: 22 },
  { type: 'psf_move', entity: 'The Hamilton', area: 'Town Square', community: 'town-square',
    detectedOn: '2026-10-12', direction: -1, value: 966.34, baseline: 1419.83, baselineDate: '2026-10-08', magnitudePct: -31.94, salesL12m: 88 },
  { type: 'psf_move', entity: 'Berkeley Square', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-14', direction: 1, value: 1578.37, baseline: 1255.10, baselineDate: '2026-10-13', magnitudePct: 25.76, salesL12m: 170 },
  { type: 'psf_move', entity: 'Central Park Tower', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-14', direction: -1, value: 706.61, baseline: 1169.98, baselineDate: '2026-10-13', magnitudePct: -39.60, salesL12m: 25 },

  // ── Highest registered gross yields (top of distribution) ──
  { type: 'yield_leader', entity: 'Platinum One', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-10-24', direction: 1, value: 0.1505, baseline: null, streak: 38 },
  { type: 'yield_leader', entity: 'Diamond Business Center Block A', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-10-24', direction: 1, value: 0.1339, baseline: null, streak: 38 },
  { type: 'yield_leader', entity: 'Aura Central', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-10-24', direction: 1, value: 0.1329, baseline: null, streak: 18 },
  { type: 'yield_leader', entity: 'Golf Panorama B', area: 'DAMAC Hills', community: 'damac-hills',
    detectedOn: '2026-10-24', direction: 1, value: 0.1308, baseline: null, streak: 38 },
  { type: 'yield_leader', entity: 'Building K05', area: 'International City', community: 'international-city',
    detectedOn: '2026-10-24', direction: 1, value: 0.1225, baseline: null, streak: 38 },
  { type: 'yield_leader', entity: 'Hyatt Regency Creek Heights Residences', area: 'Bur Dubai', community: 'bur-dubai',
    detectedOn: '2026-10-24', direction: 1, value: 0.1208, baseline: null, streak: 38 },
  { type: 'yield_leader', entity: 'Madison Columbus', area: 'Majan', community: 'majan',
    detectedOn: '2026-10-24', direction: 1, value: 0.1208, baseline: null, streak: 18 },
  { type: 'yield_leader', entity: 'Building Q01', area: 'International City', community: 'international-city',
    detectedOn: '2026-10-24', direction: 1, value: 0.1167, baseline: null, streak: 37 },

  // ── Projects printing persistently below their own 12-month average ──
  // Persistent means streak ≥ 3. The Hamilton (streak 1 on 12 Oct) has
  // held for 11 observations and is now in.
  { type: 'below_trend', entity: 'Binghatti Royale', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-24', direction: -1, value: 1495.82, baseline: 2079.13, magnitudePct: -28.06, streak: 38, salesL12m: 141, offplanPct: 9 },
  { type: 'below_trend', entity: 'Mayfair Residency', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-10-24', direction: -1, value: 736.89, baseline: 1348.34, magnitudePct: -45.35, streak: 38, salesL12m: 20, offplanPct: 0 },
  { type: 'below_trend', entity: 'The Hamilton', area: 'Town Square', community: 'town-square',
    detectedOn: '2026-10-24', direction: -1, value: 966.34, baseline: 1376.02, magnitudePct: -29.77, streak: 11, salesL12m: 88, offplanPct: 46 },
  { type: 'below_trend', entity: 'JLT Cluster Q', area: 'JLT', community: 'jumeirah-lake-towers',
    detectedOn: '2026-10-24', direction: -1, value: 1421.26, baseline: 1956.80, magnitudePct: -27.37, streak: 18, salesL12m: 123, offplanPct: 46 },
  { type: 'below_trend', entity: 'Central Park Tower', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-24', direction: -1, value: 706.61, baseline: 1149.91, magnitudePct: -38.55, streak: 9, salesL12m: 25, offplanPct: 0 },
  { type: 'below_trend', entity: 'Al Twar 4', area: 'Al Twar', community: 'al-twar',
    detectedOn: '2026-10-24', direction: -1, value: 192.32, baseline: 311.52, magnitudePct: -38.26, streak: 7, salesL12m: 25, offplanPct: 0 },
  { type: 'below_trend', entity: 'Le Ciel 1', area: 'Jumeirah', community: 'jumeirah',
    detectedOn: '2026-10-24', direction: -1, value: 2020.35, baseline: 3351.94, magnitudePct: -39.73, streak: 18, salesL12m: 22, offplanPct: 32 },
  { type: 'below_trend', entity: 'Springs 4', area: 'The Springs', community: 'the-springs',
    detectedOn: '2026-10-24', direction: -1, value: 997.95, baseline: 1558.52, magnitudePct: -35.97, streak: 23, salesL12m: 24, offplanPct: 0 },

  // ── Single trades registered materially below their unit-type median ──
  // Baseline and discount come from the engine's EVIDENCE
  // (project_median_psf, below_median_pct), not the signal's
  // baseline_value: on a repeat detection that field holds the previous
  // trade (Dune Residency's 18 Oct row carries 758.61, its last trade,
  // where the evidence median is 945.32). A thread is usually one trade,
  // but not always: Dune Residency's 1-Bed of 16 Oct (AED 699,714) sits in
  // two threads (detected 17 and 19 Oct), so trades are de-duplicated on
  // project, registration date, price and unit before ranking. Top 12 by
  // score; Dune Residency's rows fall just below the cut.
  { type: 'discount_trade', entity: 'The Spirit', area: 'Dubai Sports City', community: 'dubai-sports-city',
    detectedOn: '2026-10-24', direction: -1, value: 1260.85, baseline: 2323.98, magnitudePct: -45.75, beds: 'Studio' },
  { type: 'discount_trade', entity: 'Central Park Tower', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-14', direction: -1, value: 522.99, baseline: 950.00, magnitudePct: -44.95, beds: '1 Bed' },
  { type: 'discount_trade', entity: 'Jebel Ali Village', area: 'Jebel Ali', community: 'jebel-ali',
    detectedOn: '2026-10-16', direction: -1, value: 108.92, baseline: 177.37, magnitudePct: -38.59, beds: 'villa' },
  { type: 'discount_trade', entity: 'MBL Royal', area: 'JLT', community: 'jumeirah-lake-towers',
    detectedOn: '2026-10-12', direction: -1, value: 1034.43, baseline: 1979.10, magnitudePct: -47.73, beds: '1 Bed' },
  { type: 'discount_trade', entity: 'Hor Al Anz', area: 'Deira', community: 'deira',
    detectedOn: '2026-10-20', direction: -1, value: 418.65, baseline: 599.99, magnitudePct: -30.23, beds: 'villa' },
  { type: 'discount_trade', entity: 'Sobha Creek Vistas Reserve', area: 'MBR City', community: 'mohammed-bin-rashid-city',
    detectedOn: '2026-10-15', direction: -1, value: 1429.07, baseline: 2066.18, magnitudePct: -30.84, beds: '1 Bed' },
  { type: 'discount_trade', entity: 'The Matrix', area: 'Dubai Sports City', community: 'dubai-sports-city',
    detectedOn: '2026-10-16', direction: -1, value: 968.78, baseline: 1335.86, magnitudePct: -27.48, beds: 'Studio' },
  { type: 'discount_trade', entity: 'Binghatti Aurora', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-14', direction: -1, value: 974.99, baseline: 1433.02, magnitudePct: -31.96, beds: '1 Bed' },
  { type: 'discount_trade', entity: 'The Grand', area: 'Dubai Creek Harbour', community: 'dubai-creek-harbour-the-lagoons',
    detectedOn: '2026-10-15', direction: -1, value: 1959.66, baseline: 2583.34, magnitudePct: -24.14, beds: '2 Bed' },
  { type: 'discount_trade', entity: 'The Crescent Tower C', area: 'Dubai Production City', community: 'dubai-production-city-impz',
    detectedOn: '2026-10-20', direction: -1, value: 595.34, baseline: 767.72, magnitudePct: -22.45, beds: '2 Bed' },
  { type: 'discount_trade', entity: 'JW Marriott Hotel Marina', area: 'Dubai Marina', community: 'dubai-marina',
    detectedOn: '2026-10-13', direction: -1, value: 2097.13, baseline: 2494.33, magnitudePct: -15.92, beds: '1 Bed' },
  { type: 'discount_trade', entity: 'Hameni Tower', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-20', direction: -1, value: 911.55, baseline: 1158.63, magnitudePct: -21.33, beds: '1 Bed' },
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
