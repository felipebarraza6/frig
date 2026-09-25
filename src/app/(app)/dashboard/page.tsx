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
  Truck,
  Target,
  FlaskConical,
  ArrowRight,
  type LucideIcon,
  LayoutDashboard,
} from "lucide-react";

import {
  fetchModuleCounts,
  fetchDashboardSummary,
  fetchIngredientConsumption,
} from "@/lib/api/analytics";
import { formatCLP, cn, orderStatusLabel, paymentStatusLabel } from "@/lib/utils";
import { useCurrentBranch, useIsModuleEnabledFromConfig, useIsNutritionEnabled } from "@/lib/store/session";
import { useProducts } from "@/lib/hooks/useCatalog";
import { fetchOrders } from "@/lib/api/orders";
import { MetricDrawer, type MetricDrawerSection } from "@/components/metric-drawer";
import { Sparkline } from "@/components/sparkline";
import { CustomersMetricDetail, IncomeMetricDetail, OrdersMetricDetail, ProductsMetricDetail } from "@/components/metric-drawer-detail";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard as SharedStatCard, type StatTone } from "@/components/ui/stat-card";
import { rangeDates, getCurrentMonthRange, type DatePreset } from "@/lib/date-range";
import { PageHeader } from "@/components/page-header";
import { Modal, ModalBody } from "@/components/ui/modal";

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
  tone?: StatTone;
};

