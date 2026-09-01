"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Receipt,
  UserSearch,
  Truck,
  Loader2,
  Eye,
  Trash2,
  Check,
  Banknote,
  Calendar,
  User,
  AlertTriangle,
  CreditCard,
  DollarSign,
  Package,
  FileText,
  MapPin,
  XCircle,
  ClipboardList,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ModalBody, ModalFooter } from "@/components/ui/modal";
import { fetchOrders, fetchOrder, payOrder, fetchPendingOrdersByClient, deliverOrder } from "@/lib/api/orders";
import { fetchPurchaseOrders, payPurchaseOrder } from "@/lib/api/suppliers";
import { searchCustomers } from "@/lib/api/customers";
import { formatCLP, cn } from "@/lib/utils";
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
  delivery_address?: string | null;
  delivery_status?: string | null;
};

type PurchaseOrder = {
  id: string;
  order_number?: string | null;
  remaining_amount?: string | number | null;
  supplier_name?: string | null;
  total_amount?: string | number | null;
  payment_status?: string | null;
  payment_status_display?: string | null;
  status_display?: string | null;
  order_date?: string | null;
  items_count?: string | number | null;
  branch_name?: string | null;
  [key: string]: unknown;
};

type PaymentMethod = {
  id: string;
  name: string;
  is_active: boolean;
  is_pos_enabled?: boolean;
};

type Customer = YggdraSchemas["Client"];

function effectivePaymentStatus(
  status?: string | null,
  paid?: string | number | null,
  total?: string | number | null,
): string | null | undefined {
  const paidNum = toNum(paid);
  const totalNum = toNum(total);
  const s = status?.toUpperCase();

  // Sin pagos registrados: nunca es parcial.
  if (paidNum <= 0) {
    if (s === "PARTIAL") return "PENDING";
    return status;
  }

  // Pagado al 100%: mostrar como pagado aunque el backend diga parcial.
  if (totalNum > 0 && paidNum >= totalNum) {
    if (s === "PARTIAL" || s === "PENDING") return "PAID";
    return status;
  }

  // Hay algún pago pero no cubre el total: parcial real.
  if (paidNum > 0 && paidNum < totalNum) {
    return "PARTIAL";
  }

  return status;
}

function paymentStatusLabel(status?: string | null): string {
  switch (status?.toUpperCase()) {
    case "PAID":
    case "COMPLETED":
      return "Pagado";
    case "PARTIAL":
      return "Parcial";
    case "PENDING":
      return "Por pagar";
    default:
      return status ?? "—";
  }
}

function paymentStatusDescription(
  status?: string | null,
  remaining?: number,
): string {
  const s = status?.toUpperCase();
  const debtText = remaining && remaining > 0 ? ` · Adeuda ${formatCLP(remaining)}` : "";
  if (s === "PAID" || s === "COMPLETED") {
    return debtText ? `Pagado${debtText}` : "Pagado · Sin deuda";
  }
  if (s === "PARTIAL") return `Pago parcial${debtText || " · Adeuda 0"}`;
  if (s === "PENDING") return `Por pagar${debtText || " · Adeuda 0"}`;
  return status ?? "—";
}

