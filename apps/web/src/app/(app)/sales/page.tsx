"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, ShoppingBag, X, Eye, Ban, Banknote, Plus, Trash2, FileDown, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { fetchOrders, cancelOrder, downloadOrderThermalPdf, downloadOrderA4Pdf, exportOrdersExcel, type OrdersFilter } from "@/lib/api/orders";
import { fetchPaymentMethods, createPayment } from "@/lib/api/payments";
import { getCurrentCashRegister } from "@/lib/api/cash-register";
import { fetchTables } from "@/lib/api/tables";
import { formatCLP, paymentTypeLabel, cn } from "@/lib/utils";
import {
  useIsCashier,
  useSessionStore,
  useCurrentBranchRole,
  canCancelOrder,
  useCanViewTables,
  useIsModuleEnabledFromConfig,
} from "@/lib/store/session";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import type { YggdraSchemas } from "@/lib/api/types";

type Order = YggdraSchemas["Order"] & { order_number?: string | null };
type TableItem = YggdraSchemas["Table"];

function useClientSearchParam(key: string): string | null {
  return useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get(key);
  }, [key]);
}

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "DRAFT", label: "Borrador" },
  { value: "PENDING", label: "Pendiente" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "COMPLETED", label: "Completada" },
  { value: "CANCELLED", label: "Cancelada" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "PENDING", label: "Pendiente" },
  { value: "PARTIAL", label: "Parcial" },
  { value: "PAID", label: "Pagada" },
  { value: "REFUNDED", label: "Reembolsada" },
];

const ORDER_TYPE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "SALE", label: "Venta" },
  { value: "ORDER", label: "Pedido" },
  { value: "AGREEMENT", label: "Convenio" },
];

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function statusLabel(value?: string | null): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
}

function paymentStatusLabel(value?: string | null): string {
  return PAYMENT_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
}

