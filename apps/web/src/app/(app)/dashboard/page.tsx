"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  TrendingUp,
  Package,
  Users,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Clock,
  ChevronRight,
  ShoppingBag,
  Wallet,
  Target,
} from "lucide-react";
import { fetchModuleCounts, fetchDashboardSummary, type DateRange } from "@/lib/api/analytics";
import { formatCLP, cn, paymentTypeLabel } from "@/lib/utils";
import { useCurrentBranch } from "@/lib/store/session";
import { useProducts } from "@/lib/hooks/useCatalog";
import Link from "next/link";

function rangeDates(range: DateRange, singleDate?: string): { start: string; end: string; label: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const end = `${y}-${m}-${d}`;

  if (range === "single") {
    const date = singleDate || end;
    return { start: date, end: date, label: "Día específico" };
  }

  const startDate = new Date(today);
  switch (range) {
    case "today":
      break;
    case "yesterday":
      startDate.setDate(today.getDate() - 1);
      return {
        start: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`,
        end: `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`,
        label: "Ayer",
      };
    case "week":
      startDate.setDate(today.getDate() - 6);
      break;
    case "month":
      startDate.setDate(today.getDate() - 29);
      break;
  }
  const sy = startDate.getFullYear();
  const sm = String(startDate.getMonth() + 1).padStart(2, "0");
  const sd = String(startDate.getDate()).padStart(2, "0");
  const labels: Record<DateRange, string> = {
    today: "Hoy",
    yesterday: "Ayer",
    week: "Últimos 7 días",
    month: "Últimos 30 días",
    single: "Día específico",
  };
  return { start: `${sy}-${sm}-${sd}`, end, label: labels[range] };
}

export default function DashboardPage() {
  const branch = useCurrentBranch();
  const [range, setRange] = useState<DateRange>("today");
  const [singleDate, setSingleDate] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const dates = useMemo(() => rangeDates(range, singleDate), [range, singleDate]);

  const branchId = branch?.branch_id;

  const { data: counts, isLoading: loadingCounts, error: countsError } = useQuery({
    queryKey: ["dashboard", "module-counts", branchId],
    queryFn: fetchModuleCounts,
    enabled: !!branch,
  });

  const { data: summary, isLoading: loadingSummary, error: summaryError } = useQuery({
    queryKey: ["dashboard", "summary", dates.start, dates.end, branchId],
    queryFn: () => fetchDashboardSummary(dates.start, dates.end),
    enabled: !!branch,
  });

  const { data: products = [] } = useProducts(!!branch);

  const lowStockProducts = useMemo(() => {
    return products
      .filter((p) => (p.quantity ?? 0) > 0 && (p.minimum_stock ?? 0) > 0 && (p.quantity ?? 0) <= (p.minimum_stock ?? 0))
      .sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0))
      .slice(0, 5);
  }, [products]);

  const loading = loadingCounts || loadingSummary;
  const error = countsError || summaryError;

  if (loading) {
    return (
      <div className="grid min-h-full place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h1 className="text-lg font-semibold">No se pudo cargar el dashboard</h1>
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
  const customers = counts?.customers?.total ?? 0;
  // El contador de productos del backend llega en 0 para esta sucursal a pesar de
  // tener catálogo. Usamos la lista local que ya cargamos para stock bajo.
  const productsCount = products.length;
  const lowStockCount = lowStockProducts.length;
  const pendingOrders = counts?.sales?.pending_orders ?? 0;
  const expensesTotal = counts?.expenses_by_supplier?.reduce((sum, e) => sum + e.total, 0) ?? 0;

  return (
    <div className="flex min-h-full flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            {(["today", "yesterday", "week", "month"] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  range === r
                    ? "bg-primary text-white"
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
          <input
            type="date"
            value={range === "single" ? singleDate : dates.start}
            onChange={(e) => {
              setSingleDate(e.target.value);
              setRange("single");
            }}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </header>

      {/* Stats principales */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ventas del período"
          value={formatCLP(salesTotal)}
          icon={TrendingUp}
          tone="primary"
          sub={`${salesCount} órdenes`}
        />
        <StatCard
          label="Órdenes completadas"
          value={completedOrders}
          icon={Receipt}
          tone="emerald"
          sub={`de ${totalOrders} totales`}
        />
        <StatCard
          label="Cuentas abiertas"
          value={pendingOrders}
          icon={Clock}
          tone="amber"
          sub="pedidos sin pagar"
        />
        <StatCard
          label="Clientes"
          value={customers}
          icon={Users}
          tone="default"
          sub="registrados"
        />
      </section>

      {/* Stats secundarias */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Productos"
          value={productsCount}
          icon={Package}
          tone="default"
          sub={`${lowStockCount} con stock bajo`}
        />
        <StatCard
          label="Ingresos"
          value={formatCLP(salesTotal)}
          icon={ArrowDownLeft}
          tone="emerald"
          sub="ventas del período"
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
          tone="rose"
          sub="del período"
        />
      </section>

      {/* Gráficos principales */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" />
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
            <div className="grid h-56 place-items-center rounded-lg border border-dashed border-border">
              <p className="text-sm text-muted-foreground">Sin datos de ventas en el período.</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-primary" />
            Resumen del negocio
          </h2>
          <RadarChart
            metrics={[
              { label: "Ventas", value: Math.min(salesTotal / 100000, 1) },
              { label: "Órdenes", value: Math.min(totalOrders / 50, 1) },
              { label: "Clientes", value: Math.min(customers / 100, 1) },
              { label: "Productos", value: Math.min(productsCount / 50, 1) },
              { label: "Ganancia", value: Math.min(profit / 50000, 1) },
            ]}
          />
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-muted-foreground">Venta promedio por orden</p>
              <p className="font-semibold tabular-nums">
                {salesCount > 0 ? formatCLP(salesTotal / salesCount) : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-muted-foreground">Margen estimado</p>
              <p className="font-semibold tabular-nums">
                {salesTotal > 0 ? `${((profit / salesTotal) * 100).toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Métodos de pago y productos */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <ShoppingBag className="h-4 w-4 text-primary" />
            Métodos de pago
          </h2>
          {summary?.payments && summary.payments.length > 0 ? (
            <div className="flex flex-col gap-3">
              {(() => {
                const totalPayments = summary.payments.reduce((s, x) => s + x.total, 0);
                return summary.payments.map((p, i) => {
                  const pct = totalPayments > 0 ? (p.total / totalPayments) * 100 : 0;
                  return (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{paymentTypeLabel(p.type_payment__name)}</span>
                      <span className="tabular-nums font-semibold">{formatCLP(p.total)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            )()}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin pagos en el período.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Productos más vendidos</h2>
          {summary?.products?.best_selling && summary.products.best_selling.length > 0 ? (
            <div className="flex flex-col gap-3">
              {summary.products.best_selling.map((p, i) => {
                const maxQty = Math.max(...summary.products.best_selling.map((x) => x.quantity), 1);
                const pct = (p.quantity / maxQty) * 100;
                return (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="min-w-0 truncate font-medium">{p.product__name}</span>
                      <span className="shrink-0 tabular-nums font-semibold">
                        {p.quantity} · {formatCLP(p.total)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${pct}%` }}
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
      </section>

      {/* Stock bajo */}
      <section className="grid gap-6 lg:grid-cols-1">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Stock bajo
            </h2>
            <Link
              href="/inventory"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Ver inventario
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {lowStockProducts.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lowStockProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
                >
                  <span className="min-w-0 truncate text-sm font-medium">{p.name}</span>
                  <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {p.quantity} / {p.minimum_stock}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No hay productos con stock bajo.</p>
          )}
        </div>
      </section>
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
  icon: React.ComponentType<{ className?: string }>;
  sub: string;
  tone?: "default" | "primary" | "emerald" | "amber" | "rose";
}) {
  const tones = {
    default: "bg-card",
    primary: "bg-primary/5 border-primary/20",
    emerald: "bg-emerald-500/5 border-emerald-500/20",
    amber: "bg-amber-500/5 border-amber-500/20",
    rose: "bg-rose-500/5 border-rose-500/20",
  };
  const iconTones = {
    default: "text-muted-foreground",
    primary: "text-primary",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
  };

  return (
    <div className={cn("rounded-xl border border-border p-4 transition-shadow hover:shadow-sm", tones[tone])}>
      <div className="mb-2 flex items-center gap-2">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconTones[tone])}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
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
  const [hover, setHover] = useState<{ idx: number; mx: number; my: number } | null>(null);
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
  const height = 200;
  const padding = { top: 8, right: 8, bottom: 24, left: 8 };
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

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const raw = ((mx - padding.left) / chartW) * xDivisor;
    const idx = Math.max(0, Math.min(filled.length - 1, Math.round(raw)));
    setHover({ idx, mx, my });
  };

  const labelCount = Math.min(filled.length, 5);
  const labelInterval = Math.max(1, Math.floor(filled.length / labelCount));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-52 w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        />

        {hover && (
          <g>
            <line
              x1={getX(hover.idx)}
              y1={padding.top}
              x2={getX(hover.idx)}
              y2={padding.top + chartH}
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="3 3"
              className="text-muted-foreground/30"
            />
            <circle
              cx={getX(hover.idx)}
              cy={getY(filled[hover.idx].sales)}
              r="3.5"
              className="fill-primary stroke-background stroke-2"
            />
          </g>
        )}

        {filled.map((d, i) =>
          i % labelInterval === 0 || i === filled.length - 1 ? (
            <text
              key={i}
              x={getX(i)}
              y={height - 6}
              textAnchor="middle"
              className="fill-muted-foreground/70 text-[10px]"
            >
              {isHourly ? formatHourLabel(d.date) : formatShortDate(d.date)}
            </text>
          ) : null,
        )}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-border/60 bg-background/95 px-2 py-1 text-xs shadow-sm backdrop-blur"
          style={{ left: hover.mx + 12, top: hover.my - 36 }}
        >
          <p className="font-medium">
            {isHourly ? formatFullHour(filled[hover.idx].date) : formatFullDate(filled[hover.idx].date)}
          </p>
          <p className="text-muted-foreground">
            {formatCLP(filled[hover.idx].sales)} · {filled[hover.idx].orders} órdenes
          </p>
        </div>
      )}
    </div>
  );
}

function RadarChart({ metrics }: { metrics: { label: string; value: number }[] }) {
  const size = 120;
  const center = size / 2;
  const radius = 45;
  const angleStep = (Math.PI * 2) / metrics.length;

  const points = metrics.map((m, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = radius * Math.min(Math.max(m.value, 0.1), 1);
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
      label: m.label,
      value: m.value,
      angle,
    };
  });

  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* Grid */}
        {[0.25, 0.5, 0.75, 1].map((level) => (
          <polygon
            key={level}
            points={metrics
              .map((_, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const r = radius * level;
                return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
              })
              .join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-border"
          />
        ))}
        {/* Axis */}
        {metrics.map((m, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-border"
            />
          );
        })}
        {/* Data polygon */}
        <polygon
          points={polygon}
          fill="currentColor"
          fillOpacity="0.15"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-primary"
        />
        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" className="fill-primary" />
        ))}
        {/* Labels */}
        {points.map((p, i) => {
          const labelX = center + (radius + 18) * Math.cos(p.angle);
          const labelY = center + (radius + 18) * Math.sin(p.angle);
          return (
            <text
              key={i}
              x={labelX}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[8px] font-medium"
            >
              {p.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
