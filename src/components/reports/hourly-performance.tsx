"use client";

import { Clock, Loader2, Receipt, TrendingUp } from "lucide-react";
import {
  hourInsights,
  type SalesByDayRow,
  type SalesByHourRow,
} from "@/lib/api/sales-analytics";
import { formatCLP, cn } from "@/lib/utils";

/** Escala suave (raíz) para que un pico no aplaste al resto. */
function visualRatio(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.sqrt(value / max);
}

function fmtCompact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${Math.round(v)}`;
}

export function HourlyKpis({
  rows,
  loading,
}: {
  rows: SalesByHourRow[];
  loading?: boolean;
}) {
  const insights = hourInsights(rows);
  const samePeak =
    insights.peakSales &&
    insights.peakOrders &&
    insights.peakSales.hour_24 === insights.peakOrders.hour_24;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Cargando horas…
      </div>
    );
  }

  if (!insights.peakSales) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin ventas en franjas horarias (se excluyen anuladas y reembolsos).
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <div className="glass flex flex-col gap-2 rounded-2xl p-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/15 text-success">
            <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <p className="text-xs font-semibold tracking-tight">Hora más vendida</p>
        </div>
        <p className="font-display text-xl font-semibold tabular-nums tracking-tight text-success">
          {insights.peakSales.hour}
        </p>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {formatCLP(Number(insights.peakSales.total_sales) || 0)}
          {insights.peakShare > 0 ? ` · ${insights.peakShare}% del período` : null}
        </p>
      </div>

      <div className="glass flex flex-col gap-2 rounded-2xl p-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Receipt className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <p className="text-xs font-semibold tracking-tight">
            {samePeak ? "Órdenes en esa hora" : "Más órdenes"}
          </p>
        </div>
        <p className="font-display text-xl font-semibold tabular-nums tracking-tight text-primary">
          {samePeak
            ? insights.peakSales.order_count
            : (insights.peakOrders?.hour ?? "—")}
        </p>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {samePeak
            ? `${insights.peakSales.order_count} orden${insights.peakSales.order_count === 1 ? "" : "es"}`
            : insights.peakOrders
              ? `${insights.peakOrders.order_count} orden${insights.peakOrders.order_count === 1 ? "" : "es"}`
              : "Sin datos"}
        </p>
      </div>

      <div className="glass flex flex-col gap-2 rounded-2xl p-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/15 text-warning">
            <Clock className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <p className="text-xs font-semibold tracking-tight">Horas con venta</p>
        </div>
        <p className="font-display text-xl font-semibold tabular-nums tracking-tight text-warning">
          {insights.activeHours}
          <span className="text-sm font-medium text-muted-foreground"> / 24</span>
        </p>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Franjas con al menos una orden
        </p>
      </div>

      <div className="glass flex flex-col gap-2 rounded-2xl p-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <p className="text-xs font-semibold tracking-tight">Ticket hora pico</p>
        </div>
        <p className="font-display text-xl font-semibold tabular-nums tracking-tight">
          {formatCLP(insights.peakTicket)}
        </p>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Promedio por orden en {insights.peakSales.hour}
        </p>
      </div>
    </div>
  );
}

export function HourlyChart({
  rows,
  loading,
  compact,
  selectedHour,
  onSelectHour,
}: {
  rows: SalesByHourRow[];
  loading?: boolean;
  compact?: boolean;
  selectedHour?: number | null;
  onSelectHour?: (hour24: number | null) => void;
}) {
  const totals = rows.map((r) => Number(r.total_sales) || 0);
  const maxVal = Math.max(...totals, 1);
  const barMaxH = compact ? 96 : 140;
  const insights = hourInsights(rows);

  if (loading) {
    return (
      <div className="flex h-28 items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando franjas…
      </div>
    );
  }

  if (!insights.peakSales) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
          <Clock className="h-4.5 w-4.5 text-muted-foreground" />
        </span>
        <p className="text-sm text-muted-foreground">Sin ventas por hora en este rango.</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {!compact ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5">
            <span className="text-muted-foreground">Pico</span>
            <span className="font-semibold tabular-nums text-primary">
              {insights.peakSales.hour} · {formatCLP(Number(insights.peakSales.total_sales) || 0)}
            </span>
          </span>
          <span className="text-[11px] text-muted-foreground">
            Sin anuladas ni reembolsos
          </span>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Sin anuladas ni reembolsos</p>
      )}

      <div className="flex items-end gap-0.5 overflow-x-auto pb-1 sm:gap-1">
        {rows.map((s) => {
          const total = Number(s.total_sales) || 0;
          const count = Number(s.order_count) || 0;
          const ratio = visualRatio(total, maxVal);
          const h = total > 0 ? Math.max(6, ratio * barMaxH) : 0;
          const isPeak =
            insights.peakSales != null &&
            s.hour_24 === insights.peakSales.hour_24 &&
            total > 0;
          const isSelected = selectedHour === s.hour_24;
          const interactive = Boolean(onSelectHour) && count > 0;
          const showCountInside = h >= 22 && count > 0;

          const bar = (
            <>
              <span
                className={cn(
                  "relative z-10 rounded px-0.5 text-[9px] font-semibold tabular-nums leading-none bg-background sm:text-[10px]",
                  isPeak || isSelected
                    ? "text-primary"
                    : total > 0
                      ? "text-muted-foreground group-hover:text-foreground"
                      : "text-muted-foreground/40",
                )}
              >
                {total > 0 ? fmtCompact(total) : "·"}
              </span>
              <div
                className={cn(
                  "relative flex w-full max-w-[28px] items-end justify-center overflow-hidden rounded-t-md transition-colors duration-200",
                  total <= 0
                    ? "bg-muted/40"
                    : isPeak || isSelected
                      ? "bg-primary"
                      : "bg-primary/55 group-hover:bg-primary",
                  isSelected && "ring-2 ring-primary/25 ring-offset-1 ring-offset-background",
                )}
                style={{ height: `${Math.max(h, total > 0 ? 6 : 2)}px` }}
              >
                {showCountInside ? (
                  <span className="pb-0.5 text-[9px] font-bold tabular-nums leading-none text-white sm:text-[10px]">
                    {count}
                  </span>
                ) : null}
              </div>
              <span
                className={cn(
                  "text-[9px] tabular-nums sm:text-[10px]",
                  isPeak || isSelected
                    ? "font-semibold text-primary"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
              >
                {String(s.hour_24).padStart(2, "0")}
              </span>
            </>
          );

          if (interactive) {
            return (
              <button
                key={s.hour_24}
                type="button"
                aria-label={`${s.hour}: ${formatCLP(total)}, ${count} orden${count === 1 ? "" : "es"}`}
                onClick={() =>
                  onSelectHour?.(isSelected ? null : s.hour_24)
                }
                className="group flex min-w-[1.35rem] flex-1 shrink-0 cursor-pointer flex-col items-center gap-0.5 sm:min-w-[1.6rem]"
              >
                {bar}
              </button>
            );
          }

          return (
            <div
              key={s.hour_24}
              title={`${s.hour}: ${formatCLP(total)} · ${count} orden${count === 1 ? "" : "es"}`}
              className="group flex min-w-[1.35rem] flex-1 shrink-0 flex-col items-center gap-0.5 sm:min-w-[1.6rem]"
            >
              {bar}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Barras por día de la semana (Dom–Sáb) desde `by-day`. */
export function WeekdayChart({
  rows,
  loading,
}: {
  rows: SalesByDayRow[];
  loading?: boolean;
}) {
  const totals = rows.map((r) => Number(r.total_sales) || 0);
  const maxVal = Math.max(...totals, 1);
  const barMaxH = 120;
  const peak = rows.reduce<SalesByDayRow | null>((best, r) => {
    if (!best || Number(r.total_sales) > Number(best.total_sales)) return r;
    return best;
  }, null);
  const hasData = peak != null && Number(peak.total_sales) > 0;

  if (loading) {
    return (
      <div className="flex h-24 items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando días…
      </div>
    );
  }

  if (!hasData) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Sin patrón por día de la semana en el período.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5">
          <span className="text-muted-foreground">Mejor día</span>
          <span className="font-semibold tabular-nums text-primary">
            {peak.day_name} · {formatCLP(Number(peak.total_sales) || 0)}
          </span>
        </span>
        <span className="text-[11px] text-muted-foreground">
          Agregado Dom–Sáb · sin anuladas ni reembolsos
        </span>
      </div>
      <div className="flex items-end gap-1.5 sm:gap-2">
        {rows.map((s) => {
          const total = Number(s.total_sales) || 0;
          const count = Number(s.order_count) || 0;
          const ratio = visualRatio(total, maxVal);
          const h = total > 0 ? Math.max(8, ratio * barMaxH) : 2;
          const isPeak = peak.day_of_week === s.day_of_week && total > 0;
          const short = s.day_name.slice(0, 3);
          return (
            <div
              key={s.day_of_week}
              title={`${s.day_name}: ${formatCLP(total)} · ${count} orden${count === 1 ? "" : "es"}`}
              className="group flex min-w-0 flex-1 flex-col items-center gap-1"
            >
              <span
                className={cn(
                  "text-[10px] font-semibold tabular-nums",
                  isPeak ? "text-primary" : "text-muted-foreground",
                )}
              >
                {total > 0 ? fmtCompact(total) : "·"}
              </span>
              <div
                className={cn(
                  "flex w-full max-w-[40px] items-end justify-center overflow-hidden rounded-t-md",
                  total <= 0
                    ? "bg-muted/40"
                    : isPeak
                      ? "bg-primary"
                      : "bg-primary/55",
                )}
                style={{ height: `${h}px` }}
              >
                {h >= 24 && count > 0 ? (
                  <span className="pb-0.5 text-[10px] font-bold tabular-nums text-white">
                    {count}
                  </span>
                ) : null}
              </div>
              <span
                className={cn(
                  "text-[10px] tabular-nums",
                  isPeak ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                {short}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
