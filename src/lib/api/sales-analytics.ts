import { apiFetch } from "./client";

/** Fila de `GET /sales/analytics/by-hour/`. */
export type SalesByHourRow = {
  hour: string;
  hour_24: number;
  total_sales: number;
  order_count: number;
};

/** Fila de `GET /sales/analytics/by-day/` (día de la semana, no fecha de calendario). */
export type SalesByDayRow = {
  day_of_week: number;
  day_name: string;
  total_sales: number;
  order_count: number;
};

export async function fetchSalesByHour(
  dateFrom?: string,
  dateTo?: string,
): Promise<SalesByHourRow[]> {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();
  return apiFetch<SalesByHourRow[]>(
    `/sales/analytics/by-hour/${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchSalesByDay(
  dateFrom?: string,
  dateTo?: string,
): Promise<SalesByDayRow[]> {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();
  return apiFetch<SalesByDayRow[]>(
    `/sales/analytics/by-day/${qs ? `?${qs}` : ""}`,
  );
}

const EXCLUDED_STATUSES = new Set(["CANCELLED", "REFUNDED", "NULL"]);

/** Respaldo local si el endpoint falla: 24 franjas desde órdenes ya cargadas. */
export function buildHoursFromOrders(
  orders: { date?: string; total_amount?: number | string; status?: string }[],
): SalesByHourRow[] {
  const hours = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    hour_24: h,
    total_sales: 0,
    order_count: 0,
  }));
  for (const o of orders) {
    if (o.status && EXCLUDED_STATUSES.has(o.status)) continue;
    const d = o.date ? new Date(o.date) : null;
    if (!d || Number.isNaN(d.getTime())) continue;
    const h = d.getHours();
    const slot = hours[h];
    if (!slot) continue;
    slot.total_sales += Number(o.total_amount) || 0;
    slot.order_count += 1;
  }
  return hours;
}

export type HourInsights = {
  peakSales: SalesByHourRow | null;
  peakOrders: SalesByHourRow | null;
  activeHours: number;
  totalSales: number;
  totalOrders: number;
  peakShare: number;
  peakTicket: number;
};

export function hourInsights(rows: SalesByHourRow[]): HourInsights {
  const totalSales = rows.reduce((s, r) => s + (Number(r.total_sales) || 0), 0);
  const totalOrders = rows.reduce((s, r) => s + (Number(r.order_count) || 0), 0);
  const activeHours = rows.filter(
    (r) => (Number(r.order_count) || 0) > 0 || (Number(r.total_sales) || 0) > 0,
  ).length;

  let peakSales: SalesByHourRow | null = null;
  let peakOrders: SalesByHourRow | null = null;
  for (const r of rows) {
    if (
      !peakSales ||
      (Number(r.total_sales) || 0) > (Number(peakSales.total_sales) || 0)
    ) {
      peakSales = r;
    }
    if (
      !peakOrders ||
      (Number(r.order_count) || 0) > (Number(peakOrders.order_count) || 0)
    ) {
      peakOrders = r;
    }
  }
  if (peakSales && (Number(peakSales.total_sales) || 0) <= 0) peakSales = null;
  if (peakOrders && (Number(peakOrders.order_count) || 0) <= 0) peakOrders = null;

  const peakShare =
    peakSales && totalSales > 0
      ? Math.round(((Number(peakSales.total_sales) || 0) / totalSales) * 100)
      : 0;
  const peakTicket =
    peakSales && (Number(peakSales.order_count) || 0) > 0
      ? (Number(peakSales.total_sales) || 0) / (Number(peakSales.order_count) || 1)
      : 0;

  return {
    peakSales,
    peakOrders,
    activeHours,
    totalSales,
    totalOrders,
    peakShare,
    peakTicket,
  };
}
