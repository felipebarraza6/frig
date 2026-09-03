"use client";

import { useEffect, useMemo, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  X,
  TrendingUp,
  TrendingDown,
  Plus,
  Ban,
  FileDown,
  FileText,
  Loader2,
  User,
  ShoppingBag,
  Pencil,
  Check,
  CalendarClock,
  Banknote,
  ShoppingCart,
  CreditCard,
  FileCheck,
  Smartphone,
  Bitcoin,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/store/toast";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import {
  fetchPayments,
  fetchPaymentsByDirection,
  getPaymentMethodName,
  createPayment,
  updatePayment,
  fetchPayment,
  fetchPaymentMethods,
  downloadPaymentVoucher,
  processPayment,
  type ProcessPaymentPayload,
  type YggdraPaymentList,
  type YggdraPaymentMethod,
} from "@/lib/api/payments";
import { fetchOrder, fetchOrders, fetchInstallments, payInstallment, type InstallmentPayInput } from "@/lib/api/orders";
import type { YggdraSchemas } from "@/lib/api/types";
import { fetchExpenses, type FixedExpense } from "@/lib/api/expenses";
import { fetchRevenues, type Revenue } from "@/lib/api/revenues";
import { fetchPurchaseOrders, payPurchaseOrder, type PurchaseOrderList } from "@/lib/api/suppliers";
import { fetchBranchFinanceConfigByBranch } from "@/lib/api/branch-finance-config";
import { formatCLP, paymentTypeLabel } from "@/lib/utils";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { generateExcelBlob } from "@/lib/export-excel";

const DIRECTION_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "INCOME", label: "Ingresos" },
  { value: "EXPENSE", label: "Egresos" },
];

// TODO: cuando el backend agregue PURCHASE_ORDER a payment_source,
// separar "Orden de compra / Gasto" en dos opciones distintas.
const SOURCE_OPTIONS = [
  { value: "", label: "Todos los orígenes" },
  { value: "ORDER", label: "Orden de venta" },
  { value: "EXPENSE", label: "Orden de compra / Gasto" },
  { value: "REVENUE", label: "Ingreso directo" },
  { value: "REFUND", label: "Reembolso" },
  { value: "OTHER", label: "Otro" },
];

// Los orígenes se acotan según la dirección: ingresos solo muestra orígenes
// de entrada y egresos solo los de salida.
const INCOME_SOURCE_VALUES = ["", "ORDER", "REVENUE", "REFUND", "OTHER"];
const EXPENSE_SOURCE_VALUES = ["", "EXPENSE", "OTHER"];

function statusBadgeClass(status?: string | null) {
  switch (status) {
    case "COMPLETED":
      return "bg-success/10 text-success";
    case "PENDING":
      return "bg-warning/10 text-warning";
    case "PROCESSING":
      return "bg-primary/10 text-primary";
    case "FAILED":
    case "CANCELLED":
      return "bg-danger/10 text-danger";
    default:
      return "bg-muted text-muted-foreground";
  }
}

// Persiste un filtro de string en localStorage (patrón frig.<modulo>.<filtro>)
function usePersistedState(key: string, initialValue: string, allowed?: string[]): [string, (v: string) => void] {
  const [value, setValue] = useState<string>(() => {
    if (typeof window === "undefined") return initialValue;
    const stored = window.localStorage.getItem(key);
    if (stored === null) return initialValue;
    if (allowed && !allowed.includes(stored)) return initialValue;
    return stored;
  });
  useEffect(() => {
    window.localStorage.setItem(key, value);
  }, [key, value]);
  return [value, setValue];
}

function parseAmount(value: string | number | undefined): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  return parseFloat(value) || 0;
}

// Regla del pago rápido: aplica solo a ingresos/gastos pendientes.
// - Pagos de órdenes de venta (incluidos los de cuotas): se completan desde
//   el flujo de la orden (/installments/{id}/pay/), que marca la cuota; el
//   endpoint genérico process dejaría la cuota pendiente → inconsistencia.
// - Movimientos internos de caja ("Movimiento de Caja (Sistema)"): se
//   completan desde el flujo de Caja.
function canQuickPay(p: YggdraPaymentList): boolean {
  if (p.status !== "PENDING") return false;
  if (p.payment_source === "ORDER") return false;
  return p.payment_method_name !== "Movimiento de Caja (Sistema)";
}

/** Fecha completa arriba, hora debajo (es-CL, sin cortarse) */
function formatDateCell(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }),
    time: d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
  };
}

// Entidades que se pueden pagar desde "Registrar pago".
// - order: orden (venta/pedido/convenio) de pago único (pago unificado con order_id)
// - installment: cuota puntual de una orden con crédito (payInstallment)
// - revenue: ingreso directo manual, sin orden asociada
// - expense: gasto manual, sin orden de compra asociada
// - purchase_order: orden de compra con saldo (endpoint propio pay_order)
export type PendingEntityKind = "order" | "installment" | "revenue" | "expense" | "purchase_order";

export interface SubmitPaymentPayload {
  kind: PendingEntityKind;
  id: string;
  /** Solo para kind=installment: id de la cuota dentro de la orden. */
  installment_id?: string;
  payment_method_id: string;
  amount: number;
  reference?: string | null;
  notes?: string | null;
}

