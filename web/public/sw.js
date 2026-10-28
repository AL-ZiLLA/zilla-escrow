/* Zilla Escrow service worker: caches the app shell and static assets so the
   installed app can launch offline. It never touches cross-origin requests
   (Arbitrum RPC, Arbiscan), API routes, the unlock flow, or RSC data. */
const VERSION = 'zilla-escrow-v1';
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const PRECACHE = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/zilla-logo-official.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC);
    await cache.addAll(PRECACHE);
    // Cache the landing shell only if this browser is already unlocked.
    const res = await fetch('/', { credentials: 'same-origin' }).catch(() => null);
    if (res && res.ok && !res.redirected) await (await caches.open(SHELL)).put('/', res);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isStatic = (url) => url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') ||
  /\.(?:svg|png|ico|woff2?|css|js)$/.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // RPC and explorers: always network, never cached
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/unlock') || url.pathname === '/sw.js') return;
  if (req.headers.get('RSC') || url.searchParams.has('_rsc')) return; // app data, not shell

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok && !res.redirected) (await caches.open(SHELL)).put(req, res.clone());
        return res;
      } catch {
        return (await caches.match(req, { cacheName: SHELL })) || (await caches.match('/', { cacheName: SHELL })) || Response.error();
      }
    })());
    return;
  }

  if (isStatic(url)) {
    event.respondWith((async () => {
      const hit = await caches.match(req, { cacheName: STATIC });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') (await caches.open(STATIC)).put(req, res.clone());
      return res;
    })());
  }
});
