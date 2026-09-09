"use client";

import { useEffect } from "react";
import { useToastStore } from "@/lib/store/toast";

/**
 * Registra el service worker de la PWA (public/sw.js).
 * Silencioso en desarrollo y si el navegador no lo soporta.
 *
 * El SW hace skipWaiting + clients.claim: cuando un deploy nuevo toma
 * control, avisamos con un toast persistente en vez de recargar solos —
 * recargar en mitad de una venta del POS sería peor que la mezcla de
 * versión (el cache estático viejo sigue disponible).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Solo notificar cuando ya había un SW controlando la página (visita
    // posterior con deploy nuevo); en la primera visita controller es null
    // y el controllerchange del claim inicial no es un "update".
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

    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* sin SW la app sigue funcionando igual */
    });
  }, []);

  return null;
}
