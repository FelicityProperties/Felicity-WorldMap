// Wikitext table reading — just enough to take a constituents table off a
// Wikipedia article fetched through the MediaWiki API. Tested against the
// real FTSE 100, CAC 40, EURO STOXX 50, AEX, BEL 20, Hang Seng and Straits
// Times pages (tests/index-heatmap.test.mjs).
//
// Nothing here guesses a value: a cell is its wikitext with the markup taken
// off, and a table that is not where the caller said it is returns null.

/** Split on `sep` only outside [[links]], {{templates}} and <tags>. */
export function splitTop(s, sep) {
  const out = [];
  let depthL = 0, depthT = 0, inTag = false, cur = '';
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (!inTag && two === '[[') { depthL++; cur += two; i++; continue; }
    if (!inTag && two === ']]' && depthL) { depthL--; cur += two; i++; continue; }
    if (!inTag && two === '{{') { depthT++; cur += two; i++; continue; }
    if (!inTag && two === '}}' && depthT) { depthT--; cur += two; i++; continue; }
    if (s[i] === '<' && /[a-z/!]/i.test(s[i + 1] || '')) inTag = true;
    else if (s[i] === '>' && inTag) inTag = false;
    if (!depthL && !depthT && !inTag && s.startsWith(sep, i)) { out.push(cur); cur = ''; i += sep.length - 1; continue; }
    cur += s[i];
  }
  out.push(cur);
  return out;
}

/** The outermost templates in a cell: [{ name, params: [positional…], named: {k: v} }]. */
export function templates(s) {
  const out = [];
  let i = 0;
  while ((i = s.indexOf('{{', i)) !== -1) {
    let depth = 0, j = i;
    for (; j < s.length; j++) {
      if (s.startsWith('{{', j)) { depth++; j++; } else if (s.startsWith('}}', j)) { depth--; j++; if (!depth) break; }
    }
    const inner = s.slice(i + 2, j - 1);
    const parts = splitTop(inner, '|').map(p => p.trim());
    const named = {};
    const params = [];
    for (const p of parts.slice(1)) {
      const m = /^([A-Za-z_ ][A-Za-z0-9_ ]*)\s*=(.*)$/s.exec(p);
      if (m) named[m[1].trim().toLowerCase()] = m[2].trim(); else params.push(p);
    }
    out.push({ name: parts[0].trim(), params, named });
    i = j + 1;
  }
  return out;
}

// What a template contributes to a cell's text. Flags and country codes
// draw an icon, not words; interlanguage links show their label.
function templateText(inner) {
  const parts = splitTop(inner, '|').map(p => p.trim());
  const name = (parts[0] || '').toLowerCase();
  const params = parts.slice(1).filter(p => !/^[a-z_ ]+=/i.test(p));
  const named = Object.fromEntries(parts.slice(1).filter(p => /^[a-z_ ]+=/i.test(p)).map(p => { const k = p.indexOf('='); return [p.slice(0, k).trim().toLowerCase(), p.slice(k + 1).trim()]; }));
  if (/^flag(icon|country)?$/.test(name) || /^[A-Z]{3}$/.test(parts[0] || '')) return '';
  if (name === 'ill' || name === 'interlanguage link') return named.lt || params[0] || '';
  if (name === 'nowrap' || name === 'nobr') return params.join('|');
  if (name === 'dts' || name === 'date') return params.join(' ');
  return params[0] || '';
}

/** A cell's text with the wikitext taken off. */
export function cleanWiki(s) {
  let t = String(s || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref\b[^>]*\/>/gi, '')
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '');
  for (let n = 0; n < 8 && /\{\{[^{}]*\}\}/.test(t); n++) t = t.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => templateText(inner));
  t = t.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[https?:\/\/[^\s\]]+\s*([^\]]*)\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&ndash;/g, '–');
  return t.replace(/\s+/g, ' ').trim();
}

// A cell may carry attributes before a single pipe: `style="…" | value`
function cellValue(c) {
  const parts = splitTop(c, '|');
  if (parts.length > 1 && /^\s*[a-z-]+\s*=/i.test(parts[0]) && !/\[\[|\{\{/.test(parts[0])) return parts.slice(1).join('|').trim();
  return c.trim();
}

/**
 * Locate a table: the one whose opening line carries id="<id>", or the
 * first table after a heading matching `heading`. Returns its wikitext
 * (opening line to the line before the closing |}), or null.
 */
export function findTable(wt, { id, heading } = {}) {
  let start = -1;
  if (id) {
    const re = new RegExp(`^\\{\\|[^\\n]*\\bid\\s*=\\s*"?${id}"?`, 'm');
    const m = re.exec(wt);
    if (m) start = m.index;
  }
  if (start < 0 && heading) {
    const re = /^(=+)\s*(.+?)\s*\1\s*$/gm;
    let m;
    while ((m = re.exec(wt))) {
      if (heading.test(m[2])) { const t = wt.indexOf('\n{|', m.index); if (t >= 0) start = t + 1; break; }
    }
  }
  if (start < 0) return null;
  // The matching close, counting nested tables
  const lines = wt.slice(start).split('\n');
  let depth = 0;
  const kept = [];
  for (const line of lines) {
    const l = line.trimStart();
    if (l.startsWith('{|')) depth++;
    if (l.startsWith('|}')) { depth--; if (!depth) break; }
    kept.push(line);
  }
  return kept.join('\n');
}

/** Table wikitext → { header: [text…], rows: [[raw cell…]…] }. Cells stay raw. */
export function parseTable(seg) {
  const header = [];
  const rows = [];
  let cur = null;
  for (const line of seg.split('\n').slice(1)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('|-')) { if (cur && cur.length) rows.push(cur); cur = []; continue; }
    if (t.startsWith('|+')) continue;
    if (t.startsWith('!')) {
      const cells = splitTop(t.slice(1), '!!').flatMap(c => splitTop(c, '||')).map(c => cellValue(c).replace(/^\|/, '').trim());
      if (!rows.length && !(cur && cur.length)) header.push(...cells.map(cleanWiki));
      else (cur = cur || []).push(...cells);
      continue;
    }
    if (t.startsWith('|')) {
      (cur = cur || []).push(...splitTop(t.slice(1), '||').map(cellValue));
      continue;
    }
    // A cell that runs over several lines
    if (cur && cur.length) cur[cur.length - 1] += '\n' + line;
  }
  if (cur && cur.length) rows.push(cur);
  return { header, rows };
}

/** The infobox's `constituents` field when it is a plain count ("100 (June 2026)"), else null. */
export function infoboxCount(wt) {
  const m = /\|\s*constituents\s*=\s*([^\n]*)/i.exec(wt);
  if (!m) return null;
  const v = /^\s*(\d{1,4})\s*(?:\(|<|$)/.exec(m[1]);
  return v ? Number(v[1]) : null;
}
