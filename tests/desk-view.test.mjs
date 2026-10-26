// Every number in the Overview's Active Calls must be a registry figure
// from the Felicity Price Index files; the Historical Playbook must carry no percentages.
const root = new URL('../', import.meta.url).href;
const { DESK_CALLS, DESK_CALLS_NOTE, HISTORICAL_ANALOGS, PLAYBOOK_NOTE } = await import(root + 'js/prompts.js');
const { buildDeskContext, pixAreas, pixIndex } = await import(root + 'js/pix-data.js');
const { buildSignalContext, PIX_SIGNALS_AS_OF } = await import(root + 'js/pix-signals.js');
const { fetchMacroEvidence, renderMacroEvidence } = await import(root + 'lib/market-evidence.js');

const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

// The evidence the AI sees is the set of numbers the desk view may quote
const evidence = buildDeskContext() + '\n' + buildSignalContext();
const evidenceNums = new Set((evidence.match(/\d[\d,]*(?:\.\d+)?/g) || []).map(n => n.replace(/,/g, '')));
// Index levels are quoted to two decimals in the context; allow their 1dp forms too
[pixIndex.residential, pixIndex.apartment, pixIndex.villa].forEach(s => {
  evidenceNums.add(String(s.level)); evidenceNums.add(s.yoyPct.toFixed(1)); evidenceNums.add(Math.abs(s.yoyPct).toFixed(1));
});
// Every numeric field in the registry file is a registry figure, whether or
// not the AI context happens to print it (rental counts, villa sales)
const addNums = o => Object.values(o || {}).forEach(v => {
  if (typeof v === 'number') { evidenceNums.add(String(v)); evidenceNums.add(v.toFixed(1)); }
  else if (v && typeof v === 'object') addNums(v);
});
Object.values(pixAreas).forEach(addNums);

check(DESK_CALLS.length === 6, 'six active calls');
// A call may only lean on a signal the feed still holds (the Sep refresh
// dropped The Fields' discount trade and left the sentence asserting it)
{
  const { pixSignals } = await import('../js/pix-signals.js');
  const mbrCall = DESK_CALLS.find(c => c.area.startsWith('MBR City')).thesis;
  const mbrSigs = pixSignals.filter(s => s.area === 'MBR City' && ['below_trend', 'discount_trade'].includes(s.type));
  check(mbrSigs.every(s => mbrCall.includes(s.entity)) && (mbrSigs.length > 0 || !/has touched it/.test(mbrCall)), 'MBR call names exactly the dislocation signals the feed holds');
  const jvcCall = DESK_CALLS.find(c => c.area.startsWith('JVC'));
  const jvcRecord = pixSignals.some(s => s.area === 'JVC' && s.type === 'record_psf');
  check(jvcRecord || !/record-PSF/.test(jvcCall.risk), 'JVC risk mentions record-PSF printers only when the feed holds one');
}
for (const c of DESK_CALLS) {
  const text = `${c.thesis} ${c.risk}`.replace(/<[^>]+>/g, '');
  const nums = (text.match(/\d[\d,]*(?:\.\d+)?/g) || []).map(n => n.replace(/,/g, ''));
  for (const n of nums) {
    // Ordinal-free small integers like "12-month" and "three" are prose, not data
    if (/^(12|3|2|1)$/.test(n)) continue;
    check(evidenceNums.has(n), `${c.area}: "${n}" is not a registry figure`);
  }
  const regMarks = (c.thesis.match(/metric-src--reg/g) || []).length;
  check(regMarks >= 2, `${c.area}: thesis carries reg markers (${regMarks})`);
  check(!/undefined|NaN|n\/a/.test(text), `${c.area}: no undefined/NaN/n-a in copy`);
  check(['LONG', 'SHORT', 'AVOID', 'ACCUMULATE', 'TRIM', 'HOLD'].includes(c.call) && c.conviction >= 1 && c.conviction <= 5, `${c.area}: valid call and conviction`);
}
{
  const { PIX_AS_OF, PIX_WINDOW } = await import('../js/pix-data.js');
  check(DESK_CALLS_NOTE.includes(PIX_AS_OF) && DESK_CALLS_NOTE.includes(PIX_WINDOW) && DESK_CALLS_NOTE.includes(PIX_SIGNALS_AS_OF), 'desk note dated from the data files');
}

