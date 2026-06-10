// Service worker — offline-first caching so the app runs with no network.
// Bump CACHE when you change any asset to force an update.
const CACHE = 'workout-tracker-v2';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './chart.umd.min.js',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
];

// Precache everything on install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Clean up old caches on activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first; fall back to network, then to the cached app shell for navigations
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req)
        .then(res => {
          // Cache successful same-origin responses for next time
          if (res.ok && new URL(req.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => req.mode === 'navigate' ? caches.match('./index.html') : Promise.reject('offline'));
    })
  );
});
