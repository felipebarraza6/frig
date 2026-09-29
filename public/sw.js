/* Service worker de FRIG (PWA).
 * Estrategia:
 *  - Assets estáticos de Next (_next/static, íconos, brand): cache-first.
 *  - Navegaciones (HTML): network-first, fallback al cache offline.
 *  - API Yggdra y mutaciones: passthrough (sin cachear).
 *
 * El build se lee de ?v= en la URL de registro (ServiceWorkerRegister).
 * Al cambiar v, activate borra caches de builds anteriores.
 */

const BUILD =
  (typeof self !== "undefined" &&
    self.location &&
    new URL(self.location.href).searchParams.get("v")) ||
  "dev";
const STATIC_CACHE = "frig-static-" + BUILD;
const PAGES_CACHE = "frig-pages-" + BUILD;

const APP_SHELL = [
  "/",
  "/login",
  "/dashboard",
  "/pos",
  "/sales",
  "/profile",
  "/cash-register",
  "/manifest.webmanifest",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-512x512-maskable.png",
];

const STATIC_RE = /\/_next\/static\//;
const SAME_ORIGIN = new RegExp("^" + self.location.origin);
const PAGES_CACHE_MAX = 60;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== PAGES_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "GET_VERSION") {
    event.ports?.[0]?.postMessage({ build: BUILD });
  }
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !SAME_ORIGIN.test(request.url)) return;

  const url = new URL(request.url);

  if (
    STATIC_RE.test(url.pathname) ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/")
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGES_CACHE).then((cache) =>
              cache
                .put(request, copy)
                .then(() => cache.keys())
                .then((keys) => {
                  if (keys.length > PAGES_CACHE_MAX) {
                    return Promise.all(
                      keys.slice(0, keys.length - PAGES_CACHE_MAX).map((k) => cache.delete(k))
                    );
                  }
                })
            );
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/login") || caches.match("/"))
        )
    );
    return;
  }
});
