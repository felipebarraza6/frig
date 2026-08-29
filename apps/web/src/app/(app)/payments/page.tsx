"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Plus,
  Download,
  Ban,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import {
  fetchPayments,
  fetchPaymentsByDirection,
  getPaymentMethodName,
  createPayment,
  fetchPaymentMethods,
  downloadPaymentVoucher,
  type YggdraPaymentList,
  type YggdraPaymentMethod,
} from "@/lib/api/payments";
import { fetchRevenues } from "@/lib/api/revenues";
import { fetchExpenses } from "@/lib/api/expenses";
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

  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const filter = useMemo(
    () => ({
      payment_direction: direction || undefined,
      payment_source: source || undefined,
      ...pageUrl,
    }),
    [direction, source, pageUrl],
  );

  const { data: page, isLoading, isError, refetch } = useQuery({
    queryKey: ["payments", filter],
    queryFn: () => fetchPayments(filter),
  });

  const { data: directionSummary, isLoading: loadingDirectionSummary } = useQuery({
    queryKey: ["payments", "by_direction"],
    queryFn: fetchPaymentsByDirection,
  });

  // Data for create form
  const { data: paymentMethods } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
  });

  const { data: revenues } = useQuery({
    queryKey: ["revenues", "for-payment"],
    queryFn: () => fetchRevenues({ status: "PENDING" }),
  });

  const { data: expenses } = useQuery({
    queryKey: ["expenses", "for-payment"],
    queryFn: () => fetchExpenses({ status: "PENDING" }),
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

  // Create payment mutation
  const createMutation = useMutation({
    mutationFn: createPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setCreateOpen(false);
    },
  });

  // Download voucher handler
  const handleDownloadVoucher = async (id: string) => {
    setDownloading(id);
    try {
      const blob = await downloadPaymentVoucher(id, "thermal");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comprobante_${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Pagos</h1>
          <p className="text-xs text-muted-foreground">
            Pagos unificados: ingresos, egresos y pagos a proveedores
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nuevo pago
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {/* Stats cards */}
        <section className="grid gap-3 overflow-x-auto pb-1 [grid-template-columns:repeat(4,minmax(150px,1fr))] sm:grid-cols-2 lg:grid-cols-4">
          {loadingDirectionSummary ? (
            <><StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton /></>
          ) : (
            <>
              <StatCard label="Ingresos" value={formatCLP(incomeTotal)} icon={ArrowDownLeft} sub="pagos recibidos" tone="emerald" />
              <StatCard label="Egresos" value={formatCLP(expenseTotal)} icon={ArrowUpRight} sub="pagos a proveedores" tone="rose" />
              <StatCard label="Saldo neto" value={formatCLP(incomeTotal - expenseTotal)} icon={Wallet} sub="ingresos - egresos" tone={incomeTotal - expenseTotal >= 0 ? "emerald" : "rose"} />
              <StatCard label="Total transacciones" value={totalCount} icon={Landmark} sub="en el listado actual" tone="teal" />
            </>
          )}
        </section>

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="hidden flex-wrap items-end gap-3 md:flex">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pago…" className="pl-9" aria-label="Buscar pago" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-direction" className="text-xs text-muted-foreground">Dirección</label>
              <Select id="filter-direction" value={direction} onChange={(e) => { setDirection(e.target.value as "" | "INCOME" | "EXPENSE"); setPageUrl({}); }}>
                {DIRECTION_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-source" className="text-xs text-muted-foreground">Origen</label>
              <Select id="filter-source" value={source} onChange={(e) => { setSource(e.target.value as YggdraPaymentList["payment_source"] | ""); setPageUrl({}); }}>
                {SOURCE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </Select>
            </div>
          </div>
          {/* Mobile filters */}
          <div className="flex flex-col gap-3 md:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pago…" className="h-10 pl-9" aria-label="Buscar pago" />
              </div>
              <Button variant="outline" size="sm" className="h-10 px-3" onClick={() => setShowMobileFilters((v) => !v)}>
                <SlidersHorizontal className="h-4 w-4" /><span className="ml-2">Filtros</span>
              </Button>
            </div>
            <div id="mobile-filters-panel" className={`rounded-2xl border border-border bg-card p-4 shadow-sm ${showMobileFilters ? "" : "hidden"}`}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">Filtros</span>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setShowMobileFilters(false)}>
                  <X className="h-4 w-4" /><span className="sr-only">Cerrar filtros</span>
                </Button>
              </div>
              <div className="grid gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-direction-mobile" className="text-xs text-muted-foreground">Dirección</label>
                  <Select id="filter-direction-mobile" value={direction} onChange={(e) => { setDirection(e.target.value as "" | "INCOME" | "EXPENSE"); setPageUrl({}); }}>
                    {DIRECTION_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-source-mobile" className="text-xs text-muted-foreground">Origen</label>
                  <Select id="filter-source-mobile" value={source} onChange={(e) => { setSource(e.target.value as YggdraPaymentList["payment_source"] | ""); setPageUrl({}); }}>
                    {SOURCE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error / Loading / Empty / Table */}
        {isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10"><AlertCircle className="h-7 w-7 text-danger" /></div>
            <p className="text-sm font-medium">No se pudieron cargar los pagos</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reintentar</Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col gap-3"><TableSkeleton /><MobileCardsSkeleton /><div className="flex justify-end"><Skeleton className="h-9 w-40" /></div></div>
        ) : filteredPayments.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border p-8 text-center">
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted"><Receipt className="h-7 w-7 text-muted-foreground" /></div>
              <p className="mt-4 text-base font-medium">No se encontraron pagos</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                {direction === "EXPENSE" ? "Aún no hay pagos a proveedores registrados." : direction === "INCOME" ? "Aún no hay pagos recibidos registrados." : "Prueba con otros filtros."}
              </p>
              <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Registrar primer pago</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
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
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p) => {
                    const isIncome = p.payment_direction === "INCOME";
                    const methodName = getPaymentMethodName(p);
                    const canDownload = p.status === "COMPLETED";
                    return (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-muted-foreground">{new Date(p.payment_date).toLocaleDateString("es-CL")}</td>
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
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(p.status)}`}>{p.status_display}</span>
                        </td>
                        <td className={`px-4 py-3 text-right tabular-nums font-semibold ${isIncome ? "text-emerald-700" : "text-rose-700"}`}>
                          {isIncome ? "+" : "-"}{formatCLP(parseAmount(p.amount))}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {canDownload && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadVoucher(p.id)} disabled={downloading === p.id} title="Descargar comprobante">
                                {downloading === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                              </Button>
                            )}
                            {(p.status === "PENDING" || p.status === "PROCESSING") && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-danger" title="Cancelar pago (próximamente)" disabled>
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {filteredPayments.map((p) => {
                const isIncome = p.payment_direction === "INCOME";
                const methodName = getPaymentMethodName(p);
                const canDownload = p.status === "COMPLETED";
                return (
                  <div key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
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
                            <span className={`block truncate font-medium ${isIncome ? "text-emerald-700" : "text-rose-700"}`}>{isIncome ? "Ingreso" : "Egreso"}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Estado</span>
                            <span className="block truncate font-medium text-foreground">{p.status_display}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Fecha</span>
                            <span className="block truncate font-medium text-foreground">{new Date(p.payment_date).toLocaleDateString("es-CL")}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Origen</span>
                            <span className="block truncate font-medium text-foreground">{p.payment_source_display}</span>
                          </div>
                        </div>
                        {canDownload && (
                          <div className="mt-3 flex justify-end border-t border-border pt-3">
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => handleDownloadVoucher(p.id)} disabled={downloading === p.id}>
                              {downloading === p.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
                              Comprobante
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
              <p className="text-muted-foreground"><span className="font-medium text-foreground">{totalCount} pago{totalCount === 1 ? "" : "s"}</span></p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-10 px-4" onClick={() => setPageUrl({ previous: page?.previous })} disabled={!page?.previous}>
                  <span className="sm:hidden">Ant.</span><span className="hidden sm:inline">Anterior</span>
                </Button>
                <Button variant="outline" size="sm" className="h-10 px-4" onClick={() => setPageUrl({ next: page?.next })} disabled={!page?.next}>
                  <span className="sm:hidden">Sig.</span><span className="hidden sm:inline">Siguiente</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Payment Modal */}
      <CreatePaymentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        paymentMethods={paymentMethods ?? []}
        revenues={revenues?.results ?? []}
        expenses={expenses?.results ?? []}
        onSubmit={(payload) => createMutation.mutate(payload as Parameters<typeof createPayment>[0])}
        isPending={createMutation.isPending}
        error={createMutation.error instanceof Error ? createMutation.error.message : null}
      />
    </div>
  );
}

function CreatePaymentModal({ open, onClose, paymentMethods, revenues, expenses, onSubmit, isPending, error }: {
  open: boolean;
  onClose: () => void;
  paymentMethods: YggdraPaymentMethod[];
  revenues: Array<{ id: string; description?: string | null; amount: string | number; status?: string }>;
  expenses: Array<{ id: string; description?: string | null; amount: string | number; status?: string }>;
  onSubmit: (payload: { payment_method_id: string; amount: string; revenue_id?: string | null; expense_id?: string | null; reference?: string | null; notes?: string | null; status?: string }) => void;
  isPending: boolean;
  error: string | null;
}) {
  const [entityType, setEntityType] = useState<"revenue" | "expense">("revenue");
  const [entityId, setEntityId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const selectedEntity = entityType === "revenue"
    ? revenues.find((r) => r.id === entityId)
    : expenses.find((e) => e.id === entityId);

  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entityId || !paymentMethodId || !amount) return;
    const payload = { payment_method_id: paymentMethodId, amount: amount, status: "COMPLETED" as const, ...(entityType === "revenue" ? { revenue_id: entityId } : { expense_id: entityId }), ...(reference.trim() ? { reference: reference.trim() } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) };

    onSubmit(payload);
  };

  const handleClose = () => {
    setEntityType("revenue"); setEntityId(""); setPaymentMethodId("");
    setAmount(""); setReference(""); setNotes(""); onClose();
  };

  const activeMethods = paymentMethods.filter((m) => m.is_active);
  const pendingEntities = entityType === "revenue"
    ? revenues.filter((e) => e.status === "PENDING")
    : expenses.filter((e) => e.status === "PENDING");

  return (
    <AnimatedOverlay open={open} onClose={handleClose} panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4">
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-xl md:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">Registrar pago</h2>
          <button onClick={handleClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-4">
              {/* Entity type toggle */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Tipo de entidad</label>
                <div className="flex gap-2">
                  <button type="button" className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${entityType === "revenue" ? "border-emerald-500 bg-emerald-500/10 text-emerald-700" : "border-border text-muted-foreground hover:text-foreground"}`} onClick={() => { setEntityType("revenue"); setEntityId(""); }}>
                    <ArrowDownLeft className="mr-1 inline h-3.5 w-3.5" />Ingreso
                  </button>
                  <button type="button" className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${entityType === "expense" ? "border-rose-500 bg-rose-500/10 text-rose-700" : "border-border text-muted-foreground hover:text-foreground"}`} onClick={() => { setEntityType("expense"); setEntityId(""); }}>
                    <ArrowUpRight className="mr-1 inline h-3.5 w-3.5" />Egreso
                  </button>
                </div>
              </div>
              {/* Entity selector */}
              <div className="flex flex-col gap-1">
                <label htmlFor="cp-entity" className="text-sm font-medium">{entityType === "revenue" ? "Ingreso pendiente" : "Egreso pendiente"}</label>
                <Select id="cp-entity" value={entityId} onChange={(e) => { setEntityId(e.target.value); const ent = (entityType === "revenue" ? revenues : expenses).find((x) => x.id === e.target.value); if (ent) setAmount(String(parseAmount(ent.amount))); }} required>
                  <option value="">Seleccionar...</option>
                  {pendingEntities.length === 0 && <option disabled>No hay {entityType === "revenue" ? "ingresos" : "egresos"} pendientes</option>}
                  {pendingEntities.map((e) => (<option key={e.id} value={e.id}>{e.description ?? "Sin descripción"} — {formatCLP(parseAmount(e.amount))}</option>))}
                </Select>
                {selectedEntity && (<p className="mt-1 text-xs text-muted-foreground">Monto pendiente: <span className="font-medium text-foreground">{formatCLP(parseAmount(selectedEntity.amount))}</span></p>)}
              </div>
              {/* Payment method */}
              <div className="flex flex-col gap-1">
                <label htmlFor="cp-method" className="text-sm font-medium">Método de pago</label>
                <Select id="cp-method" value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)} required>
                  <option value="">Seleccionar...</option>
                  {activeMethods.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
                </Select>
              </div>
              {/* Amount */}
              <div className="flex flex-col gap-1">
                <label htmlFor="cp-amount" className="text-sm font-medium">Monto</label>
                <Input id="cp-amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required />
              </div>
              {/* Reference (conditional) */}
              {selectedMethod?.requires_reference && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="cp-reference" className="text-sm font-medium">Referencia <span className="text-danger">*</span></label>
                  <Input id="cp-reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° transferencia, voucher, etc." required={selectedMethod.requires_reference} />
                </div>
              )}
              {/* Notes */}
              <div className="flex flex-col gap-1">
                <label htmlFor="cp-notes" className="text-sm font-medium">Notas (opcional)</label>
                <Input id="cp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones..." />
              </div>
              {/* Error */}
              {error && (<div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>)}
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending || !entityId || !paymentMethodId || !amount}>
              {isPending ? (<><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Registrando...</>) : (<><FileText className="mr-1.5 h-4 w-4" />Registrar pago</>)}
            </Button>
          </div>
        </form>
      </div>
    </AnimatedOverlay>
  );
}

function StatCard({ label, value, icon: Icon, sub, tone = "slate" }: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; sub: string; tone?: "emerald" | "rose" | "teal" | "slate";
}) {
  const toneStyles = { emerald: "from-emerald-50/60 via-white/90 to-white/90", rose: "from-rose-50/60 via-white/90 to-white/90", teal: "from-teal-50/60 via-white/90 to-white/90", slate: "from-muted/50 via-white/90 to-white/90" };
  const toneText = { emerald: "text-emerald-700/90", rose: "text-rose-700/90", teal: "text-teal-700/90", slate: "text-muted-foreground" };
  const toneIcon = { emerald: "bg-emerald-500/12 text-emerald-600", rose: "bg-rose-500/12 text-rose-600", teal: "bg-teal-500/12 text-teal-600", slate: "bg-muted text-muted-foreground" };
  return (
    <div className={`rounded-2xl border border-border/60 bg-gradient-to-br p-4 shadow-sm ${toneStyles[tone]}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`block text-[11px] font-medium uppercase tracking-wider ${toneText[tone]}`}>{label}</span>
          <p className="mt-1 break-words text-base font-bold tabular-nums tracking-tight text-foreground sm:text-lg lg:text-xl">{value}</p>
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toneIcon[tone]}`}><Icon className="h-4 w-4" /></div>
      </div>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function StatSkeleton() {
  return (<div className="rounded-2xl border border-border/60 bg-muted/30 p-4 shadow-sm"><div className="mb-2 flex items-start justify-between gap-2"><div className="min-w-0 space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-7 w-32" /></div><Skeleton className="h-8 w-8 rounded-full" /></div><Skeleton className="h-3 w-20" /></div>);
}

function TableSkeleton() {
  return (<div className="hidden overflow-x-auto rounded-2xl border border-border md:block"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b border-border">{Array.from({ length: 7 }).map((_, i) => (<th key={i} className="px-4 py-3"><Skeleton className="h-3.5 w-20" /></th>))}</tr></thead><tbody>{Array.from({ length: 5 }).map((_, row) => (<tr key={row} className="border-b border-border last:border-0">{Array.from({ length: 7 }).map((__, col) => (<td key={col} className="px-4 py-3"><Skeleton className="h-4 w-full max-w-[80px]" /></td>))}</tr>))}</tbody></table></div>);
}

function MobileCardsSkeleton() {
  return (<div className="grid gap-3 md:hidden">{Array.from({ length: 4 }).map((_, idx) => (<div key={idx} className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start gap-3"><Skeleton className="h-10 w-10 shrink-0 rounded-full" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div><Skeleton className="h-5 w-20 shrink-0" /></div><div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">{Array.from({ length: 4 }).map((__, i) => (<div key={i} className="min-w-0 space-y-1"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-full" /></div>))}</div></div></div></div>))}</div>);
}
