"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  Banknote,
  User,
  X,
  Search,
  Table,
  ClipboardList,
  Receipt,
  Tag,
  MapPin,
  Store,
  Truck,
  Clock,
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
  type CartItemModifier,
} from "@/lib/store/cart";
import { formatCLP, paymentTypeLabel, cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import { createOrder, editOrder, fetchOrder, cartToOrderItems, type EditOrderItemInput } from "@/lib/api/orders";
import { fetchPaymentMethods, createPayment } from "@/lib/api/payments";
import { searchCustomers, createCustomer, type CustomerPayload } from "@/lib/api/customers";
import { getCurrentCashRegister } from "@/lib/api/cash-register";
import { fetchBranchFinanceConfigByBranch } from "@/lib/api/branch-finance-config";
import { occupyTable, freeTable } from "@/lib/api/tables";
import { useCurrentBranch, useIsWaiter } from "@/lib/store/session";
import {
  validateDiscountCode,
  applyDiscountToOrder,
  type ValidatedDiscount,
} from "@/lib/api/discounts";
import type { YggdraSchemas, PosProduct } from "@/lib/api/types";
type Customer = YggdraSchemas["Client"];
type Order = YggdraSchemas["Order"] & {
  order_number?: string | null;
  paid_amount?: string | number | null;
  delivery_address?: string | null;
  delivery_date?: string | null;
};
type OrderProduct = YggdraSchemas["OrderProduct"];

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
  const setItems = useCartStore((s) => s.setItems);
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
  const [showClientSection, setShowClientSection] = useState(false);
  const [showDiscountSection, setShowDiscountSection] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [removedOrderProductIds, setRemovedOrderProductIds] = useState<number[]>([]);
  const deliveryInitializedRef = useRef(false);

  function handleRemoveItem(cartItemId: string) {
    const item = items.find((i) => i.id === cartItemId);
    if (item?.orderProductId) {
      setRemovedOrderProductIds((prev) => [...prev, item.orderProductId!]);
    }
    removeItem(cartItemId);
  }

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

  function toDateTimeLocal(value?: string | null): string {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function orderProductsToCartItems(orderProducts?: OrderProduct[] | null): CartItem[] {
    if (!orderProducts) return [];
    return orderProducts.map((op) => {
      const product: PosProduct = {
        id: op.product,
        name: op.product_name,
        code: op.product_code ?? null,
        price: typeof op.unit_price === "number" ? op.unit_price : parseFloat(op.unit_price ?? "0"),
      };
      const modifiers: CartItemModifier[] = (op.modifiers ?? []).map((m) => ({
        modifierOptionId: m.modifier_option,
        name: m.modifier_option_name,
        groupName: m.modifier_group_name,
        surcharge: Number(m.surcharge_applied ?? 0),
      }));
      return {
        id: `existing-${op.id}`,
        orderProductId: op.id,
        product,
        quantity: op.quantity ?? 1,
        modifiers,
        discountPercentage: Number(op.discount_percentage ?? 0),
        notes: op.notes ?? undefined,
      };
    });
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    deliveryInitializedRef.current = false;
    setRemovedOrderProductIds([]);
  }, [existingOrderId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  // Al editar una orden existente, cargar cliente, productos y datos de entrega una sola vez.
  useEffect(() => {
    if (!existingOrder || deliveryInitializedRef.current) return;
    deliveryInitializedRef.current = true;
    if (existingOrder.client) {
      setSelectedClient(existingOrder.client as unknown as Customer);
    }
    if (existingOrder.products && existingOrder.products.length > 0) {
      setItems((prev) => (prev.length > 0 ? prev : orderProductsToCartItems(existingOrder.products)));
    }
    const hasDelivery = Boolean(existingOrder.delivery_address || existingOrder.delivery_date);
    setDeliveryMode(hasDelivery ? "delivery" : "pickup");
    setDeliveryAddress(existingOrder.delivery_address ?? "");
    setDeliveryDate(toDateTimeLocal(existingOrder.delivery_date));
  }, [existingOrder, setItems]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  // Si el modo es delivery y el cliente tiene dirección, precargarla cuando esté vacía.
  useEffect(() => {
    if (deliveryMode !== "delivery") return;
    const clientAddress = selectedClient?.address;
    if (clientAddress && deliveryAddress === "") {
      setDeliveryAddress(clientAddress);
    }
  }, [deliveryMode, selectedClient, deliveryAddress]);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  const { data: financeConfig } = useQuery({
    queryKey: ["branch-finance-config", branchId],
    queryFn: () => fetchBranchFinanceConfigByBranch(Number(branchId)),
    enabled: Boolean(branchId),
    staleTime: 60_000,
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

    // Validar monto mínimo si está definido
    if (d.minimum_amount) {
      const minAmount = parseFloat(d.minimum_amount);
      if (!Number.isNaN(minAmount) && baseTotal < minAmount) {
        return 0;
      }
    }

    let calculated = 0;

    if (d.apply_to === "ORDER_TOTAL" || d.apply_to === "ALL_PRODUCTS") {
      if (d.discount_type === "PERCENTAGE") {
        calculated = Math.round(baseTotal * (value / 100));
      } else if (d.discount_type === "FIXED_AMOUNT") {
        calculated = Math.round(value);
      }
    } else if (d.apply_to === "SPECIFIC_PRODUCTS" || d.apply_to === "CATEGORY") {
      let applicableTotal = 0;
      const targetProductIds = new Set(d.products ?? []);
      const targetCategoryIds = new Set(d.categories ?? []);

      for (const item of cartItems) {
        const itemSub = cartItemSubtotal(item);
        if (d.apply_to === "SPECIFIC_PRODUCTS") {
          if (targetProductIds.size === 0 || targetProductIds.has(item.product.id)) {
            applicableTotal += itemSub;
          }
        } else if (d.apply_to === "CATEGORY") {
          const itemCatId = item.product.categoryId;
          if (targetCategoryIds.size === 0 || (itemCatId && targetCategoryIds.has(itemCatId))) {
            applicableTotal += itemSub;
          }
        }
      }

      if (d.discount_type === "PERCENTAGE") {
        calculated = Math.round(applicableTotal * (value / 100));
      } else if (d.discount_type === "FIXED_AMOUNT") {
        calculated = Math.round(value);
      }
    }

    // Aplicar tope de descuento máximo si existe
    if (d.maximum_discount) {
      const maxDisc = parseFloat(d.maximum_discount);
      if (!Number.isNaN(maxDisc) && maxDisc > 0) {
        calculated = Math.min(calculated, Math.round(maxDisc));
      }
    }

    return Math.min(calculated, baseTotal);
  }

  const existingOrderPaid = existingOrder
    ? parseFloat(String(existingOrder.paid_amount ?? "0"))
    : 0;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const displayItemCount = itemCount;
  const cartSub = cartSubtotal(items);
  const lineDiscounts = cartDiscountTotal(items);
  const comboDiscounts = items
    .filter((i) => i.notes?.includes("Parte de combo"))
    .reduce((sum, i) => sum + cartItemDiscount(i), 0);
  const manualLineDiscounts = lineDiscounts - comboDiscounts;
  const codeDiscount = calculateCodeDiscount(validatedDiscount, items, cartSub - lineDiscounts);
  const newItemsTotal = Math.max(0, cartSub - lineDiscounts - codeDiscount);
  const subtotal = cartSub;
  const total = Math.max(0, newItemsTotal - existingOrderPaid);

  const taxRate = useMemo(() => {
    const raw = financeConfig?.default_tax_rate;
    if (raw === undefined || raw === null) return 0;
    return parseFloat(String(raw)) || 0;
  }, [financeConfig]);

  const showTaxBreakdown = Boolean(financeConfig?.show_tax_breakdown) && taxRate > 0;

  const { netAmount, taxAmount } = useMemo(() => {
    if (!showTaxBreakdown || total <= 0) return { netAmount: 0, taxAmount: 0 };
    const net = total / (1 + taxRate / 100);
    const roundedNet = Math.round(net);
    return { netAmount: roundedNet, taxAmount: total - roundedNet };
  }, [showTaxBreakdown, total, taxRate]);

  const paidAmount = useMemo(
    () => payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
    [payments],
  );
  const remaining = Math.max(0, total - paidAmount);
  const overpaid = Math.max(0, paidAmount - total);

  const canPayExistingOrder = Boolean(
    existingOrderId &&
      existingOrder &&
      (existingOrder.payment_status === "PENDING" || existingOrder.payment_status === "PARTIAL"),
  );
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

  function resetDelivery() {
    setDeliveryMode("pickup");
    setDeliveryAddress("");
    setDeliveryDate("");
  }

  async function handleSaveExistingOrder(redirectToPay: boolean) {
    if (!existingOrderId || saving) return;
    if (items.length === 0) {
      toast.error("La orden debe tener al menos un producto.");
      return;
    }
    setSaving(true);
    try {
      const activeItems: EditOrderItemInput[] = items.map((item) => ({
        id: item.orderProductId,
        product: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price.toFixed(2),
        discount_percentage: item.discountPercentage,
        notes: item.notes || null,
        is_active: true,
      }));
      const removedItems: EditOrderItemInput[] = removedOrderProductIds.map((id) => ({
        id,
        is_active: false,
      }));

      const order = await editOrder(existingOrderId, {
        client_id: selectedClient?.id ?? null,
        table_id: selectedTable?.id ?? null,
        delivery_address: deliveryMode === "delivery" ? deliveryAddress || null : null,
        delivery_date: deliveryMode === "delivery" && deliveryDate ? new Date(deliveryDate).toISOString() : null,
        items: [...activeItems, ...removedItems],
      });

      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"], refetchType: "all" });

      if (discountCode.trim()) {
        try {
          await applyDiscountToOrder(existingOrderId, discountCode.trim(), branchId);
        } catch (discountErr) {
          toast.warning(
            discountErr instanceof Error
              ? `Orden actualizada, pero el descuento falló: ${discountErr.message}`
              : "Orden actualizada, pero el descuento no pudo aplicarse",
          );
        }
      }

      if (redirectToPay) {
        await processExistingOrderPayments(existingOrderId);
        return;
      }

      clear();
      setRemovedOrderProductIds([]);
      setDiscountCode("");
      setValidatedDiscount(null);
      toast.success(`Orden actualizada (${order.id.slice(0, 8)})`);
      onOrderRegistered?.(order.order_type === "ORDER" ? "ORDER" : "SALE");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar la orden");
    } finally {
      setSaving(false);
    }
  }

  async function processExistingOrderPayments(orderId: string) {
    if (!currentCashRegister) {
      toast.error("Debes abrir una caja antes de cobrar.");
      return;
    }
    if (payments.length === 0) {
      toast.error("Agrega al menos un pago.");
      return;
    }
    const currentPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    if (currentPaid < total) {
      toast.error(`Faltan ${formatCLP(total - currentPaid)} para completar el pago.`);
      return;
    }

    try {
      for (const payment of payments) {
        await createPayment({
          payment_method_id: payment.payment_method_id,
          order_id: orderId,
          amount: Number(payment.amount).toFixed(2),
          status: "COMPLETED",
          cash_register_id: currentCashRegister.id,
        });
      }

      if (existingOrder?.order_type === "SALE" && existingOrder.table) {
        try {
          await freeTable(existingOrder.table);
          queryClient.invalidateQueries({ queryKey: ["tables"] });
        } catch {
          // Ignorar errores de liberación; la mesa puede liberarse manualmente.
        }
      }

      queryClient.invalidateQueries({ queryKey: ["orders", "open-accounts", "pos-terminal"] });
      queryClient.invalidateQueries({ queryKey: ["orders", "pending-deliveries", "pos-terminal"] });
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"], refetchType: "all" });

      const updated = await fetchOrder(orderId);
      onPostSaleOrder?.(updated, [...items]);
      clear();
      setRemovedOrderProductIds([]);
      resetPayments();
      setSelectedClient(null);
      setDiscountCode("");
      setValidatedDiscount(null);
      resetDelivery();
      onOrderRegistered?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar el pago");
    }
  }

  async function handleRegister() {
    if (items.length === 0 || saving) return;
    if (existingOrderId) {
      await handleSaveExistingOrder(false);
      return;
    }
    setSaving(true);
    try {
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
        toast.error("Debes seleccionar un cliente para guardar la orden / cuenta.");
        setSaving(false);
        return;
      }
      const order = await createOrder({
        items: cartToOrderItems(items),
        client_id: selectedClient?.id ?? null,
        table_id: selectedTable?.id ?? null,
        order_type: orderType,
        delivery_address: deliveryMode === "delivery" ? deliveryAddress || null : null,
        delivery_date: deliveryMode === "delivery" && deliveryDate ? new Date(deliveryDate).toISOString() : null,
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
              : `Orden guardada, pero no se pudo ocupar la mesa: ${message}`,
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
        resetDelivery();
        onOrderRegistered?.();
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["products"], refetchType: "all" });
      clear();
      resetPayments();
      setSelectedClient(null);
      setDiscountCode("");
      setValidatedDiscount(null);
      resetDelivery();
      const actionLabel = payments.length > 0 ? "Venta registrada" : "Orden guardada";
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

  const canRegister = existingOrderId
    ? items.length > 0 && !saving
    : items.length > 0 &&
      !saving &&
      !cashRegisterMissing &&
      (payments.length === 0 || paidAmount >= total) &&
      (!willBeOrder || selectedClient != null);

  const hasPendingPayment = payments.length > 0 && paidAmount < total;

  function renderClientField({ showCloseButton = false }: { showCloseButton?: boolean } = {}) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <User className="h-3 w-3" />
            Cliente
          </label>
          {showCloseButton && (
            <button
              type="button"
              onClick={() => {
                setShowClientSection(false);
                setClientQuery("");
                setShowClientResults(false);
              }}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Cerrar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
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
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
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

  const modeConfig = useMemo(() => {
    if (existingOrderId && existingOrder) {
      if (existingOrder.order_type === "ORDER") {
        return { label: "Editando orden", icon: ClipboardList, color: "text-blue-600 bg-blue-500/10" };
      }
      if (existingOrder.order_type === "SALE" && !existingOrder.payment_status?.startsWith("PENDING")) {
        return { label: "Editando venta", icon: Receipt, color: "text-emerald-600 bg-emerald-500/10" };
      }
      return { label: "Editando cuenta", icon: ClipboardList, color: "text-amber-600 bg-amber-500/10" };
    }
    if (defaultOrderType === "ORDER") {
      return { label: "Nueva orden", icon: ClipboardList, color: "text-blue-600 bg-blue-500/10" };
    }
    if (payments.length > 0) {
      return { label: "Venta al contado", icon: Receipt, color: "text-emerald-600 bg-emerald-500/10" };
    }
    if (isWaiter) {
      return { label: "Nuevo pedido", icon: ClipboardList, color: "text-violet-600 bg-violet-500/10" };
    }
    return { label: "Nueva venta", icon: Receipt, color: "text-emerald-600 bg-emerald-500/10" };
  }, [existingOrderId, existingOrder, defaultOrderType, payments.length, isWaiter]);

  const ModeIcon = modeConfig.icon;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", modeConfig.color.split(" ")[1])}>
            <ModeIcon className={cn("h-4 w-4", modeConfig.color.split(" ")[0])} />
          </span>
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold leading-tight">
              {existingOrderId && existingOrder
                ? `#${existingOrder.order_number ?? existingOrderId.slice(0, 8)}`
                : modeConfig.label}
            </h2>
            <span className="text-[10px] text-muted-foreground">
              {displayItemCount} {displayItemCount === 1 ? "ítem" : "ítems"} · {formatCLP(total)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                  {[...items].reverse().map((item) => (
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
                            placeholder="Nota"
                            className="mt-2 h-7 w-full rounded-md border border-border/60 bg-background px-2 text-[11px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label={`Quitar ${item.product.name}`}
                          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-lg border border-border/60 bg-background">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            aria-label="Disminuir cantidad"
                            className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-9 text-center text-xs font-semibold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            aria-label="Aumentar cantidad"
                            className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Plus className="h-4 w-4" />
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

              {willBeOrder || existingOrderId ? (
                renderClientField()
              ) : selectedClient ? (
                <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-tight">{selectedClient.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {selectedClient.dni ?? selectedClient.phone_number ?? selectedClient.email ?? "Sin datos adicionales"}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedClient(null)}
                    aria-label="Quitar cliente"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : showClientSection ? (
                renderClientField({ showCloseButton: true })
              ) : (
                <button
                  type="button"
                  onClick={() => setShowClientSection(true)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline"
                >
                  <User className="h-3 w-3" />
                  Crear o elegir cliente
                </button>
              )}

              {/* Tipo de entrega */}
              {(willBeOrder || (existingOrderId && existingOrder?.order_type !== "SALE")) && (
                <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryMode("pickup")}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[11px] font-medium transition-colors",
                        deliveryMode === "pickup"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      <Store className="h-3.5 w-3.5" /> Retiro
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryMode("delivery")}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[11px] font-medium transition-colors",
                        deliveryMode === "delivery"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      <Truck className="h-3.5 w-3.5" /> Delivery
                    </button>
                  </div>
                  {deliveryMode === "delivery" && (
                    <div className="flex flex-col gap-2">
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder="Dirección de entrega"
                          className="h-8 pl-8 text-xs"
                        />
                      </div>
                      <div className="relative">
                        <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="datetime-local"
                          value={deliveryDate}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                          placeholder="Fecha y hora de entrega"
                          className="h-8 pl-8 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Descuentos */}
              <div className="flex flex-col gap-1.5">
                {!showDiscountSection ? (
                  <button
                    type="button"
                    onClick={() => setShowDiscountSection(true)}
                    className="inline-flex items-center gap-1.5 self-start text-[11px] font-medium text-primary hover:underline"
                  >
                    <Tag className="h-3 w-3" />
                    Descuento
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium text-muted-foreground">Código de descuento</label>
                      <button
                        type="button"
                        onClick={() => setShowDiscountSection(false)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Cerrar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
                  </>
                )}
              </div>

              {!isWaiter && (!existingOrderId || canPayExistingOrder) && (
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

                  {payments.length > 0 && (
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
                                className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-danger"
                              >
                                <X className="h-4 w-4" />
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
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-border/60 bg-background p-4">
        {((!existingOrderId && cashRegisterMissing) || (canPayExistingOrder && !currentCashRegister)) && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700">
            Debes abrir una caja antes de cobrar.
          </p>
        )}
        {hasPendingPayment && (
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
          {showTaxBreakdown && (
            <div className="flex flex-col gap-1 border-t border-border/60 pt-2 text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Neto (sin IVA {taxRate}%)</span>
                <span className="tabular-nums">{formatCLP(netAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>IVA</span>
                <span className="tabular-nums">{formatCLP(taxAmount)}</span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border/60 pt-2">
            <span className="text-sm font-medium">Total</span>
            <span className="text-xl font-bold tabular-nums">{formatCLP(total)}</span>
          </div>
        </div>

        {existingOrderId ? (
          <div className="flex flex-col gap-2">
            {payments.length > 0 ? (
              <Button
                size="lg"
                disabled={saving}
                isLoading={saving}
                onClick={() => handleSaveExistingOrder(true)}
                className="h-12 text-sm font-semibold"
              >
                {saving ? "Guardando…" : canPayExistingOrder ? `Pagar ${formatCLP(total)}` : "Guardar y pagar"}
              </Button>
            ) : (
              <Button
                size="lg"
                disabled={saving}
                isLoading={saving}
                onClick={() => handleSaveExistingOrder(false)}
                className="h-12 text-sm font-semibold"
              >
                {saving ? "Guardando…" : "Guardar orden"}
              </Button>
            )}
          </div>
        ) : (
          <Button size="lg" disabled={!canRegister} isLoading={saving} onClick={handleRegister} className="h-12 text-sm font-semibold">
            {saving ? (
              isWaiter || payments.length === 0 ? "Guardando…" : "Cobrando…"
            ) : defaultOrderType === "ORDER" ? (
              "Guardar orden"
            ) : isWaiter ? (
              "Guardar pedido"
            ) : payments.length > 0 ? (
              `Cobrar ${formatCLP(total)}`
            ) : (
              "Guardar venta"
            )}
          </Button>
        )}
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
          <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
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
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg">
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
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="quick-customer-address" className="text-sm font-medium">Dirección</label>
            <Input
              id="quick-customer-address"
              value={form.address ?? ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Ej: Av. Providencia 1234, Santiago"
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
            <Button type="submit" isLoading={isPending}>
              Crear y seleccionar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