export default function DashboardPage() {
  const branch = useCurrentBranch();
  const monthRange = useMemo(() => getCurrentMonthRange(), []);
  const [range, setRange] = useState<DatePreset>("custom");
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>(monthRange);
  const [drawer, setDrawer] = useState<{ open: boolean; metric?: MetricConfig }>({ open: false });
  const [showBusinessSummary, setShowBusinessSummary] = useState(false);
  const dates = useMemo(() => rangeDates(range, customRange), [range, customRange]);
  const deliveriesEnabled = useIsModuleEnabledFromConfig("deliveries");

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

  const nutritionEnabled = useIsNutritionEnabled();

  const { data: ingredientConsumption, isLoading: loadingIngredients } = useQuery({
    queryKey: ["dashboard", "ingredient-consumption", "v2", dates.start, dates.end, branchId],
    queryFn: () => fetchIngredientConsumption(dates.start, dates.end, branchId),
    enabled: !!branch && nutritionEnabled,
  });

  const { data: products = [] } = useProducts(!!branch);

  // Últimos 5 registros para los widgets de pendientes (entrega solo con módulo deliveries).
  const { data: pendingDelivery = [] } = useQuery({
    queryKey: ["dashboard", "pending-delivery", "v2", branchId],
    queryFn: async () => {
      const data = await fetchOrders({ order_type: "ORDER", status: ["PENDING", "IN_PROGRESS"], page_size: 5 });
      return data.results ?? [];
    },
    enabled: !!branch && deliveriesEnabled,
  });

  const { data: pendingPayment = [] } = useQuery({
    queryKey: ["dashboard", "pending-payment", "v2", branchId],
    queryFn: async () => {
      const data = await fetchOrders({ order_type: ["SALE", "ORDER"], payment_status: ["PENDING", "PARTIAL"], page_size: 5 });
      return data.results ?? [];
    },
    enabled: !!branch,
  });

  const loading = loadingCounts || loadingSummary || (nutritionEnabled && loadingIngredients);
  const error = countsError || summaryError;

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h1 className="font-display text-lg font-semibold">No se pudo cargar el dashboard</h1>
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
  // tener catálogo. Usamos la lista local que ya cargamos.
  const productsCount = products.length;
  const pendingOrders = counts?.sales?.pending_orders ?? 0;
  const pendingSalesAmount = counts?.sales?.pending_sales_amount ?? 0;
  const expensesTotal = counts?.expenses_by_supplier?.reduce((sum, e) => sum + e.total, 0) ?? 0;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
      <PageHeader
        title="Dashboard"
        icon={<LayoutDashboard className="h-5 w-5" />}
        subtitle="Resumen general del negocio"
        className="sticky top-0 z-20 glass-strong border-b"
        actions={
          <div className="glass-chip inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2">
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
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">

      {/* Stats principales */}
      <motion.section variants={container} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SharedStatCard
          label="Ventas del período"
          value={formatCLP(salesTotal)}
          icon={TrendingUp}
          sub={`${salesCount} ventas`}
          tone="success"
          href="/sales"

          onClick={() =>
            setDrawer({
              open: true,
              metric: {
                title: "Ventas del período",
                value: formatCLP(salesTotal),
                icon: TrendingUp,
                tone: "success",
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
                    <Sparkline
                      data={summary.time_series.map((d) => d.sales)}
                      toneClass="text-success"
                    />
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
                                          <OrdersMetricDetail
                        filter={{
                          start_date: dates.start,
                          end_date: dates.end,
                          order_type: "SALE",
                          status: "COMPLETED",
                        }}
                        emptyMessage="No hay ventas completadas en el período seleccionado."
                      />
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
        <SharedStatCard
          label="Órdenes del período"
          value={formatCLP(ordersTotal)}
          icon={Receipt}
          sub={`${ordersCount} órdenes`}
          tone="primary"
          href="/sales"

          onClick={() =>
            setDrawer({
              open: true,
              metric: {
                title: "Órdenes del período",
                value: formatCLP(ordersTotal),
                icon: Receipt,
                tone: "primary",
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
                                          <OrdersMetricDetail
                        filter={{
                          start_date: dates.start,
                          end_date: dates.end,
                          order_type: "ORDER",
                          status: "COMPLETED",
                        }}
                        emptyMessage="No hay órdenes completadas en el período seleccionado."
                      />
                    <BestSellingProducts
                      items={summary?.products?.best_selling_orders ?? []}
                      title="Productos más vendidos en órdenes"
                      emptyMessage="Sin productos vendidos en órdenes del período."
                      colorClass="bg-primary"
                    />
                  </>
                ),
              },
            })
          }
        />
        <SharedStatCard
          label="Cuentas abiertas"
          value={pendingOrders}
          icon={Clock}
          sub="ventas sin pagar"
          tone="warning"
          href="/sales"

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
                                      <OrdersMetricDetail
                      filter={{
                        start_date: dates.start,
                        end_date: dates.end,
                        order_type: "SALE",
                        status: "PENDING",
                      }}
                      emptyMessage="No hay cuentas abiertas en el período seleccionado."
                    />
                ),
              },
            })
          }
        />
        <SharedStatCard
          label="Clientes"
          value={customers}
          icon={Users}
          sub="registrados"
          tone="primary"
          href="/customers"

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
                                      <CustomersMetricDetail
                      filter={{}}
                      emptyMessage="No hay clientes registrados en la sucursal."
                    />
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
        <SharedStatCard
          label="Productos"
          value={productsCount}
          icon={Package}
          sub="activos en catálogo"
          tone="warning"
          href="/products"

          onClick={() =>
            setDrawer({
              open: true,
              metric: {
                title: "Productos",
                value: productsCount,
                icon: Package,
                description: "Productos activos en el catálogo.",
                children: <ProductsMetricDetail products={products} />,
                actions: (
                  <Link
                    href="/products"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                  >
                    Ir a productos
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ),
              },
            })
          }
        />
        <SharedStatCard
          label="Ingresos"
          value={formatCLP(totalRevenue)}
          icon={ArrowDownLeft}
          sub="ventas + órdenes"
          tone="success"
          href="/sales"

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
                                      <IncomeMetricDetail startDate={dates.start} endDate={dates.end} />
                ),
              },
            })
          }
        />
        <SharedStatCard
          label="Ganancia estimada"
          value={formatCLP(totalProfit)}
          icon={Wallet}
          sub="aproximada"
          tone="primary"
          href="/sales"

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
          <SharedStatCard
            label="Costo de insumos"
            value={formatCLP(ingredientConsumption?.total_cost ?? 0)}
            icon={FlaskConical}
            sub="según recetas vendidas"
            tone="muted"
            href="/reports/nutrition"

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
                      href="/reports/nutrition"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                    >
                      Ver informe completo
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ),
                  children: (
                    <>
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
                    </>
                  ),
                },
              })
            }
          />
        )}
        <SharedStatCard
          label="Gastos"
          value={formatCLP(expensesTotal)}
          icon={ArrowUpRight}
          sub="pagados en el período"
          tone="danger"
          href="/expenses"

          onClick={() =>
            setDrawer({
              open: true,
              metric: {
                title: "Gastos",
                value: formatCLP(expensesTotal),
                icon: ArrowUpRight,
                description:
                  "Dinero efectivamente pagado en el período seleccionado: pagos completados de egresos (gastos manuales y de órdenes de compra).",
                sections: [
                  {
                    label: "Pagos de egresos en el período",
                    value: String(
                      counts?.expenses_by_supplier?.reduce((sum, e) => sum + e.count, 0) ?? 0,
                    ),
                  },
                  {
                    label: "Proveedores con gastos",
                    value: String(counts?.expenses_by_supplier?.length ?? 0),
                  },
                ],
                children: (
                  <>
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
                                  {e.count} {e.count === 1 ? "pago" : "pagos"}
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
                  </>
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

      {/* Pendientes de entrega (solo módulo deliveries) o resumen del negocio */}
      <motion.section variants={container} initial="hidden" animate="show" className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {deliveriesEnabled ? (
          <motion.div variants={item} className="glass rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Truck className="h-4 w-4 text-primary" />
                Últimas órdenes pendientes de entrega
              </h2>
              <Link href="/sales" className="text-xs font-medium text-primary transition-colors hover:underline">
                Ver todas
              </Link>
            </div>
            {pendingDelivery.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No hay órdenes pendientes de entrega.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {pendingDelivery.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {o.order_number ? `#${o.order_number}` : o.client?.name ?? "Sin cliente"}
                        {o.order_number && o.client?.name && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {o.client.name}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(o.date).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}
                        {" · "}{orderStatusLabel(o.status)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatCLP(Number(o.total_amount ?? 0))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : (
          <motion.div variants={item} className="glass rounded-2xl p-5">
            <BusinessSummaryPanel
              salesTotal={salesTotal}
              salesCount={salesCount}
              ordersCount={ordersCount}
              customers={customers}
              productsCount={productsCount}
              totalProfit={totalProfit}
              totalRevenue={totalRevenue}
            />
          </motion.div>
        )}

        <motion.div variants={item} className="glass rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Wallet className="h-4 w-4 text-primary" />
              Últimos pendientes por pagar
            </h2>
            <Link href="/sales" className="text-xs font-medium text-primary transition-colors hover:underline">
              Ver todas
            </Link>
          </div>
          {pendingPayment.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No hay cuentas pendientes de pago.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {pendingPayment.map((o) => {
                const paid = Number((o as { paid_amount?: number | string | null }).paid_amount ?? 0);
                const remaining = Number(o.total_amount ?? 0) - paid;
                return (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {o.order_number ? `#${o.order_number}` : o.client?.name ?? "Sin cliente"}
                        {o.order_number && o.client?.name && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {o.client.name}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(o.date).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}
                        {" · "}{paymentStatusLabel(o.payment_status)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-600">
                      {formatCLP(remaining)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.div>
      </motion.section>

      {/* Resumen del negocio: flotante solo si deliveries está activo */}
      {deliveriesEnabled && (
        <>
          <button
            type="button"
            onClick={() => setShowBusinessSummary(true)}
            className="glass-strong fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-foreground shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Target className="h-4 w-4 text-primary" />
            Resumen del negocio
          </button>
          <Modal
            open={showBusinessSummary}
            onClose={() => setShowBusinessSummary(false)}
            title="Resumen del negocio"
            size="sm"
          >
            <ModalBody>
              <BusinessSummaryPanel
                salesTotal={salesTotal}
                salesCount={salesCount}
                ordersCount={ordersCount}
                customers={customers}
                productsCount={productsCount}
                totalProfit={totalProfit}
                totalRevenue={totalRevenue}
                hideTitle
              />
            </ModalBody>
          </Modal>
        </>
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
          tone={drawer.metric.tone}
        >
          {drawer.metric.children}
        </MetricDrawer>
      )}
    </div>
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
      <div className="rounded-xl border border-dashed border-border bg-background p-6 text-center">
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

function BusinessSummaryPanel({
  salesTotal,
  salesCount,
  ordersCount,
  customers,
  productsCount,
  totalProfit,
  totalRevenue,
  hideTitle = false,
}: {
  salesTotal: number;
  salesCount: number;
  ordersCount: number;
  customers: number;
  productsCount: number;
  totalProfit: number;
  totalRevenue: number;
  hideTitle?: boolean;
}) {
  return (
    <>
      {!hideTitle && (
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4 text-primary" />
          Resumen del negocio
        </h2>
      )}
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
    </>
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
        <polygon
          points={polygon}
          fill="currentColor"
          fillOpacity="0.2"
          stroke="currentColor"
          strokeWidth="2"
          className="text-primary"
        />
        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            className="fill-background stroke-primary stroke-2"
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

function DashboardSkeleton() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-10 w-full sm:w-64" />
      </header>
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">

      {/* Stats principales */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-3.5 rounded-sm" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="mb-2 h-7 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </section>

      {/* Stats secundarias */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-3.5 rounded-sm" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="mb-2 h-7 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </section>

      {/* Pendientes / resumen */}
      <section className="grid gap-3 lg:grid-cols-2">
        <div className="glass rounded-2xl p-4">
          <Skeleton className="mb-2 h-4 w-48" />
          <Skeleton className="h-28 w-full" />
        </div>
        <div className="glass rounded-2xl p-4">
          <Skeleton className="mb-2 h-4 w-40" />
          <Skeleton className="h-28 w-full" />
        </div>
      </section>
      </div>
    </div>
  );
}
