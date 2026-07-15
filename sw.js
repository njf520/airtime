// Airtime — service worker for offline support / installability.
//
// Bump CACHE_NAME on every deploy so old caches get cleaned up and clients
// pick up fresh assets.
const CACHE_NAME = 'airtime-v3.12.0';
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
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET requests — leave podcast RSS feeds, CORS
  // proxies, Spotify's API/SDK, Archive.org, and everything else completely
  // alone (cross-origin, and must never be served stale or cached here).
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Network-first for navigations and index.html itself, so a fresh deploy
  // is picked up when online; falls back to cache when offline.
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(res => res || caches.match('./index.html')))
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
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return res;
      });
    })
  );
});
