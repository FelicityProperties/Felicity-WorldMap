// ═══════════════════════════════════════════════════════════
// FELICITY PRICE INDEX SIGNALS — Real market signals from registered DLD evidence
// ═══════════════════════════════════════════════════════════
//
// Source: signal engine over Dubai Land Department registered
// transactions (PropertyIndex tools; public name Felicity Price Index). Snapshot 2026-10-26; open signals detected
// 2026-10-12 to 2026-10-24, DLD registrations loaded through September 2026.
//
// The rows are the feed as of its 24 Oct detection run (the engine re-ran
// on 26 Oct with unchanged values; one run is never mixed with another).
// Every row below is an actual detected event with a real detection
// date and real registered values, and it rests on MARKET registrations:
// the engine computes over every registration, so each price signal was
// checked against the registrations behind it (sales.prior_sale_relation)
// and left out when they were completion or title registrations, co-owner
// buyouts, related-party transfers, or single prints outside 0.5×–2× of
// their unit type's market median. Price signals are residential only
// (office and shop buildings are a different cohort). Nothing here is authored, estimated
// or illustrative. `area` is the community label for the engine's
// community_slug, added for display only.
//
// Signal-type semantics (they differ — do not mix them up):
//   top_sale       value = registered sale price (AED). No baseline: the
//                  engine's is its own earlier detection, not the
//                  project's highest sale.
//   record_psf     value = new record registered PSF for ONE unit type
//                  (beds) in one project; baseline = the previous record
//                  for that unit type. magnitudePct = the increase.
//   momentum       value = registered sales in the last 3 months;
//                  baseline = the prior 3 months. magnitudePct = the
//                  increase in velocity. psf = the engine's running PSF.
//   psf_move       not published — the engine's project PSF is a running
//                  blend across unit types, so its moves are unit mix.
//   yield_leader   value = Felicity's cohort-matched building yield as a
//                  decimal (0.1052 = 10.52%): median registered rent PSF
//                  (valid size) ÷ median market sale PSF, same property
//                  type, last 12 complete months, over salesCount sales
//                  and rentalCount tenancies. Candidates are the engine's
//                  leaders; its own figure (average rent ÷ average price)
//                  is not used. The extreme top of the distribution.
//   below_trend    value = current registered PSF; baseline = the
//                  project's own 12-month average PSF. magnitudePct =
//                  the discount. Persistent (streak ≥ 3). cause = 'launch'
//                  (the average holds developer first sales) or 'resale'
//                  (like-for-like resales cleared lower; trades = how many
//                  since PIX_BELOW_TREND_SINCE).
//   discount_trade value = registered PSF of a single resale; baseline =
//                  the median of the project's EARLIER resales of the same
//                  unit type (beds) and a size within ±15% — resaleCount
//                  of them — re-derived from the register, not the
//                  engine's project_median_psf (which includes first sales
//                  and non-market registrations). magnitudePct = the gap;
//                  a row is listed only at −15% or deeper.
// ═══════════════════════════════════════════════════════════

export const PIX_SIGNALS_AS_OF = '2026-10-24';
// Below-trend 'resale' rows count like-for-like resales registered from
// this date; bump it with the snapshot, never type the month into copy
export const PIX_BELOW_TREND_SINCE = '2026-08-01';
const sinceMonth = new Date(PIX_BELOW_TREND_SINCE + 'T00:00:00Z').toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
export const PIX_SIGNALS_SOURCE = 'Felicity Price Index signal feed over DLD registered transactions';

export const SIGNAL_TYPES = {
  top_sale:       { label: 'Top Sale',       tone: 'bullish' },
  record_psf:     { label: 'Record PSF',     tone: 'bullish' },
  momentum:       { label: 'Sales Momentum', tone: 'bullish' },
  yield_leader:   { label: 'Yield Leader',   tone: 'watch'   },
  below_trend:    { label: 'Below Trend',    tone: 'bearish' },
  discount_trade: { label: 'Discount Trade', tone: 'bearish' },
};

