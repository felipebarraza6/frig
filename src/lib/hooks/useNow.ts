"use client";

import { useEffect, useState } from "react";

/** Reloj local para timers en vivo (prep KDS, etc.). */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  // Ajuste durante render (patrón React): refresca el reloj al reactivar
  // o al cambiar el intervalo, sin setState síncrono en effect.
  const [prevKey, setPrevKey] = useState(`${intervalMs}:${enabled}`);
  const key = `${intervalMs}:${enabled}`;
  if (prevKey !== key) {
    setPrevKey(key);
    // eslint-disable-next-line react-hooks/purity -- aleatoriedad intencional: partículas procedurales del salón
    if (enabled) setNow(Date.now());
  }
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}
