// A minimal .xlsx reader — enough to read a fund's holdings sheet, with no
// dependency (the repo ships none). An .xlsx file is a ZIP of XML parts:
// the central directory lists the parts, each is stored or deflated, the
// cell text lives in xl/sharedStrings.xml and the grid in
// xl/worksheets/sheetN.xml. Formulas, styles and dates are not
// interpreted: a cell is returned as the text or number Excel stored.
//
// readXlsx(buffer) → { sheets: [{ name, path, rows: [[cell, …], …] }] }
// Throws on anything that is not a ZIP with a workbook in it.

import { inflateRawSync } from 'node:zlib';

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 0x1000000;

/** ZIP central directory → { name: Uint8Array } for the parts we ask for. */
export function unzip(buf, wanted = () => true) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  // End-of-central-directory record: last 22 bytes plus an optional comment
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) {
    if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a ZIP file (no end-of-directory record)');
  const count = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);
  const out = {};
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (u32(b, p) !== 0x02014b50) throw new Error('ZIP central directory is damaged');
    const method = u16(b, p + 10);
    const csize = u32(b, p + 20);
    const nameLen = u16(b, p + 28), extraLen = u16(b, p + 30), commentLen = u16(b, p + 32);
    const local = u32(b, p + 42);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!wanted(name)) continue;
    if (u32(b, local) !== 0x04034b50) throw new Error(`ZIP entry ${name} has no local header`);
    const start = local + 30 + u16(b, local + 26) + u16(b, local + 28);
    const raw = b.subarray(start, start + csize);
    if (method === 0) out[name] = raw;
    else if (method === 8) out[name] = new Uint8Array(inflateRawSync(raw));
    else throw new Error(`ZIP entry ${name} uses unsupported method ${method}`);
  }
  return out;
}

const XML_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export const xmlText = s => String(s).replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (XML_ENT[e] ?? m));

// Column letters of a cell reference ("AB12" → 27)
const colIndex = ref => {
  const letters = /^[A-Z]+/.exec(ref || '')?.[0] || '';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

function sharedStrings(xml) {
  const out = [];
  for (const m of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    // A rich-text string is several <t> runs; plain is one
    out.push([...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t => xmlText(t[1])).join(''));
  }
  return out;
}

function sheetRows(xml, strings) {
  const rows = [];
  for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const body = c[2] || '';
      let v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let val;
      if (type === 's') val = v != null ? strings[Number(v)] ?? '' : '';
      else if (type === 'inlineStr') val = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t => xmlText(t[1])).join('');
      else if (v == null) val = '';
      else val = xmlText(v);
      const i = ref ? colIndex(ref) : row.length;
      while (row.length < i) row.push('');
      row[i] = val;
    }
    rows.push(row);
  }
  return rows;
}

export function readXlsx(buf) {
  const parts = unzip(buf, n => n === 'xl/workbook.xml' || n === 'xl/sharedStrings.xml' || n === 'xl/_rels/workbook.xml.rels' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const dec = new TextDecoder();
  const text = n => (parts[n] ? dec.decode(parts[n]) : '');
  if (!parts['xl/workbook.xml']) throw new Error('not an Excel workbook (no xl/workbook.xml)');
  const strings = sharedStrings(text('xl/sharedStrings.xml'));
  // Sheet names in workbook order, mapped to their part through the rels file
  const rels = {};
  for (const m of text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)) rels[m[1]] = m[2];
  for (const m of text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*\bTarget="([^"]+)"[^>]*\bId="([^"]+)"/g)) rels[m[2]] = m[1];
  const sheets = [];
  for (const m of text('xl/workbook.xml').matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = xmlText(/\bname="([^"]*)"/.exec(m[1])?.[1] || '');
    const rid = /\br:id="([^"]+)"/.exec(m[1])?.[1];
    let target = rels[rid] || '';
    target = target.replace(/^\/?xl\//, '').replace(/^\//, '');
    const path = `xl/${target}`;
    if (parts[path]) sheets.push({ name, path, rows: sheetRows(text(path), strings) });
  }
  // A workbook whose rels did not resolve still has its sheets
  if (!sheets.length) {
    for (const path of Object.keys(parts).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()) {
      sheets.push({ name: path.replace(/^.*\//, ''), path, rows: sheetRows(text(path), strings) });
    }
  }
  return { sheets };
}
