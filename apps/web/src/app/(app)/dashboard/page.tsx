"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, type Variants } from "framer-motion";
import {
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
  type LucideIcon,
} from "lucide-react";
import { fetchModuleCounts, fetchDashboardSummary, type DateRange } from "@/lib/api/analytics";
import { formatCLP, cn, paymentTypeLabel } from "@/lib/utils";
import { useCurrentBranch } from "@/lib/store/session";
import { useProducts } from "@/lib/hooks/useCatalog";
import Link from "next/link";

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

export default function DashboardPage() {
  const branch = useCurrentBranch();
  const monthRange = useMemo(() => getCurrentMonthRange(), []);
  const [range, setRange] = useState<DateRange>("custom");
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>(monthRange);
  const dates = useMemo(() => rangeDates(range, customRange), [range, customRange]);

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
    return <DashboardSkeleton />;
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
    <div className="flex min-h-full flex-col gap-4 p-4">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
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

      {/* Stats principales */}
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          label="Ventas del período"
          value={formatCLP(salesTotal)}
          icon={TrendingUp}
          tone="primary"
          sub={`${salesCount} órdenes`}
          href="/sales"
          description="Suma total de ventas pagadas en el rango seleccionado. Click para ver el detalle de órdenes."
        />
        <StatCard
          label="Órdenes completadas"
          value={completedOrders}
          icon={Receipt}
          tone="emerald"
          sub={`de ${totalOrders} totales`}
          href="/sales"
          description="Órdenes finalizadas y pagadas. Click para revisar el historial de ventas."
        />
        <StatCard
          label="Cuentas abiertas"
          value={pendingOrders}
          icon={Clock}
          tone="amber"
          sub="pedidos sin pagar"
          href="/sales"
          description="Órdenes pendientes de pago o cierre. Click para gestionarlas."
        />
        <StatCard
          label="Clientes"
          value={customers}
          icon={Users}
          tone="default"
          sub="registrados"
          href="/customers"
          description="Base de clientes registrados en la sucursal. Click para ver el listado."
        />
      </motion.section>

      {/* Stats secundarias */}
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          label="Productos"
          value={productsCount}
          icon={Package}
          tone="default"
          sub={`${lowStockCount} con stock bajo`}
          href="/products"
          description="Productos activos en el catálogo. Click para ver el inventario de productos."
        />
        <StatCard
          label="Ingresos"
          value={formatCLP(salesTotal)}
          icon={ArrowDownLeft}
          tone="emerald"
          sub="ventas del período"
          href="/sales"
          description="Total de dinero ingresado por ventas en el período seleccionado."
        />
        <StatCard
          label="Ganancia estimada"
          value={formatCLP(profit)}
          icon={Wallet}
          tone="primary"
          sub="aproximada"
          href="/sales"
          description="Margen aproximado calculado sobre las ventas del período."
        />
        <StatCard
          label="Gastos"
          value={formatCLP(expensesTotal)}
          icon={ArrowUpRight}
          tone="rose"
          sub="del período"
          href="/expenses"
          description="Total de gastos registrados. Click para ver el detalle de compras."
        />
      </motion.section>

      {/* Gráficos principales */}
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 lg:grid-cols-3"
      >
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:col-span-2">
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
            <div className="grid h-44 place-items-center rounded-xl border border-dashed border-border bg-muted/30">
              <p className="text-sm text-muted-foreground">Sin datos de ventas en el período.</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
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
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <p className="text-muted-foreground">Venta promedio</p>
              <p className="font-semibold tabular-nums">
                {salesCount > 0 ? formatCLP(salesTotal / salesCount) : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <p className="text-muted-foreground">Margen estimado</p>
              <p className="font-semibold tabular-nums">
                {salesTotal > 0 ? `${((profit / salesTotal) * 100).toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Métodos de pago y productos */}
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
              Métodos de pago
            </h2>
            <Link
              href="/payment-methods"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              Configurar
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {summary?.payments && summary.payments.length > 0 ? (
            <div className="flex flex-col gap-3">
              {(() => {
                const totalPayments = summary.payments.reduce((s, x) => s + x.total, 0);
                return summary.payments.map((p, i) => {
                  const pct = totalPayments > 0 ? (p.total / totalPayments) * 100 : 0;
                  return (
                  <Link
                    key={i}
                    href="/sales"
                    className="group flex flex-col gap-1.5 rounded-lg p-1.5 -mx-1.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium group-hover:text-primary">{paymentTypeLabel(p.type_payment__name)}</span>
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
                  </Link>
                );
              })}
            )()}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin pagos en el período.</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Productos más vendidos</h2>
            <Link
              href="/products"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              Ver todos
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {summary?.products?.best_selling && summary.products.best_selling.length > 0 ? (
            <div className="flex flex-col gap-3">
              {summary.products.best_selling.map((p, i) => {
                const maxQty = Math.max(...summary.products.best_selling.map((x) => x.quantity), 1);
                const pct = (p.quantity / maxQty) * 100;
                return (
                  <Link
                    key={i}
                    href="/products"
                    className="group flex flex-col gap-1.5 rounded-lg p-1.5 -mx-1.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="min-w-0 truncate font-medium group-hover:text-primary">{p.product__name}</span>
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
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin ventas en el período.</p>
          )}
        </div>
      </motion.section>

      {/* Stock bajo */}
      {lowStockProducts.length > 0 && (
        <motion.section
          variants={container}
          initial="hidden"
          animate="show"
          className="grid gap-4"
        >
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Stock bajo
              </h2>
              <Link
                href="/inventory"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
              >
                Ver inventario
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStockProducts.map((p) => (
                <Link
                  key={p.id}
                  href="/inventory"
                  className="flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 transition-colors hover:bg-amber-500/15"
                >
                  <span className="max-w-[160px] truncate text-sm font-medium">{p.name}</span>
                  <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    {p.quantity} / {p.minimum_stock}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </motion.section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  tone = "default",
  href,
  description,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  sub: string;
  tone?: "default" | "primary" | "emerald" | "amber" | "rose";
  href?: string;
  description?: string;
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

  const content = (
    <>
      <div className="mb-1.5 flex items-center gap-2">
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", iconBg[tone])}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
        <span className="flex-1 text-[11px] font-medium text-muted-foreground">{label}</span>
        {href && (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
        )}
      </div>
      <p className="text-lg font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </>
  );

  const baseClassName = cn(
    "group rounded-xl border border-border p-2.5 shadow-sm transition-all duration-200",
    "hover:-translate-y-0.5 hover:shadow-md",
    tones[tone]
  );

  if (href) {
    return (
      <motion.div variants={item} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <Link href={href} title={description} className={baseClassName}>
          {content}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div variants={item} title={description} className={baseClassName}>
      {content}
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

        {/* Área bajo la curva */}
        <path
          d={areaPath}
          fill="url(#sales-gradient)"
          className="text-primary"
        />

        {/* Línea principal */}
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

        {/* Puntos en cada dato */}
        {filled.map((d, i) => (
          <circle
            key={i}
            cx={getX(i)}
            cy={getY(d.sales)}
            r={hover === i ? 5 : 2.5}
            className={cn(
              "fill-background stroke-primary stroke-2 transition-all duration-150",
              hover === i && "fill-primary"
            )}
          />
        ))}

        {/* Línea vertical y punto activo en hover */}
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

        {/* Labels del eje X */}
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

      {/* Tooltip anclado al punto exacto */}
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

function RadarChart({ metrics }: { metrics: { label: string; value: number }[] }) {
  const size = 100;
  const center = size / 2;
  const radius = 36;
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
            strokeWidth="0.75"
            className="text-border/80"
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
              strokeWidth="0.75"
              className="text-border/80"
            />
          );
        })}
        {/* Data polygon */}
        <motion.polygon
          points={polygon}
          fill="currentColor"
          fillOpacity="0.2"
          stroke="currentColor"
          strokeWidth="2"
          className="text-primary"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
        {/* Data points */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            className="fill-background stroke-primary stroke-2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 + i * 0.05 }}
          />
        ))}
        {/* Labels */}
        {points.map((p, i) => {
          const labelX = center + (radius + 14) * Math.cos(p.angle);
          const labelY = center + (radius + 14) * Math.sin(p.angle);
          return (
            <text
              key={i}
              x={labelX}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[9px] font-semibold"
            >
              {p.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

function DashboardSkeleton() {
  return (
    <div className="flex min-h-full flex-col gap-4 p-4">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex flex-wrap items-center gap-2">
          <SkeletonPulse className="h-8 w-48" />
          <SkeletonPulse className="h-8 w-44" />
        </div>
      </header>

      {/* Stats principales */}
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-2.5 shadow-sm"
          >
            <div className="mb-1.5 flex items-center gap-2">
              <SkeletonPulse className="h-7 w-7 rounded-lg" />
              <SkeletonPulse className="h-3 w-20" />
            </div>
            <SkeletonPulse className="mb-1 h-6 w-24" />
            <SkeletonPulse className="h-3 w-16" />
          </div>
        ))}
      </section>

      {/* Stats secundarias */}
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-2.5 shadow-sm"
          >
            <div className="mb-1.5 flex items-center gap-2">
              <SkeletonPulse className="h-7 w-7 rounded-lg" />
              <SkeletonPulse className="h-3 w-20" />
            </div>
            <SkeletonPulse className="mb-1 h-6 w-24" />
            <SkeletonPulse className="h-3 w-16" />
          </div>
        ))}
      </section>

      {/* Gráficos */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:col-span-2">
          <SkeletonPulse className="mb-4 h-4 w-40" />
          <SkeletonPulse className="h-40 w-full" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <SkeletonPulse className="mb-4 h-4 w-36" />
          <div className="flex flex-col items-center">
            <SkeletonPulse className="h-24 w-24 rounded-full" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <SkeletonPulse className="h-14 w-full" />
            <SkeletonPulse className="h-14 w-full" />
          </div>
        </div>
      </section>

      {/* Métodos de pago y productos */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <SkeletonPulse className="mb-4 h-4 w-32" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
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
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <SkeletonPulse className="mb-4 h-4 w-40" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
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
      </section>
    </div>
  );
}
