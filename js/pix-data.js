// ═══════════════════════════════════════════════════════════
// PIX DATA — Official Dubai market evidence snapshot
// ═══════════════════════════════════════════════════════════
//
// Source: Dubai Land Department data modelled by PropertyIndex
// (propertyindex.ae). Snapshot taken 2026-08-24; last complete
// calendar month 2026-07. All values are registered-transaction
// evidence, not estimates. L12M = last 12 complete months.
// ═══════════════════════════════════════════════════════════

export const PIX_AS_OF = 'Jul 2026';
export const PIX_SOURCE = 'DLD data modelled by PropertyIndex';

// ── PIX Market Index (base Jan 2012 = 100) ──
export const pixIndex = {
  residential: { level: 205.98, momPct: -2.08, yoyPct: -2.62, medianPsf: 1672, txCount: 9582 },
  apartment:   { level: 200.58, momPct: -2.00, yoyPct: -3.26, medianPsf: 1688, txCount: 8746 },
  villa:       { level: 263.68, momPct: -2.63, yoyPct: 1.61,  medianPsf: 1510, txCount: 836 },
};

// Trailing 13 months, residential segment (index level)
export const pixSeries = [
  { month: 'Jul 25', level: 211.52 },
  { month: 'Aug 25', level: 213.34 },
  { month: 'Sep 25', level: 214.65 },
  { month: 'Oct 25', level: 216.98 },
  { month: 'Nov 25', level: 218.95 },
  { month: 'Dec 25', level: 223.16 },
  { month: 'Jan 26', level: 221.57 },
  { month: 'Feb 26', level: 220.21 },
  { month: 'Mar 26', level: 218.79 },
  { month: 'Apr 26', level: 217.62 },
  { month: 'May 26', level: 215.82 },
  { month: 'Jun 26', level: 210.37 },
  { month: 'Jul 26', level: 205.98 },
];

// ── Per-area registered activity (L12M through Jul 2026) ──
// Keyed by the area name used in dubaiAreas. `scope` notes when the
// DLD master community is broader/different than the marketing name.
export const pixAreas = {
  'Downtown Dubai':          { sales: 3492,  valueAed: 15639383166, rentals: 6353,  projects: 133, url: 'https://www.propertyindex.ae/communities/downtown-dubai' },
  'Dubai Marina':            { sales: 2501,  valueAed: 6997571130,  rentals: 7257,  projects: 121, url: 'https://www.propertyindex.ae/communities/dubai-marina' },
  'Dubai Creek Harbour':     { sales: 3029,  valueAed: 8600775568,  rentals: 3784,  projects: 45,  url: 'https://www.propertyindex.ae/communities/dubai-creek-harbour' },
  'Dubai Hills Estate':      { sales: 2986,  valueAed: 11289329034, rentals: 3806,  projects: 68,  url: 'https://www.propertyindex.ae/communities/dubai-hills-estate' },
  'Business Bay':            { sales: 9532,  valueAed: 31113943119, rentals: 27000, projects: 164, url: 'https://www.propertyindex.ae/communities/business-bay' },
  'Palm Jumeirah':           { sales: 1257,  valueAed: 12479156249, rentals: 2102,  projects: 81,  url: 'https://www.propertyindex.ae/communities/palm-jumeirah' },
  'JVC':                     { sales: 13672, valueAed: 16277420451, rentals: 15139, projects: 405, url: 'https://www.propertyindex.ae/communities/jumeirah-village-circle' },
  'Dubai South':             { sales: 13061, valueAed: 18295885591, rentals: 3833,  projects: 159, url: 'https://www.propertyindex.ae/communities/dubai-south' },
  // Expo City projects register under the Dubai South master community
  'Expo City':               { sales: 13061, valueAed: 18295885591, rentals: 3833,  projects: 159, scope: 'Dubai South incl. Expo City', url: 'https://www.propertyindex.ae/communities/dubai-south' },
  'Mohammed Bin Rashid City': { sales: 325,  valueAed: 3802795459,  rentals: 772,   projects: 39,  scope: 'MBR City District One', url: 'https://www.propertyindex.ae/communities/mohammed-bin-rashid-al-maktoum-city-district-one' },
  'DAMAC Hills':             { sales: 1890,  valueAed: 4833067950,  rentals: 2596,  projects: 52,  url: 'https://www.propertyindex.ae/communities/damac-hills' },
  'JLT':                     { sales: 2117,  valueAed: 4490557441,  rentals: 5699,  projects: 78,  url: 'https://www.propertyindex.ae/communities/jumeirah-lakes-towers' },
  // Meydan One + Meydan Racecourse Community combined
  'Meydan':                  { sales: 1999,  valueAed: 3968595958,  rentals: 5436,  projects: 99,  scope: 'Meydan One + Racecourse', url: 'https://www.propertyindex.ae/communities/meydan-one' },
  'Arjan':                   { sales: 3861,  valueAed: 4321811385,  rentals: 4972,  projects: 85,  url: 'https://www.propertyindex.ae/communities/arjan' },
  'Town Square':             { sales: 2045,  valueAed: 3233653242,  rentals: 3178,  projects: 41,  url: 'https://www.propertyindex.ae/communities/town-square' },
  'Jumeirah':                { sales: 105,   valueAed: 5173355981,  rentals: 0,     projects: 4,   url: 'https://www.propertyindex.ae/communities/jumeirah' },
  // DIFC runs its own land registry; DLD coverage is partial
  'DIFC':                    { sales: 147,   valueAed: 1118459450,  rentals: 0,     projects: 1,   scope: 'DLD-registered only', url: 'https://www.propertyindex.ae/communities/dubai-international-financial-center' },
  // Emaar Beachfront sits inside the Dubai Harbour master community
  'Emaar Beachfront':        { sales: 825,   valueAed: 5852598665,  rentals: 1010,  projects: 19,  scope: 'Dubai Harbour', url: 'https://www.propertyindex.ae/communities/dubai-harbour' },
  // Dubai Islands registers under the legacy Palm Deira community
  'Dubai Islands':           { sales: 3138,  valueAed: 10242591802, rentals: 2,     projects: 98,  scope: 'Palm Deira', url: 'https://www.propertyindex.ae/communities/palm-deira' },
};

// ── Formatting helpers ──
export function fmtAedBillions(v) {
  if (v >= 1e9) return `AED ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `AED ${(v / 1e6).toFixed(0)}M`;
  return `AED ${Math.round(v).toLocaleString('en-US')}`;
}

export function fmtCount(n) {
  return n.toLocaleString('en-US');
}

export function fmtPct(p) {
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(1)}%`;
}

// Inline SVG sparkline of the 13-month PIX residential series
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
