"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search,
  Receipt,
  ClipboardList,
  UserSearch,
  Truck,
  TrendingDown,
  Loader2,
  Eye,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ModalBody, ModalFooter } from "@/components/ui/modal";
import { fetchOrders, payOrder, fetchPendingOrdersByClient } from "@/lib/api/orders";
import { fetchPurchaseOrders, payPurchaseOrder } from "@/lib/api/suppliers";
import { fetchExpenses, payExpense } from "@/lib/api/expenses";
import { searchCustomers } from "@/lib/api/customers";
import { formatCLP, cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import type { POSQuickActionType } from "@/lib/api/branches";
import type { YggdraSchemas } from "@/lib/api/types";

function toDecimal(v: string): string {
  return (parseInt(v || "0", 10) || 0).toFixed(2);
}

function toNum(v: string | null | undefined): number {
  return parseFloat(v || "0") || 0;
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

interface PayPendingItemModalProps {
  open: boolean;
  type: POSQuickActionType;
  onClose: () => void;
  cashRegisterId: number | string | null;
  paymentMethods: PaymentMethod[];
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
    title: "Pedidos pendientes",
    icon: <ClipboardList className="h-5 w-5" />,
    listLabel: "Pedidos pendientes",
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
}: PayPendingItemModalProps) {
  const toast = useToast();
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
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
      if (type === "pay_account" || type === "pay_order") {
        const orderType = type === "pay_account" ? "SALE" : "ORDER";
        const data = await fetchOrders({
          order_type: orderType,
          payment_status: ["PENDING", "PARTIAL"],
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

  function handleClose() {
    setClientQuery("");
    setSelectedClient(null);
    setSelectedItemId(null);
    setAmount("");
    setNotes("");
    setPaymentMethodId(activeMethods[0]?.id ?? "");
    onClose();
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
    return (
      <div className="flex flex-col gap-2">
        {orders.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => handleSelectItem(o.id)}
            className={cn(
              "flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              selectedItemId === o.id
                ? "border-primary bg-primary/10"
                : "border-border hover:bg-muted",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {o.order_number ?? o.id.slice(0, 8)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatCLP(toNum(o.total_amount) - toNum(o.paid_amount))}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{o.client?.name ?? "Sin cliente"}</span>
          </button>
        ))}
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
            <div className="max-h-48 overflow-auto rounded-lg border border-border p-2">
              {renderItemList()}
            </div>
          </div>

          {selectedItem && (
            <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Saldo pendiente</span>
                <span className="font-semibold">{formatCLP(remainingAmount)}</span>
              </div>
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
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={handleClose}>
          Cancelar
        </Button>
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
      </ModalFooter>
    </Modal>
  );
}
