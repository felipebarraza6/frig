const RELOAD_KEY = "frig.chunk-reload";

/** Turbopack y webpack usan mensajes distintos para el mismo fallo. */
export function isChunkLoadFailure(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? `${reason.name} ${reason.message}`
      : typeof reason === "string"
        ? reason
        : "";
  return /Failed to load chunk|ChunkLoadError|Loading chunk [\w-]+ failed/i.test(message);
}

/**
 * Recarga una sola vez por pestaña. Si el chunk sigue faltando, no entra en bucle.
 * Devuelve true cuando dispara la recarga.
 */
export function reloadOnceForChunkError(
  storage: Pick<Storage, "getItem" | "setItem">,
  reload: () => void,
): boolean {
  if (storage.getItem(RELOAD_KEY)) return false;
  storage.setItem(RELOAD_KEY, "1");
  reload();
  return true;
}
