"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, ShoppingBag, X, Eye, Ban, Banknote, Plus, Trash2, FileDown, ChefHat, Receipt, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { fetchOrders, cancelOrder, downloadOrderThermalPdf, downloadOrderTicketPdf, downloadOrderA4Pdf, exportOrdersExcel, createOrder, type OrdersFilter } from "@/lib/api/orders";
import { fetchPaymentMethods, createPayment } from "@/lib/api/payments";
import { getCurrentCashRegister } from "@/lib/api/cash-register";
import { fetchTables } from "@/lib/api/tables";
import { searchCustomers, createCustomer } from "@/lib/api/customers";
import { formatCLP, paymentTypeLabel, cn } from "@/lib/utils";
import {
  useIsCashier,
  useSessionStore,
  useCurrentBranchRole,
  useCurrentBranch,
  canCancelOrder,
  useCanViewTables,
  useIsModuleEnabledFromConfig,
} from "@/lib/store/session";

import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import type { YggdraSchemas } from "@/lib/api/types";
import { AnimatePresence, motion } from "framer-motion";

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

function orderTypeLabel(value?: string | null): string {
  return ORDER_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
}

export default function SalesPage() {
  const queryClient = useQueryClient();
  const branch = useCurrentBranch();
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(openView ? "PENDING" : "");
  const [orderType, setOrderType] = useState("");
  const [startDate, setStartDate] = useState(isCashier ? todayStr() : "");
  const [endDate, setEndDate] = useState(isCashier ? todayStr() : "");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const [detail, setDetail] = useState<Order | null>(null);
  const [collecting, setCollecting] = useState<Order | null>(null);
  const [posModal, setPosModal] = useState<{ open: boolean; orderType: "SALE" | "ORDER" | null }>({
    open: false,
    orderType: null,
  });

  // Modal rápido para crear cuenta (ORDER) con cliente/mesa.
  const [accountModal, setAccountModal] = useState(false);
  const [clientQuery, setClientQuery] = useState("");
  const [debouncedClientQuery, setDebouncedClientQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<YggdraSchemas["Client"] | null>(null);
  const [showClientResults, setShowClientResults] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [createClientName, setCreateClientName] = useState("");
  const [showCreateClient, setShowCreateClient] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedClientQuery(clientQuery), 300);
    return () => clearTimeout(timer);
  }, [clientQuery]);

  const { data: clientResultsQuery } = useQuery({
    queryKey: ["customers", "search", debouncedClientQuery, branch?.branch_id],
    queryFn: () => searchCustomers(debouncedClientQuery, branch?.branch_id ? Number(branch.branch_id) : undefined),
    enabled: debouncedClientQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  const clientResults = useMemo<YggdraSchemas["Client"][]>(() => {
    const items = clientResultsQuery ?? [];
    if (selectedClient && !items.some((c) => c.id === selectedClient.id)) {
      return [selectedClient, ...items];
    }
    return items;
  }, [clientResultsQuery, selectedClient]);

  // Refrescar lista de órdenes al cerrar el modal rápido de POS.
  useEffect(() => {
    if (!posModal.open) {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    }
  }, [posModal.open, queryClient]);
  const [paymentLines, setPaymentLines] = useState<{ id: string; payment_method_id: string; amount: string }[]>([]);
  const [collectError, setCollectError] = useState<string | null>(null);
  const [collectSuccess, setCollectSuccess] = useState<string | null>(null);

  const filter = useMemo<OrdersFilter>(
    () => ({
      search: debouncedSearch || undefined,
      status: status || undefined,
      payment_status: paymentStatus || undefined,
      order_type: orderType || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      ...pageUrl,
    }),
    [debouncedSearch, status, paymentStatus, orderType, startDate, endDate, pageUrl],
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

  const orders = useMemo(() => {
    const items = (page?.results ?? []) as Order[];
    const term = debouncedSearch.trim().toLowerCase();
    if (!term) return items;
    return items.filter((order) => {
      const number = (order.order_number ?? order.id).toLowerCase();
      const client = (order.client?.name ?? "").toLowerCase();
      const table = order.table ? String(tableById.get(order.table)?.number ?? order.table).toLowerCase() : "";
      return number.includes(term) || client.includes(term) || table.includes(term);
    });
  }, [page?.results, debouncedSearch, tableById]) as Order[];
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

  async function handleDownloadTicketPdf(order: Order) {
    await downloadFile(() => downloadOrderTicketPdf(order.id), {
      filename: `comanda_${order.order_number ?? order.id.slice(0, 8)}.pdf`,
    });
  }

  async function handleCreateAccount() {
    if (creatingAccount) return;
    setCreatingAccount(true);
    try {
      let clientId = selectedClient?.id ?? null;
      if (!clientId && createClientName.trim()) {
        const newClient = await createCustomer({ name: createClientName.trim() });
        clientId = newClient.id;
      }
      const tableId = selectedTableId ? Number(selectedTableId) : null;
      const order = await createOrder({
        items: [],
        order_type: "ORDER",
        client_id: clientId,
        table_id: tableId,
      });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setAccountModal(false);
      resetAccountForm();
      // Abrir POS embebido con la nueva cuenta para agregar productos.
      setPosModal({ open: true, orderType: "ORDER" });
      // Navegar el iframe a la orden. Como el modal usa state, actualizamos src vía query param.
      // Usamos un pequeño timeout para asegurar que el iframe exista.
      setTimeout(() => {
        const iframe = document.querySelector<HTMLIFrameElement>("iframe[title='Nuevo pedido']");
        if (iframe) {
          iframe.src = `/pos/terminal?order_id=${order.id}`;
        }
      }, 100);
    } catch {
      // ignore - error handled by api client
    } finally {
      setCreatingAccount(false);
    }
  }

  function resetAccountForm() {
    setClientQuery("");
    setDebouncedClientQuery("");
    setSelectedClient(null);
    setShowClientResults(false);
    setSelectedTableId("");
    setCreateClientName("");
    setShowCreateClient(false);
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
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Ventas y órdenes</h1>
          <p className="text-xs text-muted-foreground">
            Historial de ventas, pedidos y estadísticas
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setPosModal({ open: true, orderType: "SALE" })}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Venta
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setAccountModal(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Nueva cuenta
            </Button>
          </div>
          <div className="hidden h-6 w-px bg-border sm:block" />
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleExportExcel}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-1.5 h-4 w-4" />
            )}
            <span className="hidden sm:inline">Exportar Excel</span>
            <span className="sm:hidden">Excel</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {/* Filtros rápidos */}
        <div className="flex flex-wrap gap-2 pb-1 sm:flex-nowrap sm:overflow-x-auto">
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
        <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-7">
          <div className="flex flex-col gap-1 xs:col-span-2 lg:col-span-2">
            <label htmlFor="filter-search" className="text-xs text-muted-foreground">Buscar por N° de orden</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="filter-search"
                value={search}
                onChange={(e) => updateFilter(setSearch, e.target.value)}
                placeholder="Ej: B5-260821-0007"
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="filter-status" className="text-xs text-muted-foreground">Estado</label>
            <Select id="filter-status" value={status} onChange={(e) => updateFilter(setStatus, e.target.value)} className="h-8 text-xs">
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="filter-payment" className="text-xs text-muted-foreground">Pago</label>
            <Select id="filter-payment" value={paymentStatus} onChange={(e) => updateFilter(setPaymentStatus, e.target.value)} className="h-8 text-xs">
              {PAYMENT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="filter-type" className="text-xs text-muted-foreground">Tipo</label>
            <Select id="filter-type" value={orderType} onChange={(e) => updateFilter(setOrderType, e.target.value)} className="h-8 text-xs">
              {ORDER_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="filter-start" className="text-xs text-muted-foreground">Desde</label>
            <Input
              id="filter-start"
              type="date"
              value={startDate}
              onChange={(e) => updateDateRange(e.target.value, endDate)}
              disabled={isCashier}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="filter-end" className="text-xs text-muted-foreground">Hasta</label>
            <Input
              id="filter-end"
              type="date"
              value={endDate}
              onChange={(e) => updateDateRange(startDate, e.target.value)}
              disabled={isCashier}
              className="h-8 text-xs"
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
            <div className="grid gap-2 sm:hidden">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-border bg-card p-3"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{order.order_number ?? order.id.slice(0, 8)}</span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {order.client?.name ?? "Sin cliente"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold tabular-nums">{formatCLP(order.total_amount ?? "0")}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(order.date).toLocaleString("es-CL", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium leading-none",
                        order.status === "COMPLETED"
                          ? "bg-emerald-500/10 text-emerald-700"
                          : order.status === "CANCELLED"
                            ? "bg-danger/10 text-danger"
                            : "bg-amber-500/10 text-amber-700",
                      )}
                    >
                      {statusLabel(order.status)}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium leading-none",
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
                    <span className="text-xs text-muted-foreground">
                      {orderTypeLabel(order.order_type)}
                    </span>
                    {showTables && order.table && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Mesa {tableById.get(order.table)?.number ?? order.table}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDetail(order)}
                      title="Ver"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDownloadTicketPdf(order)}
                      title="Descargar comanda (cocina)"
                    >
                      <ChefHat className="h-3.5 w-3.5" />
                    </Button>
                    {(order.payment_status === "PENDING" || order.payment_status === "PARTIAL") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openCollect(order)}
                        title="Cobrar"
                      >
                        <Banknote className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {order.payment_status === "PAID" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownloadThermalPdf(order)}
                          disabled={isDownloading}
                          title="Boleta 80 mm"
                        >
                          <Receipt className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownloadA4Pdf(order)}
                          disabled={isDownloading}
                          title="Boleta A4"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {order.status !== "CANCELLED" && canCancel(order.owner) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-danger hover:text-danger"
                        onClick={() => cancel.mutate(order.id)}
                        disabled={cancel.isPending}
                        title="Anular"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Vista desktop: tabla */}
            <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="whitespace-nowrap px-3 py-3">N°</th>
                    <th className="px-3 py-3">Cliente</th>
                    {showTables && <th className="px-3 py-3">Mesa</th>}
                    <th className="px-3 py-3">Tipo</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3">Pago</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">Total</th>
                    <th className="whitespace-nowrap px-3 py-3">Fecha</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-3 py-3">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{order.order_number ?? order.id.slice(0, 8)}</span>
                        </div>
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-3 text-muted-foreground">
                        {order.client?.name ?? "—"}
                      </td>
                      {showTables && (
                        <td className="px-3 py-3 text-muted-foreground">
                          {order.table ? (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                              {tableById.get(order.table)?.number ?? order.table}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                      <td className="px-3 py-3 text-muted-foreground">
                        {orderTypeLabel(order.order_type)}
                      </td>
                      <td className="px-3 py-3">
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
                      <td className="px-3 py-3 text-muted-foreground">
                        {paymentStatusLabel(order.payment_status)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums font-medium">
                        {formatCLP(order.total_amount ?? "0")}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                        {new Date(order.date).toLocaleString("es-CL", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetail(order)} title="Ver detalle">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadTicketPdf(order)} title="Descargar comanda (cocina)">
                            <ChefHat className="h-4 w-4" />
                          </Button>
                          {(order.payment_status === "PENDING" || order.payment_status === "PARTIAL") && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openCollect(order)} title="Cobrar">
                              <Banknote className="h-4 w-4" />
                            </Button>
                          )}
                          {order.payment_status === "PAID" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDownloadThermalPdf(order)}
                                disabled={isDownloading}
                                title="Boleta 80 mm"
                              >
                                <Receipt className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDownloadA4Pdf(order)}
                                disabled={isDownloading}
                                title="Boleta A4"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {order.status !== "CANCELLED" && canCancel(order.owner) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-danger hover:text-danger"
                              onClick={() => cancel.mutate(order.id)}
                              disabled={cancel.isPending}
                              title="Anular"
                            >
                              <Ban className="h-4 w-4" />
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
              <h2 className="text-base font-semibold">
                {orderTypeLabel(detail.order_type)} {detail.order_number ?? detail.id.slice(0, 8)}
              </h2>
              <button onClick={() => setDetail(null)} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <p><span className="text-muted-foreground">N°:</span> {detail.order_number ?? detail.id.slice(0, 8)}</p>
              <p><span className="text-muted-foreground">Cliente:</span> {detail.client?.name ?? "—"}</p>
              {showTables && detail.table && (
                <p>
                  <span className="text-muted-foreground">Mesa:</span>{" "}
                  Mesa {tableById.get(detail.table)?.number ?? detail.table}
                </p>
              )}
              <p><span className="text-muted-foreground">Tipo:</span> {orderTypeLabel(detail.order_type)}</p>
              <p><span className="text-muted-foreground">Estado:</span> {statusLabel(detail.status)}</p>
              <p><span className="text-muted-foreground">Pago:</span> {paymentStatusLabel(detail.payment_status)}</p>
              <p><span className="text-muted-foreground">Total:</span> {formatCLP(detail.total_amount ?? "0")}</p>
              <p><span className="text-muted-foreground">Fecha:</span> {new Date(detail.date).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</p>
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
                Cobrar {orderTypeLabel(collecting.order_type).toLowerCase()} {collecting.order_number ?? collecting.id.slice(0, 8)}
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

      {/* Modal rápido para crear cuenta (ORDER) con cliente/mesa */}
      <AnimatePresence>
        {accountModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold">Nueva cuenta</h2>
                <button
                  type="button"
                  onClick={() => {
                    setAccountModal(false);
                    resetAccountForm();
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="account-client" className="text-xs font-medium text-muted-foreground">
                    Cliente
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="account-client"
                      value={clientQuery}
                      onChange={(e) => {
                        setClientQuery(e.target.value);
                        setSelectedClient(null);
                        setShowClientResults(true);
                      }}
                      onFocus={() => setShowClientResults(true)}
                      placeholder="Buscar cliente..."
                      className="h-9 pl-8 text-sm"
                    />
                    {showClientResults && clientResults.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-border bg-background shadow-md">
                        {clientResults.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => {
                              setSelectedClient(client);
                              setClientQuery(client.name ?? "");
                              setShowClientResults(false);
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            {client.name}
                            {client.email && <span className="ml-2 text-xs text-muted-foreground">{client.email}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    {showClientResults && debouncedClientQuery.trim().length >= 2 && clientResults.length === 0 && !selectedClient && (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground shadow-md">
                        Sin resultados
                      </div>
                    )}
                  </div>
                  {!showCreateClient ? (
                    <button
                      type="button"
                      onClick={() => setShowCreateClient(true)}
                      className="self-start text-xs text-primary hover:underline"
                    >
                      + Crear cliente rápido
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        value={createClientName}
                        onChange={(e) => setCreateClientName(e.target.value)}
                        placeholder="Nombre del nuevo cliente"
                        className="h-8 flex-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateClient(false);
                          setCreateClientName("");
                        }}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {showTables && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="account-table" className="text-xs font-medium text-muted-foreground">
                      Mesa (opcional)
                    </label>
                    <Select
                      id="account-table"
                      value={selectedTableId}
                      onChange={(e) => setSelectedTableId(e.target.value)}
                      className="h-9 text-sm"
                    >
                      <option value="">Sin mesa</option>
                      {(tablesPage?.results ?? []).map((table) => (
                        <option key={table.id} value={String(table.id)}>
                          Mesa {table.number}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAccountModal(false);
                      resetAccountForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateAccount}
                    disabled={creatingAccount}
                  >
                    {creatingAccount && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Crear cuenta
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal rápido de POS para crear venta/pedido sin salir de la página */}
      <AnimatePresence>
        {posModal.open && posModal.orderType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setPosModal({ open: false, orderType: null })}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.2 }}
              className="relative flex h-full w-full flex-col overflow-hidden rounded-none bg-background shadow-2xl sm:h-[90vh] sm:max-h-[900px] sm:max-w-6xl sm:rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <h2 className="text-sm font-semibold">
                  {posModal.orderType === "SALE" ? "Nueva venta" : "Nuevo pedido / cuenta abierta"}
                </h2>
                <button
                  type="button"
                  onClick={() => setPosModal({ open: false, orderType: null })}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <iframe
                src={`/pos/terminal?order_type=${posModal.orderType}`}
                className="flex-1 border-0"
                title={posModal.orderType === "SALE" ? "Nueva venta" : "Nuevo pedido"}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
