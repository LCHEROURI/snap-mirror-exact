// Reflective service worker — shell-only. Journal data and API calls are NEVER cached;
// the only thing stored is a small offline page shown when navigation fails.
const CACHE = "reflective-shell-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.mode !== "navigate") return; // everything else goes straight to network
  e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
});
