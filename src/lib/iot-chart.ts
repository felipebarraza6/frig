import type { TelemetryReading } from "@/lib/api/iot";

export type SeriesPoint = { at: number; value: number };

/** Lecturas sin error de una variable, de la más antigua a la más nueva. */
export function variableSeries(readings: TelemetryReading[], variableId: string): SeriesPoint[] {
  return readings
    .filter((r) => !r.is_error && String(r.variable ?? "") === variableId)
    .map((r) => ({ at: new Date(r.reading_at).getTime(), value: Number(r.processed_value) }))
    .filter((p) => Number.isFinite(p.at) && Number.isFinite(p.value))
    .sort((a, b) => a.at - b.at);
}

/** Rango del eje Y que cubre lecturas y umbrales, con 10 % de margen. */
export function valueDomain(values: number[], thresholds: number[]): [number, number] {
  const all = [...values, ...thresholds];
  if (all.length === 0) return [0, 1];
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.1;
  return [min - pad, max + pad];
}
