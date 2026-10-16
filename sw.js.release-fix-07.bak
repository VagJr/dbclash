// Service Worker — Auto-Purge & Instant Refresh Engine
const CACHE_NAME = 'dbtcg-v' + Date.now();

self.addEventListener('install', (evt) => {
  console.log('[Service Worker] Auto-purging stale cache...');
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          console.log('[Service Worker] Deleting cache storage key:', key);
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-Only Strategy — Never serve stale cached files!
self.addEventListener('fetch', (evt) => {
  if (evt.request.method !== 'GET') return;
  evt.respondWith(
    fetch(evt.request).catch(() => {
      return caches.match(evt.request);
    })
  );
});
