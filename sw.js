const CACHE_NAME = 'dbtcg-v30.0.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles/main.css',
  './styles/cards.css',
  './styles/arena.css'
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching core assets v30.0.0');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Purging old cache storage:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First Strategy
self.addEventListener('fetch', (evt) => {
  if (evt.request.method !== 'GET') return;
  
  evt.respondWith(
    fetch(evt.request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(evt.request, responseToCache);
        });
      }
      return networkResponse;
    }).catch(() => {
      return caches.match(evt.request).then((cachedResponse) => {
        return cachedResponse || caches.match('./index.html');
      });
    })
  );
});
