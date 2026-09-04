"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, type Variants } from "framer-motion";
import {
  ShoppingBag,
  Package,
  FlaskConical,
  Apple,
  AlertTriangle,
  FileText,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";
import {
  fetchDashboardSummary,
  fetchIngredientConsumption,
  type DateRange,
  type DashboardSummary,
  type IngredientConsumption,
} from "@/lib/api/analytics";
import { formatCLP, cn } from "@/lib/utils";
import { useCurrentBranch } from "@/lib/store/session";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";

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

function exportToPDF() {
  window.print();
}

async function exportToExcel(
  summary: DashboardSummary,
  ingredientConsumption: IngredientConsumption | undefined,
) {
  // Import dinámico: xlsx solo se usa al exportar, fuera del bundle inicial.
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const resumenRows = [
    { Concepto: "Unidades vendidas", Valor: summary.products.best_selling.reduce((s, p) => s + p.quantity, 0) },
    { Concepto: "Productos distintos vendidos", Valor: summary.products.best_selling.length },
    { Concepto: "Insumos distintos utilizados", Valor: ingredientConsumption?.items.length ?? 0 },
    { Concepto: "Costo de insumos", Valor: ingredientConsumption?.total_cost ?? 0 },
  ];
  const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  const productosRows = summary.products.best_selling.map((p) => ({
    Nombre: p.product__name,
    Cantidad: p.quantity,
    Total: p.total,
  }));
  const wsProductos = XLSX.utils.json_to_sheet(productosRows);
  XLSX.utils.book_append_sheet(wb, wsProductos, "Productos");

  if (ingredientConsumption && ingredientConsumption.items.length > 0) {
    const insumosRows = ingredientConsumption.items.map((item) => ({
      Nombre: item.ingredient_name,
      Cantidad: item.total_quantity,
      Unidad: item.unit,
      Costo: item.cost,
    }));
    const wsInsumos = XLSX.utils.json_to_sheet(insumosRows);
    XLSX.utils.book_append_sheet(wb, wsInsumos, "Insumos");
  }

  const dateStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `informe-nutricional-${dateStr}.xlsx`);
}

export default function ReportsPage() {
  const branch = useCurrentBranch();
  const monthRange = useMemo(() => getCurrentMonthRange(), []);
  const [range, setRange] = useState<DateRange>("custom");
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>(monthRange);
  const dates = useMemo(() => rangeDates(range, customRange), [range, customRange]);

  const branchId = branch?.branch_id;

  const { data: summary, isLoading: loadingSummary, error: summaryError } = useQuery({
    queryKey: ["reports", "summary", "v2", dates.start, dates.end, branchId],
    queryFn: () => fetchDashboardSummary(dates.start, dates.end, branchId),
    enabled: !!branch,
  });

  const { data: ingredientConsumption, isLoading: loadingIngredients } = useQuery({
    queryKey: ["reports", "ingredient-consumption", "v2", dates.start, dates.end, branchId],
    queryFn: () => fetchIngredientConsumption(dates.start, dates.end, branchId),
    enabled: !!branch,
  });

  const loading = loadingSummary || loadingIngredients || !branch;
  const error = summaryError;

  if (error) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h1 className="text-lg font-semibold">No se pudo cargar el informe nutricional</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Ocurrió un error inesperado al consultar los datos."}
        </p>
      </div>
    );
  }

  const bestSelling = summary?.products?.best_selling ?? [];
  const totalUnits = bestSelling.reduce((s, p) => s + p.quantity, 0);
  const ingredientCost = ingredientConsumption?.total_cost ?? 0;

  const topIngredients = (ingredientConsumption?.items ?? [])
    .slice()
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10);

  const exportDisabled = loading || !summary;

  return (
    <div className="flex min-h-full flex-col gap-4 p-4">
      <style>{`
        @media print {
          .print-hidden { display: none !important; }
        }
      `}</style>
      {/* Header */}
      <header className="print-hidden flex flex-col gap-3">
        <PageHeader title="Informe nutricional" className="mb-0" />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="inline-flex rounded-xl border border-border bg-muted/30 p-1 shadow-sm">
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

          <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/30 p-1 shadow-sm">
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

          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={exportToPDF}
              disabled={exportDisabled}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5" />
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={() => summary && exportToExcel(summary, ingredientConsumption)}
              disabled={exportDisabled}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Exportar Excel
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <ReportsSkeleton />
      ) : (
        <>
          {/* Resumen de productos */}
          <motion.section
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 gap-2 lg:grid-cols-4"
          >
            <StatCard
              label="Productos vendidos"
              value={totalUnits}
              icon={ShoppingBag}
              tone="primary"
              sub="unidades en el período"
            />
            <StatCard
              label="Productos distintos"
              value={bestSelling.length}
              icon={Package}
              tone="emerald"
              sub="con venta registrada"
            />
            <StatCard
              label="Costo de insumos"
              value={formatCLP(ingredientCost)}
              icon={FlaskConical}
              tone="rose"
              sub="según recetas vendidas"
            />
            <StatCard
              label="Insumos utilizados"
              value={ingredientConsumption?.items.length ?? 0}
              icon={Apple}
              tone="amber"
              sub="distintos en el período"
            />
          </motion.section>

          {/* Productos más vendidos */}
          <motion.section
            variants={container}
            initial="hidden"
            animate="show"
            className="grid gap-4"
          >
            <div className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  Productos más vendidos
                </h2>
                <span className="text-xs text-muted-foreground">{dates.label}</span>
              </div>
              {bestSelling.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {bestSelling.map((p, i) => {
                    const maxQty = Math.max(...bestSelling.map((x) => x.quantity), 1);
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
                <div className="grid place-items-center rounded-xl border border-dashed border-border bg-muted/30 py-10 text-center">
                  <div>
                    <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">Sin ventas</p>
                    <p className="text-xs text-muted-foreground">No hay productos vendidos en el período.</p>
                  </div>
                </div>
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
            <div className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <FlaskConical className="h-4 w-4 text-primary" />
                  Insumos consumidos
                </h2>
                <span className="text-xs text-muted-foreground">Top 10</span>
              </div>
              {topIngredients.length > 0 ? (
                <>
                  {/* Vista móvil: cards */}
                  <div className="space-y-2 sm:hidden">
                    {topIngredients.map((item) => (
                      <div
                        key={item.ingredient_id}
                        className="flex items-center justify-between rounded-xl border border-border bg-background p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.ingredient_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.total_quantity} {item.unit}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatCLP(item.cost)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Vista desktop: tabla */}
                  <div className="hidden overflow-x-auto sm:block">
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
                </>
              ) : (
                <div className="grid place-items-center rounded-xl border border-dashed border-border bg-muted/30 py-10 text-center">
                  <div>
                    <FlaskConical className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">Sin consumo de insumos</p>
                    <p className="text-xs text-muted-foreground">No hay consumo registrado en el período.</p>
                  </div>
                </div>
              )}
            </div>
          </motion.section>
        </>
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
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  sub: string;
  tone?: "default" | "primary" | "emerald" | "amber" | "rose";
}) {
  const tones = {
    default: "bg-muted/30",
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
        "rounded-2xl border border-border p-2.5 shadow-sm transition-all duration-200",
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

function ReportsSkeleton() {
  return (
    <>
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-muted/30 p-2.5 shadow-sm">
            <div className="mb-1.5 flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="mb-1 h-6 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </section>

      <section className="grid gap-4">
        <div className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm">
          <Skeleton className="mb-4 h-4 w-40" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-2.5 w-full" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm">
          <Skeleton className="mb-4 h-4 w-36" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
