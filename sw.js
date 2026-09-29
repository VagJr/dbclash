const CACHE_VERSION = 'dbclash-release-v3-nexus-audio';
const CORE_CACHE = `${CACHE_VERSION}-core`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles/main.css',
  './styles/cards.css',
  './styles/arena.css',
  './styles/multiplayer.css',
  './styles/animations.css',
  './styles/atmosphere.css',
  './styles/rework.css',
  './styles/exchange.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('dbclash-') && ![CORE_CACHE, RUNTIME_CACHE].includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function shouldBypass(request, url) {
  const isAudio = /\.(mp3|wav|ogg|m4a|aac)$/i.test(url.pathname);
  const isRange = request.headers.has('range');
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/socket.io/') ||
    url.protocol === 'chrome-extension:' ||
    isAudio ||
    request.cache === 'no-store' ||
    isRange
  );
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response?.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await caches.match('./index.html'));
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const update = fetch(request)
    .then(async response => {
      if (response?.ok) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    event?.waitUntil(update.then(() => undefined));
    return cached;
  }

  const network = await update;
  return network || Response.error();
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || shouldBypass(request, url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, event));
});
