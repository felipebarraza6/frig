"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, type Variants } from "framer-motion";
import {
  TrendingUp,
  Receipt,
  Wallet,
  FlaskConical,
  ArrowUpRight,
  ShoppingBag,
  CreditCard,
  BarChart3,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import {
  fetchDashboardSummary,
  fetchIngredientConsumption,
  type DateRange,
} from "@/lib/api/analytics";
import { formatCLP, cn, paymentTypeLabel } from "@/lib/utils";
import { useCurrentBranch } from "@/lib/store/session";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 24 } },
};

function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getCurrentMonthRange(): { start: string; end: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start: formatDateInput(start), end: formatDateInput(end) };
}

function rangeDates(
  range: DateRange,
  customRange: { start: string; end: string },
): { start: string; end: string; label: string } {
  const today = new Date();
  const end = formatDateInput(today);

  if (range === "custom") {
    return {
      start: customRange.start,
      end: customRange.end,
      label: "Rango personalizado",
    };
  }

  const startDate = new Date(today);
  switch (range) {
    case "today":
      break;
    case "yesterday":
      startDate.setDate(today.getDate() - 1);
      return {
        start: formatDateInput(startDate),
        end: formatDateInput(startDate),
        label: "Ayer",
      };
    case "week":
      startDate.setDate(today.getDate() - 6);
      break;
    case "month":
      startDate.setDate(today.getDate() - 29);
      break;
  }
  const labels: Record<DateRange, string> = {
    today: "Hoy",
    yesterday: "Ayer",
    week: "Últimos 7 días",
    month: "Últimos 30 días",
    single: "Día específico",
    custom: "Rango personalizado",
  };
  return { start: formatDateInput(startDate), end, label: labels[range] };
}

