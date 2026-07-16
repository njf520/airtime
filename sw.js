// Airsona (formerly Airtime) — service worker for offline support / installability.
//
// Bump CACHE_NAME on every deploy so old caches get cleaned up and clients
// pick up fresh assets.
const CACHE_NAME = 'airsona-v3.23.1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      // cache.addAll rejects (and aborts entirely) if even one APP_SHELL file 404s or is
      // momentarily unreachable -- without this, that failure is completely silent and the app
      // just never gets offline support for that client, with no way to tell why.
      .catch(e => console.error('sw.js install: failed to cache the app shell.', e))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .catch(e => console.error('sw.js activate: failed to clean up old caches.', e))
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET requests — leave podcast RSS feeds, CORS
  // proxies, Archive.org, Radio-Browser, SomaFM, and everything else
  // completely alone (cross-origin, and must never be served stale or
  // cached here).
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Network-first for navigations and index.html itself, so a fresh deploy
  // is picked up when online; falls back to cache when offline.
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(req, copy))
          .catch(e => console.warn('sw.js: failed to cache navigation response for', req.url, e));
        return res;
      }).catch(e => {
        console.warn('sw.js: network fetch failed for', req.url, '-- falling back to cache.', e);
        return caches.match(req).then(res => res || caches.match('./index.html'));
      })
    );
    return;
  }

  // Cache-first, falling back to network, for other same-origin static
  // assets (manifest, icons).
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(req, copy))
          .catch(e => console.warn('sw.js: failed to cache response for', req.url, e));
        return res;
      });
    })
  );
});
