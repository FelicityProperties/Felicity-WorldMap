// ═══════════════════════════════════════════════════════════
// DUBAI INTEL — Area Cards with Search, Filter, Sort
// ═══════════════════════════════════════════════════════════

import { dubaiAreas } from './data.js';
import {
  pixIndex, pixAreas, PIX_AS_OF, PIX_SOURCE, PIX_WINDOW,
  fmtAedBillions, fmtCount, fmtPct, fmtPrice, fmtRent, yieldClass, pixSparkline,
} from './pix-data.js';
import { safeUrl } from './safe.js';

// Registry yield where PropertyIndex has evidence, else the desk estimate
function effectiveYield(area) {
  const p = pixAreas[area.name];
  return (p && p.yieldPct != null) ? p.yieldPct : area.rentalYield;
}

let currentSort = 'score';
let currentFilter = '';

export function initDubaiIntel() {
  renderPixStrip();
  renderCards();
  initSearch();
  initFilters();
}

// ── PIX Market Index strip (official DLD-derived evidence) ──
function renderPixStrip() {
  const section = document.getElementById('section-dubai');
  const controls = section ? section.querySelector('.dubai-controls') : null;
  if (!controls || document.getElementById('pix-strip')) return;

  const seg = (label, d) => {
    const yoyClass = d.yoyPct >= 0 ? 'up' : 'dn';
    const momClass = d.momPct >= 0 ? 'up' : 'dn';
    return `
      <div class="pix-strip__seg">
        <div class="pix-strip__seg-label">${label}</div>
        <div class="pix-strip__seg-level">${d.level.toFixed(1)}</div>
        <div class="pix-strip__seg-changes">
          <span class="pix-chg pix-chg--${yoyClass}">${fmtPct(d.yoyPct)} YoY</span>
          <span class="pix-chg pix-chg--${momClass}">${fmtPct(d.momPct)} MoM</span>
        </div>
        <div class="pix-strip__seg-meta">AED ${fmtCount(d.medianPsf)}/sqft · ${fmtCount(d.txCount)} tx/mo</div>
      </div>`;
  };

  const html = `
    <div class="pix-strip" id="pix-strip">
      <div class="pix-strip__head">
        <div class="pix-strip__title">PIX Market Index <span class="pix-strip__badge">Official Evidence</span></div>
        <div class="pix-strip__spark">${pixSparkline(140, 34)}<span class="pix-strip__spark-label">13-mo trend</span></div>
      </div>
      <div class="pix-strip__grid">
        ${seg('Residential', pixIndex.residential)}
        ${seg('Apartments', pixIndex.apartment)}
        ${seg('Villas', pixIndex.villa)}
      </div>
      <div class="pix-strip__source">Source: ${PIX_SOURCE} · index as of ${PIX_AS_OF} (base Jan 2012 = 100) · area medians from registered transactions ${PIX_WINDOW} · gross yields exclude service charges and voids · <a href="https://www.propertyindex.ae" target="_blank" rel="noopener">propertyindex.ae ↗</a></div>
    </div>`;

  controls.insertAdjacentHTML('beforebegin', html);
}

// Metrics grid — registry medians first, desk scores second.
// Values sourced from the DLD register carry a "reg" marker; the rest
// are Felicity desk assessments.
function metricsHtml(area, dirClass, dirIcon) {
  const p = pixAreas[area.name];
  const reg = '<span class="metric-src metric-src--reg" title="Registered DLD evidence">reg</span>';

  const yieldVal = (p && p.yieldPct != null)
    ? `<span class="dubai-card__metric-value dubai-card__metric-value--accent">${p.yieldPct.toFixed(1)}%${reg}</span>`
    : `<span class="dubai-card__metric-value dubai-card__metric-value--accent">${area.rentalYield}%<span class="metric-src" title="Felicity desk estimate — no registry evidence in window">est</span></span>`;

  const psfVal = p
    ? `<span class="dubai-card__metric-value">${fmtCount(p.psf)}${reg}</span>`
    : '<span class="dubai-card__metric-value">—</span>';

  const priceVal = p
    ? `<span class="dubai-card__metric-value">${fmtPrice(p.price)}${reg}</span>`
    : '<span class="dubai-card__metric-value">—</span>';

  const rentVal = (p && p.rent != null)
    ? `<span class="dubai-card__metric-value">${fmtRent(p.rent)}${reg}</span>`
    : '<span class="dubai-card__metric-value">—</span>';

  return `
        <div class="dubai-card__metrics">
          <div class="dubai-card__metric">
            <span class="dubai-card__metric-label">Med. PSF</span>
            ${psfVal}
          </div>
          <div class="dubai-card__metric">
            <span class="dubai-card__metric-label">Gross Yield</span>
            ${yieldVal}
          </div>
          <div class="dubai-card__metric">
            <span class="dubai-card__metric-label">Med. Price</span>
            ${priceVal}
          </div>
          <div class="dubai-card__metric">
            <span class="dubai-card__metric-label">Med. Rent</span>
            ${rentVal}
          </div>
          <div class="dubai-card__metric">
            <span class="dubai-card__metric-label">Price Trend</span>
            <span class="dubai-card__metric-value ${dirClass}">${dirIcon} ${area.priceDirection}</span>
          </div>
          <div class="dubai-card__metric">
            <span class="dubai-card__metric-label">Score</span>
            <span class="dubai-card__metric-value dubai-card__metric-value--accent">${area.opportunityScore}</span>
          </div>
        </div>
        ${villaRowHtml(p)}`;
}

