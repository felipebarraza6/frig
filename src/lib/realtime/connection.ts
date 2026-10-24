/**
 * Estado compartido de la conexión WebSocket de sucursal.
 *
 * Un solo socket (useBranchWebSocket) publica; cualquier query operativa lee
 * con useRealtimeConnected() para bajar el polling mientras el canal está vivo.
 * Sin store: es un flag de infraestructura, no estado de UI.
 */

import { useSyncExternalStore } from "react";

export type RealtimeConnection = "connecting" | "open" | "closed" | "error";

let connection: RealtimeConnection = "closed";
const listeners = new Set<() => void>();

export function setRealtimeConnection(next: RealtimeConnection): void {
  if (connection === next) return;
  connection = next;
  for (const listener of listeners) listener();
}

export function getRealtimeConnection(): RealtimeConnection {
  return connection;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** true solo con el socket abierto. SSR y el primer paint asumen desconectado. */
export function useRealtimeConnected(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => connection === "open",
    () => false,
  );
}
