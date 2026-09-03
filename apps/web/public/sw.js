/* Service worker de FRIG (PWA).
 * Estrategia:
 *  - Assets estáticos de Next (_next/static, íconos): cache-first con
 *    precarga en el install (App Shell).
 *  - Navegaciones (documentos): network-first, con fallback al cache si
 *    no hay conexión (la app es client-side y requiere API de todas formas).
 *  - API y demás: passthrough directo a red, sin cachear.
 */

const STATIC_CACHE = "frig-static-v1";
const PAGES_CACHE = "frig-pages-v1";

const APP_SHELL = ["/", "/login", "/manifest.webmanifest", "/icons/icon-192x192.png", "/icons/icon-512x512.png"];

const STATIC_RE = /\/_next\/static\//;
const SAME_ORIGIN = new RegExp("^" + self.location.origin);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE, PAGES_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !SAME_ORIGIN.test(request.url)) return;

  const url = new URL(request.url);

  // Assets inmutables de Next: cache-first.
  if (STATIC_RE.test(url.pathname) || url.pathname.startsWith("/icons/")) {
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

  // Navegaciones (HTML): network-first con fallback al cache offline.
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Resto (txt de RSC, etc.): red directa, sin cachear.
});