// Second cohort line for communities with meaningful villa volume
function villaRowHtml(p) {
  if (!p || !p.villa) return '';
  const v = p.villa;
  return `
        <div class="pix-cohort">
          <span class="pix-cohort__label">Villas</span>
          <span class="pix-cohort__stats">${fmtCount(v.psf)}/sqft · ${fmtPrice(v.price)} · ${fmtRent(v.rent)} · <strong class="pix-cohort__yield pix-cohort__yield--${yieldClass(v.yieldPct)}">${v.yieldPct.toFixed(1)}%</strong></span>
        </div>`;
}

// Evidence footer for one area card — registered DLD activity, L12M
function pixEvidenceHtml(areaName) {
  const p = pixAreas[areaName];
  if (!p) return '';
  const scope = p.scope ? ` <span class="pix-evidence__scope">(${p.scope})</span>` : '';
  const note = p.note ? `<div class="pix-evidence__note">${p.note}</div>` : '';
  return `
    <div class="pix-evidence">
      <span class="pix-evidence__badge">DLD L12M</span>
      <span class="pix-evidence__stats">${fmtCount(p.sales)} sales · ${fmtAedBillions(p.valueAed)} · ${fmtCount(p.rentals)} rentals${scope}</span>
      <a class="pix-evidence__link" href="${safeUrl(p.url)}" target="_blank" rel="noopener" title="Registered activity ${PIX_WINDOW} — ${PIX_SOURCE}">↗</a>
    </div>${note}`;
}

function getFilteredAreas() {
  let areas = [...dubaiAreas];

  // Search filter
  if (currentFilter) {
    const q = currentFilter.toLowerCase();
    areas = areas.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.sentiment.toLowerCase().includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q)) ||
      a.description.toLowerCase().includes(q)
    );
  }

  // Sort
  switch (currentSort) {
    case 'score':
      areas.sort((a, b) => b.opportunityScore - a.opportunityScore);
      break;
    case 'yield':
      areas.sort((a, b) => effectiveYield(b) - effectiveYield(a));
      break;
    case 'demand':
      areas.sort((a, b) => b.demandStrength - a.demandStrength);
      break;
    case 'name':
      areas.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  return areas;
}

function renderCards() {
  const grid = document.getElementById('dubai-grid');
  if (!grid) return;

  const areas = getFilteredAreas();

  if (!areas.length) {
    grid.innerHTML = '<div class="dubai-empty">No areas match your search</div>';
    return;
  }

  grid.innerHTML = areas.map((area, i) => {
    const sentimentClass = `dubai-card__sentiment--${area.sentiment}`;
    const sentimentIcon = area.sentiment === 'bullish' ? '\u25B2' : area.sentiment === 'bearish' ? '\u25BC' : '\u25C6';
    const dirClass = area.priceDirection === 'up' ? 'dubai-card__metric-value--up' : area.priceDirection === 'down' ? 'dubai-card__metric-value--down' : 'dubai-card__metric-value--stable';
    const dirIcon = area.priceDirection === 'up' ? '\u25B2' : area.priceDirection === 'down' ? '\u25BC' : '\u25C6';

    return `
      <div class="dubai-card" style="animation-delay:${i * 50}ms">
        <div class="dubai-card__accent"></div>
        <div class="dubai-card__header">
          <div class="dubai-card__name">${area.name}</div>
          <span class="dubai-card__sentiment ${sentimentClass}">${sentimentIcon} ${area.sentiment}</span>
        </div>
        <div class="dubai-card__desc">${area.description}</div>
        ${metricsHtml(area, dirClass, dirIcon)}
        <div class="dubai-card__score-section">
          <span class="dubai-card__score-label">Opportunity</span>
          <div class="dubai-card__score-bar">
            <div class="dubai-card__score-fill" style="width:${area.opportunityScore * 10}%"></div>
          </div>
          <span class="dubai-card__score-value">${area.opportunityScore}/10</span>
        </div>
        <div class="dubai-card__tags">
          ${area.tags.map(t => `<span class="dubai-card__tag">${t}</span>`).join('')}
        </div>
        ${pixEvidenceHtml(area.name)}
        <div class="dubai-card__cta">
          <a href="https://wa.me/971563520611?text=Hi%20Felicity%2C%20I'm%20interested%20in%20${encodeURIComponent(area.name)}%20real%20estate.%20Can%20we%20discuss%3F" target="_blank" rel="noopener" class="dubai-card__whatsapp">
            <span class="dubai-card__whatsapp-icon">&#x1F4AC;</span> WhatsApp
          </a>
          <button class="dubai-card__consult" data-area="${area.name}">Book a Call</button>
        </div>
      </div>
    `;
  }).join('');
}

function initSearch() {
  const input = document.getElementById('dubai-search');
  if (!input) return;

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      currentFilter = input.value.trim();
      renderCards();
    }, 200);
  });
}

function initFilters() {
  const container = document.getElementById('dubai-filters');
  if (!container) return;

  container.addEventListener('click', e => {
    const btn = e.target.closest('.dubai-filter-btn');
    if (!btn) return;

    const sort = btn.dataset.sort;
    if (sort) {
      currentSort = sort;
      container.querySelectorAll('.dubai-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCards();
    }
  });
}
