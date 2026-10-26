const CACHE_NAME = "nbadabet-shell-v3";
const OFFLINE_URL = "/offline.html";
const APP_SHELL = [
  "/", "/index.html", "/login.html", "/ranking.html", "/estatisticas.html",
  "/mais.html", "/historico.html", OFFLINE_URL, "/manifest.webmanifest",
  "/assets/css/styles.css", "/assets/css/room.css", "/assets/css/secondary-pages.css",
  "/assets/css/history.css", "/assets/css/pwa.css", "/assets/js/pwa.js",
  "/assets/icons/icon-192.png", "/assets/icons/nba-logoman.svg", "/assets/icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === "basic") {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === "navigate") {
      const offline = await cache.match(OFFLINE_URL);
      if (offline) return offline;
    }
    throw error;
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }
  event.respondWith(networkFirst(request));
});
