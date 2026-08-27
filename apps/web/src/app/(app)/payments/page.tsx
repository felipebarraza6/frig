"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  RotateCcw,
  Receipt,
  SlidersHorizontal,
  Wallet,
  Landmark,
  Search,
  X,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchPayments,
  fetchPaymentsByDirection,
  getPaymentMethodName,
  type YggdraPaymentList,
} from "@/lib/api/payments";
import { formatCLP } from "@/lib/utils";

const DIRECTION_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "INCOME", label: "Ingresos" },
  { value: "EXPENSE", label: "Egresos / Pagos" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "Todos los orígenes" },
  { value: "ORDER", label: "Orden de venta" },
  { value: "EXPENSE", label: "Gasto" },
  { value: "REVENUE", label: "Ingreso" },
  { value: "REFUND", label: "Reembolso" },
  { value: "OTHER", label: "Otro" },
];

function statusBadgeClass(status?: string | null) {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-500/10 text-emerald-700";
    case "PENDING":
      return "bg-amber-500/10 text-amber-700";
    case "PROCESSING":
      return "bg-primary/10 text-primary";
    case "FAILED":
    case "CANCELLED":
      return "bg-danger/10 text-danger";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function parseAmount(value: string | number | undefined): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  return parseFloat(value) || 0;
}

