"use client";

import { useEffect } from "react";

/**
 * Registra el service worker de la PWA (public/sw.js).
 * Silencioso en desarrollo y si el navegador no lo soporta.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* sin SW la app sigue funcionando igual */
    });
  }, []);

  return null;
}
