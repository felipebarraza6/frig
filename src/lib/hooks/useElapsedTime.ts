"use client";

import { useEffect, useMemo, useState } from "react";

function parseDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatElapsedMinutes(minutes: number): string {
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `${Math.floor(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h < 24) return `${h}h ${m}min`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return `${d}d ${rh}h ${m}min`;
}

/**
 * Devuelve el tiempo transcurrido (en minutos y como texto legible)
 * desde una fecha inicial, actualizándose cada segundo.
 */
export function useElapsedTime(
  start?: string | Date | null,
  options?: { intervalMs?: number; enabled?: boolean },
) {
  const { intervalMs = 1_000, enabled = true } = options ?? {};
  const startDate = useMemo(() => parseDate(start), [start]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled || !startDate) return;
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [enabled, startDate, intervalMs]);

  const minutes = useMemo(() => {
    if (!startDate) return 0;
    return Math.max(0, (now.getTime() - startDate.getTime()) / 60_000);
  }, [startDate, now]);

  return {
    minutes,
    text: formatElapsedMinutes(minutes),
  };
}
