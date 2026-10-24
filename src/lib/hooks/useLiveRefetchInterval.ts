"use client";

import { useRealtimeConnected } from "@/lib/realtime/connection";

/**
 * Mientras el WebSocket de sucursal está abierto, el polling operativo baja a
 * un latido lento (reconciliación si se pierde un evento). Si el socket cae,
 * vuelve el intervalo agresivo: la pantalla no se queda stale.
 *
 * `enabled` en false apaga el refetch por completo (query ya deshabilitada).
 */
export function liveRefetchInterval(
  disconnectedMs: number,
  connected: boolean,
  enabled = true,
): number | false {
  if (!enabled) return false;
  if (!connected) return disconnectedMs;
  return Math.max(disconnectedMs * 4, 120_000);
}

export function useLiveRefetchInterval(
  disconnectedMs: number,
  enabled = true,
): number | false {
  const connected = useRealtimeConnected();
  return liveRefetchInterval(disconnectedMs, connected, enabled);
}
