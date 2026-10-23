/** Fecha (YYYY-MM-DD, hora local) del día anterior a `now`. */
export function yesterdayLocal(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Órdenes abiertas de días anteriores (excluye cotizaciones). */
export function pickStaleOrders<T extends object>(orders: T[]): T[] {
  return orders.filter((o) => !(o as { is_quotation?: boolean | null }).is_quotation);
}