export default function ReportsPage() {
  const branch = useCurrentBranch();
  const monthRange = useMemo(() => getCurrentMonthRange(), []);
  const [range, setRange] = useState<DateRange>("custom");
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>(monthRange);
  const dates = useMemo(() => rangeDates(range, customRange), [range, customRange]);

  const branchId = branch?.branch_id;

  const { data: summary, isLoading: loadingSummary, error: summaryError } = useQuery({
    queryKey: ["reports", "summary", dates.start, dates.end, branchId],
    queryFn: () => fetchDashboardSummary(dates.start, dates.end),
    enabled: !!branch,
  });

  const { data: ingredientConsumption, isLoading: loadingIngredients } = useQuery({
    queryKey: ["reports", "ingredient-consumption", dates.start, dates.end, branchId],
    queryFn: () => fetchIngredientConsumption(dates.start, dates.end),
    enabled: !!branch,
  });

  const loading = loadingSummary || loadingIngredients;
  const error = summaryError;

  if (loading) {
    return <ReportsSkeleton />;
  }

  if (error) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h1 className="text-lg font-semibold">No se pudieron cargar los informes</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Ocurrió un error inesperado al consultar los datos."}
        </p>
      </div>
    );
  }

  const salesTotal = summary?.sales?.total_amount ?? 0;
  const salesCount = summary?.sales?.count ?? 0;
  const profit = summary?.sales?.profit ?? 0;
  const completedOrders = summary?.orders?.completed ?? 0;
  const totalOrders = summary?.orders?.count ?? 0;
  const ingredientCost = ingredientConsumption?.total_cost ?? 0;
  const expensesTotal = salesTotal - profit - ingredientCost;

  const topIngredients = (ingredientConsumption?.items ?? [])
    .slice()
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10);

  return (
    <div className="flex min-h-full flex-col gap-4 p-4">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight">Informes</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-border bg-card p-1 shadow-sm">
            {(["today", "yesterday", "week", "month"] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRange(r);
                  const computed = rangeDates(r, customRange);
                  setCustomRange({ start: computed.start, end: computed.end });
                }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  range === r
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {r === "today" && "Hoy"}
                {r === "yesterday" && "Ayer"}
                {r === "week" && "7 días"}
                {r === "month" && "30 días"}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
            <input
              type="date"
              value={customRange.start}
              max={customRange.end}
              onChange={(e) => {
                const start = e.target.value;
                setCustomRange((prev) => ({ start, end: prev.end < start ? start : prev.end }));
                setRange("custom");
              }}
              className="rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus:bg-muted"
            />
            <span className="text-xs text-muted-foreground">-</span>
            <input
              type="date"
              value={customRange.end}
              min={customRange.start}
              onChange={(e) => {
                const end = e.target.value;
                setCustomRange((prev) => ({ start: prev.start > end ? end : prev.start, end }));
                setRange("custom");
              }}
              className="rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus:bg-muted"
            />
          </div>
        </div>
      </header>

      {/* Resumen ejecutivo */}
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
      >
        <StatCard
          label="Ventas del período"
          value={formatCLP(salesTotal)}
          icon={TrendingUp}
          tone="primary"
          sub={`${salesCount} órdenes`}
        />
        <StatCard
          label="Órdenes"
          value={totalOrders}
          icon={Receipt}
          tone="emerald"
          sub={`${completedOrders} completadas`}
        />
        <StatCard
          label="Costo de insumos"
          value={formatCLP(ingredientCost)}
          icon={FlaskConical}
          tone="rose"
          sub="según recetas vendidas"
        />
        <StatCard
          label="Ganancia estimada"
          value={formatCLP(profit)}
          icon={Wallet}
          tone="primary"
          sub="aproximada"
        />
        <StatCard
          label="Gastos"
          value={formatCLP(expensesTotal)}
          icon={ArrowUpRight}
          tone="amber"
          sub="estimados"
        />
      </motion.section>

      {/* Evolución de ventas */}
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4"
      >
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="h-4 w-4 text-primary" />
              Evolución de ventas
            </h2>
            <span className="text-xs text-muted-foreground">{dates.label}</span>
          </div>
          {summary?.time_series && summary.time_series.length > 0 ? (
            <SalesChart
              data={summary.time_series}
              startDate={dates.start}
              endDate={dates.end}
            />
          ) : (
            <div className="grid h-44 place-items-center rounded-xl border border-dashed border-border bg-muted/30">
              <p className="text-sm text-muted-foreground">Sin datos de ventas en el período.</p>
            </div>
          )}
        </div>
      </motion.section>

      {/* Productos y métodos de pago */}
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 lg:grid-cols-2"
      >
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShoppingBag className="h-4 w-4 text-primary" />
              Productos más vendidos
            </h2>
          </div>
          {summary?.products?.best_selling && summary.products.best_selling.length > 0 ? (
            <div className="flex flex-col gap-3">
              {summary.products.best_selling.map((p, i) => {
                const maxQty = Math.max(...summary.products.best_selling.map((x) => x.quantity), 1);
                const pct = (p.quantity / maxQty) * 100;
                return (
                  <div
                    key={i}
                    className="flex flex-col gap-1.5"
                    title={`${p.product__name}: ${p.quantity} vendidos por ${formatCLP(p.total)}`}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="min-w-0 truncate font-medium">{p.product__name}</span>
                      <span className="shrink-0 tabular-nums font-semibold">
                        {p.quantity} · {formatCLP(p.total)}
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.05 }}
                        className="h-2.5 rounded-full bg-emerald-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin ventas en el período.</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CreditCard className="h-4 w-4 text-primary" />
              Métodos de pago
            </h2>
          </div>
          {summary?.payments && summary.payments.length > 0 ? (
            <div className="flex flex-col gap-3">
              {(() => {
                const totalPayments = summary.payments.reduce((s, x) => s + x.total, 0);
                return summary.payments.map((p, i) => {
                  const pct = totalPayments > 0 ? (p.total / totalPayments) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className="flex flex-col gap-1.5"
                      title={`${paymentTypeLabel(p.type_payment__name)}: ${formatCLP(p.total)} en el período`}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{paymentTypeLabel(p.type_payment__name)}</span>
                        <span className="tabular-nums font-semibold">{formatCLP(p.total)}</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-muted">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: i * 0.05 }}
                          className="h-2.5 rounded-full bg-primary"
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin pagos en el período.</p>
          )}
        </div>
      </motion.section>

      {/* Insumos consumidos */}
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4"
      >
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <FlaskConical className="h-4 w-4 text-primary" />
              Insumos consumidos
            </h2>
            <span className="text-xs text-muted-foreground">Top 10</span>
          </div>
          {topIngredients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Insumo</th>
                    <th className="pb-2 font-medium">Cantidad</th>
                    <th className="pb-2 font-medium">Unidad</th>
                    <th className="pb-2 text-right font-medium">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {topIngredients.map((item) => (
                    <tr
                      key={item.ingredient_id}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-2 font-medium">{item.ingredient_name}</td>
                      <td className="py-2 tabular-nums">{item.total_quantity}</td>
                      <td className="py-2 text-muted-foreground">{item.unit}</td>
                      <td className="py-2 text-right tabular-nums font-semibold">
                        {formatCLP(item.cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin consumo de insumos en el período.</p>
          )}
        </div>
      </motion.section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  sub: string;
  tone?: "default" | "primary" | "emerald" | "amber" | "rose";
}) {
  const tones = {
    default: "bg-card",
    primary: "bg-primary/[0.06] border-primary/15",
    emerald: "bg-emerald-500/[0.06] border-emerald-500/15",
    amber: "bg-amber-500/[0.06] border-amber-500/15",
    rose: "bg-rose-500/[0.06] border-rose-500/15",
  };
  const iconBg = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/15 text-primary",
    emerald: "bg-emerald-500/15 text-emerald-600",
    amber: "bg-amber-500/15 text-amber-600",
    rose: "bg-rose-500/15 text-rose-600",
  };

  return (
    <motion.div
      variants={item}
      className={cn(
        "rounded-xl border border-border p-2.5 shadow-sm transition-all duration-200",
        "hover:border-primary/20 hover:shadow-md",
        tones[tone],
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", iconBg[tone])}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
        <span className="flex-1 text-[11px] font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </motion.div>
  );
}

function parseLocalDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function formatLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatShortDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

function formatFullDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function parseHourKey(hourKey: string): Date {
  const [datePart, timePart] = hourKey.split(" ");
  const [hours] = timePart.split(":").map(Number);
  const date = parseLocalDate(datePart);
  date.setHours(hours);
  return date;
}

function formatHourLabel(hourKey: string): string {
  const [, timePart] = hourKey.split(" ");
  return timePart;
}

function formatFullHour(hourKey: string): string {
  return parseHourKey(hourKey).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function SalesChart({
  data,
  startDate,
  endDate,
}: {
  data: { date: string; sales: number; orders: number }[];
  startDate: string;
  endDate: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const isHourly = startDate === endDate;

  const filled = useMemo(() => {
    const map = new Map(data.map((d) => [d.date, d]));

    if (isHourly) {
      const hours = [];
      for (let h = 0; h < 24; h++) {
        const hourKey = `${startDate} ${String(h).padStart(2, "0")}:00`;
        hours.push(map.get(hourKey) ?? { date: hourKey, sales: 0, orders: 0 });
      }
      return hours;
    }

    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    const days = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = formatLocalISO(d);
      days.push(map.get(iso) ?? { date: iso, sales: 0, orders: 0 });
    }
    return days;
  }, [data, startDate, endDate, isHourly]);

  if (filled.length === 0) return null;

  const values = filled.map((d) => d.sales);
  const max = Math.max(...values, 1);
  const width = 600;
  const height = 180;
  const padding = { top: 10, right: 10, bottom: 24, left: 10 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const xDivisor = Math.max(filled.length - 1, 1);
  const getX = (i: number) => padding.left + (i / xDivisor) * chartW;
  const getY = (v: number) => padding.top + chartH - (v / max) * chartH;

  const path = filled.reduce((acc, d, i) => {
    const px = getX(i);
    const py = getY(d.sales);
    if (i === 0) return `M ${px},${py}`;
    const prevX = getX(i - 1);
    const prevY = getY(filled[i - 1].sales);
    const cpX = prevX + (px - prevX) / 2;
    return `${acc} C ${cpX},${prevY} ${cpX},${py} ${px},${py}`;
  }, "");

  const areaPath = `${path} L ${getX(filled.length - 1)},${padding.top + chartH} L ${getX(0)},${padding.top + chartH} Z`;

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const raw = ((mx - padding.left) / chartW) * xDivisor;
    const idx = Math.max(0, Math.min(filled.length - 1, Math.round(raw)));
    setHover(idx);
  };

  const labelCount = Math.min(filled.length, 5);
  const labelInterval = Math.max(1, Math.floor(filled.length / labelCount));

  const hoverPoint = hover !== null ? filled[hover] : null;
  const hoverX = hover !== null ? getX(hover) : 0;
  const hoverY = hover !== null ? getY(hoverPoint?.sales ?? 0) : 0;

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="sales-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" className="text-primary" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.03" className="text-primary" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill="url(#sales-gradient)" className="text-primary" />

        <motion.path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />

        {filled.map((d, i) => (
          <circle
            key={i}
            cx={getX(i)}
            cy={getY(d.sales)}
            r={hover === i ? 5 : 2.5}
            className={cn(
              "fill-background stroke-primary stroke-2 transition-all duration-150",
              hover === i && "fill-primary",
            )}
          />
        ))}

        {hover !== null && hoverPoint && (
          <g>
            <line
              x1={hoverX}
              y1={padding.top}
              x2={hoverX}
              y2={padding.top + chartH}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              className="text-muted-foreground/40"
            />
            <circle
              cx={hoverX}
              cy={hoverY}
              r="6"
              className="fill-primary stroke-background stroke-[2.5]"
            />
          </g>
        )}

        {filled.map((d, i) =>
          i % labelInterval === 0 || i === filled.length - 1 ? (
            <text
              key={i}
              x={getX(i)}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted-foreground/80 text-[11px] font-medium"
            >
              {isHourly ? formatHourLabel(d.date) : formatShortDate(d.date)}
            </text>
          ) : null,
        )}
      </svg>

      {hover !== null && hoverPoint && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${(hoverX / width) * 100}%`,
            top: `${(hoverY / height) * 100}%`,
          }}
        >
          <div className="mb-1 h-1.5 w-1.5 rounded-full bg-primary" />
          <p className="font-semibold">
            {isHourly ? formatFullHour(hoverPoint.date) : formatFullDate(hoverPoint.date)}
          </p>
          <p className="text-muted-foreground">
            {formatCLP(hoverPoint.sales)} · {hoverPoint.orders} {hoverPoint.orders === 1 ? "orden" : "órdenes"}
          </p>
        </div>
      )}
    </div>
  );
}

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

function ReportsSkeleton() {
  return (
    <div className="flex min-h-full flex-col gap-4 p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SkeletonPulse className="h-7 w-32" />
        <div className="flex flex-wrap items-center gap-2">
          <SkeletonPulse className="h-8 w-48" />
          <SkeletonPulse className="h-8 w-44" />
        </div>
      </header>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-2.5 shadow-sm">
            <div className="mb-1.5 flex items-center gap-2">
              <SkeletonPulse className="h-7 w-7 rounded-lg" />
              <SkeletonPulse className="h-3 w-20" />
            </div>
            <SkeletonPulse className="mb-1 h-6 w-24" />
            <SkeletonPulse className="h-3 w-16" />
          </div>
        ))}
      </section>

      <section className="grid gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <SkeletonPulse className="mb-4 h-4 w-40" />
          <SkeletonPulse className="h-40 w-full" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <SkeletonPulse className="mb-4 h-4 w-40" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <SkeletonPulse className="h-3 w-32" />
                  <SkeletonPulse className="h-3 w-20" />
                </div>
                <SkeletonPulse className="h-2.5 w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <SkeletonPulse className="mb-4 h-4 w-32" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <SkeletonPulse className="h-3 w-28" />
                  <SkeletonPulse className="h-3 w-16" />
                </div>
                <SkeletonPulse className="h-2.5 w-full" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <SkeletonPulse className="mb-4 h-4 w-36" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <SkeletonPulse className="h-3 w-32" />
                <SkeletonPulse className="h-3 w-20" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
