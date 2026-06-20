// Pyramid OS does not use a service worker.
//
// This file exists only to neutralize any stale service worker a browser may
// have registered against localhost:3000 during earlier development. Serving a
// real static /sw.js returns 200 (instead of Next 500-ing on an unknown route),
// and the script below unregisters itself and clears caches so the stale worker
// stops intercepting requests.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {
        // ignore — Cache API may be unavailable
      }
      try {
        await self.registration.unregister();
      } catch {
        // ignore
      }
      const clients = await self.clients.matchAll();
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});

// Pass every request straight through to the network — never cache or intercept.
self.addEventListener("fetch", () => {});
