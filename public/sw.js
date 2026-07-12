const CACHE_NAME = "checkin-shell-v2";

// Resolve everything against the service worker's own location so the same
// file works at a domain root ("/") or under a sub-path ("/t4000/") on
// GitHub Pages, without hardcoding the base.
const BASE = new URL("./", self.location.href).href;
const SHELL_ASSETS = [BASE, BASE + "manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

// Network-first for navigations/data so check-ins never show stale, falling
// back to the cached app shell when offline.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match(BASE))
      )
  );
});
