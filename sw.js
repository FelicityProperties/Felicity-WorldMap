// Felicity Intelligence service worker.
//
// The rule is the site's rule: never show a number that was not fetched.
// So only the app shell (HTML, CSS, JS, fonts, map geometry, icons) is
// cached, and always network-first — online you always get the latest
// deploy; offline the shell opens and every feed says NO FEED honestly.
// /api/* and every other origin are never touched: market prices, map
// layers and AI answers always go to the network or fail visibly.

const CACHE = 'felicity-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/assets/icons/icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('felicity-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;             // third parties: untouched
  if (url.pathname.startsWith('/api/')) return;                 // data: never cached
  if (url.pathname.startsWith('/_vercel/')) return;             // platform scripts
  if (url.pathname === '/analytics.html' || url.pathname.endsWith('analytics-dashboard.js')) return;

  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      if (fresh.ok && fresh.type === 'basic') {
        const copy = fresh.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return fresh;
    } catch (err) {
      const cached = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const shell = await caches.match('/index.html') || await caches.match('/');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
