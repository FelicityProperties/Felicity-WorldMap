// ═══════════════════════════════════════════════════════════
// DUBAI INTEL — Area Cards with Search, Filter, Sort
// ═══════════════════════════════════════════════════════════

import { dubaiAreas } from './data.js';

let currentSort = 'score';
let currentFilter = '';

export function initDubaiIntel() {
  renderCards();
  initSearch();
  initFilters();
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
      areas.sort((a, b) => b.rentalYield - a.rentalYield);
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
        <div class="dubai-card__metrics">
          <div class="dubai-card__metric">
            <span class="dubai-card__metric-label">Price</span>
            <span class="dubai-card__metric-value ${dirClass}">${dirIcon} ${area.priceDirection}</span>
          </div>
          <div class="dubai-card__metric">
            <span class="dubai-card__metric-label">Yield</span>
            <span class="dubai-card__metric-value dubai-card__metric-value--accent">${area.rentalYield}%</span>
          </div>
          <div class="dubai-card__metric">
            <span class="dubai-card__metric-label">Demand</span>
            <span class="dubai-card__metric-value">${area.demandStrength}/10</span>
          </div>
          <div class="dubai-card__metric">
            <span class="dubai-card__metric-label">Outlook</span>
            <span class="dubai-card__metric-value">${area.investorOutlook}</span>
          </div>
          <div class="dubai-card__metric">
            <span class="dubai-card__metric-label">Score</span>
            <span class="dubai-card__metric-value dubai-card__metric-value--accent">${area.opportunityScore}</span>
          </div>
          <div class="dubai-card__metric">
            <span class="dubai-card__metric-label">Sentiment</span>
            <span class="dubai-card__metric-value ${dirClass}">${area.sentiment}</span>
          </div>
        </div>
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
