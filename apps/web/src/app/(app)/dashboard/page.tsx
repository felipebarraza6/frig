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

function rangeDates(range: DateRange): { start: string; end: string; label: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const end = `${y}-${m}-${d}`;

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
  };
  return { start: `${sy}-${sm}-${sd}`, end, label: labels[range] };
}

export default function DashboardPage() {
  const branch = useCurrentBranch();
  const [range, setRange] = useState<DateRange>("today");
  const dates = useMemo(() => rangeDates(range), [range]);

  const { data: counts, isLoading: loadingCounts, error: countsError } = useQuery({
    queryKey: ["dashboard", "module-counts"],
    queryFn: fetchModuleCounts,
    enabled: !!branch,
  });

  const { data: summary, isLoading: loadingSummary, error: summaryError } = useQuery({
    queryKey: ["dashboard", "summary", dates.start, dates.end],
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
  const productsCount = counts?.inventory?.total_products ?? 0;
  const lowStock = counts?.inventory?.low_stock ?? 0;
  const pendingOrders = counts?.sales?.pending_orders ?? 0;
  const expensesTotal = counts?.expenses_by_supplier?.reduce((sum, e) => sum + e.total, 0) ?? 0;

  return (
    <div className="flex min-h-full flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {branch ? branch.business_name : "Sin sucursal seleccionada"} · {dates.label}
          </p>
        </div>
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
          sub={`${lowStock} con stock bajo`}
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
            <TimeSeriesChart data={summary.time_series} />
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos de ventas en el período.</p>
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
              <p className="text-muted-foreground">Ticket promedio</p>
              <p className="font-semibold tabular-nums">
                {salesCount > 0 ? formatCLP(salesTotal / salesCount) : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-muted-foreground">Margen</p>
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
              {summary.payments.map((p, i) => {
                const totalPayments = summary.payments.reduce((s, x) => s + x.total, 0);
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

function TimeSeriesChart({ data }: { data: { date: string; sales: number; orders: number }[] }) {
  const values = data.map((d) => d.sales);
  const max = Math.max(...values, 1);
  const width = 100;
  const height = 40;

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1 || 1)) * width;
      const y = height - (d.sales / max) * height;
      return { x, y, ...d };
    });

  // Curva suavizada con puntos de control
  const path = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x},${p.y}`;
    const prev = points[i - 1];
    const cpX = (prev.x + p.x) / 2;
    return `${acc} C ${cpX},${prev.y} ${cpX},${p.y} ${p.x},${p.y}`;
  }, "");
  const areaPath = `${path} L ${points[points.length - 1]?.x ?? width},${height} L ${points[0]?.x ?? 0},${height} Z`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-40 w-full overflow-visible"
      >
        <defs>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid horizontal */}
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            y1={height * (1 - ratio)}
            x2={width}
            y2={height * (1 - ratio)}
            stroke="currentColor"
            strokeWidth="0.3"
            strokeDasharray="2 2"
            className="text-border/50"
          />
        ))}

        {/* Área bajo la curva */}
        <path d={areaPath} fill="url(#salesGradient)" className="text-primary" />

        {/* Línea principal */}
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
          strokeLinecap="round"
          className="text-primary"
        />

        {/* Puntos con anillo */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="2.2" className="fill-card stroke-primary" strokeWidth="1" />
            <circle cx={p.x} cy={p.y} r="0.8" className="fill-primary" />
            <title>{`${p.date}: ${formatCLP(p.sales)} (${p.orders} órdenes)`}</title>
          </g>
        ))}
      </svg>

      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
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