for (const a of HISTORICAL_ANALOGS) {
  check(!/\d+\s*%/.test(a.impact + a.lesson), `${a.event}: playbook carries no percentages`);
}
check(/directions only/i.test(PLAYBOOK_NOTE), 'playbook note says directions only');

// The macro fetch must respect its deadline when Yahoo hangs. The stub
// honours AbortSignal the way real fetch does, and otherwise never answers.
globalThis.fetch = (url, opts) => new Promise((resolve, reject) => {
  if (url.includes('finnhub')) return resolve({ ok: true, json: async () => [] });
  const t = setTimeout(() => reject(new Error('hung')), 60000);
  opts?.signal?.addEventListener('abort', () => { clearTimeout(t); const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
});
const t0 = Date.now();
const ev = await fetchMacroEvidence({ finnhubKey: 'x', timeoutMs: 1000, deadlineMs: 2500 });
const took = Date.now() - t0;
check(took < 4500, `macro fetch bounded by deadline (took ${took}ms)`);
check(ev.levels.every(l => !l.ok), 'all levels unavailable when Yahoo hangs');
check(ev.levels.some(l => /deadline|timeout/.test(l.error)), 'misses name the reason');
check(renderMacroEvidence(ev).includes('0 of 9 benchmarks live'), 'rendered as 0 of 9');

// ── Lessons from the 13 Oct audit ──
{
  const { pixSignals } = await import('../js/pix-signals.js');
  const { pixSeries } = await import('../js/pix-data.js');
  // A PSF move is a running measurement: one row per project, the newest
  const moveNames = pixSignals.filter(s => s.type === 'psf_move').map(s => s.entity);
  check(new Set(moveNames).size === moveNames.length, 'psf_move holds one detection per project');
  // Every stored magnitude is the arithmetic of its own value and baseline
  for (const s of pixSignals) {
    if (s.baseline && s.magnitudePct != null && s.type !== 'momentum') {
      const m = (s.value / s.baseline - 1) * 100;
      check(Math.abs(m - s.magnitudePct) < 0.06, `${s.type} ${s.entity}: magnitude ${s.magnitudePct} ≠ value/baseline ${m.toFixed(2)}`);
    }
    if (s.type === 'momentum') check(Math.abs(((s.value - s.baseline) / s.baseline) * 100 - s.magnitudePct) < 0.06, `momentum ${s.entity}: magnitude is not the velocity increase`);
    if (s.type === 'below_trend') check(s.magnitudePct < 0 && s.streak >= 3, `below_trend ${s.entity}: must be negative and persistent (streak ≥ 3)`);
    if (s.type === 'discount_trade') check(s.magnitudePct < 0 && s.value < s.baseline, `discount_trade ${s.entity}: must sit below its project median`);
  }
  // Every percentage handed to the AI is computable from the data files —
  // a hard-coded "MBR City (6.5%)" sat beside a computed 6.4% for two refreshes
  const pct = v => `${Math.abs(v).toFixed(1)}%`;
  const allowed = new Set();
  for (const p of Object.values(pixAreas)) {
    if (p.yieldPct != null) allowed.add(pct(p.yieldPct));
    if (p.villa?.yieldPct != null) allowed.add(pct(p.villa.yieldPct));
  }
  for (const seg of Object.values(pixIndex)) { allowed.add(pct(seg.yoyPct)); allowed.add(pct(seg.momPct)); }
  for (const key of ['level', 'apartment', 'villa']) {
    pixSeries.slice(1).forEach((p, k) => allowed.add(pct((p[key] / pixSeries[k][key] - 1) * 100)));
  }
  pixSeries.forEach(p => allowed.add(pct(p.yoyPct)));
  allowed.add(pct(pixIndex.villa.yoyPct - pixIndex.apartment.yoyPct));
  const desk = buildDeskContext();
  // Integers too: a typed "+12% YoY run" sat in the template for three
  // refreshes because this pattern only matched one decimal place
  const stray = (desk.match(/\d+(?:\.\d+)?%/g) || []).filter(x => !allowed.has(x));
  check(!stray.length, `buildDeskContext carries percentages not computed from the data: ${[...new Set(stray)].join(', ')}`);
}

if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log(`desk view: ${DESK_CALLS.length} calls, ${HISTORICAL_ANALOGS.length} analogs; macro deadline honoured in ${took}ms — all checks passed`);
process.exit(0);
