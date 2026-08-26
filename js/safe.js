// ═══════════════════════════════════════════════════════════
// SAFE — escaping helpers used wherever external data is rendered
// ═══════════════════════════════════════════════════════════
//
// The app previously escaped with the textContent -> innerHTML trick:
//
//   const d = document.createElement('div');
//   d.textContent = value;
//   return d.innerHTML;
//
// That escapes & < > but NOT quotes, which is fine for text nodes and
// unsafe inside an attribute. A news URL from Finnhub or an RSS feed
// containing a double quote could close href="..." and inject further
// attributes. These helpers escape quotes too, and refuse any URL
// scheme other than http/https so a javascript: link cannot execute.
// ═══════════════════════════════════════════════════════════

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape a value for use in HTML text OR inside a quoted attribute. */
export function escapeHtml(value) {
  if (value == null) return '';
  return String(value).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

/**
 * Return the URL only if it is a plain http(s) link, otherwise '#'.
 * Blocks javascript:, data:, vbscript: and malformed values.
 */
export function safeUrl(url) {
  if (!url) return '#';
  const raw = String(url).trim();
  try {
    // Resolve relative URLs against the current origin when available
    const base = typeof location !== 'undefined' ? location.href : 'https://example.com';
    const parsed = new URL(raw, base);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '#';
    return escapeHtml(parsed.href);
  } catch {
    return '#';
  }
}

/** True when a URL is safe to hand to window.open(). */
export function isSafeUrl(url) {
  return safeUrl(url) !== '#';
}
