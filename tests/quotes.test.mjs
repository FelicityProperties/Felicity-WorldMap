// The day's move is measured against the last close on a day BEFORE the
// quote's own session. Two Yahoo shapes broke the older "second-to-last
// close" rule: a repeated today bar (~0% move) and a today bar with no
// close yet (a two-day move). chartPreviousClose is the close before the
// window and must never be used when the series has the answer.
import { yahooPrevClose } from '../lib/market-evidence.js';

const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };
const t = (d, h = 20) => Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00Z`) / 1000;
const days = ['2026-09-25', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'];
const series = (closes, extra = {}) => ({ meta: { regularMarketTime: t('2026-10-01', 9), chartPreviousClose: 90, ...extra }, timestamp: days.map(d => t(d)), indicators: { quote: [{ close: closes }] } });

check(yahooPrevClose(series([95, 98, 100, 104.32, 100.69])) === 104.32, 'normal series: yesterday');
check(yahooPrevClose(series([95, 98, 100, 104.32, null])) === 104.32, 'today bar without a close: still yesterday');
{
  const r = series([95, 98, 100, 104.32, 101]);
  r.timestamp.push(t('2026-10-01', 10)); r.indicators.quote[0].close.push(100.69);
  check(yahooPrevClose(r) === 104.32, 'repeated today bar: still yesterday, not today');
}
check(yahooPrevClose(series([95, 98, 100, null, 100.69])) === 100, 'missing yesterday close: the last earlier session');
check(yahooPrevClose({ meta: { chartPreviousClose: 90 } }) === 90, 'no series: falls back to Yahoo meta');
check(yahooPrevClose({}) === null, 'nothing at all: null, never a guess');

if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('quotes: prior close is the last earlier session on every Yahoo series shape — all checks passed');
