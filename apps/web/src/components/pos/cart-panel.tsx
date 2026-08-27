"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  Loader2,
  Banknote,
  User,
  X,
  Search,
  Table,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  useCartStore,
  cartSubtotal,
  cartDiscountTotal,
  cartItemTotal,
  cartItemDiscount,
  cartItemSubtotal,
  type CartItem,
} from "@/lib/store/cart";
import { formatCLP, paymentTypeLabel } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import { createOrder, addItemsToOrder, cartToOrderItems } from "@/lib/api/orders";
import { fetchPaymentMethods, createPayment } from "@/lib/api/payments";
import { searchCustomers, createCustomer, type CustomerPayload } from "@/lib/api/customers";
import { getCurrentCashRegister } from "@/lib/api/cash-register";
import { occupyTable, freeTable } from "@/lib/api/tables";
import { useCurrentBranch, useIsWaiter } from "@/lib/store/session";
import {
  validateDiscountCode,
  applyDiscountToOrder,
  type ValidatedDiscount,
} from "@/lib/api/discounts";
import type { YggdraSchemas } from "@/lib/api/types";
type Customer = YggdraSchemas["Client"];
type Order = YggdraSchemas["Order"] & { order_number?: string | null };

function useDebounce(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface CartPanelProps {
  stationId?: number | string | null;
  selectedTable?: YggdraSchemas["Table"] | null;
  existingOrderId?: string | null;
  existingOrder?: Order | null;
  existingOrderLoading?: boolean;
  existingOrderError?: Error | null;
  onOrderRegistered?: (orderType?: "SALE" | "ORDER") => void;
  onPostSaleOrder?: (order: Order, items: CartItem[]) => void;
  onClose?: () => void;
  isWaiter?: boolean;
  defaultOrderType?: "SALE" | "ORDER" | "AGREEMENT";
}

export default function CartPanel({ stationId, selectedTable, existingOrderId, existingOrder, existingOrderLoading, existingOrderError, onOrderRegistered, onPostSaleOrder, onClose, isWaiter: isWaiterProp, defaultOrderType }: CartPanelProps) {
  const queryClient = useQueryClient();
  const branch = useCurrentBranch();
  const branchId = branch?.branch_id ?? null;
  const realIsWaiter = useIsWaiter();
  const isWaiter = isWaiterProp ?? realIsWaiter;
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const setItemNotes = useCartStore((s) => s.setItemNotes);
  const clear = useCartStore((s) => s.clear);

  interface PaymentLine {
    id: string;
    payment_method_id: string;
    amount: string;
    cash_received?: string;
  }

  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [showClientResults, setShowClientResults] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const clientSearchRef = useRef<HTMLDivElement>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [validatedDiscount, setValidatedDiscount] = useState<ValidatedDiscount | null>(null);

  const debouncedClientQuery = useDebounce(clientQuery, 300);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setShowClientResults(false);
      }
    }
    if (showClientResults) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showClientResults]);

  const { data: paymentMethods } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  });

  const { data: currentCashRegister } = useQuery({
    queryKey: ["cash-register", "current", stationId],
    queryFn: () => getCurrentCashRegister(stationId),
    staleTime: 30_000,
    retry: false,
    refetchInterval: 30_000,
  });

  const { data: customerResults = [], isLoading: searchingCustomers } = useQuery({
    queryKey: ["customers", "search", debouncedClientQuery, branchId],
    queryFn: () => searchCustomers(debouncedClientQuery, branchId ? Number(branchId) : undefined),
    enabled: debouncedClientQuery.trim().length >= 1,
  });

  const createCustomerMutation = useMutation({
    mutationFn: (payload: CustomerPayload) => createCustomer(payload),
    onSuccess: (customer) => {
      setSelectedClient(customer);
      setCreateModalOpen(false);
      setClientQuery("");
      setShowClientResults(false);
      toast.success("Cliente creado y seleccionado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo crear el cliente");
    },
  });

  function calculateCodeDiscount(discount: ValidatedDiscount | null, cartItems: typeof items, baseTotal: number): number {
    if (!discount?.discount) return 0;
    const d = discount.discount;
    const value = parseFloat(d.discount_value || "0");
    if (Number.isNaN(value) || value <= 0) return 0;

    if (d.apply_to === "ORDER_TOTAL" || d.apply_to === "ALL_PRODUCTS") {
      if (d.discount_type === "PERCENTAGE") {
        return Math.min(Math.round(baseTotal * (value / 100)), baseTotal);
      }
      if (d.discount_type === "FIXED_AMOUNT") {
        return Math.min(Math.round(value), baseTotal);
      }
      return 0;
    }

    if (d.apply_to === "SPECIFIC_PRODUCTS" || d.apply_to === "CATEGORY") {
      // Aproximación frontend: descuento sobre productos afectados.
      // El backend recalculará al aplicar a la orden.
      let applicableTotal = 0;
      for (const item of cartItems) {
        const productTotal = cartItemSubtotal(item);
        if (d.apply_to === "SPECIFIC_PRODUCTS") {
          // No tenemos la lista de IDs en este tipo; asumimos que aplica a todos como fallback.
          applicableTotal += productTotal;
        } else {
          applicableTotal += productTotal;
        }
      }
      if (d.discount_type === "PERCENTAGE") {
        return Math.min(Math.round(applicableTotal * (value / 100)), baseTotal);
      }
      if (d.discount_type === "FIXED_AMOUNT") {
        return Math.min(Math.round(value), baseTotal);
      }
    }
    return 0;
  }

  const existingOrderTotal = existingOrder
    ? Math.max(0, parseFloat(existingOrder.total_amount ?? "0"))
    : 0;
  const existingItemCount =
    existingOrder?.products?.reduce((sum, p) => sum + (p.quantity || 0), 0) ?? 0;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const displayItemCount = itemCount + existingItemCount;
  const cartSub = cartSubtotal(items);
  const lineDiscounts = cartDiscountTotal(items);
  const comboDiscounts = items
    .filter((i) => i.notes?.includes("Parte de combo"))
    .reduce((sum, i) => sum + cartItemDiscount(i), 0);
  const manualLineDiscounts = lineDiscounts - comboDiscounts;
  const codeDiscount = calculateCodeDiscount(validatedDiscount, items, cartSub - lineDiscounts);
  const newItemsTotal = Math.max(0, cartSub - lineDiscounts - codeDiscount);
  const subtotal = cartSub + existingOrderTotal;
  const total = newItemsTotal + existingOrderTotal;

  const paidAmount = useMemo(
    () => payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
    [payments],
  );
  const remaining = Math.max(0, total - paidAmount);
  const overpaid = Math.max(0, paidAmount - total);

  const cashPayments = payments.filter((p) => {
    const method = paymentMethods?.find((m) => m.id === p.payment_method_id);
    return method?.payment_type === "CASH";
  });
  const cashReceivedTotal = cashPayments.reduce(
    (sum, p) => sum + (parseInt(p.cash_received || "0", 10) || 0),
    0,
  );
  const cashPaidTotal = cashPayments.reduce(
    (sum, p) => sum + (parseFloat(p.amount) || 0),
    0,
  );
  const change = cashReceivedTotal > cashPaidTotal ? cashReceivedTotal - cashPaidTotal : 0;

  const cashRegisterMissing = payments.length > 0 && !currentCashRegister;

  function addPayment() {
    const firstMethod = paymentMethods?.[0];
    setPayments((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, payment_method_id: firstMethod?.id ?? "", amount: remaining.toFixed(0) },
    ]);
  }

  function removePayment(id: string) {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  }

  function updatePayment(id: string, patch: Partial<PaymentLine>) {
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function resetPayments() {
    setPayments([]);
  }

  async function handleRegister() {
    if (items.length === 0 || saving) return;
    setSaving(true);
    try {
      if (existingOrderId) {
        // Agregar ítems a una orden existente (desde mapa de mesas / drawer).
        const order = await addItemsToOrder(
          existingOrderId,
          cartToOrderItems(items),
        );
        queryClient.invalidateQueries({ queryKey: ["tables"] });
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        queryClient.invalidateQueries({ queryKey: ["products"], refetchType: "all" });
        clear();
        toast.success(`Productos agregados a orden ${order.id.slice(0, 8)}`);
        onOrderRegistered?.(existingOrder?.order_type === "ORDER" ? "ORDER" : "SALE");
        return;
      }

      // Respetar el tipo explícito del POS. Si no hay tipo definido (mesero o
      // flujo legacy), el mesero siempre genera un pedido/cuenta abierta.
      // Una venta sin pagos se guarda como SALE pending (nueva cuenta), no ORDER.
      let orderType: "SALE" | "ORDER" | "AGREEMENT";
      if (defaultOrderType) {
        orderType = defaultOrderType;
      } else {
        orderType = isWaiter ? "ORDER" : "SALE";
      }
      if ((orderType === "ORDER" || payments.length === 0) && !selectedClient) {
        toast.error("Debes seleccionar un cliente para guardar el pedido / cuenta.");
        setSaving(false);
        return;
      }
      const order = await createOrder({
        items: cartToOrderItems(items),
        client_id: selectedClient?.id ?? null,
        table_id: selectedTable?.id ?? null,
        order_type: orderType,
      });

      if (orderType === "ORDER" && selectedTable) {
        try {
          await occupyTable(selectedTable.id, { action: "occupy", order_id: order.id });
          queryClient.invalidateQueries({ queryKey: ["tables"] });
        } catch (occupyErr) {
          const message = occupyErr instanceof Error ? occupyErr.message : "";
          const isAlreadyOccupied =
            selectedTable.status === "OCCUPIED" ||
            message.toLowerCase().includes("ocupada");
          toast.warning(
            isAlreadyOccupied
              ? "La mesa ya está ocupada. Abrila desde el mapa para agregar productos."
              : `Pedido guardado, pero no se pudo ocupar la mesa: ${message}`,
          );
        }
      }

      let finalTotal = total;
      if (discountCode.trim()) {
        try {
          const discountResult = await applyDiscountToOrder(order.id, discountCode.trim(), branchId);
          finalTotal = Number((discountResult as { final_amount?: string | number }).final_amount) || total;
        } catch (discountErr) {
          toast.warning(
            discountErr instanceof Error
              ? `Venta registrada, pero el descuento falló: ${discountErr.message}`
              : "Venta registrada, pero el descuento no pudo aplicarse",
          );
        }
      }

      // Si el total cambió por el descuento, ajustar los pagos proporcionalmente para no exceder el monto final.
      const currentPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      let paymentsToProcess = payments;
      if (currentPaid > finalTotal && payments.length > 0) {
        const factor = finalTotal / currentPaid;
        paymentsToProcess = payments.map((p) => ({
          ...p,
          amount: Math.round((parseFloat(p.amount) || 0) * factor).toString(),
        }));
      }

      for (const payment of paymentsToProcess) {
        await createPayment({
          payment_method_id: payment.payment_method_id,
          order_id: order.id,
          amount: Number(payment.amount).toFixed(2),
          status: "COMPLETED",
          cash_register_id: currentCashRegister ? currentCashRegister.id : null,
        });
      }

      // Solo liberar la mesa si la venta quedó cobrada (SALE con pagos).
      // Una cuenta abierta (SALE pending u ORDER) mantiene la mesa ocupada.
      if (orderType === "SALE" && payments.length > 0 && order.table) {
        try {
          await freeTable(order.table);
          queryClient.invalidateQueries({ queryKey: ["tables"] });
        } catch {
          // Ignorar errores de liberación; la mesa puede liberarse manualmente.
        }
      }

      if (orderType === "SALE" && payments.length > 0) {
        // Venta pagada: delegar al padre el modal de comprobantes para que
        // sobreviva al cierre del drawer en móvil.
        onPostSaleOrder?.(order, [...items]);
        clear();
        resetPayments();
        setSelectedClient(null);
        setDiscountCode("");
        setValidatedDiscount(null);
        onOrderRegistered?.();
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["products"], refetchType: "all" });
      clear();
      resetPayments();
      setSelectedClient(null);
      setDiscountCode("");
      setValidatedDiscount(null);
      const actionLabel = payments.length > 0 ? "Venta registrada" : "Pedido guardado";
      toast.success(`${actionLabel} (orden ${order.id.slice(0, 8)})`);
      onOrderRegistered?.(orderType === "AGREEMENT" ? "SALE" : orderType);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar la venta");
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyDiscount() {
    const code = discountCode.trim();
    if (!code) return;
    try {
      const result = await validateDiscountCode(code, branchId, total);
      if (!result.valid || !result.discount) {
        setValidatedDiscount(null);
        toast.error(result.message || "Código de descuento inválido");
        return;
      }
      setValidatedDiscount(result);
      // Al cambiar el total por descuento, resetear pagos para que el cajero los ingrese sobre el nuevo monto.
      resetPayments();
      toast.success(`Descuento ${result.discount.name} aplicado`);
    } catch (err) {
      setValidatedDiscount(null);
      toast.error(err instanceof Error ? err.message : "Código de descuento inválido");
    }
  }

  const willBeOrder = !existingOrderId && defaultOrderType === "ORDER";
  const willBeOpenAccount = !existingOrderId && payments.length === 0;

  const canRegister = existingOrderId
    ? items.length > 0 && !saving
    : items.length > 0 &&
      !saving &&
      !cashRegisterMissing &&
      (payments.length === 0 || paidAmount >= total) &&
      ((!willBeOrder && !willBeOpenAccount) || selectedClient != null);

  const hasPendingPayment = payments.length > 0 && paidAmount < total;

  function renderClientField() {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <User className="h-3 w-3" />
          Cliente <span className="text-danger">*</span>
        </label>
        {selectedClient ? (
          <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight">{selectedClient.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {selectedClient.dni ?? selectedClient.phone_number ?? selectedClient.email ?? "Sin datos adicionales"}
              </p>
              {(selectedClient as unknown as { tags?: string[] }).tags && (
                <span className="mt-1 flex flex-wrap gap-1">
                  {(selectedClient as unknown as { tags?: string[] }).tags?.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              )}
            </div>
            <button
              onClick={() => setSelectedClient(null)}
              aria-label="Quitar cliente"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div ref={clientSearchRef} className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={clientQuery}
              onChange={(e) => {
                setClientQuery(e.target.value);
                setShowClientResults(true);
              }}
              onFocus={() => setShowClientResults(true)}
              placeholder="Nombre, RUT, teléfono, email o tag…"
              className="h-9 pl-8 pr-14 text-xs"
              aria-label="Buscar cliente"
            />
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-primary hover:underline"
            >
              + Nuevo
            </button>
            <AnimatePresence>
              {showClientResults && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg"
                >
                  {clientQuery.trim().length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      Escribe nombre, RUT, teléfono, email o tag…
                    </p>
                  ) : searchingCustomers ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Buscando…</p>
                  ) : customerResults.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No se encontraron clientes.</p>
                  ) : (
                    <>
                      {customerResults.map((c) => {
                        const clientTags = (c as unknown as { tags?: string[] }).tags ?? [];
                        const secondary = [c.dni, c.phone_number, c.email].filter(Boolean).join(" · ") || "—";
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedClient(c);
                              setClientQuery("");
                              setShowClientResults(false);
                            }}
                            className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted"
                          >
                            <span className="text-sm font-medium">{c.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {secondary}
                            </span>
                            {clientTags.length > 0 && (
                              <span className="flex flex-wrap gap-1">
                                {clientTags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">
            {(() => {
              if (existingOrderId && existingOrder) {
                if (existingOrder.order_type === "ORDER") return `Editando orden #${existingOrder.order_number ?? ""}`;
                if (existingOrder.order_type === "SALE" && !existingOrder.payment_status?.startsWith("PENDING")) {
                  return `Editando venta #${existingOrder.order_number ?? ""}`;
                }
                return `Editando cuenta #${existingOrder.order_number ?? ""}`;
              }
              if (defaultOrderType === "ORDER") return "Nueva orden";
              if (defaultOrderType === "SALE") return "Nueva venta";
              return "Cuenta";
            })()}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            key={displayItemCount}
            className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {displayItemCount} {displayItemCount === 1 ? "ítem" : "ítems"}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {existingOrderId && (
          <div className="shrink-0 border-b border-border/60 p-3">
            <ExistingOrderSummary
              existingOrderId={existingOrderId}
              existingOrder={existingOrder}
              existingOrderLoading={existingOrderLoading}
              existingOrderError={existingOrderError}
            />
          </div>
        )}

        {items.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
            {!existingOrderId && (
              <div className="grid flex-1 place-items-center p-6">
                {defaultOrderType === "ORDER" ? (
                  <div className="flex w-full max-w-xs flex-col gap-4">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                        <ClipboardList className="h-5 w-5 text-blue-600" />
                      </div>
                      <p className="text-sm font-medium">Nueva orden</p>
                      <p className="text-xs text-muted-foreground">
                        Selecciona un cliente obligatorio y luego agrega productos.
                      </p>
                    </div>
                    {renderClientField()}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">Carrito vacío</p>
                    <p className="max-w-56 text-xs text-muted-foreground">
                      Toca productos en el catálogo para armar la cuenta.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <ul className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <motion.li
                      key={item.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.12 }}
                      className="border-b border-border/40 py-2.5 last:border-b-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium leading-tight">{item.product.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatCLP(item.product.price)} c/u
                          </p>
                          {item.modifiers.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.modifiers.map((m) => (
                                <span
                                  key={m.modifierOptionId}
                                  className="text-[10px] text-muted-foreground"
                                >
                                  {m.groupName}: {m.name}
                                  {m.surcharge > 0 && (
                                    <span className="ml-1">+{formatCLP(m.surcharge)}</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                          <input
                            type="text"
                            value={item.notes ?? ""}
                            onChange={(e) => setItemNotes(item.id, e.target.value)}
                            placeholder="Nota para cocina…"
                            className="mt-2 h-7 w-full rounded-md border border-border/60 bg-background px-2 text-[11px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          aria-label={`Quitar ${item.product.name}`}
                          className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-lg border border-border/60 bg-background">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            aria-label="Disminuir cantidad"
                            className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-semibold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            aria-label="Aumentar cantidad"
                            className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatCLP(cartItemTotal(item))}
                        </span>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>

            <div className="flex shrink-0 flex-col gap-3 overflow-y-auto border-t border-border/60 p-4 max-h-[42vh]">
              {selectedTable && (
                <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Table className="h-3 w-3" />
                    Mesa {selectedTable.number}
                  </div>
                  <span className="text-xs text-muted-foreground">{selectedTable.area || "Sin área"}</span>
                </div>
              )}

              {!existingOrderId && (
                <>
                  {renderClientField()}

              {!isWaiter && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <Banknote className="h-3 w-3" />
                      Pagos
                    </label>
                    <button
                      type="button"
                      onClick={addPayment}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      + Agregar
                    </button>
                  </div>

                  {payments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Sin pagos se guardará como pedido / cuenta abierta.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {payments.map((payment) => {
                        const method = paymentMethods?.find((m) => m.id === payment.payment_method_id);
                        const isCash = method?.payment_type === "CASH";
                        return (
                          <div
                            key={payment.id}
                            className="flex flex-col gap-1.5 rounded-lg bg-muted/30 p-2.5"
                          >
                            <div className="flex items-end gap-2">
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <Select
                                  value={payment.payment_method_id}
                                  onChange={(e) =>
                                    updatePayment(payment.id, {
                                      payment_method_id: e.target.value,
                                      cash_received: undefined,
                                    })
                                  }
                                  className="h-8 text-xs"
                                >
                                  {paymentMethods?.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {paymentTypeLabel(m.payment_type) || m.name || m.payment_type}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                              <div className="flex w-24 flex-col gap-0.5">
                                <Input
                                  type="number"
                                  min={0}
                                  step="1"
                                  value={payment.amount ? Math.round(parseFloat(payment.amount)).toString() : ""}
                                  onChange={(e) =>
                                    updatePayment(payment.id, { amount: e.target.value })
                                  }
                                  placeholder="0"
                                  className="h-8 text-xs tabular-nums"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => removePayment(payment.id)}
                                aria-label="Quitar pago"
                                className="mb-4 text-muted-foreground hover:text-danger"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {isCash && (
                              <div className="flex flex-col gap-0.5">
                                <label className="text-[10px] text-muted-foreground">
                                  Efectivo recibido
                                </label>
                                <Input
                                  value={payment.cash_received ? formatCLP(parseInt(payment.cash_received || "0", 10) || 0) : ""}
                                  onChange={(e) =>
                                    updatePayment(payment.id, {
                                      cash_received: e.target.value.replace(/[^0-9]/g, ""),
                                    })
                                  }
                                  placeholder="0"
                                  className="h-8 text-xs tabular-nums"
                                  inputMode="numeric"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {payments.length > 0 && (
                    <div className="flex flex-col gap-0.5 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Pagado</span>
                        <span className="tabular-nums">{formatCLP(paidAmount)}</span>
                      </div>
                      {remaining > 0 && (
                        <div className="flex items-center justify-between font-medium text-amber-700">
                          <span>Pendiente</span>
                          <span className="tabular-nums">{formatCLP(remaining)}</span>
                        </div>
                      )}
                      {overpaid > 0 && (
                        <div className="flex items-center justify-between font-medium text-emerald-700">
                          <span>Sobrepago / vuelto</span>
                          <span className="tabular-nums">{formatCLP(overpaid)}</span>
                        </div>
                      )}
                      {change > 0 && (
                        <div className="flex items-center justify-between font-medium text-emerald-700">
                          <span>Vuelto efectivo</span>
                          <span className="tabular-nums">{formatCLP(change)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Descuentos */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">Código de descuento</label>
                <div className="flex items-center gap-2">
                  <Input
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    placeholder="Ej: PROMO10"
                    disabled={saving}
                    className="h-9 text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleApplyDiscount}
                    disabled={!discountCode.trim() || saving}
                    className="h-9"
                  >
                    Aplicar
                  </Button>
                </div>
                {validatedDiscount?.discount && (
                  <p className="text-xs text-emerald-700">
                    Descuento {validatedDiscount.discount.name} aplicado.
                  </p>
                )}
              </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-border/60 bg-background p-4">
        {!existingOrderId && cashRegisterMissing && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700">
            Debes abrir una caja antes de cobrar.
          </p>
        )}
        {!existingOrderId && hasPendingPayment && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700">
            Faltan {formatCLP(remaining)} para completar el pago.
          </p>
        )}

        <div className="flex flex-col gap-1 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCLP(subtotal)}</span>
          </div>
          {comboDiscounts > 0 && (
            <div className="flex items-center justify-between text-emerald-700">
              <span>Desc. por combo</span>
              <span className="tabular-nums">-{formatCLP(comboDiscounts)}</span>
            </div>
          )}
          {manualLineDiscounts > 0 && (
            <div className="flex items-center justify-between text-emerald-700">
              <span>Desc. por línea</span>
              <span className="tabular-nums">-{formatCLP(manualLineDiscounts)}</span>
            </div>
          )}
          {codeDiscount > 0 && (
            <div className="flex items-center justify-between text-emerald-700">
              <span>Desc. por código</span>
              <span className="tabular-nums">-{formatCLP(codeDiscount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border/60 pt-2">
            <span className="text-sm font-medium">Total</span>
            <span className="text-xl font-bold tabular-nums">{formatCLP(total)}</span>
          </div>
        </div>

        <Button size="lg" disabled={!canRegister} onClick={handleRegister} className="h-12 text-sm font-semibold">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {existingOrderId
                ? "Agregando…"
                : isWaiter || payments.length === 0
                  ? "Guardando…"
                  : "Cobrando…"}
            </>
          ) : existingOrderId ? (
            "Agregar a la orden"
          ) : defaultOrderType === "ORDER" ? (
            "Guardar orden"
          ) : isWaiter ? (
            "Guardar pedido"
          ) : payments.length > 0 ? (
            `Cobrar ${formatCLP(total)}`
          ) : (
            "Guardar cuenta"
          )}
        </Button>
      </div>

      {createModalOpen && (
        <CustomerCreateModal
          onClose={() => setCreateModalOpen(false)}
          onSubmit={(payload) => createCustomerMutation.mutate(payload)}
          isPending={createCustomerMutation.isPending}
          error={createCustomerMutation.error}
        />
      )}

    </div>
  );
}

function ExistingOrderSummary({
  existingOrderId,
  existingOrder,
  existingOrderLoading,
  existingOrderError,
}: {
  existingOrderId: string;
  existingOrder?: Order | null;
  existingOrderLoading?: boolean;
  existingOrderError?: Error | null;
}) {
  if (existingOrderLoading) {
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-primary/5 px-3 py-2.5 text-xs text-primary">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Cargando orden #{existingOrderId.slice(0, 8)}…</span>
        </div>
      </div>
    );
  }

  if (existingOrderError) {
    return (
      <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-700">
        No se pudo cargar la orden. Revisa la conexión o el ID.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-primary/5 px-3 py-2.5 text-xs">
      <div className="flex items-center justify-between text-primary">
        <span className="font-medium">Agregando a orden #{existingOrderId.slice(0, 8)}</span>
        <span className="font-bold tabular-nums">
          {formatCLP(parseFloat(existingOrder?.total_amount ?? "0"))}
        </span>
      </div>
      {existingOrder?.products && existingOrder.products.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-primary/10 pt-2">
          {existingOrder.products.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-2">
              <span className="truncate">
                {item.quantity}× {item.product_name}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatCLP(parseFloat(item.final_price ?? item.total_price ?? "0"))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CustomerCreateModal({
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  onClose: () => void;
  onSubmit: (payload: CustomerPayload) => void;
  isPending: boolean;
  error: Error | null;
}) {
  const [form, setForm] = useState<CustomerPayload>({
    name: "",
    dni: "",
    phone_number: "",
    email: "",
    commercial_business: "",
    address: "",
    is_active: true,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Nuevo cliente rápido</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="quick-customer-name" className="text-sm font-medium">Nombre</label>
            <Input
              id="quick-customer-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Ej: Juan Pérez"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="quick-customer-dni" className="text-sm font-medium">RUT/DNI</label>
            <Input
              id="quick-customer-dni"
              value={form.dni ?? ""}
              onChange={(e) => setForm({ ...form, dni: e.target.value })}
              placeholder="Opcional"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="quick-customer-phone" className="text-sm font-medium">Teléfono</label>
            <Input
              id="quick-customer-phone"
              value={form.phone_number ?? ""}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              placeholder="Opcional"
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="quick-customer-email" className="text-sm font-medium">Email</label>
            <Input
              id="quick-customer-email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Opcional"
            />
          </div>
          {error && (
            <p className="text-sm text-danger sm:col-span-2">
              {error instanceof Error ? error.message : "Error al crear el cliente"}
            </p>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear y seleccionar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
