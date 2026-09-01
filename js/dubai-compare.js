// ═══════════════════════════════════════════════════════════
// DUBAI COMPARE — two areas, side by side, on registry evidence
// ═══════════════════════════════════════════════════════════
//
// Every number in the comparison is a registered-transaction median from
// PropertyIndex (DLD evidence) already living in js/pix-data.js, and every
// figure carries the same window and `reg` provenance as the area cards.
// The one desk-opinion row (sentiment) is labelled as exactly that.
//
// The point of comparing two areas is deciding between them — so the
// panel ends where that decision continues: a WhatsApp thread with the
// desk, pre-filled with the two areas being weighed.
// ═══════════════════════════════════════════════════════════

import { dubaiAreas } from './data.js';
import { pixAreas, PIX_AS_OF, PIX_WINDOW, fmtCount, fmtPrice, fmtRent, fmtAedBillions, yieldClass } from './pix-data.js';
import { escapeHtml, safeUrl } from './safe.js';

const esc = escapeHtml;

// Areas we can honestly compare: those with registry coverage
const comparable = () => Object.keys(pixAreas).sort();

function deskViewFor(name) {
  return dubaiAreas.find(a => a.name === name) || null;
}

// Relative difference of A over B, shown on A's side
function relPct(a, b) {
  if (a == null || b == null || !b) return null;
  return ((a - b) / b) * 100;
}

function deltaBadge(pct, { higherIsBetter = true } = {}) {
  if (pct == null) return '';
  const good = higherIsBetter ? pct > 0 : pct < 0;
  const cls = Math.abs(pct) < 0.05 ? 'even' : good ? 'lead' : 'trail';
  return `<span class="dcmp__delta dcmp__delta--${cls}">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</span>`;
}

// Yield gaps are stated in percentage points — the unit that matters —
// never as a relative percent of a percent.
function ppBadge(a, b) {
  if (a == null || b == null) return '';
  const pp = a - b;
  const cls = Math.abs(pp) < 0.05 ? 'even' : pp > 0 ? 'lead' : 'trail';
  return `<span class="dcmp__delta dcmp__delta--${cls}">${pp >= 0 ? '+' : ''}${pp.toFixed(1)} pp</span>`;
}

function row(label, aHtml, bHtml, note = '') {
  return `
    <div class="dcmp__row">
      <div class="dcmp__label">${label}${note ? `<em>${note}</em>` : ''}</div>
      <div class="dcmp__cell">${aHtml}</div>
      <div class="dcmp__cell">${bHtml}</div>
    </div>`;
}

function renderComparison(host, nameA, nameB) {
  const A = pixAreas[nameA], B = pixAreas[nameB];
  const out = host.querySelector('#dcmp-out');
  if (!A || !B || !out) return;

  const dA = deskViewFor(nameA), dB = deskViewFor(nameB);
  const wa = txt => `https://wa.me/971563520611?text=${encodeURIComponent(txt)}`;

  out.innerHTML = `
    <div class="dcmp__panel">
      <div class="dcmp__heads">
        <div class="dcmp__spacer"></div>
        <div class="dcmp__area">
          <span class="dcmp__area-name">${esc(nameA)}</span>
          <a class="dcmp__area-link" href="${safeUrl(A.url)}" target="_blank" rel="noopener">PIX ↗</a>
        </div>
        <div class="dcmp__area">
          <span class="dcmp__area-name">${esc(nameB)}</span>
          <a class="dcmp__area-link" href="${safeUrl(B.url)}" target="_blank" rel="noopener">PIX ↗</a>
        </div>
      </div>

      ${row('Registered sales', `${fmtCount(A.sales)}`, `${fmtCount(B.sales)}`, 'last 12 months')}
      ${row('Registered value', fmtAedBillions(A.valueAed), fmtAedBillions(B.valueAed))}
      ${row('Registered rentals', fmtCount(A.rentals), fmtCount(B.rentals))}
      ${row(`Median PSF <span class="dcmp__cohort">(${esc(A.cohort)})</span>`,
            `AED ${fmtCount(A.psf)} ${deltaBadge(relPct(A.psf, B.psf), { higherIsBetter: false })}`,
            `AED ${fmtCount(B.psf)}`,
            'lower buys more')}
      ${row('Median sale price', fmtPrice(A.price), fmtPrice(B.price))}
      ${row('Median annual rent', fmtRent(A.rent), fmtRent(B.rent))}
      ${row('Gross yield',
            A.yieldPct != null
              ? `<strong class="dcmp__yield dcmp__yield--${yieldClass(A.yieldPct)}">${A.yieldPct.toFixed(1)}%</strong> ${ppBadge(A.yieldPct, B.yieldPct)}`
              : 'unavailable',
            B.yieldPct != null ? `<strong class="dcmp__yield dcmp__yield--${yieldClass(B.yieldPct)}">${B.yieldPct.toFixed(1)}%</strong>` : 'unavailable',
            'cohort-matched')}
      ${A.villa && B.villa
        ? row('Villa cohort PSF / yield',
              `AED ${fmtCount(A.villa.psf)} · ${A.villa.yieldPct != null ? A.villa.yieldPct.toFixed(1) + '%' : '—'}`,
              `AED ${fmtCount(B.villa.psf)} · ${B.villa.yieldPct != null ? B.villa.yieldPct.toFixed(1) + '%' : '—'}`)
        : ''}
      ${dA && dB
        ? row('Desk view <em class="dcmp__desk-mark">desk — not registry data</em>',
              `${esc(dA.sentiment || '—')}`,
              `${esc(dB.sentiment || '—')}`)
        : ''}

      <div class="dcmp__foot">
        <span class="dcmp__prov"><span class="dcmp__reg">reg</span> Registered DLD evidence via PropertyIndex ·
          ${esc(PIX_WINDOW)} · as of ${esc(PIX_AS_OF)}. Medians are cohort-matched — never apartment rents over villa prices.</span>
        <a class="dcmp__cta" href="${safeUrl(wa(`Hi Felicity, I'm weighing ${nameA} against ${nameB} — can we talk it through?`))}"
           target="_blank" rel="noopener">💬 Weigh these two with the desk</a>
      </div>
    </div>`;
}

export function initDubaiCompare() {
  const grid = document.getElementById('dubai-grid');
  if (!grid || document.getElementById('dcmp')) return;

  const names = comparable();
  const opts = sel => names.map(n => `<option value="${esc(n)}"${n === sel ? ' selected' : ''}>${esc(n)}</option>`).join('');

  const box = document.createElement('section');
  box.className = 'dcmp';
  box.id = 'dcmp';
  box.innerHTML = `
    <div class="dcmp__bar">
      <div class="dcmp__title">Compare two areas
        <em>${names.length} areas with registered DLD evidence</em>
      </div>
      <div class="dcmp__controls">
        <select class="dcmp__select" id="dcmp-a">${opts('Dubai Marina')}</select>
        <span class="dcmp__vs">vs</span>
        <select class="dcmp__select" id="dcmp-b">${opts('Downtown Dubai')}</select>
        <button class="dcmp__go" id="dcmp-go">Compare</button>
      </div>
    </div>
    <div id="dcmp-out"></div>`;

  grid.parentNode.insertBefore(box, grid);

  const run = () => {
    const a = box.querySelector('#dcmp-a').value;
    const b = box.querySelector('#dcmp-b').value;
    if (a === b) {
      box.querySelector('#dcmp-out').innerHTML =
        '<div class="dcmp__same">Pick two different areas to compare.</div>';
      return;
    }
    renderComparison(box, a, b);
  };

  box.querySelector('#dcmp-go').addEventListener('click', run);
}
