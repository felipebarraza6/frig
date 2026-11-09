function amountOf(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowsOf(payload: unknown, key: string): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const value = (payload as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value;
    const results = (payload as Record<string, unknown>).results;
    if (Array.isArray(results)) return results;
  }
  return [];
}

/** Agrupa ingresos por día. El API manda `{ revenues: [...] }`, no `{ results }`. */
export function revenuesToDailyTotals(
  payload: unknown,
): { date: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const row of rowsOf(payload, "revenues")) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const date = String(item.date ?? item.revenue_date ?? "").slice(0, 10);
    if (!date) continue;
    totals.set(date, (totals.get(date) ?? 0) + amountOf(item.total ?? item.amount));
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));
}

/** El API de frecuencia responde una lista, no un sobre `{ results }`. */
export function expensesToFrequencyTotals(
  payload: unknown,
): { frequency: string; total: number; count: number }[] {
  const out: { frequency: string; total: number; count: number }[] = [];
  for (const row of rowsOf(payload, "results")) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const frequency = String(item.frequency ?? "").trim();
    if (!frequency) continue;
    out.push({
      frequency,
      total: amountOf(item.total ?? item.amount),
      count: amountOf(item.count),
    });
  }
  return out;
}
