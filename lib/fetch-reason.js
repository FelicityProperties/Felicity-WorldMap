// Node's fetch reports every connection-level failure as the bare words
// "fetch failed" and hides the real reason (ENOTFOUND, ECONNRESET,
// UND_ERR_CONNECT_TIMEOUT, a certificate error…) in `error.cause`. The
// first OpenSky outage on the deployed site surfaced exactly that string
// and nothing else, which is undiagnosable. Every timedFetch in lib/ turns
// its error into words through here.
export function fetchReason(e, ms) {
  if (e && e.name === 'AbortError') return `timeout after ${ms}ms`;
  const cause = e && e.cause;
  const detail = cause ? (cause.code || cause.message || String(cause)) : '';
  return detail && !String(e.message).includes(detail) ? `${e.message} (${detail})` : (e && e.message) || String(e);
}