export default function SalesPage() {
  const queryClient = useQueryClient();
  const isCashier = useIsCashier();
  const user = useSessionStore((s) => s.user);
  const currentRole = useCurrentBranchRole();
  const canCancel = (ownerId?: string | number) => canCancelOrder(user, currentRole, ownerId);
  const canViewTables = useCanViewTables();
  const tablesEnabled = useIsModuleEnabledFromConfig("tables");
  const showTables = canViewTables && tablesEnabled;
  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();
  const openView = useClientSearchParam("view") === "open";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(openView ? "PENDING" : "");
  const [orderType, setOrderType] = useState("");
  const [startDate, setStartDate] = useState(isCashier ? todayStr() : "");
  const [endDate, setEndDate] = useState(isCashier ? todayStr() : "");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [detail, setDetail] = useState<Order | null>(null);
  const [collecting, setCollecting] = useState<Order | null>(null);
  const [paymentLines, setPaymentLines] = useState<{ id: string; payment_method_id: string; amount: string }[]>([]);
  const [collectError, setCollectError] = useState<string | null>(null);
  const [collectSuccess, setCollectSuccess] = useState<string | null>(null);

  const filter = useMemo<OrdersFilter>(
    () => ({
      search: search || undefined,
      status: status || undefined,
      payment_status: paymentStatus || undefined,
      order_type: orderType || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      ...pageUrl,
    }),
    [search, status, paymentStatus, orderType, startDate, endDate, pageUrl],
  );

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["orders", filter],
    queryFn: () => fetchOrders(filter),
  });

  const { data: paymentMethods } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  });

  const { data: currentCashRegister } = useQuery({
    queryKey: ["cash-register", "current"],
    queryFn: () => getCurrentCashRegister(),
    staleTime: 30_000,
    retry: false,
  });

  const { data: tablesPage } = useQuery({
    queryKey: ["tables", "sales"],
    queryFn: () => fetchTables({ is_active: true, page_size: 200 }),
    enabled: showTables,
    staleTime: 60_000,
  });

  const tableById = useMemo(() => {
    const tables = tablesPage?.results ?? [];
    const map = new Map<number, TableItem>();
    tables.forEach((t) => map.set(t.id, t));
    return map;
  }, [tablesPage]);

  const orders = (page?.results ?? []) as Order[];
  const totalOrders = page?.count ?? 0;

  const cancel = useMutation({
    mutationFn: (id: string) => cancelOrder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const collect = useMutation({
    mutationFn: async ({
      orderId,
      payments,
    }: {
      orderId: string;
      payments: { payment_method_id: string; amount: string }[];
    }) => {
      for (const payment of payments) {
        await createPayment({
          payment_method_id: payment.payment_method_id,
          order_id: orderId,
          amount: Number(payment.amount).toFixed(2),
          status: "COMPLETED",
          cash_register_id: currentCashRegister ? currentCashRegister.id : null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setCollectSuccess("Pago registrado correctamente.");
      setTimeout(() => {
        setCollectSuccess(null);
        setCollecting(null);
        setPaymentLines([]);
      }, 1200);
    },
  });

  function updateFilter<T extends string>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  function updateDateRange(start: string, end: string) {
    setStartDate(start);
    setEndDate(end);
    setPageUrl({});
  }

  function openCollect(order: Order) {
    setCollecting(order);
    setCollectError(null);
    setCollectSuccess(null);
    const total = parseFloat(order.total_amount ?? "0");
    const firstMethod = paymentMethods?.[0];
    setPaymentLines([
      {
        id: "initial",
        payment_method_id: firstMethod?.id ?? "",
        amount: total.toFixed(2),
      },
    ]);
  }

  async function handleExportExcel() {
    await downloadFile(() => exportOrdersExcel(filter), {
      filename: exportFilename("ordenes", "xlsx"),
      extension: "xlsx",
    });
  }

  async function handleDownloadThermalPdf(order: Order) {
    await downloadFile(() => downloadOrderThermalPdf(order.id), {
      filename: `boleta_${order.order_number ?? order.id.slice(0, 8)}.pdf`,
    });
  }

  async function handleDownloadA4Pdf(order: Order) {
    await downloadFile(() => downloadOrderA4Pdf(order.id), {
      filename: `boleta_${order.order_number ?? order.id.slice(0, 8)}_a4.pdf`,
    });
  }

  function closeCollect() {
    setCollecting(null);
    setPaymentLines([]);
    setCollectError(null);
    setCollectSuccess(null);
  }

  function addPaymentLine() {
    const firstMethod = paymentMethods?.[0];
    setPaymentLines((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, payment_method_id: firstMethod?.id ?? "", amount: "" },
    ]);
  }

  function removePaymentLine(id: string) {
    setPaymentLines((prev) => prev.filter((p) => p.id !== id));
  }

  function updatePaymentLine(id: string, patch: Partial<{ payment_method_id: string; amount: string }>) {
    setPaymentLines((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function handleCollectSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCollectError(null);
    if (!collecting) return;
    const total = parseFloat(collecting.total_amount ?? "0");
    const paid = paymentLines.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    if (paid < total) {
      setCollectError(`Faltan ${formatCLP(total - paid)} para completar el pago.`);
      return;
    }
    try {
      await collect.mutateAsync({ orderId: collecting.id, payments: paymentLines });
    } catch (err) {
      setCollectError(err instanceof Error ? err.message : "Error al registrar el pago.");
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Ventas y órdenes</h1>
          <p className="text-xs text-muted-foreground">
            Historial de ventas, pedidos y convenios
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportExcel}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-2 h-4 w-4" />
          )}
          Exportar Excel
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {/* Filtros rápidos */}
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
          <button
            onClick={() => {
              setStatus("");
              setPaymentStatus("");
              setOrderType("");
              setPageUrl({});
            }}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              status === "" && paymentStatus === "" && orderType === ""
                ? "bg-primary text-white"
                : "bg-card text-muted-foreground ring-1 ring-border hover:bg-muted",
            )}
          >
            Todas
          </button>
          <button
            onClick={() => {
              setStatus("");
              setPaymentStatus("PENDING");
              setOrderType("");
              setPageUrl({});
            }}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              paymentStatus === "PENDING" && status === "" && orderType === ""
                ? "bg-amber-500 text-white"
                : "bg-card text-muted-foreground ring-1 ring-border hover:bg-muted",
            )}
          >
            Cuentas abiertas
          </button>
          <button
            onClick={() => {
              setStatus("");
              setPaymentStatus("");
              setOrderType("ORDER");
              setPageUrl({});
            }}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              orderType === "ORDER" && status === "" && paymentStatus === ""
                ? "bg-blue-500 text-white"
                : "bg-card text-muted-foreground ring-1 ring-border hover:bg-muted",
            )}
          >
            Pedidos
          </button>
          <button
            onClick={() => {
              setStatus("");
              setPaymentStatus("PAID");
              setOrderType("");
              setPageUrl({});
            }}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              paymentStatus === "PAID" && status === "" && orderType === ""
                ? "bg-emerald-500 text-white"
                : "bg-card text-muted-foreground ring-1 ring-border hover:bg-muted",
            )}
          >
            Pagadas
          </button>
          <button
            onClick={() => {
              setStatus("CANCELLED");
              setPaymentStatus("");
              setOrderType("");
              setPageUrl({});
            }}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              status === "CANCELLED" && paymentStatus === "" && orderType === ""
                ? "bg-danger text-white"
                : "bg-card text-muted-foreground ring-1 ring-border hover:bg-muted",
            )}
          >
            Anuladas
          </button>
        </div>

        {/* Filtros avanzados */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="relative col-span-2 sm:col-span-3 lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => updateFilter(setSearch, e.target.value)}
              placeholder="Buscar orden…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-status" className="text-xs text-muted-foreground">Estado</label>
            <Select id="filter-status" value={status} onChange={(e) => updateFilter(setStatus, e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-payment" className="text-xs text-muted-foreground">Pago</label>
            <Select id="filter-payment" value={paymentStatus} onChange={(e) => updateFilter(setPaymentStatus, e.target.value)}>
              {PAYMENT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-type" className="text-xs text-muted-foreground">Tipo</label>
            <Select id="filter-type" value={orderType} onChange={(e) => updateFilter(setOrderType, e.target.value)}>
              {ORDER_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-start" className="text-xs text-muted-foreground">Desde</label>
            <Input
              id="filter-start"
              type="date"
              value={startDate}
              onChange={(e) => updateDateRange(e.target.value, endDate)}
              disabled={isCashier}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-end" className="text-xs text-muted-foreground">Hasta</label>
            <Input
              id="filter-end"
              type="date"
              value={endDate}
              onChange={(e) => updateDateRange(startDate, e.target.value)}
              disabled={isCashier}
            />
          </div>
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudieron cargar las órdenes.</p>
        ) : isLoading ? (
          <div className="grid flex-1 place-items-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Vista móvil: cards */}
            <div className="grid gap-3 sm:hidden">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{order.order_number ?? order.id.slice(0, 8)}</span>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        order.status === "COMPLETED"
                          ? "bg-emerald-500/10 text-emerald-700"
                          : order.status === "CANCELLED"
                            ? "bg-danger/10 text-danger"
                            : "bg-amber-500/10 text-amber-700",
                      )}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>{order.client?.name ?? "Sin cliente"}</span>
                    <span>·</span>
                    <span>{order.order_type === "SALE" ? "Venta" : order.order_type === "ORDER" ? "Pedido" : "Convenio"}</span>
                    {showTables && order.table && (
                      <>
                        <span>·</span>
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                          Mesa {tableById.get(order.table)?.number ?? order.table}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {new Date(order.date).toLocaleString("es-CL", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-lg font-bold tabular-nums">
                      {formatCLP(order.total_amount ?? "0")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        order.payment_status === "PAID"
                          ? "bg-emerald-500/10 text-emerald-700"
                          : order.payment_status === "PARTIAL"
                            ? "bg-blue-500/10 text-blue-700"
                            : order.payment_status === "REFUNDED"
                              ? "bg-rose-500/10 text-rose-700"
                              : "bg-muted text-muted-foreground",
                      )}
                    >
                      {paymentStatusLabel(order.payment_status)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setDetail(order)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {(order.payment_status === "PENDING" || order.payment_status === "PARTIAL") && (
                        <Button variant="ghost" size="sm" onClick={() => openCollect(order)}>
                          <Banknote className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {order.payment_status === "PAID" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadThermalPdf(order)}
                            disabled={isDownloading}
                            title="Boleta 80 mm"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadA4Pdf(order)}
                            disabled={isDownloading}
                            title="Boleta A4"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {order.status !== "CANCELLED" && canCancel(order.owner) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger hover:text-danger"
                          onClick={() => cancel.mutate(order.id)}
                          disabled={cancel.isPending}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Vista desktop: tabla */}
            <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">N° Orden</th>
                    <th className="px-4 py-3">Cliente</th>
                    {showTables && <th className="px-4 py-3">Mesa</th>}
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Pago</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{order.order_number ?? order.id.slice(0, 8)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {order.client?.name ?? "—"}
                      </td>
                      {showTables && (
                        <td className="px-4 py-3 text-muted-foreground">
                          {order.table ? (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                              Mesa {tableById.get(order.table)?.number ?? order.table}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-muted-foreground">
                        {order.order_type === "SALE" ? "Venta" : order.order_type === "ORDER" ? "Pedido" : "Convenio"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            order.status === "COMPLETED"
                              ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                              : order.status === "CANCELLED"
                                ? "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger"
                                : "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700"
                          }
                        >
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {paymentStatusLabel(order.payment_status)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatCLP(order.total_amount ?? "0")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(order.date).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetail(order)}>
                            <Eye className="h-3.5 w-3.5" />
                            Ver
                          </Button>
                          {(order.payment_status === "PENDING" || order.payment_status === "PARTIAL") && (
                            <Button variant="ghost" size="sm" onClick={() => openCollect(order)}>
                              <Banknote className="h-3.5 w-3.5" />
                              Cobrar
                            </Button>
                          )}
                          {order.payment_status === "PAID" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadThermalPdf(order)}
                                disabled={isDownloading}
                                title="Boleta 80 mm"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                80 mm
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadA4Pdf(order)}
                                disabled={isDownloading}
                                title="Boleta A4"
                              >
                                <FileDown className="h-3.5 w-3.5" />
                                A4
                              </Button>
                            </>
                          )}
                          {order.status !== "CANCELLED" && canCancel(order.owner) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-danger hover:text-danger"
                              onClick={() => cancel.mutate(order.id)}
                              disabled={cancel.isPending}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Anular
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                {totalOrders} orden{totalOrders === 1 ? "" : "es"} en total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ previous: page?.previous })}
                  disabled={!page?.previous}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ next: page?.next })}
                  disabled={!page?.next}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Orden {detail.id.slice(0, 8)}</h2>
              <button onClick={() => setDetail(null)} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <p><span className="text-muted-foreground">N° Orden:</span> {detail.order_number ?? detail.id.slice(0, 8)}</p>
              <p><span className="text-muted-foreground">Cliente:</span> {detail.client?.name ?? "—"}</p>
              {showTables && detail.table && (
                <p>
                  <span className="text-muted-foreground">Mesa:</span>{" "}
                  Mesa {tableById.get(detail.table)?.number ?? detail.table}
                </p>
              )}
              <p><span className="text-muted-foreground">Tipo:</span> {detail.order_type}</p>
              <p><span className="text-muted-foreground">Estado:</span> {statusLabel(detail.status)}</p>
              <p><span className="text-muted-foreground">Pago:</span> {paymentStatusLabel(detail.payment_status)}</p>
              <p><span className="text-muted-foreground">Total:</span> {formatCLP(detail.total_amount ?? "0")}</p>
              <p><span className="text-muted-foreground">Fecha:</span> {new Date(detail.date).toLocaleString()}</p>
              {detail.observation && (
                <p><span className="text-muted-foreground">Observación:</span> {detail.observation}</p>
              )}
              {detail.products && detail.products.length > 0 && (
                <div className="mt-2">
                  <p className="text-muted-foreground">Productos:</p>
                  <ul className="mt-1 flex flex-col gap-1 rounded-lg border border-border bg-background p-2">
                    {detail.products.map((p) => (
                      <li key={p.id} className="flex items-center justify-between text-sm">
                        <span>{p.product_name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          x{p.quantity ?? 0} · {formatCLP(parseFloat(p.total_price ?? "0"))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setDetail(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {collecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                Cobrar orden {collecting.order_number ?? collecting.id.slice(0, 8)}
              </h2>
              <button onClick={closeCollect} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCollectSubmit} className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <span className="text-muted-foreground">Total a cobrar</span>
                <span className="text-lg font-semibold tabular-nums">
                  {formatCLP(collecting.total_amount ?? "0")}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Pagos</label>
                  <Button type="button" variant="outline" size="sm" onClick={addPaymentLine}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Agregar
                  </Button>
                </div>
                {paymentLines.map((line) => (
                  <div key={line.id} className="flex items-end gap-2 rounded-lg border border-border p-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Método</label>
                      <Select
                        value={line.payment_method_id}
                        onChange={(e) => updatePaymentLine(line.id, { payment_method_id: e.target.value })}
                      >
                        {paymentMethods?.map((m) => (
                          <option key={m.id} value={m.id}>
                            {paymentTypeLabel(m.payment_type) || m.name || m.payment_type}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex w-28 flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Monto</label>
                      <Input
                        type="number"
                        min={0}
                        step="1"
                        value={line.amount ? Math.round(parseFloat(line.amount)).toString() : ""}
                        onChange={(e) => updatePaymentLine(line.id, { amount: e.target.value })}
                        className="tabular-nums"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePaymentLine(line.id)}
                      className="mb-2 text-muted-foreground hover:text-danger"
                      aria-label="Quitar pago"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Total ingresado</span>
                  <span className="tabular-nums">
                    {formatCLP(paymentLines.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0))}
                  </span>
                </div>
              </div>

              {collectError && (
                <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{collectError}</p>
              )}
              {collectSuccess && (
                <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
                  {collectSuccess}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeCollect} disabled={collect.isPending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={collect.isPending}>
                  {collect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Registrar pago
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
