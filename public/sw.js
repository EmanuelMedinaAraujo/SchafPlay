const CACHE_NAME = 'schafplay-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        '/',
        '/index.html',
        '/icon-192.png',
        '/icon-512.png',
        '/manifest.json',
      ])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Navigation: network-first, fall back to cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Only cache GET requests of same origin to avoid caching external APIs/WebRTC connections.
  const isSameOrigin = request.url.startsWith(self.location.origin);
  const isGet = request.method === 'GET';

  if (isSameOrigin && isGet) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // If response is valid, cache it dynamically
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Fallback for other requests (external / non-GET)
  event.respondWith(fetch(request));
});
