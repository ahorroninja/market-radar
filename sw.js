const CACHE = "market-radar-3.0.3-prospective-precision";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./public/styles.css",
  "./src/main.js",
  "./src/app/refresh.js",
  "./src/app/persistence.js",
  "./src/core/rolling.js",
  "./src/core/indicators.js",
  "./src/core/radar.js",
  "./src/core/macro.js",
  "./src/core/smart-dca.js",
  "./src/core/portfolio.js",
  "./src/core/backtest.js",
  "./src/core/research.js",
  "./src/core/universe.js",
  "./src/core/execution.js",
  "./src/core/prospective.js",
  "./src/core/metrics.js",
  "./src/domain/defaults.js",
  "./src/domain/settings.js",
  "./src/ui/shell.js",
  "./src/ui/views.js",
  "./src/data/macro-provider.js",
  "./src/data/provider.js",
  "./src/data/normalize.js",
  "./src/storage/market-cache.js",
  "./src/storage/backup.js",
];
self.addEventListener("install", (e) =>
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("market-radar") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  if (
    e.request.method !== "GET" ||
    new URL(e.request.url).origin !== self.location.origin
  )
    return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const copy = r.clone();
          e.waitUntil(caches.open(CACHE).then((c) => c.put(e.request, copy)));
        }
        return r;
      })
      .catch(async () => {
        const cached = await caches.match(e.request);
        return (
          cached ||
          new Response("Sin conexión y sin copia local", { status: 503 })
        );
      }),
  );
});