export default function PaymentsPage() {
  const toast = useToast();
  // Filtros persistidos en localStorage para que sobrevivan recargas/navegación
  const [direction, setDirection] = usePersistedState("frig.payments.direction", "EXPENSE", ["", "INCOME", "EXPENSE"]);
  const [source, setSource] = usePersistedState("frig.payments.source", "", ["", "ORDER", "EXPENSE", "REVENUE", "REFUND", "OTHER"]);
  const [dateFrom, setDateFrom] = usePersistedState("frig.payments.dateFrom", "");
  const [dateTo, setDateTo] = usePersistedState("frig.payments.dateTo", "");
  const [search, setSearch] = usePersistedState("frig.payments.search", "");
  // Búsqueda con debounce: se envía al backend (N° orden, referencia, método)
  // después de 400 ms sin teclear, para no disparar un request por tecla.
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  // Offset aproximado de la página actual para calcular el correlativo visible
  const [offset, setOffset] = useState(0);

  const resetPaging = () => {
    setPageUrl({});
    setOffset(0);
  };

  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [detailPayment, setDetailPayment] = useState<YggdraPaymentList | null>(null);
  const [editingPayment, setEditingPayment] = useState<YggdraPaymentList | null>(null);

  const queryClient = useQueryClient();

  // Los orígenes se acotan según la dirección: ingresos solo muestra orígenes
  // de entrada y egresos solo los de salida. Si el origen persistido queda
  // fuera de la lista (ej. cambió la dirección), se ignora hasta re-seleccionar.
  const sourceOptions = useMemo(
    () =>
      SOURCE_OPTIONS.filter((o) =>
        direction === "INCOME"
          ? INCOME_SOURCE_VALUES.includes(o.value)
          : direction === "EXPENSE"
            ? EXPENSE_SOURCE_VALUES.includes(o.value)
            : true,
      ),
    [direction],
  );
  const activeSource = sourceOptions.some((o) => o.value === source) ? source : "";

  const filter = useMemo(
    () => ({
      payment_direction: (direction || undefined) as "INCOME" | "EXPENSE" | undefined,
      payment_source: (activeSource || undefined) as YggdraPaymentList["payment_source"] | undefined,
      payment_date__gte: dateFrom || undefined,
      payment_date__lte: dateTo || undefined,
      search: debouncedSearch.trim() || undefined,
      // Mientras se busca, la paginación por cursor deja de aplicar: el
      // resultado filtrado vuelve a la primera página.
      ...(debouncedSearch.trim() ? {} : pageUrl),
    }),
    [direction, activeSource, dateFrom, dateTo, debouncedSearch, pageUrl],
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

  // Data for create form. En el registro de un INGRESO se selecciona la
  // ORDEN de venta pendiente (lo que realmente se paga) o un INGRESO DIRECTO
  // manual (sin orden asociada). En un EGRESO se selecciona una ORDEN DE
  // COMPRA con saldo o un GASTO manual (los gastos ligados a una OC se pagan
  // siempre vía la OC, para mantener su estado de pago sincronizado).
  // Solo se cargan cuando el modal está abierto.
  const { data: ordersForPayment } = useQuery({
    queryKey: ["orders", "for-payment"],
    // Todas las órdenes con pago pendiente/parcial, sin filtrar por tipo:
    // SALE (venta), ORDER (orden de pedido) y AGREEMENT (convenio) se pueden pagar.
    queryFn: () => fetchOrders({ payment_status: ["PENDING", "PARTIAL"], page_size: 100 }),
    enabled: createOpen,
  });

  const { data: revenuesForPayment } = useQuery({
    queryKey: ["revenues", "for-payment"],
    queryFn: () => fetchRevenues({ status: "PENDING", page_size: 100 }),
    enabled: createOpen,
  });

  const { data: purchaseOrdersForPayment } = useQuery({
    queryKey: ["purchase-orders", "for-payment"],
    queryFn: () => fetchPurchaseOrders({ payment_status__in: ["PENDING", "PARTIAL", "OVERDUE"], page_size: 100 }),
    enabled: createOpen,
  });

  const { data: expenses } = useQuery({
    queryKey: ["expenses", "for-payment"],
    queryFn: () => fetchExpenses({ status: "PENDING" }),
    enabled: createOpen,
  });

  // Símbolo de la moneda configurada en Finanzas → Configuración (para el campo Monto).
  const branchId = typeof window !== "undefined" ? Number(window.localStorage.getItem("frig.branch_id")) : NaN;
  const { data: financeConfig } = useQuery({
    queryKey: ["branch-finance-config", branchId],
    queryFn: () => fetchBranchFinanceConfigByBranch(branchId),
    enabled: createOpen && Number.isFinite(branchId) && branchId > 0,
    staleTime: 5 * 60_000,
  });
  const currencySymbol = financeConfig?.currency_symbol?.trim() || "$";

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
        p.status_display?.toLowerCase().includes(q) ||
        p.order_number?.toLowerCase().includes(q) ||
        p.reference?.toLowerCase().includes(q)
      );
    });
  }, [payments, search]);

  // Correlativo visible del pago (descendente: el más reciente tiene el mayor número)
  const correlativoOf = (index: number) => totalCount - offset - index;

  // Create payment mutation. Según el tipo de entidad elegida en el picker:
  // - purchase_order → endpoint propio de OC (crea el gasto ligado y sincroniza
  //   el estado de pago de la orden).
  // - installment → pago de una cuota puntual de una orden (payInstallment,
  //   el mismo flujo que usa Ventas; marca la cuota como pagada).
  // - order / revenue / expense → pago unificado estándar.
  const createMutation = useMutation({
    mutationFn: (payload: SubmitPaymentPayload): Promise<unknown> => {
      if (payload.kind === "purchase_order") {
        return payPurchaseOrder(payload.id, {
          amount: String(payload.amount),
          payment_method_id: payload.payment_method_id,
          reference: payload.reference ?? null,
          notes: payload.notes ?? null,
        });
      }
      if (payload.kind === "installment") {
        return payInstallment(payload.id, payload.installment_id as string, {
          payment_method_id: payload.payment_method_id,
          amount: String(payload.amount),
          reference: payload.reference ?? null,
          notes: payload.notes ?? null,
        });
      }
      return createPayment({
        payment_method_id: payload.payment_method_id,
        amount: payload.amount,
        status: "COMPLETED",
        ...(payload.kind === "order"
          ? { order_id: payload.id }
          : payload.kind === "revenue"
            ? { revenue_id: payload.id }
            : { expense_id: payload.id }),
        ...(payload.reference ? { reference: payload.reference } : {}),
        ...(payload.notes ? { notes: payload.notes } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["revenues"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setCreateOpen(false);
    },
  });

  // Editar pago (cambiar estado a completado, monto, método, referencia, notas)
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updatePayment>[1] }) =>
      updatePayment(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setEditingPayment(null);
    },
  });

  // Download voucher handler (80mm térmico o A4 según formato)
  const handleDownloadVoucher = async (id: string, format: "thermal" | "a4") => {
    setDownloading(`${id}:${format}`);
    try {
      const blob = await downloadPaymentVoucher(id, format);
      if (!(blob instanceof Blob)) {
        throw new Error("Respuesta no es un archivo válido");
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comprobante_${id}_${format === "thermal" ? "80mm" : "a4"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  // Pago rápido: procesa un pago PENDING directo desde la lista, sin pasar
  // por "Registrar pago". El método se resuelve por nombre desde la lista
  // cargada; si no aparece, se consulta el detalle del pago.
  async function handleQuickPay(p: YggdraPaymentList) {
    setPayingId(p.id);
    try {
      let methodId = paymentMethods?.find((m) => m.name === p.payment_method_name)?.id;
      if (!methodId) {
        methodId = (await fetchPayment(p.id)).payment_method.id;
      }
      const payload: ProcessPaymentPayload = {
        payment_method_id: methodId,
        amount: parseAmount(p.amount),
        payment_source: p.payment_source,
        payment_date: p.payment_date,
        status: "COMPLETED",
        revenue_id: p.revenue_id,
        expense_id: p.expense_id,
        reference: p.reference ?? null,
      };
      await processPayment(p.id, payload);
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo procesar el pago");
    } finally {
      setPayingId(null);
    }
  }

  // Exporta a Excel exactamente los registros visibles con los filtros aplicados.
  const { download: downloadFile, isLoading: isDownloadingExcel } = useDownloadFile();
  async function handleExportExcel() {
    const headers = ["Fecha", "Método", "Origen", "Estado", "Monto", "Referencia", "N° orden"];
    const rows = filteredPayments.map((p) => {
      const isIncome = p.payment_direction === "INCOME";
      return [
        new Date(p.payment_date).toLocaleDateString("es-CL"),
        getPaymentMethodName(p),
        p.payment_source_display ?? "",
        p.status_display ?? "",
        Math.round((isIncome ? 1 : -1) * parseAmount(p.amount) * 100) / 100,
        p.reference ?? "",
        p.order_number ?? "",
      ];
    });
    const blob = await generateExcelBlob("Pagos", headers, rows);
    await downloadFile(async () => ({ blob }), {
      filename: exportFilename("pagos", "xlsx"),
      extension: "xlsx",
    });
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            isLoading={isDownloadingExcel}
            title="Exportar Excel"
            aria-label="Exportar Excel"
            className="h-9 w-9 px-0 sm:h-8 sm:w-auto sm:px-3"
          >
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nuevo pago
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {/* Stats cards */}
        <section className="grid gap-3 overflow-x-auto pb-1 [grid-template-columns:repeat(4,minmax(150px,1fr))] sm:grid-cols-2 lg:grid-cols-4">
          {loadingDirectionSummary ? (
            <><StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton /></>
          ) : (
            <>
              <StatCard label="Ingresos" value={formatCLP(incomeTotal)} icon={ArrowDownLeft} sub="pagos recibidos" tone="success" />
              <StatCard label="Egresos" value={formatCLP(expenseTotal)} icon={ArrowUpRight} sub="pagos a proveedores" tone="danger" />
              <StatCard label="Saldo neto" value={formatCLP(incomeTotal - expenseTotal)} icon={Wallet} sub="ingresos - egresos" tone={incomeTotal - expenseTotal >= 0 ? "success" : "danger"} />
              <StatCard label="Total transacciones" value={totalCount} icon={Landmark} sub="en el listado actual" tone="slate" />
            </>
          )}
        </section>

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="hidden flex-wrap items-end gap-3 md:flex">
            <div className="relative w-56 shrink-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por N° orden, método, referencia…" className="pl-9" aria-label="Buscar pago" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-direction" className="text-xs text-muted-foreground">Dirección</label>
              <Select id="filter-direction" value={direction} onChange={(e) => { setDirection(e.target.value as "" | "INCOME" | "EXPENSE"); setSource(""); resetPaging(); }}>
                {DIRECTION_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-source" className="text-xs text-muted-foreground">Origen</label>
              <Select id="filter-source" value={activeSource} onChange={(e) => { setSource(e.target.value as YggdraPaymentList["payment_source"] | ""); resetPaging(); }}>
                {sourceOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-date-from" className="text-xs text-muted-foreground">Desde</label>
              <Input id="filter-date-from" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); resetPaging(); }} className="h-10" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-date-to" className="text-xs text-muted-foreground">Hasta</label>
              <Input id="filter-date-to" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); resetPaging(); }} className="h-10" />
            </div>
            <Button variant="ghost" size="sm" className="h-10 px-2 text-xs" onClick={() => { setDirection(""); setSource(""); setDateFrom(""); setDateTo(""); resetPaging(); }}>
              Limpiar
            </Button>
          </div>
          {/* Mobile filters */}
          <div className="flex flex-col gap-3 md:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por N° orden, método, referencia…" className="h-10 pl-9" aria-label="Buscar pago" />
              </div>
              <Button variant="outline" size="sm" className="h-10 px-3" onClick={() => setShowMobileFilters((v) => !v)}>
                <SlidersHorizontal className="h-4 w-4" /><span className="ml-2">Filtros</span>
              </Button>
            </div>
            <div id="mobile-filters-panel" className={`rounded-2xl border border-border bg-muted/30 p-4 shadow-sm ${showMobileFilters ? "" : "hidden"}`}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">Filtros</span>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setShowMobileFilters(false)}>
                  <X className="h-4 w-4" /><span className="sr-only">Cerrar filtros</span>
                </Button>
              </div>
              <div className="grid gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-direction-mobile" className="text-xs text-muted-foreground">Dirección</label>
                  <Select id="filter-direction-mobile" value={direction} onChange={(e) => { setDirection(e.target.value as "" | "INCOME" | "EXPENSE"); setSource(""); resetPaging(); }}>
                    {DIRECTION_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-source-mobile" className="text-xs text-muted-foreground">Origen</label>
                  <Select id="filter-source-mobile" value={activeSource} onChange={(e) => { setSource(e.target.value as YggdraPaymentList["payment_source"] | ""); resetPaging(); }}>
                    {sourceOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-date-from-mobile" className="text-xs text-muted-foreground">Desde</label>
                  <Input id="filter-date-from-mobile" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); resetPaging(); }} className="h-10" />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-date-to-mobile" className="text-xs text-muted-foreground">Hasta</label>
                  <Input id="filter-date-to-mobile" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); resetPaging(); }} className="h-10" />
                </div>
                <Button variant="ghost" size="sm" className="h-10 px-2 text-xs" onClick={() => { setDirection(""); setSource(""); setDateFrom(""); setDateTo(""); resetPaging(); }}>
                  Limpiar
                </Button>
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
                    <th className="px-4 py-3">Pago</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Método</th>
                    <th className="px-4 py-3">Origen</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p, index) => {
                    const isIncome = p.payment_direction === "INCOME";
                    const methodName = getPaymentMethodName(p);
                    const canDownload = p.status === "COMPLETED";
                    const dateCell = formatDateCell(p.payment_date);
                    return (
                      <tr
                        key={p.id}
                        className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-muted/40"
                        onClick={() => setDetailPayment(p)}
                      >
                        <td className="px-4 py-3 font-medium tabular-nums text-muted-foreground">#{correlativoOf(index)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          <span className="flex flex-col">
                            <span className="font-medium text-foreground">{dateCell.date}</span>
                            <span className="text-xs tabular-nums">{dateCell.time}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`flex h-7 w-7 items-center justify-center rounded-full ${isIncome ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                              {isIncome ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                            </div>
                            <span>{methodName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <span className="block">{p.payment_source_display}</span>
                          {p.order_number && (
                            <span className="block text-xs font-medium text-primary">OV {p.order_number}</span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-right tabular-nums font-semibold ${isIncome ? "text-success" : "text-danger"}`}>
                          {isIncome ? "+" : "-"}{formatCLP(parseAmount(p.amount))}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {canDownload ? (
                              <>
                                {/* Boleta con color según estado: verde = pagado */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1 px-2 text-xs border-success/40 bg-success/10 text-success hover:bg-success/20"
                                  onClick={() => handleDownloadVoucher(p.id, "thermal")}
                                  isLoading={downloading === `${p.id}:thermal`}
                                  title="Descargar boleta 80mm"
                                >
                                  <Receipt className="h-4 w-4" />
                                  80mm
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1 px-2 text-xs border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                                  onClick={() => handleDownloadVoucher(p.id, "a4")}
                                  isLoading={downloading === `${p.id}:a4`}
                                  title="Descargar comprobante A4"
                                >
                                  <FileText className="h-4 w-4" />
                                  A4
                                </Button>
                              </>
                            ) : (
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(p.status)}`} title={p.status_display}>{p.status_display}</span>
                            )}
                            {(p.status === "PENDING" || p.status === "PROCESSING") && (
                              <>
                                {canQuickPay(p) && (
                                  <Button
                                    size="sm"
                                    className="h-8 gap-1 px-2 text-xs"
                                    onClick={() => handleQuickPay(p)}
                                    isLoading={payingId === p.id}
                                    title="Marcar como pagado"
                                  >
                                    <Check className="h-4 w-4" />
                                    Pagar
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                                  onClick={() => setEditingPayment(p)}
                                  title="Editar pago"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-danger" title="Cancelar pago (próximamente)" disabled>
                                  <Ban className="h-4 w-4" />
                                </Button>
                              </>
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
              {filteredPayments.map((p, index) => {
                const isIncome = p.payment_direction === "INCOME";
                const methodName = getPaymentMethodName(p);
                const canDownload = p.status === "COMPLETED";
                return (
                  <div
                    key={p.id}
                    className="cursor-pointer rounded-2xl border border-border bg-muted/30 p-4 shadow-sm transition-colors hover:bg-muted/40"
                    onClick={() => setDetailPayment(p)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isIncome ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                        {isIncome ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">#{correlativoOf(index)} · {methodName}</p>
                            <p className="break-words text-xs text-muted-foreground">
                              {p.payment_source_display}
                              {p.order_number ? ` · OV ${p.order_number}` : ""}
                            </p>
                          </div>
                          <p className={`shrink-0 text-base font-bold tabular-nums ${isIncome ? "text-success" : "text-danger"}`}>
                            {isIncome ? "+" : "-"}{formatCLP(parseAmount(p.amount))}
                          </p>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
                          <div className="min-w-0">
                            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Estado</span>
                            <span className={`inline-block truncate rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(p.status)}`}>{p.status_display}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Fecha</span>
                            <span className="block whitespace-nowrap font-medium text-foreground">
                              {(() => { const f = formatDateCell(p.payment_date); return (<>{f.date} <span className="text-muted-foreground">{f.time}</span></>); })()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Origen</span>
                            <span className="block truncate font-medium text-foreground">
                              {p.payment_source_display}
                              {p.order_number ? ` · OV ${p.order_number}` : ""}
                            </span>
                          </div>
                        </div>
                        {(canDownload || p.status === "PENDING" || p.status === "PROCESSING") && (
                          <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
                            {(p.status === "PENDING" || p.status === "PROCESSING") && (
                              <>
                                {canQuickPay(p) && (
                                  <Button
                                    size="sm"
                                    className="h-8 flex-1 gap-1 px-2 text-xs sm:flex-none"
                                    onClick={() => handleQuickPay(p)}
                                    isLoading={payingId === p.id}
                                    title="Marcar como pagado"
                                  >
                                    <Check className="h-4 w-4" />
                                    Pagar
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1 px-2 text-xs"
                                  onClick={() => setEditingPayment(p)}
                                  title="Editar pago"
                                >
                                  <Pencil className="h-4 w-4" />
                                  Editar
                                </Button>
                              </>
                            )}
                            {canDownload && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1 px-2 text-xs border-success/40 bg-success/10 text-success hover:bg-success/20"
                                  onClick={() => handleDownloadVoucher(p.id, "thermal")}
                                  isLoading={downloading === `${p.id}:thermal`}
                                  title="Descargar boleta 80mm"
                                >
                                  <Receipt className="h-4 w-4" />
                                  80mm
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1 px-2 text-xs border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                                  onClick={() => handleDownloadVoucher(p.id, "a4")}
                                  isLoading={downloading === `${p.id}:a4`}
                                  title="Descargar comprobante A4"
                                >
                                  <FileText className="h-4 w-4" />
                                  A4
                                </Button>
                              </>
                            )}
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
                <Button variant="outline" size="sm" className="h-10 px-4" onClick={() => { setPageUrl({ previous: page?.previous }); setOffset((o) => Math.max(0, o - payments.length)); }} disabled={!page?.previous}>
                  <span className="sm:hidden">Ant.</span><span className="hidden sm:inline">Anterior</span>
                </Button>
                <Button variant="outline" size="sm" className="h-10 px-4" onClick={() => { setPageUrl({ next: page?.next }); setOffset((o) => o + payments.length); }} disabled={!page?.next}>
                  <span className="sm:hidden">Sig.</span><span className="hidden sm:inline">Siguiente</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Payment Detail Modal */}
      <PaymentDetailModal
        payment={detailPayment}
        onClose={() => setDetailPayment(null)}
        onDownloadVoucher={handleDownloadVoucher}
        downloading={downloading}
      />

      {/* Create Payment Modal */}
      <CreatePaymentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        paymentMethods={paymentMethods ?? []}
        orders={ordersForPayment?.results ?? []}
        revenues={revenuesForPayment?.results ?? []}
        purchaseOrders={purchaseOrdersForPayment?.results ?? []}
        expenses={expenses?.results ?? []}
        currencySymbol={currencySymbol}
        onSubmit={(payload) => createMutation.mutate(payload)}
        isPending={createMutation.isPending}
        error={createMutation.error instanceof Error ? createMutation.error.message : null}
      />

      {/* Edit Payment Modal */}
      <EditPaymentModal
        payment={editingPayment}
        paymentMethods={paymentMethods ?? []}
        onClose={() => setEditingPayment(null)}
        onSubmit={(id, payload) => updateMutation.mutate({ id, payload })}
        isPending={updateMutation.isPending}
        error={updateMutation.error instanceof Error ? updateMutation.error.message : null}
      />
    </div>
  );
}

// Entidad elegible en el picker del modal "Registrar pago".
interface PickerEntity {
  /** Clave única compuesta `${kind}:${id}` (los ids son UUID por tipo). */
  key: string;
  kind: PendingEntityKind;
  id: string;
  title: string;
  /** Etiqueta corta del tipo específico (Venta, Orden, Convenio, Ingreso directo…). */
  tag: string;
  description: string | null;
  category: string;
  date: string | null;
  amount: number;
  pending: number;
  hint: string;
}

// Estilo del ícono por tipo de entidad: las órdenes/gastos usan el tono de
// su dirección (success/danger) y las entidades manuales un tono neutro.
const KIND_META: Record<PendingEntityKind, { icon: LucideIcon; chip: string }> = {
  order: { icon: ArrowDownLeft, chip: "bg-success/10 text-success" },
  installment: { icon: CalendarClock, chip: "bg-primary/10 text-primary" },
  revenue: { icon: Banknote, chip: "bg-primary/10 text-primary" },
  expense: { icon: ArrowUpRight, chip: "bg-danger/10 text-danger" },
  purchase_order: { icon: ShoppingCart, chip: "bg-warning/10 text-warning" },
};

/** Identidad visual por tipo de método de pago: cuadrito cuyo color deriva del primary (mismo lenguaje que Configuración → Métodos de pago). */
interface PaymentTypeMeta {
  icon: LucideIcon;
  solid: string;
  iconClass: string;
}

const METHOD_TYPE_META: Record<YggdraPaymentMethod["payment_type"], PaymentTypeMeta> = {
  CASH: { icon: Banknote, solid: "bg-primary", iconClass: "text-white" },
  BANK_TRANSFER: { icon: Landmark, solid: "bg-[color-mix(in_oklab,var(--color-primary),black_12%)]", iconClass: "text-white" },
  CHECK: { icon: FileCheck, solid: "bg-[color-mix(in_oklab,var(--color-primary),black_28%)]", iconClass: "text-white" },
  CREDIT_CARD: { icon: CreditCard, solid: "bg-[color-mix(in_oklab,var(--color-primary),black_45%)]", iconClass: "text-white" },
  DEBIT_CARD: { icon: Wallet, solid: "bg-[color-mix(in_oklab,var(--color-primary),white_18%)]", iconClass: "text-[color-mix(in_oklab,var(--color-primary),black_55%)]" },
  DIGITAL_WALLET: { icon: Smartphone, solid: "bg-[color-mix(in_oklab,var(--color-primary),white_32%)]", iconClass: "text-[color-mix(in_oklab,var(--color-primary),black_55%)]" },
  CRYPTO: { icon: Bitcoin, solid: "bg-[color-mix(in_oklab,var(--color-primary),black_60%)]", iconClass: "text-white" },
  OTHER: { icon: MoreHorizontal, solid: "bg-[color-mix(in_oklab,var(--color-primary),black_35%)]", iconClass: "text-white" },
};

function CreatePaymentModal({ open, onClose, paymentMethods, orders, revenues, purchaseOrders, expenses, currencySymbol, onSubmit, isPending, error }: {
  open: boolean;
  onClose: () => void;
  paymentMethods: YggdraPaymentMethod[];
  orders: OrderDetail[];
  revenues: Revenue[];
  purchaseOrders: PurchaseOrderList[];
  expenses: FixedExpense[];
  /** Símbolo de la moneda configurada en Finanzas (p. ej. "$"). */
  currencySymbol: string;
  onSubmit: (payload: SubmitPaymentPayload) => void;
  isPending: boolean;
  error: string | null;
}) {
  const [entityType, setEntityType] = useState<"revenue" | "expense">("revenue");
  const [entityKey, setEntityKey] = useState("");
  const [installmentId, setInstallmentId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // Entidades pendientes de pago.
  // Ingreso: ÓRDENES con pago pendiente — ventas (SALE), pedidos (ORDER) y
  // convenios (AGREEMENT); lo que realmente se paga, el ingreso es la
  // consecuencia contable— + INGRESOS DIRECTOS manuales (sin orden asociada).
  // Egreso: ÓRDENES DE COMPRA con saldo + GASTOS manuales sin OC asociada
  // (los gastos ligados a una OC se pagan siempre vía la OC).
  const pendingEntities = useMemo<PickerEntity[]>(() => {
    if (entityType === "revenue") {
      const orderEntities: PickerEntity[] = orders
        .filter((o) => o.payment_status !== "PAID" && parseAmount(o.total_amount) > 0)
        .map((o) => {
          // SALE = venta directa, ORDER = orden de pedido, AGREEMENT = convenio.
          const typeLabel = o.order_type === "SALE" ? "Venta" : o.order_type === "ORDER" ? "Orden" : "Convenio";
          return {
            key: `order:${o.id}`,
            kind: "order" as const,
            id: o.id,
            title: o.order_number ? `#${o.order_number}` : `${typeLabel} ${o.id.slice(0, 8)}`,
            tag: typeLabel,
            description: o.client?.name ?? null,
            category: o.payment_status === "PARTIAL" ? "Pago parcial" : "Sin pagar",
            date: o.date,
            amount: parseAmount(o.total_amount),
            pending: parseAmount(o.total_amount),
            hint: "total orden",
          };
        });
      const revenueEntities: PickerEntity[] = revenues
        .filter((r) => !r.order && r.status === "PENDING" && !r.is_fully_paid && parseAmount(r.pending_amount) > 0)
        .map((r) => ({
          key: `revenue:${r.id}`,
          kind: "revenue",
          id: r.id,
          title: r.title,
          tag: "Ingreso directo",
          description: r.description ?? null,
          category: "Ingreso directo",
          date: r.revenue_date,
          amount: parseAmount(r.amount),
          pending: parseAmount(r.pending_amount),
          hint: "pendiente",
        }));
      return [...orderEntities, ...revenueEntities];
    }
    const poEntities: PickerEntity[] = purchaseOrders
      .filter((po) => po.status !== "CANCELLED" && po.status !== "DRAFT" && !po.is_fully_paid && parseAmount(po.remaining_amount ?? po.total_amount) > 0)
      .map((po) => ({
        key: `purchase_order:${po.id}`,
        kind: "purchase_order",
        id: po.id,
        title: `OC ${po.order_number}`,
        tag: "Orden de compra",
        description: po.supplier_name ?? "Sin proveedor",
        category: po.payment_status === "PARTIAL" ? "Pago parcial" : po.status_display,
        date: po.order_date,
        amount: parseAmount(po.total_amount),
        pending: parseAmount(po.remaining_amount ?? po.total_amount),
        hint: "por pagar",
      }));
    const expenseEntities: PickerEntity[] = expenses
      .filter((e) => !e.purchase_order_id && e.status === "PENDING" && !e.is_fully_paid && parseAmount(e.pending_amount) > 0)
      .map((e) => ({
        key: `expense:${e.id}`,
        kind: "expense",
        id: e.id,
        title: e.name,
        tag: "Gasto",
        description: e.description ?? null,
        category: e.category_name,
        date: e.start_date,
        amount: parseAmount(e.amount),
        pending: parseAmount(e.pending_amount),
        hint: "pendiente",
      }));
    return [...poEntities, ...expenseEntities];
  }, [entityType, orders, revenues, purchaseOrders, expenses]);

  const pickerList = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return pendingEntities;
    return pendingEntities.filter((e) =>
      e.title.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.tag.toLowerCase().includes(q),
    );
  }, [pendingEntities, pickerSearch]);

  // Grupos del picker: se distinguen órdenes de venta vs ingresos directos
  // (y órdenes de compra vs gastos) con encabezado, para que sea obvio qué
  // se está pagando. La búsqueda filtra dentro de cada grupo.
  const pickerGroups = useMemo(() => {
    const groups: { label: string; entities: PickerEntity[] }[] = [];
    if (entityType === "revenue") {
      const orderEntities = pickerList.filter((e) => e.kind === "order");
      const revenueEntities = pickerList.filter((e) => e.kind === "revenue");
      if (orderEntities.length > 0) groups.push({ label: "Órdenes y ventas", entities: orderEntities });
      if (revenueEntities.length > 0) groups.push({ label: "Ingresos directos", entities: revenueEntities });
    } else {
      const poEntities = pickerList.filter((e) => e.kind === "purchase_order");
      const expenseEntities = pickerList.filter((e) => e.kind === "expense");
      if (poEntities.length > 0) groups.push({ label: "Órdenes de compra", entities: poEntities });
      if (expenseEntities.length > 0) groups.push({ label: "Gastos", entities: expenseEntities });
    }
    return groups;
  }, [pickerList, entityType]);

  const selectedEntity = pendingEntities.find((e) => e.key === entityKey);

  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);

  // Condiciones de pago de la orden seleccionada: contado o crédito con
  // cuotas. El backend rechaza un pago directo (order_id) si la orden tiene
  // cuotas no canceladas — esas se pagan cuota a cuota desde Ventas.
  const selectedOrderId = selectedEntity?.kind === "order" ? selectedEntity.id : null;
  const { data: orderInstallments, isLoading: loadingOrderInstallments } = useQuery({
    queryKey: ["orders", selectedOrderId, "installments"],
    queryFn: () => fetchInstallments(selectedOrderId as string),
    enabled: Boolean(selectedOrderId),
    staleTime: 30_000,
  });
  const activeInstallments = useMemo(
    () => (orderInstallments ?? []).filter((i) => i.status !== "CANCELLED"),
    [orderInstallments],
  );
  const orderHasInstallments = activeInstallments.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntity || !paymentMethodId || !amount) return;
    // Orden con crédito: se paga la cuota seleccionada, no la orden completa.
    if (selectedEntity.kind === "order" && orderHasInstallments) {
      if (!installmentId) return;
      onSubmit({
        kind: "installment",
        id: selectedEntity.id,
        installment_id: installmentId,
        payment_method_id: paymentMethodId,
        amount: Number(amount),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      return;
    }
    onSubmit({
      kind: selectedEntity.kind,
      id: selectedEntity.id,
      payment_method_id: paymentMethodId,
      amount: Number(amount),
      ...(reference.trim() ? { reference: reference.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  };

  const handleClose = () => {
    setEntityType("revenue"); setEntityKey(""); setInstallmentId(""); setPaymentMethodId("");
    setAmount(""); setReference(""); setNotes("");
    setPickerOpen(false); setPickerSearch(""); onClose();
  };

  // Solo métodos de pago activos y habilitados para POS — los mismos que se
  // ofrecen en Punto de Venta.
  const activeMethods = paymentMethods.filter((m) => m.is_active && m.is_pos_enabled !== false);
  const entityWord = entityType === "revenue" ? "ingreso" : "egreso";
  const entityLabel = entityType === "revenue" ? "orden o ingreso" : "orden de compra o gasto";
  const emptyLabel = entityType === "revenue"
    ? "órdenes o ingresos pendientes de pago"
    : "órdenes de compra ni gastos con pago pendiente";

  return (
    <AnimatedOverlay open={open} onClose={handleClose} panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4">
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-xl md:border">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-1">
            {pickerOpen && (
              <button type="button" onClick={() => setPickerOpen(false)} aria-label="Volver" className="-ml-1 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <h2 className="text-base font-semibold">{pickerOpen ? `Seleccionar ${entityWord}` : "Registrar pago"}</h2>
          </div>
          <button onClick={handleClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          {pickerOpen ? (
            <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input autoFocus value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder={entityType === "revenue" ? "Buscar por N° orden, cliente o título…" : "Buscar por N° OC, proveedor o gasto…"} className="pl-9" aria-label="Buscar pendiente" />
              </div>
              {pickerList.length === 0 ? (
                <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {pendingEntities.length === 0
                      ? `No hay ${emptyLabel}`
                      : "Sin resultados para la búsqueda"}
                  </p>
                </div>
              ) : (
                <div className="-mr-1 flex-1 space-y-3 overflow-y-auto pr-1">
                  {pickerGroups.map((group) => (
                    <div key={group.label}>
                      <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                      <div className="flex flex-col gap-2">
                        {group.entities.map((ent) => {
                          const Meta = KIND_META[ent.kind];
                          return (
                            <button
                              key={ent.key}
                              type="button"
                              onClick={() => { setEntityKey(ent.key); setInstallmentId(""); setAmount(String(ent.pending)); setPickerOpen(false); setPickerSearch(""); }}
                              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 ${ent.key === entityKey ? "border-primary bg-primary/5" : "border-border/60"}`}
                            >
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${Meta.chip}`}>
                                <Meta.icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5">
                                  <span className="truncate text-sm font-medium">{ent.title}</span>
                                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${Meta.chip}`}>{ent.tag}</span>
                                </span>
                                {ent.description && (
                                  <span className="block truncate text-xs text-foreground/80">{ent.description}</span>
                                )}
                                <span className="block truncate text-[11px] text-muted-foreground">
                                  {ent.category}{ent.date ? ` · ${new Date(ent.date).toLocaleDateString("es-CL")}` : ""}
                                </span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span className="block text-sm font-semibold tabular-nums">{formatCLP(ent.pending)}</span>
                                {ent.pending < ent.amount && (<span className="block text-[10px] text-muted-foreground">de {formatCLP(ent.amount)}</span>)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-4">
              {/* Entity type toggle */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Tipo de entidad</label>
                <div className="flex gap-2">
                  <button type="button" className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${entityType === "revenue" ? "border-primary bg-primary text-white shadow-sm" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`} onClick={() => { setEntityType("revenue"); setEntityKey(""); setInstallmentId(""); setPickerOpen(false); setPickerSearch(""); }}>
                    <ArrowDownLeft className="mr-1 inline h-3.5 w-3.5" />Ingreso
                  </button>
                  <button type="button" className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${entityType === "expense" ? "border-danger bg-danger text-white shadow-sm" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`} onClick={() => { setEntityType("expense"); setEntityKey(""); setInstallmentId(""); setPickerOpen(false); setPickerSearch(""); }}>
                    <ArrowUpRight className="mr-1 inline h-3.5 w-3.5" />Egreso
                  </button>
                </div>
              </div>
              {/* Entity picker trigger */}
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">{entityType === "revenue" ? "Orden o ingreso pendiente" : "Orden de compra o gasto pendiente"}</span>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  aria-label={`Seleccionar ${entityLabel} pendiente`}
                  className="flex w-full items-center gap-3 rounded-lg border border-input bg-background px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/50"
                >
                  {selectedEntity ? (
                    <>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${KIND_META[selectedEntity.kind].chip}`}>
                        {(() => { const Icon = KIND_META[selectedEntity.kind].icon; return <Icon className="h-4 w-4" />; })()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{selectedEntity.title}</span>
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${KIND_META[selectedEntity.kind].chip}`}>{selectedEntity.tag}</span>
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {selectedEntity.description ?? selectedEntity.category} · {formatCLP(selectedEntity.pending)} {selectedEntity.hint}
                        </span>
                      </span>
                    </>
                  ) : (
                    <span className="flex-1 text-muted-foreground">
                      {pendingEntities.length === 0
                        ? `No hay ${emptyLabel}`
                        : `Seleccionar ${entityLabel}…`}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </div>
              {/* Condiciones de pago de la orden seleccionada (solo órdenes de venta) */}
              {selectedEntity?.kind === "order" && (
                <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/30 p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">Condición de pago</span>
                    {loadingOrderInstallments ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${orderHasInstallments ? "bg-primary/10 text-primary" : "bg-success/10 text-success"}`}>
                        {orderHasInstallments
                          ? `Crédito · ${activeInstallments.length} cuota${activeInstallments.length === 1 ? "" : "s"}`
                          : "Contado"}
                      </span>
                    )}
                  </div>
                  {!loadingOrderInstallments && orderHasInstallments && (
                    <>
                      <p className="text-[11px] text-muted-foreground">Esta orden es de crédito: selecciona la cuota que vas a pagar.</p>
                      <ul className="flex flex-col gap-1.5">
                        {activeInstallments.map((inst, idx) => {
                          const isPaid = inst.status === "PAID";
                          const isSelected = inst.id === installmentId;
                          return (
                            <li key={inst.id}>
                              <button
                                type="button"
                                disabled={isPaid}
                                onClick={() => { setInstallmentId(inst.id); setAmount(String(parseAmount(inst.amount))); }}
                                className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors ${
                                  isPaid
                                    ? "cursor-not-allowed border-transparent opacity-50"
                                    : isSelected
                                      ? "border-primary bg-primary/5"
                                      : "border-border/60 hover:border-primary/50 hover:bg-primary/5"
                                }`}
                              >
                                <span className="flex min-w-0 items-center gap-1.5">
                                  {!isPaid && (
                                    <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${isSelected ? "border-primary bg-primary text-white" : "border-muted-foreground/50"}`}>
                                      {isSelected && <Check className="h-2.5 w-2.5" />}
                                    </span>
                                  )}
                                  <span className="min-w-0 truncate text-muted-foreground">
                                    Cuota {idx + 1}
                                    {inst.due_date ? ` · vence ${new Date(inst.due_date).toLocaleDateString("es-CL")}` : ""}
                                  </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-2">
                                  <span className="font-medium tabular-nums">{formatCLP(parseAmount(inst.amount))}</span>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                    inst.status === "PAID"
                                      ? "bg-success/10 text-success"
                                      : inst.status === "OVERDUE"
                                        ? "bg-danger/10 text-danger"
                                        : "bg-warning/10 text-warning"
                                  }`}>
                                    {inst.status_display ?? inst.status}
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                  {!loadingOrderInstallments && !orderHasInstallments && selectedEntity && (
                    <p className="text-xs text-muted-foreground">
                      Pago al contado · total {formatCLP(selectedEntity.pending)}
                    </p>
                  )}
                </div>
              )}
              {/* Payment method: tarjetas con ícono, igual de simpáticas que en POS */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Método de pago</span>
                {activeMethods.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">No hay métodos de pago activos habilitados para POS.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {activeMethods.map((m) => {
                      const meta = METHOD_TYPE_META[m.payment_type] ?? METHOD_TYPE_META.OTHER;
                      const Icon = meta.icon;
                      const isSelected = m.id === paymentMethodId;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethodId(m.id)}
                          aria-pressed={isSelected}
                          className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition-colors ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border/60 hover:border-primary/40 hover:bg-muted/40"}`}
                        >
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.solid} ${meta.iconClass}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium">{m.name}</span>
                            <span className="block truncate text-[10px] text-muted-foreground">{paymentTypeLabel(m.payment_type)}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Amount, con el símbolo de la moneda configurada */}
              <div className="flex flex-col gap-1">
                <label htmlFor="cp-amount" className="text-sm font-medium">{selectedEntity?.kind === "order" && orderHasInstallments ? "Monto de la cuota" : "Monto"}</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">{currencySymbol}</span>
                  <Input id="cp-amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required className="pl-8 tabular-nums" />
                </div>
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
          )}
          {!pickerOpen && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending || !selectedEntity || !paymentMethodId || !amount || (selectedEntity?.kind === "order" && orderHasInstallments && !installmentId)}>
              {isPending
                ? (<><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Registrando...</>)
                : selectedEntity?.kind === "order" && orderHasInstallments
                  ? (<><CalendarClock className="mr-1.5 h-4 w-4" />Pagar cuota</>)
                  : (<><FileText className="mr-1.5 h-4 w-4" />Registrar pago</>)}
            </Button>
          </div>
          )}
        </form>
      </div>
    </AnimatedOverlay>
  );
}

const EDIT_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pendiente" },
  { value: "PROCESSING", label: "Procesando" },
  { value: "COMPLETED", label: "Completado" },
];

function EditPaymentModal({ payment, paymentMethods, onClose, onSubmit, isPending, error }: {
  payment: YggdraPaymentList | null;
  paymentMethods: YggdraPaymentMethod[];
  onClose: () => void;
  onSubmit: (id: string, payload: Parameters<typeof updatePayment>[1]) => void;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <AnimatedOverlay open={Boolean(payment)} onClose={onClose} panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4">
      {payment && (
        <EditPaymentForm
          key={payment.id}
          payment={payment}
          paymentMethods={paymentMethods}
          onClose={onClose}
          onSubmit={onSubmit}
          isPending={isPending}
          error={error}
        />
      )}
    </AnimatedOverlay>
  );
}

function EditPaymentForm({ payment, paymentMethods, onClose, onSubmit, isPending, error }: {
  payment: YggdraPaymentList;
  paymentMethods: YggdraPaymentMethod[];
  onClose: () => void;
  onSubmit: (id: string, payload: Parameters<typeof updatePayment>[1]) => void;
  isPending: boolean;
  error: string | null;
}) {
  const [status, setStatus] = useState<string>(payment.status ?? "PENDING");
  const [methodId, setMethodId] = useState<string | null>(null);
  const [amount, setAmount] = useState(String(parseAmount(payment.amount)));
  const [reference, setReference] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  // Detalle completo: precarga método de pago y notas (la lista no los trae completos)
  const { data: detail } = useQuery({
    queryKey: ["payment", payment.id],
    queryFn: () => fetchPayment(payment.id),
    staleTime: 30_000,
  });

  // Valores efectivos: el editado por el usuario, o el precargado
  const methodIdValue = methodId ?? detail?.payment_method?.id ?? "";
  const referenceValue = reference ?? detail?.reference ?? payment.reference ?? "";
  const notesValue = notes ?? detail?.notes ?? "";

  const activeMethods = paymentMethods.filter((m) => m.is_active);
  const selectedMethod = paymentMethods.find((m) => m.id === methodIdValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!methodIdValue || !amount) return;
    onSubmit(payment.id, {
      status: status as "PENDING" | "PROCESSING" | "COMPLETED",
      payment_method_id: methodIdValue,
      amount: Number(amount),
      reference: referenceValue.trim() || null,
      notes: notesValue.trim() || null,
    });
  };

  return (
    <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:max-h-[90vh] md:max-w-md md:rounded-xl md:border">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold">Editar pago</h2>
        <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-4">
            {/* Estado */}
            <div className="flex flex-col gap-1">
              <label htmlFor="ep-status" className="text-sm font-medium">Estado</label>
              <Select id="ep-status" value={status} onChange={(e) => setStatus(e.target.value)} required>
                {EDIT_STATUS_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </Select>
              {status === "COMPLETED" && (
                <p className="mt-1 text-xs text-muted-foreground">Al completar, el pago queda confirmado y se habilita la descarga de boleta (80mm / A4).</p>
              )}
            </div>
            {/* Método de pago */}
            <div className="flex flex-col gap-1">
              <label htmlFor="ep-method" className="text-sm font-medium">Método de pago</label>
              <Select id="ep-method" value={methodIdValue} onChange={(e) => setMethodId(e.target.value)} required>
                <option value="">Seleccionar...</option>
                {activeMethods.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
              </Select>
            </div>
            {/* Monto */}
            <div className="flex flex-col gap-1">
              <label htmlFor="ep-amount" className="text-sm font-medium">Monto</label>
              <Input id="ep-amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required />
            </div>
            {/* Referencia (condicional según método) */}
            {selectedMethod?.requires_reference && (
              <div className="flex flex-col gap-1">
                <label htmlFor="ep-reference" className="text-sm font-medium">Referencia <span className="text-danger">*</span></label>
                <Input id="ep-reference" value={referenceValue} onChange={(e) => setReference(e.target.value)} placeholder="N° transferencia, voucher, etc." required />
              </div>
            )}
            {/* Notas */}
            <div className="flex flex-col gap-1">
              <label htmlFor="ep-notes" className="text-sm font-medium">Notas (opcional)</label>
              <Input id="ep-notes" value={notesValue} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones..." />
            </div>
            {/* Error */}
            {error && (<div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>)}
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button type="submit" disabled={isPending || !methodIdValue || !amount}>
            {isPending ? (<><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Guardando...</>) : (<><Pencil className="mr-1.5 h-4 w-4" />Guardar cambios</>)}
          </Button>
        </div>
      </form>
    </div>
  );
}

type OrderDetail = YggdraSchemas["Order"];

function PaymentDetailModal({ payment, onClose, onDownloadVoucher, downloading }: {
  payment: YggdraPaymentList | null;
  onClose: () => void;
  onDownloadVoucher: (id: string, format: "thermal" | "a4") => Promise<void>;
  downloading: string | null;
}) {
  const isIncome = payment?.payment_direction === "INCOME";
  const canDownload = payment?.status === "COMPLETED";

  return (
    <AnimatedOverlay open={Boolean(payment)} onClose={onClose} panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4">
      {payment && (
        <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:max-h-[90vh] md:max-w-lg md:rounded-xl md:border">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-base font-semibold">Detalle del pago</h2>
              <p className="text-xs text-muted-foreground">{new Date(payment.payment_date).toLocaleString("es-CL")}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(payment.status)}`}>{payment.status_display}</span>
              <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-4">
              {/* Monto destacado */}
              <div className={`flex items-center justify-between rounded-xl border border-border/60 px-4 py-3 ${isIncome ? "bg-success/5" : "bg-danger/5"}`}>
                <span className="text-sm font-medium text-muted-foreground">{isIncome ? "Ingreso" : "Egreso"} · {getPaymentMethodName(payment)}</span>
                <span className={`text-xl font-bold tabular-nums ${isIncome ? "text-success" : "text-danger"}`}>
                  {isIncome ? "+" : "-"}{formatCLP(parseAmount(payment.amount))}
                </span>
              </div>

              {/* Datos del pago */}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <DetailField label="Origen" value={payment.payment_source_display} />
                {payment.order_number && <DetailField label="Orden de venta" value={`OV ${payment.order_number}`} />}
                <DetailField label="Dirección" value={payment.payment_direction_display} />
                <DetailField label="Método" value={getPaymentMethodName(payment)} />
                {payment.net_amount !== undefined && Number(payment.net_amount) !== parseAmount(payment.amount) && (
                  <DetailField label="Monto neto" value={formatCLP(parseAmount(payment.net_amount))} />
                )}
                {payment.reference && <DetailField label="Referencia" value={payment.reference} />}
                {payment.branch_name && <DetailField label="Sucursal" value={payment.branch_name} />}
                {payment.processed_by_username && <DetailField label="Registrado por" value={payment.processed_by_username} />}
              </dl>

              {/* Detalle de la orden de venta asociada (incluye cuota, si aplica) */}
              {payment.order && <PaymentOrderSection orderId={payment.order} paymentId={payment.id} />}
            </div>
          </div>

          {canDownload && (
            <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1 px-3 text-xs border-success/40 bg-success/10 text-success hover:bg-success/20"
                onClick={() => onDownloadVoucher(payment.id, "thermal")}
                isLoading={downloading === `${payment.id}:thermal`}
              >
                <Receipt className="h-4 w-4" />
                Boleta 80mm
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1 px-3 text-xs border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                onClick={() => onDownloadVoucher(payment.id, "a4")}
                isLoading={downloading === `${payment.id}:a4`}
              >
                <FileText className="h-4 w-4" />
                Comprobante A4
              </Button>
            </div>
          )}
        </div>
      )}
    </AnimatedOverlay>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/80">{label}</dt>
      <dd className="truncate font-medium text-foreground" title={value}>{value}</dd>
    </div>
  );
}

function PaymentOrderSection({ orderId, paymentId }: { orderId: string; paymentId?: string }) {
  const queryClient = useQueryClient();
  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder(orderId),
    staleTime: 30_000,
  });
  const { data: installments } = useQuery({
    queryKey: ["order-installments", orderId],
    queryFn: () => fetchInstallments(orderId),
    staleTime: 30_000,
  });
  const { data: paymentMethods } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
  });

  // Formulario inline para pagar una cuota directamente desde Pagos (mismo
  // endpoint que usa Ventas: marca la cuota como pagada, no solo el pago).
  const [payingCuotaId, setPayingCuotaId] = useState<string | null>(null);
  const [cuotaMethodId, setCuotaMethodId] = useState("");
  const [cuotaAmount, setCuotaAmount] = useState("");
  const [cuotaReference, setCuotaReference] = useState("");
  const [cuotaNotes, setCuotaNotes] = useState("");

  const payCuotaMut = useMutation({
    mutationFn: ({ installmentId, input }: { installmentId: string; input: InstallmentPayInput }) =>
      payInstallment(orderId, installmentId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-installments", orderId] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setPayingCuotaId(null);
      setCuotaMethodId(""); setCuotaAmount(""); setCuotaReference(""); setCuotaNotes("");
    },
  });

  // Solo cuotas vigentes (las canceladas no cuentan para el numerado).
  const active = (installments ?? []).filter((i) => i.status !== "CANCELLED");
  const cuotaIndex = paymentId ? active.findIndex((i) => i.payment === paymentId) : -1;
  const paidCount = active.filter((i) => i.status === "PAID").length;
  const activeMethods = (paymentMethods ?? []).filter((m) => m.is_active);

  const openPayForm = (installmentId: string, amount: string) => {
    setPayingCuotaId((cur) => (cur === installmentId ? null : installmentId));
    setCuotaAmount(String(parseAmount(amount)));
    setCuotaReference("");
    setCuotaNotes("");
  };

  return (
    <section className="rounded-2xl border border-border bg-muted/30 shadow-sm">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Orden de venta</h3>
      </div>
      <div className="p-4">
        {active.length > 0 && (
          <div className="mb-3 rounded-lg border border-border/60">
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <CalendarClock className="h-4 w-4 text-primary" />
                Cuotas
                {cuotaIndex >= 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    este pago es la cuota {cuotaIndex + 1}
                  </span>
                )}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${paidCount === active.length ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                {paidCount}/{active.length} pagadas
              </span>
            </div>
            <ul className="divide-y divide-border/40">
              {active.map((inst, idx) => {
                const isThisPayment = Boolean(paymentId && inst.payment === paymentId);
                const payable = inst.status === "PENDING" || inst.status === "OVERDUE";
                const isPaying = payingCuotaId === inst.id;
                return (
                  <li key={inst.id} className="px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium">Cuota {idx + 1}</span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums text-muted-foreground">{formatCLP(parseAmount(inst.amount))}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${inst.status === "PAID" ? "bg-success/10 text-success" : inst.status === "OVERDUE" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}>
                          {inst.status_display ?? inst.status}
                        </span>
                        {payable && !isThisPayment && (
                          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => openPayForm(inst.id, inst.amount)}>
                            <Check className="h-3.5 w-3.5" />
                            {isPaying ? "Cerrar" : "Pagar"}
                          </Button>
                        )}
                      </span>
                    </div>
                    {inst.due_date && (
                      <p className="mt-0.5 text-xs text-muted-foreground">Vence {new Date(inst.due_date).toLocaleDateString("es-CL")}</p>
                    )}
                    {isPaying && (
                      <div className="mt-2 grid gap-2 rounded-lg bg-muted/30 p-3">
                        <Select value={cuotaMethodId} onChange={(e) => setCuotaMethodId(e.target.value)} aria-label="Método de pago de la cuota">
                          <option value="">Método de pago…</option>
                          {activeMethods.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
                        </Select>
                        <Input type="number" step="0.01" min="0.01" value={cuotaAmount} onChange={(e) => setCuotaAmount(e.target.value)} placeholder="Monto" aria-label="Monto de la cuota" />
                        <Input value={cuotaReference} onChange={(e) => setCuotaReference(e.target.value)} placeholder="Referencia (opcional)" aria-label="Referencia" />
                        <Input value={cuotaNotes} onChange={(e) => setCuotaNotes(e.target.value)} placeholder="Notas (opcional)" aria-label="Notas" />
                        <div className="flex items-center justify-end gap-2">
                          <Button type="button" variant="ghost" size="sm" onClick={() => setPayingCuotaId(null)} disabled={payCuotaMut.isPending}>Cancelar</Button>
                          <Button
                            type="button"
                            size="sm"
                            isLoading={payCuotaMut.isPending}
                            disabled={!cuotaMethodId || !cuotaAmount}
                            onClick={() => payCuotaMut.mutate({
                              installmentId: inst.id,
                              input: {
                                payment_method_id: cuotaMethodId,
                                amount: Number(cuotaAmount).toFixed(2),
                                reference: cuotaReference || null,
                                notes: cuotaNotes || null,
                              },
                            })}
                          >
                            <Check className="mr-1 h-3.5 w-3.5" />Confirmar pago
                          </Button>
                        </div>
                        {payCuotaMut.isError && (
                          <p className="text-xs text-danger">{payCuotaMut.error instanceof Error ? payCuotaMut.error.message : "Error al pagar la cuota"}</p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando orden...</div>
        ) : isError || !order ? (
          <p className="text-sm text-muted-foreground">No se pudo cargar la orden.</p>
        ) : (
          <OrderDetailInfo order={order} />
        )}
      </div>
    </section>
  );
}

function OrderDetailInfo({ order }: { order: OrderDetail }) {
  const items = order.products ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">Orden #{order.order_number ?? order.id.slice(0, 8)}</p>
          <p className="text-xs text-muted-foreground">{new Date(order.date).toLocaleString("es-CL")}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${order.payment_status === "PAID" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
          {order.payment_status === "PAID" ? "Pagada" : order.payment_status === "PARTIAL" ? "Pago parcial" : order.payment_status === "PENDING" ? "Sin pagar" : order.payment_status}
        </span>
      </div>

      {order.client && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
          <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm">{order.client.name}</span>
        </div>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col divide-y divide-border/40">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{item.quantity}× {item.product_name}</p>
                {item.notes && <p className="mt-0.5 text-[11px] text-muted-foreground">{item.notes}</p>}
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCLP(item.final_price ?? item.total_price ?? 0)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between border-t border-border/60 pt-2">
        <span className="text-sm font-medium">Total orden</span>
        <span className="text-base font-bold tabular-nums">{formatCLP(order.total_amount ?? 0)}</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, sub, tone = "slate" }: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; sub: string; tone?: "success" | "danger" | "slate";
}) {
  const toneStyles = { success: "from-success/12 via-card to-card", danger: "from-danger/12 via-card to-card", slate: "from-muted/50 via-card to-card" };
  const toneText = { success: "text-success", danger: "text-danger", slate: "text-muted-foreground" };
  const toneIcon = { success: "bg-success/12 text-success", danger: "bg-danger/12 text-danger", slate: "bg-muted text-muted-foreground" };
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
  return (<div className="grid gap-3 md:hidden">{Array.from({ length: 4 }).map((_, idx) => (<div key={idx} className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm"><div className="flex items-start gap-3"><Skeleton className="h-10 w-10 shrink-0 rounded-full" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div><Skeleton className="h-5 w-20 shrink-0" /></div><div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">{Array.from({ length: 4 }).map((__, i) => (<div key={i} className="min-w-0 space-y-1"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-full" /></div>))}</div></div></div></div>))}</div>);
}
