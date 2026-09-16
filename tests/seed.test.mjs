// The client data module may carry symbol metadata and reference sets, but
// never a market price or a headline: those come from the live endpoints
// or are not shown. This pins that, so a seeded "price: 3234" cannot creep
// back and scroll under the LIVE badge during an outage.
const { markets, news } = await import('../js/data.js');

const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

check(Array.isArray(markets) && markets.length >= 15, `markets metadata present (${markets.length})`);
for (const m of markets) {
  check(m.price == null && m.chg == null && !m.live, `${m.sym}: no seeded price/chg/live flag`);
  check(typeof m.sym === 'string' && typeof m.name === 'string', `${m.sym}: symbol metadata intact`);
}
check(Array.isArray(news) && news.length === 0, `news starts empty (${news.length})`);

// The ticker must render words, not numbers, from this state
const src = await import('node:fs').then(fs => fs.readFileSync(new URL('../js/ticker.js', import.meta.url), 'utf8'));
check(/m\.live && typeof m\.price === 'number'/.test(src), 'ticker filters on fetched prices');
check(/tick-item--empty/.test(src), 'ticker has an explicit empty state');

// And loadFromAPI must not re-seed from the static /api/data fixtures
const dataSrc = await import('node:fs').then(fs => fs.readFileSync(new URL('../js/data.js', import.meta.url), 'utf8'));
check(!/replaceArray\(markets,/.test(dataSrc) && !/replaceArray\(news,/.test(dataSrc), '/api/data does not seed markets or news');

if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log(`seed guard: ${markets.length} instruments carry no seeded price, news starts empty — all checks passed`);
