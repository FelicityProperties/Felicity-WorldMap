// Front-month resolution by the exchange's expiry rule. Pinned to the
// dates the 2026-09-28 diag established: Yahoo's continuous BZ=F had
// already rolled to December (100.96) while November — the front month
// until 30 Sep, and the number Bloomberg/TradingView quoted — was 108.49.
import { frontMonth, frontMonthFor, yahooCandidates } from '../lib/futures.js';

const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };
const d = s => new Date(s + 'T12:00:00Z');

// Brent: delivery month M last trades on the last business day of M−2
check(frontMonth('BZ', d('2026-09-28')).symbol === 'BZX26.NYM', 'Brent on 28 Sep 2026 is November (last trade 30 Sep)');
check(frontMonth('BZ', d('2026-09-30')).symbol === 'BZX26.NYM' && frontMonth('BZ', d('2026-09-30')).lastTrade === '2026-09-30', 'Brent still November on its last trade day');
check(frontMonth('BZ', d('2026-10-01')).symbol === 'BZZ26.NYM', 'Brent rolls to December on 1 Oct');
check(frontMonth('BZ', d('2026-10-31')).symbol === 'BZF27.NYM', 'Brent on Sat 31 Oct (after Fri 30 Oct last trade) is January 2027');
check(frontMonth('BZ', d('2026-12-31')).symbol === 'BZG27.NYM' && frontMonth('BZ', d('2027-01-01')).symbol === 'BZH27.NYM', 'Brent on 31 Dec 2026 (Thu, last business day) is still February 2027; March from 1 Jan');

// WTI: delivery month M last trades three business days before the 25th of M−1
check(frontMonth('CL', d('2026-09-21')).symbol === 'CLV26.NYM', 'WTI on 21 Sep 2026 is October');
check(frontMonth('CL', d('2026-09-22')).symbol === 'CLV26.NYM' && frontMonth('CL', d('2026-09-22')).lastTrade === '2026-09-22', 'WTI October last trades 22 Sep (25th is a Friday)');
check(frontMonth('CL', d('2026-09-23')).symbol === 'CLX26.NYM', 'WTI rolls to November on 23 Sep');
check(frontMonth('CL', d('2026-09-28')).label === 'Nov 2026' && frontMonth('CL', d('2026-09-28')).lastTrade === '2026-10-20', 'WTI on 28 Sep is November, last trade 20 Oct (25 Oct is a Sunday → 23 Oct → three business days back)');

// Candidates: front month first, continuous as the fallback; other symbols untouched
const c = yahooCandidates('BZ=F', d('2026-09-28'));
check(c.length === 2 && c[0].symbol === 'BZX26.NYM' && c[0].contract === 'Nov 2026' && c[1].symbol === 'BZ=F' && c[1].contract === null, 'Brent candidates: November contract then BZ=F');
check(yahooCandidates('GC=F').length === 1 && yahooCandidates('GC=F')[0].symbol === 'GC=F', 'gold has no rule and is asked for as-is');
check(frontMonthFor('^GSPC') === null && frontMonth('XX') === null, 'unknown roots resolve to nothing, never a guess');

if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('futures: Brent and WTI front months resolve by the exchange rule on every pinned date — all checks passed');
