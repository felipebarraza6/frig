/**
 * Utilidades PWA: identidad del build, detección de modo standalone y
 * chequeo manual de actualizaciones del service worker.
 */

/** Identificador del build inyectado en build time (ver deploy.yml). */
export const APP_BUILD: string = process.env.NEXT_PUBLIC_APP_BUILD ?? "dev";

/** True si la app corre instalada como PWA (standalone). */
export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export type AppUpdateResult = "updated" | "latest" | "unsupported";

/**
 * Fuerza la búsqueda de una versión nueva del service worker.
 * - "updated": se encontró e instaló una versión nueva; el SW hace
 *   skipWaiting, así que el toast de "Recargar" (controllerchange) aparecerá.
 * - "latest": no hay nada nuevo (o no se pudo confirmar a tiempo).
 * - "unsupported": sin service worker (desarrollo o navegador viejo).
 */
export async function checkForAppUpdate(): Promise<AppUpdateResult> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return "unsupported";
  }
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return "unsupported";

  const foundNew = await new Promise<boolean>((resolve) => {
    let settled = false;
    const done = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    const timeout = setTimeout(() => done(false), 10_000);

    // Un SW ya instalado esperando control = hay versión nueva (borde: con
    // skipWaiting normalmente no queda en waiting, pero se cubre igual).
    if (registration.waiting) return done(true);

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return done(false);
      if (worker.state === "installed") return done(true);
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") done(true);
      });
    });

    registration.update().catch(() => done(false));
  });

  return foundNew ? "updated" : "latest";
}
