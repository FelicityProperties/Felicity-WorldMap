// ═══════════════════════════════════════════════════════════
// REGIONS — Region Intelligence Drawer
// ═══════════════════════════════════════════════════════════

import { regionIntel, regionMap } from './data.js';

let isOpen = false;

export function initRegionDrawer() {
  const closeBtn = document.getElementById('region-drawer-close');
  const overlay = document.getElementById('region-drawer-overlay');

  if (closeBtn) closeBtn.addEventListener('click', closeRegionDrawer);
  if (overlay) overlay.addEventListener('click', closeRegionDrawer);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen) closeRegionDrawer();
  });
}

export function getRegionForCountry(countryName) {
  const region = regionMap[countryName];
  if (!region) return null;

  // Map granular regions to the 7 main regions
  const mapping = {
    'N. America': 'N. America',
    'S. America': 'S. America',
    'C. America': 'S. America',
    'Caribbean': 'S. America',
    'Europe': 'Europe',
    'Europe/Asia': 'Europe',
    'Africa': 'Africa',
    'Middle East': 'Middle East',
    'Asia': 'Asia',
    'C. Asia': 'Asia',
    'Oceania': 'Oceania',
    'Caucasus': 'Europe'
  };

  return mapping[region] || region;
}

export function openRegionDrawer(regionName) {
  const drawer = document.getElementById('region-drawer');
  const overlay = document.getElementById('region-drawer-overlay');
  if (!drawer) return;

  const intel = regionIntel[regionName];
  if (!intel) return;

  const content = document.getElementById('region-drawer-content');
  if (!content) return;

  // Sentiment colors
  const sentimentColors = {
    bullish: { color: 'var(--semantic-green)', bg: 'var(--semantic-green-glow)' },
    cautious: { color: 'var(--semantic-amber)', bg: 'var(--semantic-amber-glow)' },
    neutral: { color: 'var(--semantic-blue)', bg: 'var(--semantic-blue-glow)' },
    mixed: { color: 'var(--semantic-amber)', bg: 'var(--semantic-amber-glow)' },
    stable: { color: 'var(--semantic-green)', bg: 'var(--semantic-green-glow)' },
    bearish: { color: 'var(--semantic-red)', bg: 'var(--semantic-red-glow)' }
  };

  const sc = sentimentColors[intel.sentiment] || sentimentColors.neutral;
  const pressurePct = (intel.geopoliticalPressure / 10 * 100).toFixed(0);
  const pressureColor = intel.geopoliticalPressure >= 7 ? 'var(--semantic-red)' : intel.geopoliticalPressure >= 4 ? 'var(--semantic-amber)' : 'var(--semantic-green)';

  content.innerHTML = `
    <div class="rd__region-name">${regionName}</div>
    <div class="rd__sentiment" style="color:${sc.color};background:${sc.bg}">
      ${intel.sentiment.toUpperCase()}
    </div>

    <div class="rd__section-title">Headline</div>
    <div class="rd__headline">${intel.headlineIssue}</div>

    <div class="rd__section-title">Macro Signals</div>
    <div class="rd__macro-grid">
      <div class="rd__macro-item">
        <span class="rd__macro-label">Inflation</span>
        <span class="rd__macro-value">${intel.macroSignals.inflation}%</span>
      </div>
      <div class="rd__macro-item">
        <span class="rd__macro-label">Rate Direction</span>
        <span class="rd__macro-value">${intel.macroSignals.rateDirection}</span>
      </div>
      <div class="rd__macro-item">
        <span class="rd__macro-label">GDP Growth</span>
        <span class="rd__macro-value">${intel.macroSignals.gdpGrowth}%</span>
      </div>
    </div>

    <div class="rd__section-title">Geopolitical Pressure</div>
    <div class="rd__pressure">
      <div class="rd__pressure-bar">
        <div class="rd__pressure-fill" style="width:${pressurePct}%;background:${pressureColor}"></div>
      </div>
      <span class="rd__pressure-value" style="color:${pressureColor}">${intel.geopoliticalPressure}/10</span>
    </div>

    <div class="rd__section-title">Market Outlook</div>
    <div class="rd__outlook-grid">
      <div class="rd__outlook-item">
        <span class="rd__outlook-label">Short Term</span>
        <span class="rd__outlook-value">${intel.marketOutlook.short}</span>
      </div>
      <div class="rd__outlook-item">
        <span class="rd__outlook-label">Medium Term</span>
        <span class="rd__outlook-value">${intel.marketOutlook.medium}</span>
      </div>
      <div class="rd__outlook-item">
        <span class="rd__outlook-label">Long Term</span>
        <span class="rd__outlook-value">${intel.marketOutlook.long}</span>
      </div>
    </div>

    <div class="rd__section-title">Real Estate Impact</div>
    <div class="rd__impact-text">${intel.realEstateImpact}</div>

    <div class="rd__section-title">Key Risks</div>
    <div class="rd__risks">
      ${intel.keyRisks.map(r => `<div class="rd__risk-item">\u26A0 ${r}</div>`).join('')}
    </div>
  `;

  drawer.classList.add('is-open');
  if (overlay) overlay.classList.add('is-open');
  isOpen = true;
}

export function closeRegionDrawer() {
  const drawer = document.getElementById('region-drawer');
  const overlay = document.getElementById('region-drawer-overlay');
  if (drawer) drawer.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-open');
  isOpen = false;
}
