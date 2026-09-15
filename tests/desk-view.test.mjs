// Every number in the Overview's Active Calls must be a registry figure
// from the PIX files; the Historical Playbook must carry no percentages.
const root = new URL('../', import.meta.url).href;
const { DESK_CALLS, DESK_CALLS_NOTE, HISTORICAL_ANALOGS, PLAYBOOK_NOTE } = await import(root + 'js/prompts.js');
const { buildDeskContext, pixAreas, pixIndex } = await import(root + 'js/pix-data.js');
const { buildSignalContext } = await import(root + 'js/pix-signals.js');
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
check(/registered DLD medians \(Aug 2026\)/.test(DESK_CALLS_NOTE) && DESK_CALLS_NOTE.includes('2026-09-13'), 'desk note dated from the data files');

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

if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log(`desk view: ${DESK_CALLS.length} calls, ${HISTORICAL_ANALOGS.length} analogs; macro deadline honoured in ${took}ms — all checks passed`);
process.exit(0);
