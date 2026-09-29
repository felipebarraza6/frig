"use client";

import { useEffect } from "react";
import { useToastStore } from "@/lib/store/toast";
import { APP_BUILD } from "@/lib/pwa";

/**
 * Registra el service worker de la PWA (public/sw.js?v=BUILD).
 * El query `v` versiona el SW: un deploy nuevo rota caches en activate.
 *
 * El SW hace skipWaiting + clients.claim: cuando un deploy nuevo toma
 * control, avisamos con un toast persistente en vez de recargar solos.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const hadController = navigator.serviceWorker.controller !== null;
    let notified = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (notified || !hadController) return;
      notified = true;
      useToastStore.getState().addToast({
        message: "Hay una nueva versión de la app",
        variant: "info",
        duration: 0,
        action: { label: "Recargar", onClick: () => window.location.reload() },
      });
    });

    const swUrl = `/sw.js?v=${encodeURIComponent(APP_BUILD)}`;
    navigator.serviceWorker.register(swUrl).catch(() => {
      /* sin SW la app sigue funcionando igual */
    });
  }, []);

  return null;
}