export default function PaymentsPage() {
  const [direction, setDirection] = useState<"" | "INCOME" | "EXPENSE">("EXPENSE");
  const [source, setSource] = useState<YggdraPaymentList["payment_source"] | "">("");
  const [search, setSearch] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});

  const filter = useMemo(
    () => ({
      payment_direction: direction || undefined,
      payment_source: source || undefined,
      ...pageUrl,
    }),
    [direction, source, pageUrl],
  );

  const {
    data: page,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["payments", filter],
    queryFn: () => fetchPayments(filter),
  });

  const { data: directionSummary, isLoading: loadingDirectionSummary } = useQuery({
    queryKey: ["payments", "by_direction"],
    queryFn: fetchPaymentsByDirection,
  });

  const payments = useMemo(() => page?.results ?? [], [page]);
  const totalCount = page?.count ?? 0;

  const incomeTotal = parseAmount(directionSummary?.INCOME);
  const expenseTotal = parseAmount(directionSummary?.EXPENSE);

  const filteredPayments = useMemo(() => {
    if (!search.trim()) return payments;
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      const methodName = getPaymentMethodName(p);
      return (
        methodName.toLowerCase().includes(q) ||
        p.payment_source_display?.toLowerCase().includes(q) ||
        p.status_display?.toLowerCase().includes(q)
      );
    });
  }, [payments, search]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Pagos</h1>
          <p className="text-xs text-muted-foreground">
            Pagos unificados: ingresos, egresos y pagos a proveedores
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <section className="grid gap-3 overflow-x-auto pb-1 [grid-template-columns:repeat(4,minmax(150px,1fr))] sm:grid-cols-2 lg:grid-cols-4">
          {loadingDirectionSummary ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="Ingresos"
                value={formatCLP(incomeTotal)}
                icon={ArrowDownLeft}
                sub="pagos recibidos"
                tone="emerald"
              />
              <StatCard
                label="Egresos"
                value={formatCLP(expenseTotal)}
                icon={ArrowUpRight}
                sub="pagos a proveedores"
                tone="rose"
              />
              <StatCard
                label="Saldo neto"
                value={formatCLP(incomeTotal - expenseTotal)}
                icon={Wallet}
                sub="ingresos - egresos"
                tone={incomeTotal - expenseTotal >= 0 ? "emerald" : "rose"}
              />
              <StatCard
                label="Total transacciones"
                value={totalCount}
                icon={Landmark}
                sub="en el listado actual"
                tone="teal"
              />
            </>
          )}
        </section>

        <div className="flex flex-col gap-3">
          <div className="hidden flex-wrap items-end gap-3 md:flex">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar pago…"
                className="pl-9"
                aria-label="Buscar pago"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-direction" className="text-xs text-muted-foreground">Dirección</label>
              <Select
                id="filter-direction"
                value={direction}
                onChange={(e) => {
                  setDirection(e.target.value as "" | "INCOME" | "EXPENSE");
                  setPageUrl({});
                }}
              >
                {DIRECTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-source" className="text-xs text-muted-foreground">Origen</label>
              <Select
                id="filter-source"
                value={source}
                onChange={(e) => {
                  setSource(e.target.value as YggdraPaymentList["payment_source"] | "");
                  setPageUrl({});
                }}
              >
                {SOURCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar pago…"
                  className="h-10 pl-9"
                  aria-label="Buscar pago"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-10 px-3"
                onClick={() => setShowMobileFilters((v) => !v)}
                aria-expanded={showMobileFilters}
                aria-controls="mobile-filters-panel"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="ml-2">Filtros</span>
              </Button>
            </div>

            <div
              id="mobile-filters-panel"
              className={`rounded-2xl border border-border bg-card p-4 shadow-sm ${showMobileFilters ? "" : "hidden"}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">Filtros</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setShowMobileFilters(false)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Cerrar filtros</span>
                </Button>
              </div>
              <div className="grid gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-direction-mobile" className="text-xs text-muted-foreground">Dirección</label>
                  <Select
                    id="filter-direction-mobile"
                    value={direction}
                    onChange={(e) => {
                      setDirection(e.target.value as "" | "INCOME" | "EXPENSE");
                      setPageUrl({});
                    }}
                  >
                    {DIRECTION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-source-mobile" className="text-xs text-muted-foreground">Origen</label>
                  <Select
                    id="filter-source-mobile"
                    value={source}
                    onChange={(e) => {
                      setSource(e.target.value as YggdraPaymentList["payment_source"] | "");
                      setPageUrl({});
                    }}
                  >
                    {SOURCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10">
              <AlertCircle className="h-7 w-7 text-danger" />
            </div>
            <p className="text-sm font-medium">No se pudieron cargar los pagos</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reintentar
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col gap-3">
            <TableSkeleton />
            <div className="flex justify-end">
              <Skeleton className="h-9 w-40" />
            </div>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border p-8 text-center">
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Receipt className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="mt-4 text-base font-medium">No se encontraron pagos</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                {direction === "EXPENSE"
                  ? "Aún no hay pagos a proveedores registrados."
                  : direction === "INCOME"
                    ? "Aún no hay pagos recibidos registrados."
                    : "Prueba con otros filtros."}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Método</th>
                    <th className="px-4 py-3">Origen</th>
                    <th className="px-4 py-3">Dirección</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p) => {
                    const isIncome = p.payment_direction === "INCOME";
                    const methodName = getPaymentMethodName(p);
                    return (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(p.payment_date).toLocaleDateString("es-CL")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`flex h-7 w-7 items-center justify-center rounded-full ${isIncome ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
                              {isIncome ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                            </div>
                            <span>{methodName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{p.payment_source_display}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${isIncome ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700"}`}>
                            {isIncome ? "Ingreso" : "Egreso"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(p.status)}`}>
                            {p.status_display}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right tabular-nums font-semibold ${isIncome ? "text-emerald-700" : "text-rose-700"}`}>
                          {isIncome ? "+" : "-"}{formatCLP(parseAmount(p.amount))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 md:hidden">
              {filteredPayments.map((p) => {
                const isIncome = p.payment_direction === "INCOME";
                const methodName = getPaymentMethodName(p);
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isIncome ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>
                        {isIncome ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{methodName}</p>
                            <p className="break-words text-xs text-muted-foreground">{p.payment_source_display}</p>
                          </div>
                          <p className={`shrink-0 text-base font-bold tabular-nums ${isIncome ? "text-emerald-700" : "text-rose-700"}`}>
                            {isIncome ? "+" : "-"}{formatCLP(parseAmount(p.amount))}
                          </p>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
                          <div className="min-w-0">
                            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Dirección</span>
                            <span className={`block truncate font-medium ${isIncome ? "text-emerald-700" : "text-rose-700"}`}>
                              {isIncome ? "Ingreso" : "Egreso"}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Estado</span>
                            <span className="block truncate font-medium text-foreground">{p.status_display}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Fecha</span>
                            <span className="block truncate font-medium text-foreground">
                              {new Date(p.payment_date).toLocaleDateString("es-CL")}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Origen</span>
                            <span className="block truncate font-medium text-foreground">{p.payment_source_display}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{totalCount} pago{totalCount === 1 ? "" : "s"}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 px-4"
                  onClick={() => setPageUrl({ previous: page?.previous })}
                  disabled={!page?.previous}
                >
                  <span className="sm:hidden">Ant.</span>
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 px-4"
                  onClick={() => setPageUrl({ next: page?.next })}
                  disabled={!page?.next}
                >
                  <span className="sm:hidden">Sig.</span>
                  <span className="hidden sm:inline">Siguiente</span>
                </Button>
              </div>
            </div>
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

function TableSkeleton() {
  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <Skeleton className="h-3.5 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, row) => (
            <tr key={row} className="border-b border-border last:border-0">
              {Array.from({ length: 6 }).map((__, col) => (
                <td key={col} className="px-4 py-3">
                  <Skeleton className="h-4 w-full max-w-[80px]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
