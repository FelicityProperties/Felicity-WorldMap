// The installable app: the manifest Android and iOS need, icons that
// exist at the sizes they claim, and a service worker that can never
// serve a cached market number.
import { readFileSync, existsSync } from 'node:fs';

const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };
const root = new URL('..', import.meta.url).pathname;
const read = p => readFileSync(root + p, 'utf8');

const m = JSON.parse(read('manifest.webmanifest'));
check(m.name && m.short_name && m.start_url && m.display === 'standalone' && m.scope === '/', 'manifest has the installability basics');
const pngSize = p => { const b = readFileSync(root + p.replace(/^\//, '')); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
for (const i of m.icons.filter(i => i.type === 'image/png')) {
  check(existsSync(root + i.src.replace(/^\//, '')), `icon ${i.src} exists`);
  const [w, h] = pngSize(i.src);
  check(`${w}x${h}` === i.sizes, `icon ${i.src} is really ${i.sizes} (got ${w}x${h})`);
}
check(m.icons.some(i => i.sizes === '192x192') && m.icons.some(i => i.sizes === '512x512' && i.purpose === 'any') && m.icons.some(i => i.purpose === 'maskable'), 'Android needs 192, 512 and a maskable icon');
for (const s of m.shortcuts || []) check(/^\/\?tab=(worldmap|invest|dubai|hormuz|signals|broadcasts|overview)\b/.test(s.url), `shortcut ${s.name} deep-links a real tab`);

const html = read('index.html');
check(html.includes('<link rel="manifest" href="/manifest.webmanifest">'), 'index links the manifest');
check(/apple-touch-icon" href="\/assets\/icons\/apple-touch-icon\.png"/.test(html) && existsSync(root + 'assets/icons/apple-touch-icon.png'), 'iPhone home-screen icon present');
check(/viewport-fit=cover/.test(html) && /apple-mobile-web-app-capable/.test(html), 'full-screen on iPhone (notch-aware)');

const sw = read('sw.js');
check(/pathname\.startsWith\('\/api\/'\)\) return/.test(sw), 'service worker never intercepts /api/ — no cached prices');
check(/url\.origin !== self\.location\.origin\) return/.test(sw), 'service worker never touches third-party requests');
check(/await fetch\(req\)/.test(sw) && sw.indexOf('await fetch(req)') < sw.indexOf('caches.match(req'), 'network first; the cache is only the offline fallback');
check(/analytics\.html/.test(sw), 'the private dashboard is not cached on the device');

const vercel = JSON.parse(read('vercel.json'));
check(vercel.headers.some(h => h.source === '/sw.js' && h.headers.some(x => x.key === 'Cache-Control' && /no-cache/.test(x.value))), 'sw.js is never edge-cached, so updates reach installed apps');

if (fails.length) { console.log('FAILED:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('app: manifest, icons, deep links and a network-first service worker that never caches data — all checks passed');
