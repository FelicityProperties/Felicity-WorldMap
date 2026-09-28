// ═══════════════════════════════════════════════════════════
// FUTURES — which contract is the front month, by the exchange's rule
// ═══════════════════════════════════════════════════════════
//
// Yahoo's continuous symbols (BZ=F, CL=F) roll to the next month on
// Yahoo's own schedule, not the exchange's. On 2026-09-28 the diag showed
// BZ=F already equal to the December contract (100.96) while November —
// still the front month until its last trade on 30 Sep — stood at 108.49,
// which is what Bloomberg and TradingView quoted. Seven and a half dollars
// of backwardation, and the site was on the wrong side of it.
//
// So oil is quoted as the exchange's front month, resolved here from the
// calendar, with the continuous symbol only as a fallback. Rules (weekends
// only; exchange holidays are not modelled, which can be off by a day
// around a holiday expiry):
//
//   Brent (ICE, mirrored by NYMEX BZ): the contract for delivery month M
//     last trades on the last business day of month M−2.
//   WTI (NYMEX CL): the contract for delivery month M last trades three
//     business days before the 25th of month M−1 (the 25th moved to the
//     prior business day if it falls on a weekend).
// ═══════════════════════════════════════════════════════════

export const MONTH_CODES = 'FGHJKMNQUVXZ';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 86400000;

const isWeekend = d => d.getUTCDay() === 0 || d.getUTCDay() === 6;
const priorBusinessDay = d => { let x = d; while (isWeekend(x)) x = new Date(x.getTime() - DAY); return x; };
const lastBusinessDay = (y, m) => priorBusinessDay(new Date(Date.UTC(y, m + 1, 0)));
function businessDaysBefore(d, n) {
  let x = d, k = 0;
  while (k < n) { x = new Date(x.getTime() - DAY); if (!isWeekend(x)) k++; }
  return x;
}

// Last trade day of the contract for delivery month (y, m); m may overflow
const RULES = {
  BZ: { name: 'Brent', lastTrade: (y, m) => lastBusinessDay(y, m - 2) },
  CL: { name: 'WTI',   lastTrade: (y, m) => businessDaysBefore(priorBusinessDay(new Date(Date.UTC(y, m - 1, 25))), 3) },
};

/** The front-month contract for a root on a date: symbol, label, last trade day. */
export function frontMonth(root, date = new Date()) {
  const rule = RULES[root];
  if (!rule) return null;
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  for (let k = 0; k < 8; k++) {
    const y = date.getUTCFullYear(), m = date.getUTCMonth() + k;
    const last = rule.lastTrade(y, m);
    if (last.getTime() >= today) {
      const d = new Date(Date.UTC(y, m, 1));
      return {
        root,
        symbol: `${root}${MONTH_CODES[d.getUTCMonth()]}${String(d.getUTCFullYear()).slice(2)}.NYM`,
        label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
        lastTrade: last.toISOString().slice(0, 10),
      };
    }
  }
  return null;
}

/** For a Yahoo continuous symbol that has a rule (BZ=F, CL=F): the front-month contract, else null. */
export function frontMonthFor(continuous, date = new Date()) {
  const m = String(continuous || '').match(/^(BZ|CL)=F$/);
  return m ? frontMonth(m[1], date) : null;
}

/** Symbols to try, best first: the front-month contract, then the continuous symbol. */
export function yahooCandidates(symbol, date = new Date()) {
  const fm = frontMonthFor(symbol, date);
  return fm ? [{ symbol: fm.symbol, contract: fm.label }, { symbol, contract: null }] : [{ symbol, contract: null }];
}
