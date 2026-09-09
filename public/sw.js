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
// Tope de páginas cacheadas (LRU simple): evita que frig-pages-v1 crezca
// sin límite con una entrada por URL+querystring en tablets de POS.
const PAGES_CACHE_MAX = 60;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      // Adds individuales tolerantes a fallo: si el hosting no reescribe
      // /login → /login.html, un 404 en addAll abortaría todo el install.
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
            caches.open(PAGES_CACHE).then((cache) =>
              cache
                .put(request, copy)
                // LRU: si excede el tope, elimina las entradas más antiguas.
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
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Resto (txt de RSC, etc.): red directa, sin cachear.
});
