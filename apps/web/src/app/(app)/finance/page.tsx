"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Percent,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  RotateCcw,
  BarChart3,
  PieChart,
  ArrowRight,
  PiggyBank,
  CreditCard,
  Banknote,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchFinancialMetricsSummary,
  fetchRevenuesByDateRange,
  fetchExpensesByFrequency,
  getCurrentMonthRange,
  getMetricAmount,
  type RevenueByDateRangeItem,
  type ExpenseByFrequency,
} from "@/lib/api/financial-metrics";
import { formatCLP } from "@/lib/utils";
import { useCurrentBranch } from "@/lib/store/session";

function parseAmount(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  return parseFloat(String(value)) || 0;
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

export default function FinanceDashboardPage() {
  const monthRange = useMemo(() => getCurrentMonthRange(), []);
  const branch = useCurrentBranch();
  const branchId = branch?.branch_id;
  const [range] = useState({
    start: monthRange.start,
    end: monthRange.end,
  });

  const {
    data: summary,
    isLoading: loadingSummary,
    isError: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["financial-metrics", "summary", branchId],
    queryFn: () => fetchFinancialMetricsSummary(branchId),
    enabled: Boolean(branchId),
  });

  const {
    data: revenueRange,
    isLoading: loadingRevenueRange,
    isError: revenueRangeError,
    refetch: refetchRevenueRange,
  } = useQuery({
    queryKey: ["revenues", "by_date_range", branchId, range.start, range.end],
    queryFn: () => fetchRevenuesByDateRange(branchId, range.start, range.end),
    enabled: Boolean(branchId),
  });

  const {
    data: expensesFrequency,
    isLoading: loadingExpensesFrequency,
    isError: expensesFrequencyError,
    refetch: refetchExpensesFrequency,
  } = useQuery({
    queryKey: ["fixed-expenses", "by_frequency", branchId],
    queryFn: () => fetchExpensesByFrequency(branchId),
    enabled: Boolean(branchId),
  });

  const revenueItems = useMemo(() => {
    const raw = revenueRange?.results ?? [];
    return raw.filter((d): d is RevenueByDateRangeItem & { date: string; total: string | number } => Boolean(d.date));
  }, [revenueRange]);

  const expenseItems = useMemo(() => {
    const raw = expensesFrequency?.results ?? [];
    return raw.filter((d): d is ExpenseByFrequency & { frequency: string; total: string | number } => Boolean(d.frequency));
  }, [expensesFrequency]);

  const hasError = summaryError || revenueRangeError || expensesFrequencyError;

  const revenueTotal = getMetricAmount(summary, "current_month_revenue") || getMetricAmount(summary, "total_revenue");
  const expenseTotal = getMetricAmount(summary, "current_month_expenses") || getMetricAmount(summary, "total_expenses");
  const netProfit = getMetricAmount(summary, "current_month_profit") || getMetricAmount(summary, "net_profit");
  const margin = getMetricAmount(summary, "profit_margin");

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Finanzas</h1>
          <p className="text-xs text-muted-foreground">
            Resumen financiero del mes y flujo de caja
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        {hasError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
              <AlertCircle className="h-7 w-7 text-danger" />
            </div>
            <p className="text-sm font-medium">No se pudieron cargar las métricas financieras</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (summaryError) refetchSummary();
                if (revenueRangeError) refetchRevenueRange();
                if (expensesFrequencyError) refetchExpensesFrequency();
              }}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            <section className="grid gap-3 overflow-x-auto pb-1 [grid-template-columns:repeat(4,minmax(150px,1fr))] sm:grid-cols-2 lg:grid-cols-4">
              {loadingSummary ? (
                <>
                  <StatSkeleton />
                  <StatSkeleton />
                  <StatSkeleton />
                  <StatSkeleton />
                </>
              ) : (
                <>
                  <StatCard
                    label="Ingresos del mes"
                    value={formatCLP(revenueTotal)}
                    icon={ArrowDownLeft}
                    sub="total ingresado"
                    tone="emerald"
                  />
                  <StatCard
                    label="Egresos del mes"
                    value={formatCLP(expenseTotal)}
                    icon={ArrowUpRight}
                    sub="total gastado"
                    tone="rose"
                  />
                  <StatCard
                    label="Utilidad neta"
                    value={formatCLP(netProfit)}
                    icon={Wallet}
                    sub="ingresos - egresos"
                    tone={netProfit >= 0 ? "emerald" : "rose"}
                  />
                  <StatCard
                    label="Margen"
                    value={`${margin.toFixed(1)}%`}
                    icon={Percent}
                    sub="rentabilidad aproximada"
                    tone={margin >= 0 ? "teal" : "rose"}
                  />
                </>
              )}
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-semibold">Flujo de ingresos</h2>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatShortDate(range.start)} - {formatShortDate(range.end)}
                  </span>
                </div>
                {loadingRevenueRange ? (
                  <div className="h-56">
                    <Skeleton className="h-full w-full rounded-xl" />
                  </div>
                ) : revenueItems.length === 0 ? (
                  <div className="grid h-56 place-items-center rounded-xl border border-dashed border-border text-center">
                    <div>
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <TrendingUp className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="mt-3 text-sm font-medium">Sin datos de ingresos</p>
                      <p className="text-xs text-muted-foreground">No hay ingresos registrados en el período.</p>
                    </div>
                  </div>
                ) : (
                  <SimpleBarChart data={revenueItems} />
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
                    <PieChart className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold">Egresos por frecuencia</h2>
                </div>
                {loadingExpensesFrequency ? (
                  <div className="h-56">
                    <Skeleton className="h-full w-full rounded-xl" />
                  </div>
                ) : expenseItems.length === 0 ? (
                  <div className="grid h-56 place-items-center rounded-xl border border-dashed border-border text-center">
                    <div>
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <TrendingDown className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="mt-3 text-sm font-medium">Sin egresos</p>
                      <p className="text-xs text-muted-foreground">No hay gastos registrados por frecuencia.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-56 flex-col justify-end gap-3">
                    {expenseItems.map((item) => {
                      const max = Math.max(...expenseItems.map((i) => parseAmount(i.total)), 1);
                      const value = parseAmount(item.total);
                      const pct = (value / max) * 100;
                      return (
                        <div key={item.frequency} className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{item.frequency}</span>
                            <span className="tabular-nums text-muted-foreground">{formatCLP(value)}</span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-2.5 rounded-full bg-rose-500 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PiggyBank className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-semibold">Acciones rápidas</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <QuickAction
                  href="/revenues"
                  icon={Banknote}
                  title="Registrar ingreso"
                  description="Agrega ventas, servicios u otros ingresos."
                  tone="emerald"
                />
                <QuickAction
                  href="/expenses"
                  icon={CreditCard}
                  title="Registrar egreso"
                  description="Controla gastos, proveedores y pagos recurrentes."
                  tone="rose"
                />
                <QuickAction
                  href="/payments"
                  icon={Wallet}
                  title="Ver pagos"
                  description="Revisa ingresos, egresos y pagos unificados."
                  tone="teal"
                />
              </div>
            </section>
          </>
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
  tone = "slate",
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sub: string;
  tone?: "emerald" | "rose" | "teal" | "slate";
}) {
  const toneStyles = {
    emerald: "from-emerald-50/60 via-white/90 to-white/90",
    rose: "from-rose-50/60 via-white/90 to-white/90",
    teal: "from-teal-50/60 via-white/90 to-white/90",
    slate: "from-muted/50 via-white/90 to-white/90",
  };
  const toneText = {
    emerald: "text-emerald-700/90",
    rose: "text-rose-700/90",
    teal: "text-teal-700/90",
    slate: "text-muted-foreground",
  };
  const toneIcon = {
    emerald: "bg-emerald-500/12 text-emerald-600",
    rose: "bg-rose-500/12 text-rose-600",
    teal: "bg-teal-500/12 text-teal-600",
    slate: "bg-muted text-muted-foreground",
  };

  return (
    <div className={`rounded-2xl border border-border/60 bg-gradient-to-br p-4 shadow-sm ${toneStyles[tone]}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`block text-[11px] font-medium uppercase tracking-wider ${toneText[tone]}`}>
            {label}
          </span>
          <p className="mt-1 break-words text-base font-bold tabular-nums tracking-tight text-foreground sm:text-lg lg:text-xl">{value}</p>
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toneIcon[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

function SimpleBarChart({ data }: { data: (RevenueByDateRangeItem & { date: string; total: string | number })[] }) {
  const max = Math.max(...data.map((d) => parseAmount(d.total)), 1);
  return (
    <div className="flex h-56 items-end gap-1 overflow-x-auto pb-1 sm:gap-1.5">
      {data.map((d) => {
        const value = parseAmount(d.total);
        const pct = (value / max) * 100;
        return (
          <div key={d.date} className="group flex min-w-[2rem] flex-1 shrink-0 flex-col items-center gap-1.5">
            <div className="relative w-full flex-1 overflow-hidden rounded-t-md bg-muted">
              <div
                className="absolute bottom-0 w-full rounded-t-md bg-emerald-500 transition-all duration-500 group-hover:bg-emerald-400"
                style={{ height: `${pct}%` }}
                title={`${formatShortDate(d.date)}: ${formatCLP(value)}`}
              />
            </div>
            <span className="text-[10px] text-muted-foreground sm:hidden">
              {new Date(`${d.date}T00:00:00`).toLocaleDateString("es-CL", { day: "numeric" })}
            </span>
            <span className="hidden text-[10px] text-muted-foreground sm:inline">
              {new Date(`${d.date}T00:00:00`).getDate()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
  tone = "slate",
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tone?: "emerald" | "rose" | "teal" | "slate";
}) {
  const toneIcon = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    rose: "bg-rose-500/10 text-rose-600",
    teal: "bg-teal-500/10 text-teal-600",
    slate: "bg-muted text-muted-foreground",
  };
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:border-border hover:bg-muted/40"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneIcon[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-sm font-medium">
          {title}
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
