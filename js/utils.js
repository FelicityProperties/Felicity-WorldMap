// ═══════════════════════════════════════════════════════════
// UTILS — Clock, Color Helpers, Formatting
// ═══════════════════════════════════════════════════════════

export function ciiColor(score) {
  if (!score) return '#141c2b';
  if (score >= 9) return '#500010';
  if (score >= 7) return '#6b1020';
  if (score >= 5) return '#664400';
  if (score >= 3) return '#0d3366';
  return '#0a3d22';
}

export function ciiBarColor(score) {
  if (!score) return '#4a5568';
  if (score >= 9) return '#ef4444';
  if (score >= 7) return '#dc2626';
  if (score >= 5) return '#f59e0b';
  if (score >= 3) return '#3b82f6';
  return '#22c55e';
}

export function ciiLabel(score) {
  if (!score) return 'No Data';
  if (score >= 9) return 'Critical';
  if (score >= 7) return 'High Risk';
  if (score >= 5) return 'Elevated';
  if (score >= 3) return 'Moderate';
  return 'Low Risk';
}

export function formatPrice(price, sym) {
  if (sym === 'BTC' || sym === 'NIKKEI' || price >= 1000) {
    return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return price.toFixed(2);
}

export function updateClock(el) {
  const now = new Date();
  const h = String(now.getUTCHours()).padStart(2, '0');
  const m = String(now.getUTCMinutes()).padStart(2, '0');
  const s = String(now.getUTCSeconds()).padStart(2, '0');
  el.textContent = `${h}:${m}:${s} UTC`;
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
