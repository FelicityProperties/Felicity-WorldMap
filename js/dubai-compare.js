// ═══════════════════════════════════════════════════════════
// DUBAI COMPARE — two areas, side by side, on registry evidence
// ═══════════════════════════════════════════════════════════
//
// Every number in the comparison is a registered-transaction median from
// the Felicity Price Index (DLD evidence) already living in js/pix-data.js, and every
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

  // Never divide or difference across cohorts. An area whose headline is
  // its villa cohort (Jumeirah) is compared with the other area's villa
  // cohort when it has one; otherwise each side is labelled and no delta
  // is drawn.
  const asCohort = (p, cohort) => p.cohort === cohort ? p : (cohort === 'Villa' && p.villa ? { ...p.villa, cohort: 'Villa' } : null);
  let cA = A, cB = B;
  if (A.cohort !== B.cohort) {
    const pick = A.cohort === 'Villa' ? 'Villa' : B.cohort === 'Villa' ? 'Villa' : null;
    if (pick && asCohort(A, pick) && asCohort(B, pick)) { cA = asCohort(A, pick); cB = asCohort(B, pick); }
  }
  const same = cA.cohort === cB.cohort;
  // Value and rental totals are the headline cohort's, so they are not
  // shown once a side has been switched to its villa cohort
  const swapped = cA !== A || cB !== B;
  const tag = c => ` <span class="dcmp__cohort">(${esc(c.cohort)})</span>`;
  const cohortNote = [A.note && `${esc(nameA)}: ${esc(A.note)}`, B.note && `${esc(nameB)}: ${esc(B.note)}`,
    !same && 'The two areas\' registered evidence is in different property types, so no difference is computed.',
    same && swapped && `Both shown as villa cohorts so like is compared with like.`].filter(Boolean).join(' ');
  const wa = txt => `https://wa.me/971563520611?text=${encodeURIComponent(txt)}`;

  out.innerHTML = `
    <div class="dcmp__panel">
      <div class="dcmp__heads">
        <div class="dcmp__spacer"></div>
        <div class="dcmp__area">
          <span class="dcmp__area-name">${esc(nameA)}</span>
        </div>
        <div class="dcmp__area">
          <span class="dcmp__area-name">${esc(nameB)}</span>
        </div>
      </div>

      ${row(`Registered sales${same ? ` <span class="dcmp__cohort">(${esc(cA.cohort)})</span>` : ''}`, `${fmtCount(cA.sales)}`, `${fmtCount(cB.sales)}`, 'last 12 months')}
      ${swapped ? '' : row('Registered value', fmtAedBillions(A.valueAed), fmtAedBillions(B.valueAed))}
      ${swapped ? '' : row('Registered rentals', fmtCount(A.rentals), fmtCount(B.rentals))}
      ${cohortNote ? `<div class="dcmp__row dcmp__row--note"><div class="dcmp__label">Cohort</div><div class="dcmp__cell dcmp__cell--wide">${cohortNote}</div></div>` : ''}
      ${row(`Median PSF ${same ? `<span class="dcmp__cohort">(${esc(cA.cohort)})</span>` : ''}`,
            `AED ${fmtCount(cA.psf)}${same ? ` ${deltaBadge(relPct(cA.psf, cB.psf), { higherIsBetter: false })}` : tag(cA)}`,
            `AED ${fmtCount(cB.psf)}${same ? '' : tag(cB)}`,
            same ? 'lower buys more' : 'different cohorts — not compared')}
      ${row('Median sale price', fmtPrice(cA.price) + (same ? '' : tag(cA)), fmtPrice(cB.price) + (same ? '' : tag(cB)))}
      ${row('Median annual rent', fmtRent(cA.rent) + (same ? '' : tag(cA)), fmtRent(cB.rent) + (same ? '' : tag(cB)))}
      ${row('Gross yield',
            cA.yieldPct != null
              ? `<strong class="dcmp__yield dcmp__yield--${yieldClass(cA.yieldPct)}">${cA.yieldPct.toFixed(1)}%</strong> ${same ? ppBadge(cA.yieldPct, cB.yieldPct) : tag(cA)}`
              : 'unavailable',
            cB.yieldPct != null ? `<strong class="dcmp__yield dcmp__yield--${yieldClass(cB.yieldPct)}">${cB.yieldPct.toFixed(1)}%</strong>${same ? '' : tag(cB)}` : 'unavailable',
            'cohort-matched')}
      ${A.villa && B.villa && cA === A && cB === B
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
        <span class="dcmp__prov"><span class="dcmp__reg">reg</span> Registered DLD evidence · Felicity Price Index ·
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
