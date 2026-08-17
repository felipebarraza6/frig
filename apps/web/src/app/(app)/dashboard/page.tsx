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

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            {branch ? `Sucursal: ${branch.business_name}` : "Sin sucursal seleccionada"} · {dates.label}
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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ventas del período"
          value={formatCLP(summary?.sales?.total_amount ?? 0)}
          icon={TrendingUp}
          sub={`${summary?.sales?.count ?? 0} órdenes`}
        />
        <StatCard
          label="Órdenes completadas"
          value={summary?.orders?.completed ?? 0}
          icon={Receipt}
          sub={`de ${summary?.orders?.count ?? 0} totales`}
        />
        <StatCard
          label="Cuentas abiertas"
          value={counts?.sales?.pending_orders ?? 0}
          icon={Clock}
          sub="pedidos sin pagar"
        />
        <StatCard
          label="Clientes"
          value={counts?.customers?.total ?? 0}
          icon={Users}
          sub="registrados"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Productos"
          value={counts?.inventory?.total_products ?? 0}
          icon={Package}
          sub={`${counts?.inventory?.low_stock ?? 0} con stock bajo`}
        />
        <StatCard
          label="Ingresos"
          value={formatCLP(summary?.sales?.total_amount ?? 0)}
          icon={ArrowDownLeft}
          sub="ventas del período"
        />
        <StatCard
          label="Ganancia estimada"
          value={formatCLP(summary?.sales?.profit ?? 0)}
          icon={TrendingUp}
          sub="aproximada"
        />
        <StatCard
          label="Gastos"
          value={formatCLP(counts?.expenses_by_supplier?.reduce((sum, e) => sum + e.total, 0) ?? 0)}
          icon={ArrowUpRight}
          sub="del período"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Evolución de ventas</h2>
            <span className="text-xs text-muted-foreground">{dates.label}</span>
          </div>
          {summary?.time_series && summary.time_series.length > 0 ? (
            <TimeSeriesChart data={summary.time_series} />
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos de ventas en el período.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Métodos de pago</h2>
          {summary?.payments && summary.payments.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {summary.payments.map((p, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span>{paymentTypeLabel(p.type_payment__name)}</span>
                  <span className="font-semibold tabular-nums">{formatCLP(p.total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin pagos en el período.</p>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Productos más vendidos</h2>
          {summary?.products?.best_selling && summary.products.best_selling.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {summary.products.best_selling.map((p, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span>{p.product__name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    x{p.quantity} · {formatCLP(p.total)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sin ventas en el período.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Stock bajo</h2>
            <Link
              href="/inventory"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Ver inventario
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {lowStockProducts.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {lowStockProducts.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="min-w-0 truncate">{p.name}</span>
                  <span className="shrink-0 rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {p.quantity} / {p.minimum_stock}
                  </span>
                </li>
              ))}
            </ul>
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
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
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
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-40 w-full overflow-visible"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          points={points}
          className="text-primary"
        />
        {data.map((d, i) => {
          const x = (i / (data.length - 1 || 1)) * width;
          const y = height - (d.sales / max) * height;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="1" className="fill-primary" />
              <title>{`${d.date}: ${formatCLP(d.sales)} (${d.orders} órdenes)`}</title>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}
