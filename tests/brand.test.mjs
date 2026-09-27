// The public name of the Dubai evidence is the Felicity Price Index. The
// vendor and index names it is built from ("PIX", "PropertyIndex") must not
// reach a reader: not in markup, not in a rendered string, not in a prompt.
// Internal identifiers keep the `pix` prefix (pixAreas, PIX_AS_OF,
// js/pix-data.js) — those are code, not copy — and the evidence URLs keep
// their host. This scans everything a browser or the model could see.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (/node_modules|vendor|\.git/.test(p)) continue;
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(js|html|mjs)$/.test(name)) out.push(p);
  }
  return out;
}
const files = [...walk(join(root, 'js')), ...walk(join(root, 'api')), ...walk(join(root, 'lib')), join(root, 'index.html')];
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
const forbidden = /\bPIX\b|PIX©|PropertyIndex/;
for (const f of files) {
  const src = stripComments(readFileSync(f, 'utf8'));
  const m = src.match(forbidden);
  check(!m, `${f.replace(root, '')} mentions "${m && m[0]}" outside a comment`);
}

// What the model is handed
const { buildDeskContext } = await import('../js/pix-data.js');
const { buildSignalContext } = await import('../js/pix-signals.js');
const desk = buildDeskContext();
const sig = buildSignalContext();
check(!forbidden.test(desk) && !forbidden.test(sig), 'the AI evidence blocks never name PIX or PropertyIndex');
check(desk.includes('Felicity Price Index') && sig.includes('Felicity Price Index'), 'the AI evidence blocks name the Felicity Price Index');
check(/Use no other name for the index or its provider/.test(desk), 'the desk block tells the model the index has one name');

if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log(`brand: ${files.length} files and both AI blocks name only the Felicity Price Index — all checks passed`);
