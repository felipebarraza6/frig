"use client";

import { useEffect } from "react";
import { useToastStore } from "@/lib/store/toast";
import { APP_BUILD } from "@/lib/pwa";
import { isChunkLoadFailure, reloadOnceForChunkError } from "@/lib/chunk-load";

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

    const onRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadFailure(event.reason)) return;
      if (reloadOnceForChunkError(sessionStorage, () => window.location.reload())) {
        event.preventDefault();
      }
    };
    const onError = (event: ErrorEvent) => {
      if (!isChunkLoadFailure(event.error ?? event.message)) return;
      if (reloadOnceForChunkError(sessionStorage, () => window.location.reload())) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);

    if (!("serviceWorker" in navigator)) {
      return () => {
        window.removeEventListener("unhandledrejection", onRejection);
        window.removeEventListener("error", onError);
      };
    }

    const hadController = navigator.serviceWorker.controller !== null;
    let notified = false;
    const onController = () => {
      if (notified || !hadController) return;
      notified = true;
      useToastStore.getState().addToast({
        message: "Hay una nueva versión de la app",
        variant: "info",
        duration: 0,
        action: { label: "Recargar", onClick: () => window.location.reload() },
      });
    };
    navigator.serviceWorker.addEventListener("controllerchange", onController);

    // En GitHub Pages el SW vive bajo /<repo>/; en FTP de producción, en /.
    const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
    const swUrl = `${base}/sw.js?v=${encodeURIComponent(APP_BUILD)}`;
    navigator.serviceWorker
      .register(swUrl, { scope: `${base || ""}/`, type: "module" })
      .catch(() => {
      /* sin SW la app sigue funcionando igual */
    });

    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
      navigator.serviceWorker.removeEventListener("controllerchange", onController);
    };
  }, []);

  return null;
}