export const pixSignals = [
  // ── Top registered sales (by value) ──
  // Every top_sale signal in the feed that rests on a market registration
  // and that the engine marks as a new high (direction 1).
  // W Residences' AED 53.7M (16 Oct) is out: a related-party transfer
  // whose previous price equals its sale price. So are the two rows the
  // engine marks as falling (Eden Hills 15 Oct, Elysian Mansions 20 Oct):
  // its "prior top" is only its own earlier detection in the window (a
  // different, larger villa; Eden Hills registered more in June), so the
  // "x% below" read as a price fall that did not happen. For the same
  // reason no row carries the engine's baseline. Balqis Residences-Beach
  // Villas is registered as an apartment, so it is tagged by bedrooms.
  { type: 'top_sale', entity: 'Balqis Residences-Beach Villas', area: 'Palm Jumeirah', community: 'palm-jumeirah',
    detectedOn: '2026-10-24', direction: 1, value: 55000000, baseline: null, psf: 3953.26, beds: '5 Bed' },
  { type: 'top_sale', entity: 'Fleur De Jardin Villas', area: 'MBR City', community: 'mohammed-bin-rashid-city',
    detectedOn: '2026-10-14', direction: 1, value: 49484953, baseline: null, psf: 5338.44, beds: 'Villa' },
  { type: 'top_sale', entity: 'Eden Hills', area: 'MBR City', community: 'mohammed-bin-rashid-city',
    detectedOn: '2026-10-12', direction: 1, value: 43800000, baseline: null, psf: 3390.96, beds: 'Villa' },
  { type: 'top_sale', entity: 'Golf Place 2', area: 'Dubai Hills Estate', community: 'dubai-hills-estate',
    detectedOn: '2026-10-13', direction: 1, value: 35000000, baseline: null, psf: 2662.65, beds: 'Villa' },
  { type: 'top_sale', entity: 'Mareva The Oasis', area: 'The Oasis', community: 'the-oasis-by-emaar',
    detectedOn: '2026-10-17', direction: 1, value: 27479888, baseline: null, psf: 1866.05, beds: 'Villa' },
  { type: 'top_sale', entity: 'Victory Heights', area: 'Dubai Sports City', community: 'dubai-sports-city',
    detectedOn: '2026-10-21', direction: 1, value: 25000000, baseline: null, psf: 1486.24, beds: 'Villa' },

  // ── New record price per square foot, for one unit type in one project ──
  // The record print must be a market print inside 0.5×–2× of the unit
  // type's 12-month market median, with at least 3 prints to judge it by.
  // 26 Oct: Al Majara 3's record was a related-party transfer, and Rokane
  // G22, Al Khushkar, Massakin Al Furjan Block E and Norton Court 4 set
  // records for a unit type with almost no other recent evidence (0–2
  // reference prints), so none of them can be told from an odd unit.
  { type: 'record_psf', entity: 'Al Reem 1', area: 'Arabian Ranches', community: 'arabian-ranches',
    detectedOn: '2026-10-13', direction: 1, value: 2242.46, baseline: 2075.92, magnitudePct: 8.02, beds: '3 Bed villa' },
  { type: 'record_psf', entity: 'Weston Court 1', area: 'Motor City', community: 'motor-city',
    detectedOn: '2026-10-24', direction: 1, value: 1402.01, baseline: 1300, magnitudePct: 7.85, beds: '1 Bed' },
  { type: 'record_psf', entity: 'Claverton House 1', area: 'Motor City', community: 'motor-city',
    detectedOn: '2026-10-15', direction: 1, value: 1196.63, baseline: 1094.50, magnitudePct: 9.33, beds: '2 Bed' },
  { type: 'record_psf', entity: 'Park One', area: 'Jumeirah Village Triangle', community: 'jumeirah-village-triangle',
    detectedOn: '2026-10-21', direction: 1, value: 1201.57, baseline: 1107.65, magnitudePct: 8.48, beds: '1 Bed' },
  { type: 'record_psf', entity: 'Abbey Crescent 2', area: 'Motor City', community: 'motor-city',
    detectedOn: '2026-10-13', direction: 1, value: 1058.72, baseline: 1014.28, magnitudePct: 4.38, beds: '3 Bed' },
  { type: 'record_psf', entity: 'Avenue Residence 1', area: 'Al Furjan', community: 'al-furjan',
    detectedOn: '2026-10-20', direction: 1, value: 1141.41, baseline: 1112.49, magnitudePct: 2.60, beds: '2 Bed' },
  { type: 'record_psf', entity: 'Grand Views', area: 'Meydan', community: 'meydan',
    detectedOn: '2026-10-13', direction: 1, value: 2684.57, baseline: 2641.95, magnitudePct: 1.61, beds: '4 Bed villa' },
  { type: 'record_psf', entity: 'Marina Terrace', area: 'Dubai Marina', community: 'dubai-marina',
    detectedOn: '2026-10-16', direction: 1, value: 1803.31, baseline: 1782.12, magnitudePct: 1.19, beds: '2 Bed' },

  // ── Sales velocity: last 3 months against the prior 3 ──
  // A node is left out only when one of its ANCESTORS is also flagged —
  // the ancestor's registrations already include it (location_path in the
  // projects entity). 26 Oct: Damac District Tower B (the feed's top score,
  // under Damac District), Azizi Venice 6 Building H (under Azizi Venice 6)
  // and The Borough (under District 17) are out on that rule, which brings
  // in Jebel Ali Village Townhouses and The Horizon; further down, Trussardi
  // Residences Phase II and Binghatti Skyterraces would go the same way.
  // Standalone towers with no flagged ancestor (Azizi Milan 30, Regalia,
  // Sera Gardens) are projects in their own right and stay in. The counts
  // are the engine's and include a few non-homes and non-market rows
  // (Oxford Cove's 130 hold 4 shops, Damac District's prior quarter 4
  // offices, Regalia and Jebel Ali Village Townhouses one related-party
  // transfer each) — too few to change a row. The PSF beside each count is
  // the engine's running figure and could not be reproduced from the
  // registrations, so the card calls it the signal feed's.
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

  // ── No PSF moves ──
  // The engine's project PSF is a running blend of whatever registered
  // last, across unit types and sizes, so its moves are mostly unit mix.
  // 26 Oct: of the candidates whose prints were all market registrations,
  // every one moved on a different unit type or size (Onda by Kasco: a
  // studio after 1-Bed prints; Farm Grove "+33.8%" on a 4-Bed villa that
  // resold at its own previous price). None is published until a
  // like-for-like test (same unit type, size within ±15%) exists.

  // ── Highest registered gross yields, recomputed like the area yields ──
  // The engine's 15 leaders are the candidates, but its figure is average
  // rent ÷ average price: unit mix moves it (large flats let, small flats
  // sold) and office towers rank beside homes. Each is recomputed as the
  // median rent PSF of tenancies with a valid size ÷ the median PSF of
  // market sales, same property type, Oct 2025 – Sep 2026, with at least 5
  // sales and 10 tenancies. Out: three office/shop buildings (Diamond
  // Business Center Block A, Aura Central, Armada Tower 2), two
  // subcommunities whose rents and sales are different buildings (Zabeel 1,
  // Al Qusais Industrial Area 4), two with under 5 apartment sales (Building
  // Q01, Building S06) and Golf Panorama, the parent of Golf Panorama B.
  // Seven remain, so the list holds seven.
  { type: 'yield_leader', entity: 'Platinum One', area: 'Arjan', community: 'arjan',
    detectedOn: '2026-10-24', direction: 1, value: 0.1702, baseline: null, streak: 38, salesCount: 9, rentalCount: 271 },
  { type: 'yield_leader', entity: 'Building X03', area: 'International City', community: 'international-city',
    detectedOn: '2026-10-24', direction: 1, value: 0.1017, baseline: null, streak: 18, salesCount: 7, rentalCount: 54 },
  { type: 'yield_leader', entity: 'Building K05', area: 'International City', community: 'international-city',
    detectedOn: '2026-10-24', direction: 1, value: 0.0977, baseline: null, streak: 38, salesCount: 6, rentalCount: 42 },
  { type: 'yield_leader', entity: 'Hyatt Regency Creek Heights Residences', area: 'Bur Dubai', community: 'bur-dubai',
    detectedOn: '2026-10-24', direction: 1, value: 0.0948, baseline: null, streak: 38, salesCount: 6, rentalCount: 12 },
  { type: 'yield_leader', entity: 'Madison Columbus', area: 'Majan', community: 'majan',
    detectedOn: '2026-10-24', direction: 1, value: 0.0941, baseline: null, streak: 18, salesCount: 7, rentalCount: 45 },
  { type: 'yield_leader', entity: 'Building I08', area: 'International City', community: 'international-city',
    detectedOn: '2026-10-24', direction: 1, value: 0.0906, baseline: null, streak: 18, salesCount: 6, rentalCount: 56 },
  { type: 'yield_leader', entity: 'Golf Panorama B', area: 'DAMAC Hills', community: 'damac-hills',
    detectedOn: '2026-10-24', direction: 1, value: 0.0770, baseline: null, streak: 38, salesCount: 7, rentalCount: 52 },

  // ── Projects printing persistently below their own 12-month average ──
  // Residential only, streak ≥ 3, and the registrations that pulled the
  // print down must be market prints. Each row carries its cause: 'launch'
  // (the trailing average holds developer first sales — Binghatti Royale
  // 93 of 141, JLT Cluster Q 59 of 123, Binghatti Aurora 31 of 71) or
  // 'resale' (like-for-like resales cleared lower; `trades` is how many,
  // and four of the five rest on one). A gap that is only unit mix is not
  // listed, nor a node beside its ancestor (District 18 holds Binghatti
  // Royale). 26 Oct: Mayfair Residency, The Hamilton, Central Park Tower,
  // Canal Front Residence 6, both Opalz rows and Le Ciel 1 were printing
  // low on title registrations, co-owner buyouts or related-party
  // transfers; Al Twar 4, Springs 4 and Creek Crescent on single prints
  // far outside their unit type's range; The Binary Tower is offices.
  { type: 'below_trend', entity: 'Binghatti Royale', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-24', direction: -1, value: 1495.82, baseline: 2079.13, magnitudePct: -28.06, streak: 38, salesL12m: 141, offplanPct: 9.2, cause: 'launch' },
  { type: 'below_trend', entity: 'JLT Cluster Q', area: 'JLT', community: 'jumeirah-lake-towers',
    detectedOn: '2026-10-24', direction: -1, value: 1421.26, baseline: 1956.80, magnitudePct: -27.37, streak: 18, salesL12m: 123, offplanPct: 46.3, cause: 'launch' },
  { type: 'below_trend', entity: 'The Address Jumeirah Resort and Spa', area: 'JBR', community: 'jumeirah-beach-residence',
    detectedOn: '2026-10-24', direction: -1, value: 3425.29, baseline: 4365.10, magnitudePct: -21.53, streak: 18, salesL12m: 62, offplanPct: 0, cause: 'resale', trades: 1 },
  { type: 'below_trend', entity: 'Binghatti Aurora', area: 'JVC', community: 'jumeirah-village-circle',
    detectedOn: '2026-10-24', direction: -1, value: 1293.31, baseline: 1626.36, magnitudePct: -20.48, streak: 24, salesL12m: 71, offplanPct: 8.5, cause: 'launch' },
  { type: 'below_trend', entity: 'The Paragon by IGO', area: 'Business Bay', community: 'business-bay',
    detectedOn: '2026-10-24', direction: -1, value: 1641.55, baseline: 2046.90, magnitudePct: -19.80, streak: 11, salesL12m: 38, offplanPct: 13.2, cause: 'resale', trades: 1 },
  { type: 'below_trend', entity: 'Azizi Riviera 26', area: 'Meydan', community: 'meydan',
    detectedOn: '2026-10-24', direction: -1, value: 1365.60, baseline: 1794.91, magnitudePct: -23.92, streak: 7, salesL12m: 16, offplanPct: 6.2, cause: 'resale', trades: 1 },
  { type: 'below_trend', entity: 'MAG 218', area: 'Dubai Marina', community: 'dubai-marina',
    detectedOn: '2026-10-24', direction: -1, value: 1099.27, baseline: 1370.65, magnitudePct: -19.80, streak: 12, salesL12m: 29, offplanPct: 0, cause: 'resale', trades: 2 },
  { type: 'below_trend', entity: 'Al Khail Heights 3A', area: 'Al Quoz', community: 'al-quoz',
    detectedOn: '2026-10-24', direction: -1, value: 683.00, baseline: 884.12, magnitudePct: -22.75, streak: 31, salesL12m: 18, offplanPct: 0, cause: 'resale', trades: 1 },

  // ── Single resales registered well below like-for-like resales ──
  // The trade must be a genuine resale (prior_buyer_sold) inside the band;
  // the baseline is the median of the project's EARLIER resales of the same
  // unit type and a size within ±15% (resaleCount of them, at least 10),
  // re-derived from the register; the gap must be 15% or more. The engine's
  // own median (project_median_psf) counts first sales and non-market
  // registrations, and its 24 rows (23 trades — Dune Residency's AED
  // 699,714 1-Bed sits in two threads) shrink to three: five were title
  // registrations or related-party transfers (Central Park Tower, Jebel Ali
  // Village, Hor Al Anz, The Crescent Tower C, Burj Royale), two were first
  // sales, one had only two reference prints (Florence 2), and twelve resales sat
  // less than 15% below like-for-like resales — The Spirit's "45.8%"
  // studio sat 3.6% below; Binghatti Aurora's "32%" was two layouts mixed.
  // Sobha Creek Vistas Reserve's and The Grand's trades were each one of
  // several same-day resales in the project at about one price (three
  // floor-2 1-Beds at 1,429–1,433 AED/sqft; three floor-59 2-Beds at a flat
  // AED 2.6M, this the largest) — a seller clearing units, not one odd sale.
  { type: 'discount_trade', entity: 'MBL Royal', area: 'JLT', community: 'jumeirah-lake-towers',
    detectedOn: '2026-10-12', direction: -1, value: 1034.43, baseline: 1881.71, magnitudePct: -45.03, beds: '1 Bed', resaleCount: 100 },
  { type: 'discount_trade', entity: 'Sobha Creek Vistas Reserve', area: 'MBR City', community: 'mohammed-bin-rashid-city',
    detectedOn: '2026-10-15', direction: -1, value: 1429.07, baseline: 2009.99, magnitudePct: -28.90, beds: '1 Bed', resaleCount: 114 },
  { type: 'discount_trade', entity: 'The Grand', area: 'Dubai Creek Harbour', community: 'dubai-creek-harbour-the-lagoons',
    detectedOn: '2026-10-15', direction: -1, value: 1959.66, baseline: 2477.11, magnitudePct: -20.89, beds: '2 Bed', resaleCount: 213 },
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

// Why a project prints below its own trailing average. A row whose gap is
// only unit mix (a large or odd unit registering at a lower PSF) is not
// listed at all; these are the two causes that are.
const BELOW_CAUSE = {
  launch: () => 'The trailing average still holds developer first sales, so this is where resale is clearing against launch pricing, not a like-for-like fall of that size.',
  resale: s => s.trades === 1
    ? `One like-for-like resale since ${sinceMonth} cleared this low — a single trade, not yet a trend.`
    : `${s.trades} like-for-like resales of the same unit type have cleared lower since ${sinceMonth}.`,
};

// Headline + supporting line, derived purely from the registered values
export function signalCopy(s) {
  switch (s.type) {
    case 'top_sale':
      return {
        headline: `${aed(s.value)} registered sale`,
        detail: s.baseline
          ? `Prior top sale ${aed(s.baseline)} — this trade came in ${Math.abs(s.magnitudePct).toFixed(1)}% ${s.magnitudePct < 0 ? 'below' : 'above'} it.`
          : `Flagged by the signal feed as a top sale for this project${s.psf ? ` — ${s.beds ? s.beds + ', ' : ''}${psf(s.psf)}` : ''}.`,
      };
    case 'record_psf':
      // A record for one unit type in one project, not necessarily the
      // project's highest print (in the 26 Oct rebuild, four records sat
      // below a dearer resale of another unit type in the same tower)
      return {
        headline: `New ${s.beds ? `${s.beds} ` : ''}record ${psf(s.value)}`,
        detail: `Previous ${s.beds ? `${s.beds} ` : ''}record ${psf(s.baseline)} — up ${s.magnitudePct.toFixed(1)}%. A record for this unit type in this project.`,
      };
    case 'momentum':
      return {
        headline: `${s.value.toLocaleString('en-US')} sales in 3 months, ${times(s.magnitudePct)} the prior 3`,
        detail: `${s.baseline.toLocaleString('en-US')} registered in the previous quarter. Current PSF on the signal feed ${psf(s.psf)}. Held for ${s.streak} consecutive observations.`,
      };
    case 'yield_leader':
      return {
        headline: `${(s.value * 100).toFixed(2)}% gross yield`,
        detail: `Median registered rent PSF ÷ median registered sale PSF for the building's ${s.cohort ? s.cohort.toLowerCase() : 'apartment'}s over the last 12 complete months (${s.salesCount} market sales, ${s.rentalCount} tenancies with a registered size). Top of the yield distribution, not a typical return.`,
      };
    case 'below_trend':
      return {
        headline: `${Math.abs(s.magnitudePct).toFixed(1)}% below its own 12-month average`,
        detail: `Registering at ${psf(s.value)} against a ${psf(s.baseline)} trailing average, for ${s.streak} consecutive observations. ${s.salesL12m} sales in the last 12 months, ${s.offplanPct}% off-plan. ${BELOW_CAUSE[s.cause]?.(s) || ''}`.trim(),
      };
    case 'discount_trade':
      return {
        headline: `${Math.abs(s.magnitudePct).toFixed(1)}% below like-for-like resales`,
        detail: `A ${s.beds} resale registered at ${psf(s.value)} against ${psf(s.baseline)}, the median of the project's ${s.resaleCount.toLocaleString('en-US')} earlier ${s.beds} resales of a similar size.`,
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

  return `LIVE MARKET SIGNALS — signals from the Felicity Price Index signal feed, detected over DLD registered transactions through ${PIX_SIGNALS_AS_OF}. Refer to them as "our signal list" or "the Felicity Price Index signals"; use no other name for them or their provider. These are real registered events. Cite them by name and date; never invent a comparable anecdote.
Every price row rests on market registrations only: completion or title registrations, co-owner buyouts, related-party or nominee transfers, and single prints far outside their unit type's range are left out, so a project the raw feed flags can be missing here on purpose. The sales-velocity counts are the feed's own and include a handful of non-market registrations.
Except for the top sales, each section is an EXTRACT holding only the top of its type (the feed holds hundreds of below-trend runs). A project or district missing from these lists is not evidence that the feed has nothing there — never write "the feed shows no …"; say "none of the signals on our list".

TOP REGISTERED SALES (every top-sale signal in the feed that rests on a market registration and sets a new high for its project in the feed's window):
${group('top_sale')}

NEW RECORD PRICE PER SQFT (each a record for one unit type in one project — not necessarily the project's highest print):
${group('record_psf')}

SALES VELOCITY (registered sales, last 3 months vs the prior 3 — often launches registering in bulk; velocity, not price strength):
${group('momentum')}

HIGHEST REGISTERED GROSS YIELDS (rent PSF ÷ sale PSF within one building and one property type — extreme top of the distribution, not typical returns):
${group('yield_leader')}

PROJECTS PRINTING PERSISTENTLY BELOW THEIR OWN 12-MONTH AVERAGE (each row says whether the gap is launch pricing in the trailing average or like-for-like resales clearing lower — quote that reason with the figure):
${group('below_trend')}

SINGLE RESALES REGISTERED AT LEAST 15% BELOW LIKE-FOR-LIKE RESALES (the median of the same project's earlier resales of the same unit type and a similar size — not a current price level):
${group('discount_trade')}`;
}
