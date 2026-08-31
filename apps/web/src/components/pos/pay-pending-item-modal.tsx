"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Receipt,
  UserSearch,
  Truck,
  TrendingDown,
  Loader2,
  Eye,
  Pencil,
  Trash2,
  Check,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ModalBody, ModalFooter } from "@/components/ui/modal";
import { fetchOrders, fetchOrder, payOrder, fetchPendingOrdersByClient, deliverOrder } from "@/lib/api/orders";
import { fetchPurchaseOrders, payPurchaseOrder } from "@/lib/api/suppliers";
import { fetchExpenses, payExpense } from "@/lib/api/expenses";
import { searchCustomers } from "@/lib/api/customers";
import { formatCLP, cn, paymentStatusLabel } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import type { POSQuickActionType } from "@/lib/api/branches";
import type { YggdraSchemas } from "@/lib/api/types";

function toDecimal(v: string): string {
  return (parseInt(v || "0", 10) || 0).toFixed(2);
}

function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isNaN(v) ? 0 : v;
  const parsed = parseFloat(v);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function numberValue(v: string): string {
  const cleaned = v.replace(/[^0-9]/g, "");
  return cleaned ? (parseInt(cleaned, 10) || 0).toString() : "";
}

type Order = YggdraSchemas["Order"] & {
  order_number?: string | null;
  paid_amount?: string | null;
};

type PurchaseOrder = {
  id: string;
  order_number?: string | null;
  remaining_amount?: string | null;
  [key: string]: unknown;
};

type FixedExpense = {
  id: string;
  name?: string | null;
  amount?: string | null;
  total_paid?: string | null;
  [key: string]: unknown;
};

type PaymentMethod = {
  id: string;
  name: string;
  is_active: boolean;
  is_pos_enabled?: boolean;
};

type Customer = YggdraSchemas["Client"];

function deliveryStatusLabel(status?: string | null) {
  switch (status) {
    case "IN_PROGRESS":
      return "En preparación";
    case "DELIVERED":
      return "Entregado";
    case "PARTIAL":
      return "Parcial";
    case "PENDING":
    default:
      return "Pendiente";
  }
}

function deliveryStatusClass(status?: string | null) {
  switch (status) {
    case "IN_PROGRESS":
      return "text-blue-600";
    case "DELIVERED":
      return "text-emerald-600";
    case "PARTIAL":
      return "text-violet-600";
    case "PENDING":
    default:
      return "text-amber-600";
  }
}

function paymentStatusClass(status?: string | null) {
  switch (status) {
    case "PAID":
      return "text-emerald-600";
    case "PARTIAL":
      return "text-violet-600";
    case "INVOICED":
      return "text-blue-600";
    case "REFUNDED":
      return "text-rose-600";
    case "PENDING":
    default:
      return "text-amber-600";
  }
}

function shortDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

interface PayPendingItemModalProps {
  open: boolean;
  type: POSQuickActionType;
  onClose: () => void;
  cashRegisterId: number | string | null;
  paymentMethods: PaymentMethod[];
  onContinueOrder?: (order: Order) => void;
  onCancelOrder?: (order: Order) => void;
}

const TYPE_CONFIG: Record<
  POSQuickActionType,
  { title: string; icon: React.ReactNode; listLabel: string }
> = {
  pay_account: {
    title: "Cuentas por cobrar",
    icon: <Receipt className="h-5 w-5" />,
    listLabel: "Cuentas por cobrar (ventas)",
  },
  pay_order: {
    title: "Retiros pendientes",
    icon: <Truck className="h-5 w-5" />,
    listLabel: "Retiros pendientes",
  },
  collect: {
    title: "Cobrar por cliente",
    icon: <UserSearch className="h-5 w-5" />,
    listLabel: "Órdenes del cliente",
  },
  pay_purchase_order: {
    title: "Órdenes de compra por pagar",
    icon: <Truck className="h-5 w-5" />,
    listLabel: "Órdenes de compra por pagar",
  },
  pay_expense: {
    title: "Gastos por pagar",
    icon: <TrendingDown className="h-5 w-5" />,
    listLabel: "Gastos por pagar",
  },
};

