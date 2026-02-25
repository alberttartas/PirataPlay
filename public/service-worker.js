const CACHE_NAME = "pirataplay-v2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/storage.js",
  "/manifest.json",
];

// ── Instalação: pré-cache dos assets estáticos ──
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Ativação: remove caches antigos ────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first para assets, network-first para API ──
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requests que não são GET
  if (request.method !== "GET") return;

  // API e proxy: sempre network (nunca cachear streams)
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/proxy")) {
    return;
  }

  // Assets estáticos: cache-first, fallback network
  if (
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".json") ||
    url.pathname === "/"
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        });
        return cached || networkFetch;
      })
    );
    return;
  }

  // Imagens externas (logos, posters): cache com TTL implícito
  if (request.destination === "image") {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response("", { status: 404 }));
      })
    );
  }
});
