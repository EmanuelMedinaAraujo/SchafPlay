const CACHE_NAME = 'schafplay-v1';

// The deploy base ('/', or '/<repo>/' on GitHub Pages). The build
// (vite.config.ts, sw-version-injector) rewrites this to match `base`.
const BASE = '/';

// The build (vite.config.ts, sw-version-injector) replaces this list with
// the full set of hashed assets (base-prefixed) so the app works offline even
// if a file was never fetched while online.
const PRECACHE = [
  '/',
  '/index.html',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
];

// Fetch with a timeout so a navigation never hangs on a slow/unreachable
// network. A hand-rolled AbortController rather than AbortSignal.timeout(),
// which iOS < 16 lacks.
function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal })
    .then((response) => {
      clearTimeout(id);
      return response;
    })
    .catch((err) => {
      clearTimeout(id);
      throw err;
    });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const requests = PRECACHE.map((url) => new Request(url, { cache: 'reload' }));
      return cache.addAll(requests);
    })
  );
  // #61: don't skipWaiting() here — wait for the page to post SKIP_WAITING
  // (via checkForUpdate) so updates only apply on explicit user action.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Activated only when the page posts SKIP_WAITING (see checkForUpdate).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Navigation: cache-first (offline-first). Falls back to network only
  // when nothing is cached yet.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cached =
          (await caches.match(BASE + 'index.html', { ignoreVary: true })) ||
          (await caches.match(BASE, { ignoreVary: true })) ||
          (await caches.match(request, { ignoreVary: true }));
        if (cached) return cached;
        try {
          const networkResponse = await fetchWithTimeout(request, 3000);
          return networkResponse;
        } catch {
          return Response.error();
        }
      })()
    );
    return;
  }

  // Only cache GET requests of same origin to avoid caching external APIs/WebRTC connections.
  const isSameOrigin = request.url.startsWith(self.location.origin);
  const isGet = request.method === 'GET';

  // Anything else (cross-origin, non-GET) is left to the browser.
  if (!isSameOrigin || !isGet) return;

  // The manual's intro videos stream with Range requests; a cached full
  // response would answer those with the whole file, which iOS Safari refuses
  // to play. Leave them to the browser (the manual hides them offline).
  if (new URL(request.url).pathname.startsWith(BASE + 'manual/') && request.url.endsWith('.mp4')) return;

  event.respondWith(
    caches.match(request, { ignoreVary: true, ignoreSearch: true }).then((cached) => {
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
});