export default function PayPendingItemModal({
  open,
  type,
  onClose,
  cashRegisterId,
  paymentMethods,
  onContinueOrder,
  onCancelOrder,
}: PayPendingItemModalProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [viewDetailId, setViewDetailId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState<string>(
    paymentMethods[0]?.id ?? "",
  );
  const [notes, setNotes] = useState("");

  const activeMethods = useMemo(
    () => paymentMethods.filter((m) => m.is_active && m.is_pos_enabled !== false),
    [paymentMethods],
  );

  const isCollect = type === "collect";

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["pending-orders-for-pos", type, selectedClient?.id],
    queryFn: async () => {
      if (type === "collect") {
        if (!selectedClient) return [];
        return fetchPendingOrdersByClient(String(selectedClient.id)) as Promise<Order[]>;
      }
      if (type === "pay_account") {
        const data = await fetchOrders({
          order_type: "SALE",
          payment_status: ["PENDING", "PARTIAL"],
          page_size: 50,
        });
        return (data.results ?? []) as Order[];
      }
      if (type === "pay_order") {
        const data = await fetchOrders({
          order_type: "ORDER",
          status: ["PENDING", "IN_PROGRESS"],
          page_size: 50,
        });
        return (data.results ?? []) as Order[];
      }
      return [];
    },
    enabled: open && (type === "pay_account" || type === "pay_order" || (type === "collect" && !!selectedClient)),
  });

  const { data: purchaseOrdersData, isLoading: loadingPurchaseOrders } = useQuery({
    queryKey: ["pending-purchase-orders-for-pos"],
    queryFn: () =>
      fetchPurchaseOrders({ status: "SENT", payment_status: "PENDING", page_size: 50 }),
    enabled: open && type === "pay_purchase_order",
  });
  const purchaseOrders = (purchaseOrdersData?.results ?? []) as PurchaseOrder[];

  const { data: expensesData, isLoading: loadingExpenses } = useQuery({
    queryKey: ["pending-expenses-for-pos"],
    queryFn: () => fetchExpenses({ status: "ACTIVE", page_size: 50 }),
    enabled: open && type === "pay_expense",
  });
  const expenses = ((expensesData?.results ?? []) as FixedExpense[]).filter(
    (e) => toNum(e.amount) - toNum(e.total_paid) > 0,
  );

  const { data: customerResults = [], isLoading: searchingCustomers } = useQuery({
    queryKey: ["customers", "search", clientQuery],
    queryFn: () => searchCustomers(clientQuery),
    enabled: isCollect && open && clientQuery.trim().length >= 1,
  });

  const { data: orderDetail, isLoading: loadingOrderDetail } = useQuery({
    queryKey: ["order", "detail", viewDetailId],
    queryFn: () => fetchOrder(viewDetailId as string) as Promise<Order>,
    enabled:
      Boolean(viewDetailId) && type !== "pay_purchase_order" && type !== "pay_expense",
    staleTime: 30_000,
  });

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    if (type === "pay_purchase_order") {
      return purchaseOrders.find((o) => o.id === selectedItemId) ?? null;
    }
    if (type === "pay_expense") {
      return expenses.find((e) => e.id === selectedItemId) ?? null;
    }
    return orders.find((o) => o.id === selectedItemId) ?? null;
  }, [selectedItemId, type, purchaseOrders, expenses, orders]);

  const remainingAmount = useMemo(() => {
    if (!selectedItem) return 0;
    if (type === "pay_purchase_order") {
      return toNum((selectedItem as PurchaseOrder).remaining_amount);
    }
    if (type === "pay_expense") {
      const e = selectedItem as FixedExpense;
      return toNum(e.amount) - toNum(e.total_paid);
    }
    const o = selectedItem as Order;
    return toNum(o.total_amount) - toNum(o.paid_amount);
  }, [selectedItem, type]);

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) throw new Error("Selecciona un ítem");
      if (!paymentMethodId) throw new Error("Selecciona un método de pago");
      const payload = {
        payment_method_id: paymentMethodId,
        amount: toDecimal(amount),
        cash_register_id: cashRegisterId,
        notes: notes || null,
      };
      if (type === "pay_purchase_order") {
        return payPurchaseOrder(selectedItem.id, payload);
      }
      if (type === "pay_expense") {
        return payExpense(selectedItem.id, payload);
      }
      return payOrder(selectedItem.id, payload);
    },
    onSuccess: () => {
      toast.success("Pago registrado");
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo registrar el pago");
    },
  });

  const deliverMutation = useMutation({
    mutationFn: (orderId: string) => deliverOrder(orderId),
    onSuccess: () => {
      toast.success("Pedido marcado como entregado");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["pending-orders-for-pos"] });
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo marcar como entregado");
    },
  });

  function handleClose() {
    setClientQuery("");
    setSelectedClient(null);
    setSelectedItemId(null);
    setViewDetailId(null);
    setAmount("");
    setNotes("");
    setPaymentMethodId(activeMethods[0]?.id ?? "");
    onClose();
  }

  function handleContinueOrder(order: Order) {
    onContinueOrder?.(order);
    handleClose();
  }

  function handleCancelOrder(order: Order) {
    if (window.confirm("¿Anular esta cuenta?")) {
      onCancelOrder?.(order);
      handleClose();
    }
  }

  function handleSelectItem(id: string) {
    setSelectedItemId(id);
    const item =
      type === "pay_purchase_order"
        ? purchaseOrders.find((o) => o.id === id)
        : type === "pay_expense"
          ? expenses.find((e) => e.id === id)
          : orders.find((o) => o.id === id);
    if (!item) return;
    let remaining = 0;
    if (type === "pay_purchase_order") {
      remaining = toNum((item as PurchaseOrder).remaining_amount);
    } else if (type === "pay_expense") {
      remaining = toNum((item as FixedExpense).amount) - toNum((item as FixedExpense).total_paid);
    } else {
      remaining = toNum((item as Order).total_amount) - toNum((item as Order).paid_amount);
    }
    setAmount(remaining ? Math.round(remaining).toString() : "");
    setNotes(
      type === "pay_purchase_order"
        ? `Pago OC ${(item as PurchaseOrder).order_number}`
        : type === "pay_expense"
          ? `Pago ${(item as FixedExpense).name}`
          : `Pago ${(item as Order).order_number ?? (item as Order).id.slice(0, 8)}`,
    );
  }

  const cfg = TYPE_CONFIG[type];

  const showOrderActions = type === "pay_account" || type === "pay_order";

  function renderItemList() {
    if (type === "pay_purchase_order") {
      if (loadingPurchaseOrders) return <p className="text-sm text-muted-foreground">Cargando...</p>;
      if (purchaseOrders.length === 0) return <p className="text-sm text-muted-foreground">No hay órdenes de compra pendientes.</p>;
      return (
        <div className="flex flex-col gap-2">
          {purchaseOrders.map((o) => (
            <div
              key={o.id}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors",
                selectedItemId === o.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted",
              )}
            >
              <button
                type="button"
                onClick={() => handleSelectItem(o.id)}
                className="flex flex-1 items-center justify-between text-left"
              >
                <span className="font-medium">{o.order_number}</span>
                <span className="text-xs text-muted-foreground">
                  {formatCLP(toNum(o.remaining_amount))}
                </span>
              </button>
              <a
                href={`/purchase-orders/${o.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted"
                aria-label="Ver orden de compra"
                title="Ver orden de compra"
                onClick={(e) => e.stopPropagation()}
              >
                <Eye className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}
        </div>
      );
    }

    if (type === "pay_expense") {
      if (loadingExpenses) return <p className="text-sm text-muted-foreground">Cargando...</p>;
      if (expenses.length === 0) return <p className="text-sm text-muted-foreground">No hay gastos pendientes.</p>;
      return (
        <div className="flex flex-col gap-2">
          {expenses.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => handleSelectItem(e.id)}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                selectedItemId === e.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted",
              )}
            >
              <span className="font-medium">{e.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatCLP(toNum(e.amount) - toNum(e.total_paid))}
              </span>
            </button>
          ))}
        </div>
      );
    }

    if (loadingOrders) return <p className="text-sm text-muted-foreground">Cargando...</p>;
    if (orders.length === 0) return <p className="text-sm text-muted-foreground">No hay órdenes pendientes.</p>;
    if (isCollect) {
      return (
        <div className="flex flex-col gap-2">
          {orders.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => handleSelectItem(o.id)}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                selectedItemId === o.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted",
              )}
            >
              <span className="font-medium">{o.order_number ?? o.id.slice(0, 8)}</span>
              <span className="text-xs text-muted-foreground">
                {formatCLP(toNum(o.total_amount) - toNum(o.paid_amount))}
              </span>
            </button>
          ))}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 gap-3">
        {orders.map((o) => {
          const isPayOrder = type === "pay_order";
          const remaining = isPayOrder
            ? toNum(o.total_amount)
            : toNum(o.total_amount) - toNum(o.paid_amount);
          const isExpanded = viewDetailId === o.id;
          const detailOrder = (isExpanded ? orderDetail : null) ?? o;
          const isDetailLoading = loadingOrderDetail && isExpanded;
          return (
            <div
              key={o.id}
              className={cn(
                "rounded-xl border border-border bg-card p-3 shadow-sm transition-colors",
                selectedItemId === o.id && "border-primary bg-primary/5",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {o.order_number ?? o.id.slice(0, 8)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.client?.name ?? "Sin cliente"}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums">
                  {formatCLP(remaining)}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {isPayOrder
                  ? (o.delivery_address ?? "Retiro en local")
                  : (o.observation ?? "Sin notas")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {shortDate(o.date)}
                {" · "}
                {isPayOrder
                  ? deliveryStatusLabel(o.delivery_status)
                  : paymentStatusLabel(o.payment_status)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => handleSelectItem(o.id)}>
                  {isPayOrder ? "Ver" : "Pagar"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setViewDetailId(isExpanded ? null : o.id)}
                >
                  {isExpanded ? "Cerrar" : "Ver detalle"}
                </Button>
                {isPayOrder && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deliverMutation.mutate(o.id)}
                    isLoading={deliverMutation.isPending}
                  >
                    Entregar
                  </Button>
                )}
                {!isPayOrder && showOrderActions && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleContinueOrder(o)}
                      title="Continuar agregando"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelOrder(o)}
                      title="Anular"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>

              {isExpanded && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">Detalle de la orden</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setViewDetailId(null)}
                    >
                      Cerrar
                    </Button>
                  </div>
                  {isDetailLoading ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando detalle...
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <div>
                          <span className="text-muted-foreground">Total:</span>{" "}
                          <span className="font-medium">
                            {formatCLP(Number(detailOrder.total_amount ?? 0))}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pagado:</span>{" "}
                          <span className="font-medium">
                            {formatCLP(Number(detailOrder.paid_amount ?? 0))}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pago:</span>{" "}
                          <span
                            className={cn(
                              "font-medium",
                              paymentStatusClass(detailOrder.payment_status),
                            )}
                          >
                            {paymentStatusLabel(detailOrder.payment_status)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Entrega:</span>{" "}
                          <span
                            className={cn(
                              "font-medium",
                              deliveryStatusClass(detailOrder.delivery_status),
                            )}
                          >
                            {deliveryStatusLabel(detailOrder.delivery_status)}
                          </span>
                        </div>
                      </div>
                      {detailOrder.delivery_address && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Dirección:</span>{" "}
                          {detailOrder.delivery_address}
                        </p>
                      )}
                      {(detailOrder.products ?? []).length > 0 && (
                        <div className="rounded-lg border border-border bg-background p-2">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            Productos
                          </p>
                          <ul className="space-y-1">
                            {(detailOrder.products ?? []).map((p) => (
                              <li
                                key={p.id}
                                className="flex items-center justify-between gap-2 text-xs"
                              >
                                <span className="truncate">
                                  {p.quantity ?? 0} × {p.product_name}
                                </span>
                                <span className="shrink-0 tabular-nums">
                                  {formatCLP(p.total_price ?? 0)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {detailOrder.observation && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Notas:</span>{" "}
                          {detailOrder.observation}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title={cfg.title} size="lg">
      <ModalBody>
        <div className="flex flex-col gap-4">
          {isCollect && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">Buscar cliente</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={clientQuery}
                  onChange={(e) => {
                    setClientQuery(e.target.value);
                    if (selectedClient) {
                      setSelectedClient(null);
                      setSelectedItemId(null);
                    }
                  }}
                  placeholder="Nombre, RUT, teléfono o email"
                  className="pl-9"
                />
              </div>
              {searchingCustomers && (
                <p className="text-xs text-muted-foreground">Buscando clientes...</p>
              )}
              {selectedClient ? (
                <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                  <span className="font-medium">{selectedClient.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClient(null);
                      setSelectedItemId(null);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedClient(c);
                        setClientQuery("");
                      }}
                      className="rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {c.dni ?? c.phone_number ?? c.email}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">{cfg.listLabel}</label>
            <div className="max-h-[24rem] overflow-y-auto rounded-lg border border-border p-2 sm:max-h-[28rem]">
              {renderItemList()}
            </div>
          </div>

          {selectedItem && (
            <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              {type === "pay_order" ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Orden</span>
                    <span className="font-semibold">
                      {(selectedItem as Order).order_number ?? (selectedItem as Order).id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Cliente</span>
                    <span className="font-medium">{(selectedItem as Order).client?.name ?? "Sin cliente"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold">{formatCLP(Number((selectedItem as Order).total_amount || 0))}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Estado de entrega</span>
                    <span className={cn("font-medium", deliveryStatusClass((selectedItem as Order).delivery_status))}>
                      {deliveryStatusLabel((selectedItem as Order).delivery_status)}
                    </span>
                  </div>
                  {(selectedItem as Order).delivery_address && (
                    <div className="flex flex-col gap-0.5 text-sm">
                      <span className="text-muted-foreground">Dirección de entrega</span>
                      <span className="font-medium">{(selectedItem as Order).delivery_address}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleContinueOrder(selectedItem as Order)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                      title="Ver"
                      aria-label="Ver"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deliverMutation.mutate((selectedItem as Order).id)}
                      disabled={deliverMutation.isPending}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-emerald-600 disabled:opacity-50"
                      title="Entregar"
                      aria-label="Entregar"
                    >
                      {deliverMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Saldo pendiente</span>
                    <span className="font-semibold">{formatCLP(remainingAmount)}</span>
                  </div>
                  {showOrderActions && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleContinueOrder(selectedItem as Order)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                        title="Continuar agregando"
                        aria-label="Continuar agregando"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancelOrder(selectedItem as Order)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-rose-600"
                        title="Anular"
                        aria-label="Anular"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted-foreground">Monto</label>
                      <Input
                        value={amount ? formatCLP(parseFloat(toDecimal(amount))) : ""}
                        onChange={(e) => setAmount(numberValue(e.target.value))}
                        placeholder="Monto"
                        className="tabular-nums"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted-foreground">Método de pago</label>
                      <Select
                        value={paymentMethodId}
                        onChange={(e) => setPaymentMethodId(e.target.value)}
                        options={activeMethods.map((m) => ({
                          value: m.id,
                          label: m.name,
                        }))}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">Notas / referencia</label>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={handleClose}>
          Cancelar
        </Button>
        {type === "pay_order" ? (
          <Button
            onClick={() => deliverMutation.mutate((selectedItem as Order).id)}
            disabled={!selectedItem || deliverMutation.isPending}
            isLoading={deliverMutation.isPending}
          >
            Entregar
          </Button>
        ) : (
          <Button
            onClick={() => payMutation.mutate()}
            disabled={
              !selectedItem ||
              !amount ||
              !paymentMethodId ||
              payMutation.isPending ||
              parseFloat(toDecimal(amount)) > remainingAmount + 0.01
            }
            isLoading={payMutation.isPending}
          >
            Registrar pago
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
