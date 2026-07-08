// Service Worker ساده: اول اینترنت، اگر نبود از کش (برای کار آفلاین)
const CACHE = "health-app-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const res = await fetch(e.request);
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
          cache.put(e.request, res.clone());
        }
        return res;
      } catch {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        return cache.match("/");
      }
    })
  );
});
