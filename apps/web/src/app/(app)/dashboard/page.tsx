"use client";

import { useMemo, useState, type ReactNode } from "react";
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
  Wallet,
  Target,
  FlaskConical,
  ArrowRight,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

import {
  fetchModuleCounts,
  fetchDashboardSummary,
  fetchIngredientConsumption,
  type DateRange,
} from "@/lib/api/analytics";
import { formatCLP, cn } from "@/lib/utils";
import { useCurrentBranch, useIsModuleEnabledFromConfig } from "@/lib/store/session";
import { useProducts } from "@/lib/hooks/useCatalog";
import { MetricDrawer, type MetricDrawerSection } from "@/components/metric-drawer";
import { Sparkline } from "@/components/sparkline";
import { CustomersMetricDetail, IncomeMetricDetail, OrdersMetricDetail } from "@/components/metric-drawer-detail";
import Link from "next/link";

const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 24 } },
};

type MetricConfig = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description: string;
  sections?: MetricDrawerSection[];
  chart?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
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
  const [drawer, setDrawer] = useState<{ open: boolean; metric?: MetricConfig }>({ open: false });
  const dates = useMemo(() => rangeDates(range, customRange), [range, customRange]);

  const branchId = branch?.branch_id;

  const { data: counts, isLoading: loadingCounts, error: countsError } = useQuery({
    queryKey: ["dashboard", "module-counts", "v2", branchId],
    queryFn: () => fetchModuleCounts(branchId),
    enabled: !!branch,
  });

  const { data: summary, isLoading: loadingSummary, error: summaryError } = useQuery({
    queryKey: ["dashboard", "summary", "v2", dates.start, dates.end, branchId],
    queryFn: () => fetchDashboardSummary(dates.start, dates.end, branchId),
    enabled: !!branch,
  });

  const nutritionEnabled = useIsModuleEnabledFromConfig("nutrition");

  const { data: ingredientConsumption, isLoading: loadingIngredients } = useQuery({
    queryKey: ["dashboard", "ingredient-consumption", "v2", dates.start, dates.end, branchId],
    queryFn: () => fetchIngredientConsumption(dates.start, dates.end, branchId),
    enabled: !!branch && nutritionEnabled,
  });

  const { data: products = [] } = useProducts(!!branch);

  const lowStockProducts = useMemo(() => {
    return products
      .filter((p) => (p.quantity ?? 0) > 0 && (p.minimum_stock ?? 0) > 0 && (p.quantity ?? 0) <= (p.minimum_stock ?? 0))
      .sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0))
      .slice(0, 5);
  }, [products]);

  const loading = loadingCounts || loadingSummary || (nutritionEnabled && loadingIngredients);
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

  // Ventas del período = ventas completadas (order_type=SALE).
  const salesTotal = summary?.sales?.completed?.total_amount ?? 0;
  const salesCount = summary?.sales?.completed?.count ?? 0;
  const salesProfit = summary?.sales?.completed?.profit ?? 0;
  // Órdenes del período = órdenes de cliente completadas.
  const ordersTotal = summary?.orders?.completed_summary?.total_amount ?? 0;
  const ordersCount = summary?.orders?.completed_summary?.count ?? 0;
  const ordersProfit = summary?.orders?.completed_summary?.profit ?? 0;
  // Ingresos y ganancia = suma de ventas + órdenes completadas.
  const totalRevenue = salesTotal + ordersTotal;
  const totalProfit = salesProfit + ordersProfit;
  // Métricas de contexto para estados y totales generales.
  const completedOrders = summary?.orders?.completed ?? 0;
  const customers = counts?.customers?.total ?? 0;
  // El contador de productos del backend llega en 0 para esta sucursal a pesar de
  // tener catálogo. Usamos la lista local que ya cargamos para stock bajo.
  const productsCount = products.length;
  const lowStockCount = lowStockProducts.length;
  const pendingOrders = counts?.sales?.pending_orders ?? 0;
  const pendingSalesAmount = counts?.sales?.pending_sales_amount ?? 0;
  const expensesTotal = counts?.expenses_by_supplier?.reduce((sum, e) => sum + e.total, 0) ?? 0;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <p className="text-xs text-muted-foreground">Resumen general del negocio</p>
        </div>
        <div className="flex items-center justify-center sm:justify-end">
          <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 shadow-sm sm:w-auto">
            <input
              type="date"
              value={customRange.start}
              max={customRange.end}
              onChange={(e) => {
                const start = e.target.value;
                setCustomRange((prev) => ({ start, end: prev.end < start ? start : prev.end }));
                setRange("custom");
              }}
              className="min-w-0 flex-1 border-0 bg-transparent px-1 py-0.5 text-xs font-medium text-foreground outline-none sm:flex-none"
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
              className="min-w-0 flex-1 border-0 bg-transparent px-1 py-0.5 text-xs font-medium text-foreground outline-none sm:flex-none"
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">

      {/* Stats principales */}
      <motion.section variants={container} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Ventas del período"
          value={formatCLP(salesTotal)}
          icon={TrendingUp}
          sub={`${salesCount} ventas`}
          tone="emerald"
          href="/sales"
          description="Ventas completadas en el rango seleccionado."
          onClick={() =>
            setDrawer({
              open: true,
              metric: {
                title: "Ventas del período",
                value: formatCLP(salesTotal),
                icon: TrendingUp,
                description:
                  "Suma total de ventas completadas y pagadas en el rango seleccionado. Incluye ventas creadas desde el POS o manualmente.",
                sections: [
                  { label: "Ventas completadas", value: String(salesCount) },
                  {
                    label: "Venta promedio",
                    value: salesCount > 0 ? formatCLP(salesTotal / salesCount) : "—",
                  },
                  {
                    label: "Ganancia estimada",
                    value: formatCLP(salesProfit),
                  },
                ],
                chart:
                  summary?.time_series && summary.time_series.length > 1 ? (
                    <Sparkline data={summary.time_series.map((d) => d.sales)} />
                  ) : undefined,
                actions: (
                  <Link
                    href="/sales"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                  >
                    Ver detalle de ventas
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ),
                children: (
                  <>
                    <div className="rounded-2xl border border-border bg-muted/30 p-3">
                      <OrdersMetricDetail
                        filter={{
                          start_date: dates.start,
                          end_date: dates.end,
                          order_type: "SALE",
                          status: "COMPLETED",
                        }}
                        emptyMessage="No hay ventas completadas en el período seleccionado."
                      />
                    </div>
                    <BestSellingProducts
                      items={summary?.products?.best_selling_sales ?? []}
                      title="Productos más vendidos en ventas"
                      emptyMessage="Sin productos vendidos en el período."
                      colorClass="bg-emerald-500"
                    />
                  </>
                ),
              },
            })
          }
        />
        <StatCard
          label="Órdenes del período"
          value={formatCLP(ordersTotal)}
          icon={Receipt}
          sub={`${ordersCount} órdenes`}
          tone="blue"
          href="/sales"
          description="Órdenes de cliente completadas en el rango seleccionado."
          onClick={() =>
            setDrawer({
              open: true,
              metric: {
                title: "Órdenes del período",
                value: formatCLP(ordersTotal),
                icon: Receipt,
                description:
                  "Suma total de órdenes de cliente completadas y pagadas en el rango seleccionado. Pueden ser pedidos, cotizaciones convertidas o cualquier transacción tipo orden según tu negocio.",
                sections: [
                  { label: "Órdenes completadas", value: String(ordersCount) },
                  {
                    label: "Promedio por orden",
                    value: ordersCount > 0 ? formatCLP(ordersTotal / ordersCount) : "—",
                  },
                  {
                    label: "Ganancia estimada",
                    value: formatCLP(ordersProfit),
                  },
                ],
                actions: (
                  <Link
                    href="/sales"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                  >
                    Ver historial de ventas
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ),
                children: (
                  <>
                    <div className="rounded-2xl border border-border bg-muted/30 p-3">
                      <OrdersMetricDetail
                        filter={{
                          start_date: dates.start,
                          end_date: dates.end,
                          order_type: "ORDER",
                          status: "COMPLETED",
                        }}
                        emptyMessage="No hay órdenes completadas en el período seleccionado."
                      />
                    </div>
                    <BestSellingProducts
                      items={summary?.products?.best_selling_orders ?? []}
                      title="Productos más vendidos en órdenes"
                      emptyMessage="Sin productos vendidos en órdenes del período."
                      colorClass="bg-blue-500"
                    />
                  </>
                ),
              },
            })
          }
        />
        <StatCard
          label="Cuentas abiertas"
          value={pendingOrders}
          icon={Clock}
          sub="ventas sin pagar"
          tone="amber"
          href="/sales"
          description="Ventas pendientes de pago. Click para gestionarlas."
          onClick={() =>
            setDrawer({
              open: true,
              metric: {
                title: "Cuentas abiertas",
                value: pendingOrders,
                icon: Clock,
                description: "Ventas que todavía no se han pagado en el rango seleccionado. Requieren atención para completar el cobro.",
                sections: [
                  { label: "Monto pendiente", value: formatCLP(pendingSalesAmount) },
                  { label: "Ventas completadas", value: String(salesCount) },
                  { label: "Órdenes completadas", value: String(completedOrders) },
                ],
                actions: (
                  <Link
                    href="/sales"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600/90"
                  >
                    Gestionar cuentas abiertas
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ),
                children: (
                  <div className="rounded-2xl border border-border bg-muted/30 p-3">
                    <OrdersMetricDetail
                      filter={{
                        start_date: dates.start,
                        end_date: dates.end,
                        order_type: "SALE",
                        status: "PENDING",
                      }}
                      emptyMessage="No hay cuentas abiertas en el período seleccionado."
                    />
                  </div>
                ),
              },
            })
          }
        />
        <StatCard
          label="Clientes"
          value={customers}
          icon={Users}
          sub="registrados"
          tone="violet"
          href="/customers"
          description="Base de clientes registrados en la sucursal. Click para ver el listado."
          onClick={() =>
            setDrawer({
              open: true,
              metric: {
                title: "Clientes",
                value: customers,
                icon: Users,
                description: "Base de clientes registrados en la sucursal. Click para ver el listado.",
                sections: [{ label: "Total registrados", value: String(customers) }],
                children: (
                  <div className="rounded-2xl border border-border bg-muted/30 p-3">
                    <CustomersMetricDetail
                      filter={{}}
                      emptyMessage="No hay clientes registrados en la sucursal."
                    />
                  </div>
                ),
              },
            })
          }
        />
      </motion.section>

      {/* Stats secundarias */}
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className={cn("grid grid-cols-2 gap-3", nutritionEnabled ? "lg:grid-cols-5" : "lg:grid-cols-4")}
      >
        <StatCard
          label="Productos"
          value={productsCount}
          icon={Package}
          sub={`${lowStockCount} con stock bajo`}
          tone="orange"
          href="/products"
          description="Productos activos en el catálogo. Click para ver el inventario de productos."
          onClick={() =>
            setDrawer({
              open: true,
              metric: {
                title: "Productos",
                value: productsCount,
                icon: Package,
                description: "Productos activos en el catálogo. Click para ver el inventario de productos.",
                sections: [
                  { label: "Con stock bajo", value: String(lowStockCount) },
                  { label: "Catálogo local", value: String(productsCount) },
                ],
                children: (
                  <div className="rounded-2xl border border-border bg-muted/30 p-3">
                    {lowStockProducts.length > 0 ? (
                      <div className="flex flex-col">
                        {lowStockProducts.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between border-b border-border py-2.5 last:border-0"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{p.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Stock: {p.quantity ?? 0} / mín: {p.minimum_stock ?? 0}
                              </p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold tabular-nums">
                              {formatCLP(p.price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center">
                        <Package className="mx-auto h-8 w-8 text-muted-foreground" />
                        <p className="mt-2 text-sm font-medium">Sin productos con stock bajo</p>
                        <p className="text-xs text-muted-foreground">Todos los productos tienen stock suficiente.</p>
                      </div>
                    )}
                  </div>
                ),
              },
            })
          }
        />
        <StatCard
          label="Ingresos"
          value={formatCLP(totalRevenue)}
          icon={ArrowDownLeft}
          sub="ventas + órdenes"
          tone="emerald"
          href="/sales"
          description="Total de dinero ingresado por ventas y órdenes completadas en el período."
          onClick={() =>
            setDrawer({
              open: true,
              metric: {
                title: "Ingresos",
                value: formatCLP(totalRevenue),
                icon: ArrowDownLeft,
                description:
                  "Suma total del dinero que ingresó por ventas y órdenes de cliente completadas en el rango seleccionado.",
                sections: [
                  { label: "Ventas completadas", value: String(salesCount) },
                  { label: "Órdenes completadas", value: String(ordersCount) },
                  { label: "Ventas del período", value: formatCLP(salesTotal) },
                  { label: "Órdenes del período", value: formatCLP(ordersTotal) },
                ],
                actions: (
                  <Link
                    href="/sales"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                  >
                    Ver historial de ingresos
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ),
                children: (
                  <div className="rounded-2xl border border-border bg-muted/30 p-3">
                    <IncomeMetricDetail startDate={dates.start} endDate={dates.end} />
                  </div>
                ),
              },
            })
          }
        />
        <StatCard
          label="Ganancia estimada"
          value={formatCLP(totalProfit)}
          icon={Wallet}
          sub="aproximada"
          tone="teal"
          href="/sales"
          description="Margen aproximado calculado sobre ventas y órdenes completadas."
          onClick={() =>
            setDrawer({
              open: true,
              metric: {
                title: "Ganancia estimada",
                value: formatCLP(totalProfit),
                icon: Wallet,
                description:
                  "Margen aproximado calculado sobre ventas y órdenes de cliente completadas en el rango seleccionado. Se obtiene restando el costo estimado al total vendido.",
                sections: [
                  { label: "Ingresos totales", value: formatCLP(totalRevenue) },
                  { label: "Costo estimado", value: formatCLP(totalRevenue - totalProfit) },
                  { label: "Ganancia neta", value: formatCLP(totalProfit) },
                  {
                    label: "Margen estimado",
                    value: totalRevenue > 0 ? `${((totalProfit / totalRevenue) * 100).toFixed(1)}%` : "—",
                  },
                ],
                children: (
                  <ProfitMiniReport revenue={totalRevenue} profit={totalProfit} salesProfit={salesProfit} ordersProfit={ordersProfit} />
                ),
              },
            })
          }
        />
        {nutritionEnabled && (
          <StatCard
            label="Costo de insumos"
            value={formatCLP(ingredientConsumption?.total_cost ?? 0)}
            icon={FlaskConical}
            sub="según recetas vendidas"
            tone="slate"
            href="/reports"
            description="Costo estimado de los insumos consumidos según las recetas de los productos vendidos."
            onClick={() =>
              setDrawer({
                open: true,
                metric: {
                  title: "Costo de insumos",
                  value: formatCLP(ingredientConsumption?.total_cost ?? 0),
                  icon: FlaskConical,
                  description:
                    "Costo estimado de los insumos consumidos según las recetas de los productos vendidos.",
                  sections: [
                    {
                      label: "Insumos distintos",
                      value: String(ingredientConsumption?.items?.length ?? 0),
                    },
                    ],
                  actions: (
                    <Link
                      href="/reports"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                    >
                      Ver informe completo
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ),
                  children: (
                    <div className="rounded-2xl border border-border bg-muted/30 p-3">
                      {ingredientConsumption?.items && ingredientConsumption.items.length > 0 ? (
                        <div className="flex flex-col">
                          {(() => {
                            const maxCost = Math.max(
                              ...ingredientConsumption.items.map((i) => i.cost),
                              1,
                            );
                            return ingredientConsumption.items.map((item) => {
                              const pct = (item.cost / maxCost) * 100;
                              return (
                                <div
                                  key={item.ingredient_id}
                                  className="flex flex-col gap-1 border-b border-border py-2.5 last:border-0"
                                  title={`${item.ingredient_name}: ${item.total_quantity} ${item.unit} consumidos`}
                                >
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="min-w-0 truncate font-medium">
                                      {item.ingredient_name}
                                    </span>
                                    <span className="shrink-0 tabular-nums font-semibold">
                                      {formatCLP(item.cost)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {item.total_quantity} {item.unit}
                                  </p>
                                  <div className="h-1.5 w-full rounded-full bg-muted">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${pct}%` }}
                                      transition={{ duration: 0.8 }}
                                      className="h-1.5 rounded-full bg-primary"
                                    />
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      ) : (
                        <div className="py-6 text-center">
                          <FlaskConical className="mx-auto h-8 w-8 text-muted-foreground" />
                          <p className="mt-2 text-sm font-medium">Sin consumo de insumos</p>
                          <p className="text-xs text-muted-foreground">No hay insumos consumidos en el período seleccionado.</p>
                        </div>
                      )}
                    </div>
                  ),
                },
              })
            }
          />
        )}
        <StatCard
          label="Gastos"
          value={formatCLP(expensesTotal)}
          icon={ArrowUpRight}
          sub="activos"
          tone="rose"
          href="/expenses"
          description="Gastos fijos activos de la sucursal. No dependen del rango de fechas."
          onClick={() =>
            setDrawer({
              open: true,
              metric: {
                title: "Gastos",
                value: formatCLP(expensesTotal),
                icon: ArrowUpRight,
                description:
                  "Suma de gastos fijos activos registrados para la sucursal. Estos registros no tienen fecha de ocurrencia, por lo que no se filtran por el rango seleccionado.",
                sections: [
                  {
                    label: "Registros activos",
                    value: String(counts?.finance?.total_expenses ?? 0),
                  },
                  {
                    label: "Proveedores con gastos",
                    value: String(counts?.expenses_by_supplier?.length ?? 0),
                  },
                ],
                children: (
                  <div className="rounded-2xl border border-border bg-muted/30 p-3">
                    {counts?.expenses_by_supplier && counts.expenses_by_supplier.length > 0 ? (
                      <div className="flex flex-col">
                        {(() => {
                          const maxTotal = Math.max(
                            ...counts.expenses_by_supplier.map((e) => e.total),
                            1,
                          );
                          return counts.expenses_by_supplier.map((e) => {
                            const pct = (e.total / maxTotal) * 100;
                            return (
                              <div
                                key={e.supplier}
                                className="flex flex-col gap-1 border-b border-border py-2.5 last:border-0"
                              >
                                <div className="flex items-center justify-between text-sm">
                                  <span className="min-w-0 truncate font-medium">{e.supplier}</span>
                                  <span className="shrink-0 tabular-nums font-semibold">
                                    {formatCLP(e.total)}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {e.count} {e.count === 1 ? "registro" : "registros"}
                                </p>
                                <div className="h-1.5 w-full rounded-full bg-muted">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.8 }}
                                    className="h-1.5 rounded-full bg-rose-500"
                                  />
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    ) : (
                      <div className="py-6 text-center">
                        <ArrowUpRight className="mx-auto h-8 w-8 text-muted-foreground" />
                        <p className="mt-2 text-sm font-medium">Sin gastos registrados</p>
                        <p className="text-xs text-muted-foreground">Aún no hay gastos fijos registrados para la sucursal.</p>
                      </div>
                    )}
                  </div>
                ),
                actions: (
                  <Link
                    href="/expenses"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-600/90"
                  >
                    Ver detalle de gastos
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ),
              },
            })
          }
        />
      </motion.section>

      {/* Gráficos principales */}
      <motion.section variants={container} initial="hidden" animate="show" className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-muted/30 p-5 shadow-sm lg:col-span-2">
          <div className="mb-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" />
              Evolución de ventas
            </h2>
          </div>
          {summary?.time_series && summary.time_series.length > 0 ? (
            <SalesChart data={summary.time_series} startDate={dates.start} endDate={dates.end} />
          ) : (
            <div className="h-52">
              <EmptyState
                icon={BarChart3}
                title="Sin datos de ventas"
                subtitle="No hay ventas registradas en el período seleccionado."
              />
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-primary" />
            Resumen del negocio
          </h2>
          <div className="flex flex-col items-center">
            <RadarChart
              metrics={[
                { label: "Ventas", value: Math.min(salesTotal / 100000, 1) },
                { label: "Órdenes", value: Math.min(ordersCount / 50, 1) },
                { label: "Clientes", value: Math.min(customers / 100, 1) },
                { label: "Productos", value: Math.min(productsCount / 50, 1) },
                { label: "Ganancia", value: Math.min(totalProfit / 50000, 1) },
              ]}
            />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-border/60 bg-background/60 p-3 text-xs">
            <div>
              <p className="text-muted-foreground">Venta promedio</p>
              <p className="font-semibold tabular-nums">
                {salesCount > 0 ? formatCLP(salesTotal / salesCount) : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Margen estimado</p>
              <p className="font-semibold tabular-nums">
                {totalRevenue > 0 ? `${((totalProfit / totalRevenue) * 100).toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Insumos consumidos */}
      {nutritionEnabled && (
        <motion.section variants={container} initial="hidden" animate="show" className="grid gap-3">
          <div className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <FlaskConical className="h-4 w-4 text-primary" />
                Insumos consumidos
              </h2>
              <Link
                href="/reports"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                Ver informe completo
              </Link>
            </div>
            {ingredientConsumption?.items && ingredientConsumption.items.length > 0 ? (
              (() => {
                const maxCost = Math.max(...ingredientConsumption.items.map((i) => i.cost), 1);
                return (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                    {ingredientConsumption.items.map((item) => {
                      const pct = (item.cost / maxCost) * 100;
                      return (
                        <div
                          key={item.ingredient_id}
                          className="flex flex-col gap-1 border-b border-border pb-2.5 last:border-0"
                          title={`${item.ingredient_name}: ${item.total_quantity} ${item.unit} consumidos`}
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="min-w-0 truncate font-medium">{item.ingredient_name}</span>
                            <span className="shrink-0 tabular-nums font-semibold">{formatCLP(item.cost)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.total_quantity} {item.unit}
                          </p>
                          <div className="h-1.5 w-full rounded-full bg-muted">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8 }}
                              className="h-1.5 rounded-full bg-primary"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            ) : (
              <div className="py-6 text-center">
                <FlaskConical className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Sin consumo de insumos</p>
                <p className="text-xs text-muted-foreground">No hay insumos consumidos en el período seleccionado.</p>
              </div>
            )}
          </div>
        </motion.section>
      )}

      {drawer.metric && (
        <MetricDrawer
          open={drawer.open}
          onClose={() => setDrawer({ open: false })}
          title={drawer.metric.title}
          value={drawer.metric.value}
          icon={drawer.metric.icon}
          description={drawer.metric.description}
          sections={drawer.metric.sections}
          chart={drawer.metric.chart}
          actions={drawer.metric.actions}
        >
          {drawer.metric.children}
        </MetricDrawer>
      )}
    </div>
  </div>
);
}

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  href,
  description,
  onClick,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  sub: string;
  href?: string;
  description?: string;
  onClick?: () => void;
  tone?: "emerald" | "blue" | "amber" | "violet" | "orange" | "teal" | "rose" | "slate";
}) {
  const toneStyles = {
    emerald: "from-emerald-50/50 via-white/80 to-white/80 shadow-emerald-500/5",
    blue: "from-blue-50/50 via-white/80 to-white/80 shadow-blue-500/5",
    amber: "from-amber-50/50 via-white/80 to-white/80 shadow-amber-500/5",
    violet: "from-violet-50/50 via-white/80 to-white/80 shadow-violet-500/5",
    orange: "from-orange-50/50 via-white/80 to-white/80 shadow-orange-500/5",
    teal: "from-teal-50/50 via-white/80 to-white/80 shadow-teal-500/5",
    rose: "from-rose-50/50 via-white/80 to-white/80 shadow-rose-500/5",
    slate: "from-muted/40 via-white/80 to-white/80",
  };

  const toneText = {
    emerald: "text-emerald-700/90",
    blue: "text-blue-700/90",
    amber: "text-amber-700/90",
    violet: "text-violet-700/90",
    orange: "text-orange-700/90",
    teal: "text-teal-700/90",
    rose: "text-rose-700/90",
    slate: "text-muted-foreground",
  };

  const toneIcon = {
    emerald: "bg-emerald-500/12 text-emerald-600",
    blue: "bg-blue-500/12 text-blue-600",
    amber: "bg-amber-500/12 text-amber-600",
    violet: "bg-violet-500/12 text-violet-600",
    orange: "bg-orange-500/12 text-orange-600",
    teal: "bg-teal-500/12 text-teal-600",
    rose: "bg-rose-500/12 text-rose-600",
    slate: "bg-muted text-muted-foreground",
  };

  const content = (
    <>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={cn("block text-[11px] font-medium tracking-wide", toneText[tone])}>
            {label}
          </span>
          <p className="text-xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
        </div>
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-110",
            toneIcon[tone]
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </>
  );

  const baseClassName = cn(
    "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br p-4 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md",
    toneStyles[tone]
  );

  if (href) {
    return (
      <motion.div variants={item}>
        <Link
          href={href}
          title={description}
          className={cn(baseClassName, "block cursor-pointer")}
          onClick={(e) => {
            if (!onClick) return;
            e.preventDefault();
            onClick();
          }}
        >
          {content}
        </Link>
      </motion.div>
    );
  }

  if (onClick) {
    return (
      <motion.button
        type="button"
        variants={item}
        title={description}
        onClick={onClick}
        className={cn(baseClassName, "w-full cursor-pointer text-left")}
      >
        {content}
      </motion.button>
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
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 32, left: 16 };
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
        className="h-52 w-full"
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
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-border bg-card px-3 py-2 shadow-lg"
          style={{
            left: `${(hoverX / width) * 100}%`,
            top: `${(hoverY / height) * 100}%`,
          }}
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <p className="text-xs font-semibold">
              {isHourly ? formatFullHour(hoverPoint.date) : formatFullDate(hoverPoint.date)}
            </p>
          </div>
          <p className="text-sm font-bold tabular-nums">{formatCLP(hoverPoint.sales)}</p>
          <p className="text-xs text-muted-foreground">
            {hoverPoint.orders} {hoverPoint.orders === 1 ? "venta" : "ventas"} en este período
          </p>
        </div>
      )}
    </div>
  );
}

function ProfitMiniReport({
  revenue,
  profit,
  salesProfit,
  ordersProfit,
}: {
  revenue: number;
  profit: number;
  salesProfit: number;
  ordersProfit: number;
}) {
  const cost = Math.max(revenue - profit, 0);
  const profitPct = revenue > 0 ? (profit / revenue) * 100 : 0;
  const size = 120;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const profitOffset = circumference * (1 - profitPct / 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 rounded-xl border border-border bg-background p-4">
        <div className="relative flex h-[120px] w-[120px] shrink-0 items-center justify-center">
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              className="text-muted"
              strokeLinecap="round"
            />
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              className="text-primary"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: profitOffset }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-muted-foreground">Margen</span>
            <span className="text-lg font-bold tabular-nums">{profitPct.toFixed(1)}%</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              Ganancia
            </span>
            <span className="font-semibold tabular-nums">{formatCLP(profit)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-muted" />
              Costo estimado
            </span>
            <span className="font-semibold tabular-nums">{formatCLP(cost)}</span>
          </div>
          <div className="mt-1 border-t border-border pt-2 text-xs text-muted-foreground">
            Por tipo de transacción:
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>Ventas</span>
            <span className="font-medium tabular-nums">{formatCLP(salesProfit)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>Órdenes</span>
            <span className="font-medium tabular-nums">{formatCLP(ordersProfit)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BestSellingProducts({
  items,
  title,
  emptyMessage,
  colorClass = "bg-primary",
}: {
  items: { product__name: string; quantity: number; total: number }[];
  title: string;
  emptyMessage: string;
  colorClass?: string;
}) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
        <Package className="mx-auto h-8 w-8 text-muted-foreground" />
        <h3 className="mt-2 text-xs font-semibold text-muted-foreground">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  const maxQty = Math.max(...items.map((x) => x.quantity), 1);

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <h3 className="mb-3 text-xs font-semibold text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-1 gap-3">
        {items.map((p, i) => {
          const pct = (p.quantity / maxQty) * 100;
          return (
            <div key={i} className="flex items-start gap-3">
              <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", colorClass)}>
                #{i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium">{p.product__name}</span>
                  <span className="ml-2 shrink-0 text-sm font-bold tabular-nums">{formatCLP(p.total)}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05 }}
                    className={cn("h-1.5 rounded-full", colorClass)}
                  />
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{p.quantity} unidades</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RadarChart({ metrics }: { metrics: { label: string; value: number }[] }) {
  const size = 160;
  const center = size / 2;
  const radius = 56;
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
          const labelX = center + (radius + 18) * Math.cos(p.angle);
          const labelY = center + (radius + 18) * Math.sin(p.angle);
          return (
            <text
              key={i}
              x={labelX}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[10px] font-semibold"
            >
              {p.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="grid h-full place-items-center rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
      <div>
        <Icon className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

function DashboardSkeleton() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="space-y-2">
          <SkeletonPulse className="h-5 w-32" />
          <SkeletonPulse className="h-3 w-48" />
        </div>
        <SkeletonPulse className="h-10 w-full sm:w-64" />
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">

      {/* Stats principales */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-1.5">
              <SkeletonPulse className="h-3.5 w-3.5 rounded-sm" />
              <SkeletonPulse className="h-3 w-20" />
            </div>
            <SkeletonPulse className="mb-2 h-7 w-28" />
            <SkeletonPulse className="h-3 w-16" />
          </div>
        ))}
      </section>

      {/* Stats secundarias */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-1.5">
              <SkeletonPulse className="h-3.5 w-3.5 rounded-sm" />
              <SkeletonPulse className="h-3 w-20" />
            </div>
            <SkeletonPulse className="mb-2 h-7 w-28" />
            <SkeletonPulse className="h-3 w-16" />
          </div>
        ))}
      </section>

      {/* Gráficos */}
      <section className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm lg:col-span-2">
          <SkeletonPulse className="mb-2 h-4 w-40" />
          <SkeletonPulse className="h-36 w-full" />
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm">
          <SkeletonPulse className="mb-2 h-4 w-36" />
          <div className="flex flex-col items-center">
            <SkeletonPulse className="h-20 w-20 rounded-full" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <SkeletonPulse className="h-8 w-full" />
            <SkeletonPulse className="h-8 w-full" />
          </div>
        </div>
      </section>
      </div>
    </div>
  );
}
