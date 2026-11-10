export const OFFLINE_SALE_MESSAGE =
  "Sin conexión. No se registró el cobro ni el envío a cocina. Reintenta cuando vuelva la red.";

export function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

/** Bloquea cobros y altas de orden cuando el navegador está offline. */
export function assertOnlineSale(): void {
  if (!isOnline()) {
    throw new Error(OFFLINE_SALE_MESSAGE);
  }
}