function deliveryStatusLabel(status?: string | null): string {
  switch (status?.toUpperCase()) {
    case "DELIVERED":
    case "COMPLETED":
      return "Entregado";
    case "IN_PROGRESS":
    case "PREPARING":
      return "En preparación";
    case "PENDING":
      return "Pendiente";
    default:
      return status ?? "—";
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

function paymentStatusBadgeClass(status?: string | null) {
  switch (status?.toUpperCase()) {
    case "PAID":
    case "COMPLETED":
      return "bg-emerald-500/10 text-emerald-700";
    case "PARTIAL":
      return "bg-violet-500/10 text-violet-700";
    case "PENDING":
    default:
      return "bg-amber-500/10 text-amber-700";
  }
}

function deliveryStatusBadgeClass(status?: string | null) {
  switch (status?.toUpperCase()) {
    case "DELIVERED":
    case "COMPLETED":
      return "bg-emerald-500/10 text-emerald-700";
    case "IN_PROGRESS":
    case "PREPARING":
      return "bg-blue-500/10 text-blue-700";
    case "PENDING":
    default:
      return "bg-amber-500/10 text-amber-700";
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

function LoadingState({ message = "Cargando..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="max-w-[16rem] text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
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
    title: "Cuentas",
    icon: <Receipt className="h-5 w-5" />,
    listLabel: "Cuentas",
  },
  pay_order: {
    title: "Órdenes",
    icon: <Truck className="h-5 w-5" />,
    listLabel: "Órdenes",
  },
  collect: {
    title: "Cobrar por cliente",
    icon: <UserSearch className="h-5 w-5" />,
    listLabel: "Órdenes del cliente",
  },
  pay_purchase_order: {
    title: "Órdenes de compra",
    icon: <Truck className="h-5 w-5" />,
    listLabel: "Órdenes de compra",
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [confirmCancelItem, setConfirmCancelItem] = useState<Order | null>(null);
  const [clientFilter, setClientFilter] = useState<{ id: number; name: string } | null>(null);
  const [clientFilterQuery, setClientFilterQuery] = useState("");
  const [deliveringOrderId, setDeliveringOrderId] = useState<string | null>(null);
  const [orderQuery, setOrderQuery] = useState("");

  const activeMethods = useMemo(
    () => paymentMethods.filter((m) => m.is_active && m.is_pos_enabled !== false),
    [paymentMethods],
  );

  const isCollect = type === "collect";
  const [payingAll, setPayingAll] = useState(false);

  const { data: allPendingAccounts = [], isLoading: loadingAllPending } = useQuery({
    queryKey: ["all-pending-accounts-for-collect", dateFrom, dateTo],
    queryFn: async () => {
      const data = await fetchOrders({ order_type: "SALE", payment_status: ["PENDING", "PARTIAL"], start_date: dateFrom || undefined, end_date: dateTo || undefined, page_size: 100 });
      return (data.results ?? []) as Order[];
    },
    enabled: open && type === "collect",
    staleTime: 30_000,
  });

  const clientsWithTotals = useMemo(() => {
    const map = new Map<number, { client: Order["client"]; totalPending: number; orders: Order[] }>();
    for (const o of allPendingAccounts) {
      const cid = (o.client as unknown as { id?: number })?.id;
      if (!cid) continue;
      const entry = map.get(cid) ?? { client: o.client, totalPending: 0, orders: [] };
      entry.totalPending += toNum(o.total_amount) - toNum(o.paid_amount);
      entry.orders.push(o);
      map.set(cid, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.totalPending - a.totalPending);
  }, [allPendingAccounts]);

  const filteredClientsWithTotals = useMemo(() => {
    if (!clientQuery.trim()) return clientsWithTotals;
    const q = clientQuery.toLowerCase();
    return clientsWithTotals.filter((c) => (c.client?.name ?? "").toLowerCase().includes(q));
  }, [clientsWithTotals, clientQuery]);

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["pending-orders-for-pos", type, selectedClient?.id, clientFilter?.id, dateFrom, dateTo],
    queryFn: async () => {
      if (type === "collect") {
        if (!selectedClient) return [];
        return fetchPendingOrdersByClient(String(selectedClient.id)) as Promise<Order[]>;
      }
      if (type === "pay_account") {
        const data = await fetchOrders({
          order_type: "SALE",
          payment_status: ["PENDING", "PARTIAL"],
          client__in: clientFilter ? String(clientFilter.id) : undefined,
          start_date: dateFrom || undefined,
          end_date: dateTo || undefined,
          page_size: 50,
        });
        return (data.results ?? []) as Order[];
      }
      if (type === "pay_order") {
        const [byPayment, byDelivery] = await Promise.all([
          fetchOrders({ order_type: "ORDER", payment_status: ["PENDING", "PARTIAL"], start_date: dateFrom || undefined, end_date: dateTo || undefined, page_size: 50 }),
          fetchOrders({ order_type: "ORDER", status: ["PENDING", "IN_PROGRESS"], start_date: dateFrom || undefined, end_date: dateTo || undefined, page_size: 50 }),
        ]);
        const map = new Map<string, Order>();
        for (const o of [...(byPayment.results ?? []), ...(byDelivery.results ?? [])] as Order[]) {
          map.set(o.id, o);
        }
        const filtered = Array.from(map.values()).filter(
          (o) =>
            ["PENDING", "PARTIAL"].includes(o.payment_status ?? "") ||
            ["PENDING", "IN_PROGRESS"].includes(o.status ?? ""),
        );
        return filtered;
      }
      return [];
    },
    enabled: open && (type === "pay_account" || type === "pay_order" || (type === "collect" && !!selectedClient)),
  });

  const { data: purchaseOrdersData, isLoading: loadingPurchaseOrders } = useQuery({
    queryKey: ["pending-purchase-orders-for-pos", dateFrom, dateTo],
    queryFn: () =>
      fetchPurchaseOrders({ status: "SENT", payment_status: "PENDING", start_date: dateFrom || undefined, end_date: dateTo || undefined, page_size: 50 }),
    enabled: open && type === "pay_purchase_order",
  });
  const purchaseOrders = (purchaseOrdersData?.results ?? []) as PurchaseOrder[];

  const { data: customerResults = [], isLoading: searchingCustomers } = useQuery({
    queryKey: ["customers", "search", clientQuery],
    queryFn: () => searchCustomers(clientQuery),
    enabled: isCollect && open && clientQuery.trim().length >= 1,
  });

  const { data: filterCustomerResults = [], isLoading: searchingFilterCustomers } = useQuery({
    queryKey: ["customers", "search-filter", clientFilterQuery],
    queryFn: () => searchCustomers(clientFilterQuery),
    enabled: type === "pay_account" && open && clientFilterQuery.trim().length >= 1,
  });

  const { data: orderDetail, isLoading: loadingOrderDetail } = useQuery({
    queryKey: ["order", "detail", viewDetailId],
    queryFn: () => fetchOrder(viewDetailId as string) as Promise<Order>,
    enabled:
      Boolean(viewDetailId) && type !== "pay_purchase_order",
    staleTime: 30_000,
  });

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    if (type === "pay_purchase_order") {
      return purchaseOrders.find((o) => o.id === selectedItemId) ?? null;
    }
    return orders.find((o) => o.id === selectedItemId) ?? null;
  }, [selectedItemId, type, purchaseOrders, orders]);

  const filteredOrders = useMemo(() => {
    if (!orderQuery.trim()) return orders;
    const q = orderQuery.toLowerCase().trim();
    return orders.filter((o) => {
      const client = o.client as unknown as { name?: string | null; dni?: string | null; phone_number?: string | null; email?: string | null } | null;
      const orderNumber = (o.order_number ?? "").toLowerCase();
      const clientName = (client?.name ?? "").toLowerCase();
      const dni = (client?.dni ?? "").toLowerCase();
      const phone = (client?.phone_number ?? "").toLowerCase();
      const email = (client?.email ?? "").toLowerCase();
      const address = (o.delivery_address ?? "").toLowerCase();
      return (
        orderNumber.includes(q) ||
        clientName.includes(q) ||
        dni.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        address.includes(q)
      );
    });
  }, [orders, orderQuery]);

  const remainingAmount = useMemo(() => {
    if (!selectedItem) return 0;
    if (type === "pay_purchase_order") {
      return toNum((selectedItem as PurchaseOrder).remaining_amount);
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
      return payOrder(selectedItem.id, payload);
    },
    onSuccess: () => {
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo registrar el pago");
    },
  });

  const deliverMutation = useMutation({
    mutationFn: (orderId: string) => deliverOrder(orderId),
    onMutate: (orderId: string) => {
      setDeliveringOrderId(orderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["pending-orders-for-pos"] });
    },
    onSettled: () => {
      setDeliveringOrderId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo marcar como entregado");
    },
  });

  function handleClose() {
    setClientQuery("");
    setSelectedClient(null);
    setClientFilter(null);
    setClientFilterQuery("");
    setSelectedItemId(null);
    setViewDetailId(null);
    setAmount("");
    setNotes("");
    setPaymentMethodId(activeMethods[0]?.id ?? "");
    setPayingAll(false);
    onClose();
  }

  function handleContinueOrder(order: Order) {
    onContinueOrder?.(order);
    handleClose();
  }

  function handleCancelOrder(order: Order) {
    setConfirmCancelItem(order);
  }

  function confirmCancelOrder() {
    if (confirmCancelItem) {
      onCancelOrder?.(confirmCancelItem);
      setConfirmCancelItem(null);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["pending-orders-for-pos"] });
      queryClient.invalidateQueries({ queryKey: ["all-pending-accounts-for-collect"] });
    }
  }

  function handleSelectItem(id: string) {
    setSelectedItemId(id);
    const item =
      type === "pay_purchase_order"
        ? purchaseOrders.find((o) => o.id === id)
        : orders.find((o) => o.id === id);
    if (!item) return;
    let remaining = 0;
    if (type === "pay_purchase_order") {
      remaining = toNum((item as PurchaseOrder).remaining_amount);
    } else {
      remaining = toNum((item as Order).total_amount) - toNum((item as Order).paid_amount);
    }
    setAmount(remaining ? Math.round(remaining).toString() : "");
    setNotes(
      type === "pay_purchase_order"
        ? `Pago OC ${(item as PurchaseOrder).order_number}`
        : `Pago ${(item as Order).order_number ?? (item as Order).id.slice(0, 8)}`,
    );
  }

  async function handlePayAll() {
    if (!selectedClient || orders.length === 0) return;
    if (!paymentMethodId) {
      toast.error("Selecciona un método de pago");
      return;
    }
    if (!cashRegisterId) {
      toast.error("No hay caja abierta");
      return;
    }
    setPayingAll(true);
    let success = 0;
    let failed = 0;
    for (const o of orders) {
      const remaining = toNum(o.total_amount) - toNum(o.paid_amount);
      if (remaining <= 0) continue;
      try {
        await payOrder(o.id, {
          payment_method_id: paymentMethodId,
          amount: toDecimal(remaining.toString()),
          cash_register_id: cashRegisterId,
          notes: notes || `Pago ${o.order_number ?? o.id.slice(0, 8)}`,
        });
        success++;
      } catch {
        failed++;
      }
    }
    setPayingAll(false);
    if (success > 0) {
      toast.success(`${success} pago(s) registrado(s)${failed ? `, ${failed} fallaron` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["pending-orders-for-pos"] });
      queryClient.invalidateQueries({ queryKey: ["all-pending-accounts-for-collect"] });
      handleClose();
    } else if (failed > 0) {
      toast.error("No se pudo registrar ningún pago");
    }
  }

  const cfg = TYPE_CONFIG[type];

  const showOrderActions = type === "pay_account" || type === "pay_order";

  function renderItemList() {
    if (type === "pay_purchase_order") {
      if (loadingPurchaseOrders) return <LoadingState message="Cargando órdenes de compra..." />;
      if (purchaseOrders.length === 0) return (
        <EmptyState
          icon={Truck}
          title="No hay órdenes de compra"
          description="Ajusta el rango de fechas si esperas ver más resultados."
        />
      );
      return (
        <div className="flex flex-col gap-3">
          {purchaseOrders.map((o) => (
            <div
              key={o.id}
              className={cn(
                "rounded-xl border p-3 shadow-sm hover:shadow-md transition-shadow",
                selectedItemId === o.id
                  ? "border-primary bg-primary/10"
                  : "border-border/60 bg-card",
              )}
            >
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{o.order_number ?? o.id.slice(0, 8)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.supplier_name ?? "Sin proveedor"} · {shortDate(o.order_date)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {o.status_display ?? o.payment_status_display ?? ""}{" "}
                    {o.items_count ? `· ${o.items_count} ítems` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{formatCLP(toNum(o.remaining_amount))}</p>
                  <p className="text-xs text-muted-foreground">de {formatCLP(toNum(o.total_amount))}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => handleSelectItem(o.id)}>
                  Pagar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewDetailId(viewDetailId === o.id ? null : o.id)}
                >
                  {viewDetailId === o.id ? "Cerrar" : "Ver detalle"}
                </Button>
                <a
                  href={`/purchase-orders/${o.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted"
                  aria-label="Ver orden de compra"
                  title="Ver orden de compra"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Eye className="h-3.5 w-3.5" />
                </a>
              </div>
              {viewDetailId === o.id && (
                <div className="mt-3 rounded-lg bg-muted/30 p-3 text-xs">
                  <p>
                    <span className="font-medium">Proveedor:</span> {o.supplier_name ?? "-"}
                  </p>
                  <p>
                    <span className="font-medium">Total:</span> {formatCLP(toNum(o.total_amount))} ·{" "}
                    <span className="font-medium">Pendiente:</span> {formatCLP(toNum(o.remaining_amount))}
                  </p>
                  <p>
                    <span className="font-medium">Estado:</span> {o.status_display ?? "-"} ·{" "}
                    {o.payment_status_display ?? o.payment_status ?? "-"}
                  </p>
                  <p>
                    <span className="font-medium">Fecha:</span> {shortDate(o.order_date)}
                  </p>
                  <p>
                    <span className="font-medium">Sucursal:</span> {o.branch_name ?? "-"}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (isCollect) {
      if (!selectedClient) {
        if (loadingAllPending) return <LoadingState message="Cargando clientes..." />;
        if (filteredClientsWithTotals.length === 0) {
          if (clientsWithTotals.length === 0) {
            return (
              <EmptyState
                icon={UserSearch}
                title="No hay clientes con cuentas pendientes"
                description="Ajusta el rango de fechas si esperas ver más resultados."
              />
            );
          }
          return (
            <EmptyState
              icon={Search}
              title="No se encontraron clientes"
              description="Prueba con otro nombre, RUT, teléfono o email."
            />
          );
        }
        return (
          <div className="grid grid-cols-1 gap-2">
            {filteredClientsWithTotals.map((entry) => (
              <button
                key={String(entry.client.id)}
                type="button"
                onClick={() => {
                  setSelectedClient(entry.client as unknown as Customer);
                  setClientQuery("");
                  setSelectedItemId(null);
                  setViewDetailId(null);
                }}
                className="flex items-center justify-between rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                    {(entry.client?.name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left min-w-0">
                    <p className="truncate text-sm font-medium">{entry.client?.name ?? "Sin nombre"}</p>
                    <p className="text-xs text-muted-foreground">{entry.orders.length} cuenta(s) pendiente(s)</p>
                  </div>
                </div>
                <span className="ml-3 shrink-0 text-sm font-bold tabular-nums">{formatCLP(entry.totalPending)}</span>
              </button>
            ))}
          </div>
        );
      }
      if (loadingOrders) return <LoadingState message="Cargando cuentas..." />;
      if (orders.length === 0) return (
        <EmptyState
          icon={Receipt}
          title="No hay cuentas pendientes"
          description="Este cliente no tiene deudas en el rango seleccionado."
        />
      );
      return (
        <div className="flex flex-col gap-3">
          {/* Pagar todas deshabilitado: el pago se hace en el flujo normal del POS */}
          {false && orders.length > 1 && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={handlePayAll} disabled={payingAll || !paymentMethodId}>
                {payingAll ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Pagando...
                  </>
                ) : (
                  `Pagar todas (${orders.length})`
                )}
              </Button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3">
            {orders.map((o) => {
              const remaining = toNum(o.total_amount) - toNum(o.paid_amount);
              const isExpanded = viewDetailId === o.id;
              const detailOrder = (isExpanded ? orderDetail : null) ?? o;
              const isDetailLoading = loadingOrderDetail && isExpanded;
              return (
                <div
                  key={o.id}
                  className={cn(
                    "rounded-xl border border-border/60 bg-card p-3 shadow-sm hover:shadow-md transition-shadow",
                    selectedItemId === o.id && "border-primary bg-primary/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Receipt className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {o.order_number ?? o.id.slice(0, 8)}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            <Calendar className="h-3 w-3" /> {shortDate(o.date)}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                              paymentStatusBadgeClass(effectivePaymentStatus(o.payment_status, o.paid_amount, o.total_amount)),
                            )}
                          >
                            <DollarSign className="h-3 w-3" /> {paymentStatusLabel(effectivePaymentStatus(o.payment_status, o.paid_amount, o.total_amount))}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                              deliveryStatusBadgeClass(o.delivery_status),
                            )}
                          >
                            <Truck className="h-3 w-3" /> {deliveryStatusLabel(o.delivery_status)}
                          </span>
                        </div>
                        {o.client?.name && (
                          <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                            <User className="h-3 w-3" /> {o.client.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold tabular-nums text-amber-700">{formatCLP(remaining)}</p>
                      <p className="text-xs text-muted-foreground">de {formatCLP(toNum(o.total_amount))}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        onContinueOrder?.(o as Order);
                        handleClose();
                      }}
                      className="h-7 gap-1 px-2 text-xs"
                    >
                      <Banknote className="h-3 w-3" /> Abrir
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setViewDetailId(isExpanded ? null : o.id)}
                      className="h-7 gap-1 px-2 text-xs"
                    >
                      <Eye className="h-3 w-3" /> {isExpanded ? "Cerrar" : "Ver detalle"}
                    </Button>
                  </div>

                {isExpanded && (
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-sm font-semibold">
                        <FileText className="h-4 w-4 text-primary" /> Detalle de la orden
                      </p>
                      <Button size="sm" variant="ghost" onClick={() => setViewDetailId(null)}>
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
                          <div className="rounded-lg bg-muted/50 p-2">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <DollarSign className="h-3 w-3" /> Total
                            </span>
                            <span className="block font-medium">
                              {formatCLP(Number(detailOrder.total_amount ?? 0))}
                            </span>
                          </div>
                          <div className="rounded-lg bg-muted/50 p-2">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Check className="h-3 w-3" /> Pagado
                            </span>
                            <span className="block font-medium">
                              {formatCLP(Number(detailOrder.paid_amount ?? 0))}
                            </span>
                          </div>
                          <div className="rounded-lg bg-muted/50 p-2">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Banknote className="h-3 w-3" /> Pago
                            </span>
                            <span
                              className={cn(
                                "block font-medium",
                                paymentStatusClass(effectivePaymentStatus(detailOrder.payment_status, detailOrder.paid_amount, detailOrder.total_amount)),
                              )}
                            >
                              {paymentStatusLabel(effectivePaymentStatus(detailOrder.payment_status, detailOrder.paid_amount, detailOrder.total_amount))}
                            </span>
                          </div>
                          <div className="rounded-lg bg-muted/50 p-2">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Truck className="h-3 w-3" /> Entrega
                            </span>
                            <span
                              className={cn(
                                "block font-medium",
                                deliveryStatusClass(detailOrder.delivery_status),
                              )}
                            >
                              {deliveryStatusLabel(detailOrder.delivery_status)}
                            </span>
                          </div>
                        </div>
                        {detailOrder.delivery_address && (
                          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span><span className="font-medium">Dirección:</span> {detailOrder.delivery_address}</span>
                          </p>
                        )}
                        {(detailOrder.products ?? []).length > 0 && (
                          <div className="rounded-lg border border-border bg-background p-2">
                            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                              <Package className="h-3.5 w-3.5" /> Productos
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
                            <span className="font-medium">Notas:</span> {detailOrder.observation}
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
        </div>
      );
    }
    if (loadingOrders) return <LoadingState message={type === "pay_order" ? "Cargando órdenes..." : "Cargando cuentas..."} />;
    if (filteredOrders.length === 0) return (
      <EmptyState
        icon={type === "pay_order" ? ClipboardList : Receipt}
        title={type === "pay_order" ? "No hay órdenes" : "No hay cuentas"}
        description={orderQuery.trim() ? "No coinciden con la búsqueda." : "Ajusta el rango de fechas si esperas ver más resultados."}
      />
    );
    return (
      <div className="grid grid-cols-1 gap-3">
        {filteredOrders.map((o) => {
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
                "rounded-xl border border-border/60 bg-card p-3 shadow-sm hover:shadow-md transition-shadow",
                selectedItemId === o.id && "border-primary bg-primary/5",
              )}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {isPayOrder ? <ClipboardList className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{o.order_number ?? o.id.slice(0, 8)}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <User className="h-3 w-3" /> {o.client?.name ?? "Sin cliente"}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {isPayOrder
                          ? (o.delivery_address ? `Domicilio · ${shortDate(o.date)}` : `Retiro · ${shortDate(o.date)}`)
                          : `${shortDate(o.date)}${o.observation ? ` · ${o.observation}` : ""}`}
                      </p>
                      {o.delivery_address && (
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" /> {o.delivery_address}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-base font-bold tabular-nums", isPayOrder ? "text-foreground" : "text-amber-700")}>{formatCLP(remaining)}</p>
                    {!isPayOrder && <p className="text-xs text-muted-foreground">de {formatCLP(toNum(o.total_amount))}</p>}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {isPayOrder ? (
                    <>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", paymentStatusBadgeClass(effectivePaymentStatus(o.payment_status, o.paid_amount, o.total_amount)))}>
                        <DollarSign className="h-3 w-3" /> {paymentStatusLabel(effectivePaymentStatus(o.payment_status, o.paid_amount, o.total_amount))}
                      </span>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", deliveryStatusBadgeClass(o.delivery_status))}>
                        <Check className="h-3 w-3" /> {deliveryStatusLabel(o.delivery_status)}
                      </span>
                    </>
                  ) : (
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", paymentStatusBadgeClass(effectivePaymentStatus(o.payment_status, o.paid_amount, o.total_amount)))}>
                      <DollarSign className="h-3 w-3" /> {paymentStatusDescription(effectivePaymentStatus(o.payment_status, o.paid_amount, o.total_amount), remaining)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  {isPayOrder ? (
                    <>
                      {["PENDING", "PARTIAL"].includes(o.payment_status ?? "") && (
                        <Button
                          size="sm"
                          onClick={() => {
                            onContinueOrder?.(o as Order);
                            handleClose();
                          }}
                          className="h-7 gap-1 px-2 text-xs"
                        >
                          <Banknote className="h-3 w-3" /> Abrir
                        </Button>
                      )}
                      {(["PENDING", "IN_PROGRESS"].includes(o.status ?? "") ||
                        ["PENDING", "IN_PROGRESS", "PARTIAL"].includes(o.delivery_status ?? "")) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deliverMutation.mutate(o.id)}
                          isLoading={deliveringOrderId === o.id}
                          disabled={deliveringOrderId !== null}
                          className="h-7 gap-1 px-2 text-xs"
                        >
                          <Check className="h-3 w-3" /> Entregar
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        onContinueOrder?.(o as Order);
                        handleClose();
                      }}
                      className="h-7 gap-1 px-2 text-xs"
                    >
                      <Banknote className="h-3 w-3" /> Abrir
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setViewDetailId(isExpanded ? null : o.id)}
                    className="h-7 gap-1 px-2 text-xs"
                  >
                    <Eye className="h-3 w-3" /> {isExpanded ? "Cerrar" : "Ver detalle"}
                  </Button>
                  {!isPayOrder && showOrderActions && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelOrder(o)}
                      title="Anular"
                      className="h-7 w-7 p-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <FileText className="h-4 w-4 text-primary" /> Detalle de la orden
                    </p>
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
                        <div className="rounded-lg bg-muted/50 p-2">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <DollarSign className="h-3 w-3" /> Total
                          </span>
                          <span className="block font-medium">
                            {formatCLP(Number(detailOrder.total_amount ?? 0))}
                          </span>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Check className="h-3 w-3" /> Pagado
                          </span>
                          <span className="block font-medium">
                            {formatCLP(Number(detailOrder.paid_amount ?? 0))}
                          </span>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Banknote className="h-3 w-3" /> Pago
                          </span>
                          <span
                            className={cn(
                              "block font-medium",
                              paymentStatusClass(effectivePaymentStatus(detailOrder.payment_status, detailOrder.paid_amount, detailOrder.total_amount)),
                            )}
                          >
                            {paymentStatusLabel(effectivePaymentStatus(detailOrder.payment_status, detailOrder.paid_amount, detailOrder.total_amount))}
                          </span>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Check className="h-3 w-3" /> Entrega
                          </span>
                          <span
                            className={cn(
                              "block font-medium",
                              deliveryStatusClass(detailOrder.delivery_status),
                            )}
                          >
                            {deliveryStatusLabel(detailOrder.delivery_status)}
                          </span>
                        </div>
                      </div>
                      {detailOrder.delivery_address && (
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span><span className="font-medium">Dirección:</span> {detailOrder.delivery_address}</span>
                        </p>
                      )}
                      {(detailOrder.products ?? []).length > 0 && (
                        <div className="rounded-lg border border-border bg-background p-2">
                          <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                            <Package className="h-3.5 w-3.5" /> Productos
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
    <>
      <Modal
      open={open}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {cfg.icon}
          </span>
          <span>{cfg.title}</span>
        </div>
      }
      size="lg"
    >
      <ModalBody>
        <div className="flex flex-col gap-4">
          {isCollect && (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <UserSearch className="h-3.5 w-3.5" />
                Buscar cliente
              </label>
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
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Buscando clientes...
                </p>
              )}
              {selectedClient ? (
                <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {(selectedClient.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium">{selectedClient.name ?? "Sin nombre"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClient(null);
                      setSelectedItemId(null);
                      setViewDetailId(null);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Cambiar
                  </button>
                </div>
              ) : clientsWithTotals.length > 0 ? null : (
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

          {type === "pay_account" && (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <UserSearch className="h-3.5 w-3.5" />
                Filtrar por cliente
              </label>
              {clientFilter ? (
                <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {clientFilter.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium">{clientFilter.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setClientFilter(null);
                      setClientFilterQuery("");
                      setSelectedItemId(null);
                      setViewDetailId(null);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={clientFilterQuery}
                      onChange={(e) => setClientFilterQuery(e.target.value)}
                      placeholder="Nombre, RUT, teléfono o email"
                      className="pl-9"
                    />
                  </div>
                  {searchingFilterCustomers && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Buscando clientes...
                    </p>
                  )}
                  {clientFilterQuery.trim().length >= 1 && !searchingFilterCustomers && (
                    <div className="flex flex-col gap-1">
                      {filterCustomerResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setClientFilter({ id: Number(c.id), name: c.name ?? "Sin nombre" });
                            setClientFilterQuery("");
                          }}
                          className="rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {c.dni ?? c.phone_number ?? c.email}
                          </span>
                        </button>
                      ))}
                      {filterCustomerResults.length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">No se encontraron clientes.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" />
              {cfg.listLabel}
            </p>
            {type === "pay_order" && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={orderQuery}
                  onChange={(e) => setOrderQuery(e.target.value)}
                  placeholder="N° orden, cliente, RUT, teléfono, email o dirección"
                  className="pl-9 h-9 text-xs"
                />
              </div>
            )}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-1 gap-2">
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs flex-1" placeholder="Desde" />
                <span className="self-center text-xs text-muted-foreground">→</span>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs flex-1" placeholder="Hasta" />
              </div>
              {(dateFrom || dateTo || orderQuery) && (
                <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setOrderQuery(""); }} className="h-8 px-2 text-xs">Limpiar</Button>
              )}
            </div>
            <div className="flex flex-col gap-3 rounded-xl bg-muted/20 p-3 max-h-[28rem] overflow-y-auto">
              {renderItemList()}
            </div>
          </div>

          {selectedItem && (
            <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              {type === "pay_order" ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Receipt className="h-3.5 w-3.5" /> Orden
                    </span>
                    <span className="font-semibold">
                      {(selectedItem as Order).order_number ?? (selectedItem as Order).id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="h-3.5 w-3.5" /> Cliente
                    </span>
                    <span className="font-medium">{(selectedItem as Order).client?.name ?? "Sin cliente"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" /> Total
                    </span>
                    <span className="font-semibold">{formatCLP(Number((selectedItem as Order).total_amount || 0))}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Truck className="h-3.5 w-3.5" /> Estado de entrega
                    </span>
                    <span className={cn("font-medium", deliveryStatusClass((selectedItem as Order).delivery_status))}>
                      {deliveryStatusLabel((selectedItem as Order).delivery_status)}
                    </span>
                  </div>
                  {(selectedItem as Order).delivery_address && (
                    <div className="flex flex-col gap-0.5 text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" /> Dirección de entrega
                      </span>
                      <span className="font-medium">{(selectedItem as Order).delivery_address}</span>
                    </div>
                  )}
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Banknote className="h-3.5 w-3.5" /> Se abrirá la orden para pagar en el flujo normal del POS.
                  </p>
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
                      disabled={deliveringOrderId !== null}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-emerald-600 disabled:opacity-50"
                      title="Entregar"
                      aria-label="Entregar"
                    >
                      {deliveringOrderId === (selectedItem as Order).id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </>
              ) : type === "pay_purchase_order" ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" /> Saldo pendiente
                    </span>
                    <span className="font-semibold">{formatCLP(remainingAmount)}</span>
                  </div>
                  {showOrderActions && (
                    <div className="flex items-center justify-end gap-2">
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
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <DollarSign className="h-3 w-3" /> Monto
                      </label>
                      <Input
                        value={amount ? formatCLP(parseFloat(toDecimal(amount))) : ""}
                        onChange={(e) => setAmount(numberValue(e.target.value))}
                        placeholder="Monto"
                        className="tabular-nums"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <CreditCard className="h-3 w-3" /> Método de pago
                      </label>
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
                    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <FileText className="h-3 w-3" /> Notas / referencia
                    </label>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" /> Saldo pendiente
                    </span>
                    <span className="font-semibold">{formatCLP(remainingAmount)}</span>
                  </div>
                  {showOrderActions && (
                    <div className="flex items-center justify-end gap-2">
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
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Banknote className="h-3.5 w-3.5" /> Se abrirá la cuenta para pagar en el flujo normal del POS.
                  </p>
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
        {type === "pay_account" || type === "pay_order" || type === "collect" ? (
          <Button
            onClick={() => {
              if (selectedItem) {
                const order = selectedItem as Order;
                onContinueOrder?.(order);
                handleClose();
              }
            }}
            disabled={!selectedItem}
          >
            <Banknote className="mr-1.5 h-4 w-4" />
            {type === "pay_account"
              ? "Abrir cuenta"
              : type === "collect"
                ? "Abrir cuenta"
                : selectedItem && ["PENDING", "PARTIAL"].includes((selectedItem as Order).payment_status ?? "")
                  ? "Abrir orden"
                  : "Ver / Editar"}
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
            <Check className="mr-1.5 h-4 w-4" />
            Registrar pago
          </Button>
        )}
      </ModalFooter>
    </Modal>

    <Modal
      open={Boolean(confirmCancelItem)}
      onClose={() => setConfirmCancelItem(null)}
      title={
        <div className="flex items-center gap-2 text-danger">
          <AlertTriangle className="h-5 w-5" />
          <span>¿Anular cuenta?</span>
        </div>
      }
      size="sm"
    >
      <ModalBody>
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-danger/10">
            <XCircle className="h-6 w-6 text-danger" />
          </div>
          <p className="text-sm text-muted-foreground">
            ¿Confirmas que quieres anular la cuenta{" "}
            <strong className="text-foreground">
              {confirmCancelItem?.order_number ?? confirmCancelItem?.id.slice(0, 8)}
            </strong>? Esta acción no se puede deshacer.
          </p>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={() => setConfirmCancelItem(null)}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={confirmCancelOrder}>
          Anular
        </Button>
      </ModalFooter>
    </Modal>
    </>
  );
}
