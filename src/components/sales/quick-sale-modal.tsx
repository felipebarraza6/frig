"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  X,
  Loader2,
  Banknote,
  ClipboardList,
  Store,
  User,
  Package,
  MonitorSmartphone,
  ChevronDown,
  Check,
  Truck,
  MapPin,
  Clock,
} from "lucide-react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fetchProducts } from "@/lib/api/products";
import {
  createOrder,
  editOrder,
  fetchOrder,
  type EditOrderItemInput,
  type OrderItemInput,
} from "@/lib/api/orders";
import { fetchPaymentMethods, createPayment, type YggdraPaymentMethod } from "@/lib/api/payments";
import { getCashRegisters, type CashRegister } from "@/lib/api/cash-register";
import { fetchTaxTypes, type TaxType } from "@/lib/api/tax-types";
import { searchCustomers, createCustomer } from "@/lib/api/customers";
import { occupyTable, fetchTables } from "@/lib/api/tables";
import { useCurrentBranch, useCanViewTables, useIsModuleEnabledFromConfig } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import { formatCLP, cn } from "@/lib/utils";
import type { YggdraSchemas } from "@/lib/api/types";

type Product = YggdraSchemas["ProductList"];
type TableItem = YggdraSchemas["Table"];
type ClientOption = { id: number; name: string; email?: string | null; address?: string | null };

type OrderDetail = YggdraSchemas["Order"] & {
  paid_amount?: string | number | null;
};

type QuickItem = {
  key: string;
  /** ID de OrderProduct cuando el ítem ya existe en la orden (modo edición). */
  orderProductId?: number;
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
};

type PaymentLine = {
  key: string;
  payment_method_id: string;
  amount: string;
  reference: string;
  notes: string;
};

let keyCounter = 0;
function nextKey(prefix: string) {
  keyCounter += 1;
  return `${prefix}-${keyCounter}`;
}

function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isNaN(v) ? 0 : v;
  const parsed = parseFloat(v);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toLocalInputValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface QuickSaleModalProps {
  open: boolean;
  orderType: "SALE" | "ORDER";
  /** Orden existente (ej. cuenta abierta): carga sus ítems y edita en vez de crear. */
  existingOrderId?: string | null;
  onClose: () => void;
  /** Abre el terminal POS embebido (flujo completo con modificadores/combos). */
  onOpenFullPos?: () => void;
}

/**
 * Creación rápida y manual de ventas/órdenes desde /sales, sin cargar el
 * terminal POS completo. Registra productos, cliente/mesa opcionales y pago
 * con cualquier método de pago activo (incluidos los que no usan el POS).
 */
export default function QuickSaleModal({
  open,
  orderType,
  existingOrderId,
  onClose,
  onOpenFullPos,
}: QuickSaleModalProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const branch = useCurrentBranch();
  const canViewTables = useCanViewTables();
  const tablesEnabled = useIsModuleEnabledFromConfig("tables");
  const showTables = canViewTables && tablesEnabled;

  const [items, setItems] = useState<QuickItem[]>([]);
  const [removedOrderProductIds, setRemovedOrderProductIds] = useState<number[]>([]);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  const [productQuery, setProductQuery] = useState("");
  const [debouncedProductQuery, setDebouncedProductQuery] = useState("");

  const [clientQuery, setClientQuery] = useState("");
  const [debouncedClientQuery, setDebouncedClientQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [showClientResults, setShowClientResults] = useState(false);
  const [createClientName, setCreateClientName] = useState("");
  const [showCreateClient, setShowCreateClient] = useState(false);

  const [tableId, setTableId] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [observation, setObservation] = useState("");
  const [chargeNow, setChargeNow] = useState(true);
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  // null = aún no se elige (se preselecciona la primera abierta), "" = sin caja.
  const [cashRegisterChoice, setCashRegisterChoice] = useState<string | null>(null);
  const [selectedTaxIds, setSelectedTaxIds] = useState<string[]>([]);
  const [taxDefaultsApplied, setTaxDefaultsApplied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
    [items],
  );
  const paidTotal = useMemo(
    () => payments.reduce((sum, p) => sum + (parseInt(p.amount || "0", 10) || 0), 0),
    [payments],
  );

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    // Reset completo al cerrar (ajuste de estado durante el render).
    if (!open) {
      setItems([]);
      setRemovedOrderProductIds([]);
      setInitializedFor(null);
      setProductQuery("");
      setDebouncedProductQuery("");
      setClientQuery("");
      setDebouncedClientQuery("");
      setSelectedClient(null);
      setShowClientResults(false);
      setCreateClientName("");
      setShowCreateClient(false);
      setTableId("");
      setDeliveryMode("pickup");
      setDeliveryAddress("");
      setDeliveryDate("");
      setObservation("");
      setChargeNow(true);
      setPayments([]);
      setCashRegisterChoice(null);
      setSelectedTaxIds([]);
      setTaxDefaultsApplied(false);
      setSaving(false);
      setError(null);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedProductQuery(productQuery), 300);
    return () => clearTimeout(timer);
  }, [productQuery]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedClientQuery(clientQuery), 300);
    return () => clearTimeout(timer);
  }, [clientQuery]);

  const { data: paymentMethods } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  });

  // Todos los métodos activos: acá se registran ventas manuales, así que
  // también aparecen los métodos que no están habilitados para el POS.
  const activeMethods = useMemo(
    () => (paymentMethods ?? []).filter((m) => m.is_active),
    [paymentMethods],
  );

  // Listar cajas abiertas directamente: el endpoint /current/ solo resuelve la
  // caja de una estación concreta y devolvía 404 acá aunque hubieran cajas abiertas.
  const { data: openRegistersPage } = useQuery({
    queryKey: ["cash-register", "open", "quick-sale"],
    queryFn: () => getCashRegisters({ status: "OPEN", page_size: 100 }),
    enabled: open,
    staleTime: 15_000,
  });
  // El backend puede devolver varios registros abiertos de la misma estación;
  // para elegir "la caja" basta uno por estación.
  const openRegisters = useMemo(() => {
    const all = (openRegistersPage?.results ?? []) as CashRegister[];
    const byStation = new Map<string, CashRegister>();
    for (const r of all) {
      const key = String(r.station ?? `legacy-${r.id}`);
      if (!byStation.has(key)) byStation.set(key, r);
    }
    return Array.from(byStation.values());
  }, [openRegistersPage]);

  function registerLabel(r: CashRegister): string {
    const name = r.station_name || (r.station_code ? `Caja ${r.station_code}` : `Caja ${r.id}`);
    return r.date ? `${name} · ${r.date}` : name;
  }

  // Preseleccionar la primera caja abierta apenas carga la lista.
  if (open && cashRegisterChoice === null && openRegistersPage) {
    setCashRegisterChoice(openRegisters.length > 0 ? String(openRegisters[0].id) : "");
  }
  const selectedRegister =
    openRegisters.find((r) => String(r.id) === cashRegisterChoice) ?? null;

  // Dropdown propio de caja: un <select> nativo dibuja su lista fuera del modal.
  const [registerOpen, setRegisterOpen] = useState(false);
  const registerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!registerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (registerRef.current && !registerRef.current.contains(e.target as Node)) {
        setRegisterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [registerOpen]);

  // Impuestos configurados en Finanzas → Configuración (TaxTypes de la sucursal).
  const { data: taxTypes } = useQuery({
    queryKey: ["tax-types", "quick-sale", branch?.branch_id],
    queryFn: () => fetchTaxTypes({ branch: Number(branch?.branch_id), is_active: true }),
    enabled: open && Boolean(branch?.branch_id),
    staleTime: 60_000,
  });

  // Preseleccionar los impuestos marcados como default.
  if (open && taxTypes && !taxDefaultsApplied) {
    setTaxDefaultsApplied(true);
    setSelectedTaxIds((taxTypes as TaxType[]).filter((t) => t.is_default).map((t) => t.id));
  }

  const { data: tablesPage } = useQuery({
    queryKey: ["tables", "quick-sale"],
    queryFn: () => fetchTables({ is_active: true, page_size: 200 }),
    enabled: open && showTables,
    staleTime: 60_000,
  });

  const { data: productResults, isLoading: searchingProducts } = useQuery({
    queryKey: ["products", "quick-sale", debouncedProductQuery, branch?.branch_id],
    queryFn: () =>
      fetchProducts({
        search: debouncedProductQuery.trim() || undefined,
        is_for_sale: true,
        is_active: true,
        page_size: 20,
      }),
    enabled: open && debouncedProductQuery.trim().length >= 1,
    staleTime: 30_000,
  });

  const { data: clientResultsQuery, isLoading: searchingCustomers } = useQuery({
    queryKey: ["customers", "search", debouncedClientQuery, branch?.branch_id],
    queryFn: () =>
      searchCustomers(debouncedClientQuery, branch?.branch_id ? Number(branch.branch_id) : undefined),
    enabled: open && debouncedClientQuery.trim().length >= 1,
    staleTime: 30_000,
  });

  const clientResults = useMemo<ClientOption[]>(() => {
    const list = (clientResultsQuery ?? []) as ClientOption[];
    if (selectedClient && !list.some((c) => c.id === selectedClient.id)) {
      return [selectedClient, ...list];
    }
    return list;
  }, [clientResultsQuery, selectedClient]);

  // Cargar orden existente (cuenta abierta) una sola vez, al llegar el detalle.
  const { data: existingOrder } = useQuery({
    queryKey: ["order", "quick-sale", existingOrderId],
    queryFn: () => fetchOrder(existingOrderId as string) as Promise<OrderDetail>,
    enabled: open && Boolean(existingOrderId),
    staleTime: 30_000,
  });

  if (open && existingOrderId && existingOrder && initializedFor !== existingOrderId) {
    setInitializedFor(existingOrderId);
    setItems(
      (existingOrder.products ?? []).map((p) => ({
        key: nextKey("op"),
        orderProductId: p.id,
        productId: p.product,
        name: p.product_name ?? `Producto #${p.product}`,
        quantity: p.quantity ?? 1,
        unitPrice: toNum(p.unit_price),
      })),
    );
    if (existingOrder.client) {
      setSelectedClient({ id: existingOrder.client.id, name: existingOrder.client.name });
      setClientQuery(existingOrder.client.name);
    }
    if (existingOrder.table) setTableId(String(existingOrder.table));
    if (existingOrder.delivery_address) {
      setDeliveryMode("delivery");
      setDeliveryAddress(existingOrder.delivery_address);
      setDeliveryDate(toLocalInputValue(existingOrder.delivery_date));
    }
    setObservation(existingOrder.observation ?? "");
  }

  // Desglose de impuestos seleccionados. Los "incluidos en precio" solo
  // desglosan el total (caso Chile); los demás se agregan encima del total.
  const taxBreakdown = useMemo(() => {
    return (taxTypes ?? [])
      .filter((t) => selectedTaxIds.includes(t.id))
      .map((t) => {
        if (t.tax_calc === "FIXED") {
          return { tax: t, amount: toNum(t.rate), included: Boolean(t.is_included_in_price) };
        }
        const rate = toNum(t.rate);
        const amount = t.is_included_in_price ? total - total / (1 + rate / 100) : (total * rate) / 100;
        return { tax: t, amount, included: Boolean(t.is_included_in_price) };
      });
  }, [taxTypes, selectedTaxIds, total]);

  const addedTaxTotal = useMemo(
    () => taxBreakdown.reduce((sum, b) => sum + (b.included ? 0 : b.amount), 0),
    [taxBreakdown],
  );
  const grandTotal = total + addedTaxTotal;

  function toggleTax(taxId: string) {
    setSelectedTaxIds((prev) =>
      prev.includes(taxId) ? prev.filter((id) => id !== taxId) : [...prev, taxId],
    );
  }

  // Monto por defecto del primer pago: total (o saldo pendiente de la orden).
  const defaultAmount = useMemo(() => {
    const alreadyPaid = toNum(existingOrder?.paid_amount);
    return Math.max(0, Math.round(grandTotal - alreadyPaid));
  }, [grandTotal, existingOrder]);

  function ensurePaymentRows() {
    setPayments((prev) => {
      if (prev.length > 0) return prev;
      const first = activeMethods[0];
      return first
        ? [
            {
              key: nextKey("pay"),
              payment_method_id: first.id,
              amount: String(defaultAmount),
              reference: "",
              notes: "",
            },
          ]
        : [];
    });
  }

  function addItem(product: Product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id && i.unitPrice === toNum(product.price));
      if (existing) {
        return prev.map((i) => (i.key === existing.key ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          key: nextKey("np"),
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPrice: toNum(product.price),
        },
      ];
    });
  }

  function updateItem(key: string, patch: Partial<QuickItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function removeItem(key: string) {
    setItems((prev) => {
      const target = prev.find((i) => i.key === key);
      if (target?.orderProductId) {
        setRemovedOrderProductIds((ids) => [...ids, target.orderProductId as number]);
      }
      return prev.filter((i) => i.key !== key);
    });
  }

  function addPaymentRow() {
    const remaining = Math.max(0, Math.round(grandTotal - paidTotal));
    const first = activeMethods[0];
    if (!first) return;
    setPayments((prev) => [
      ...prev,
      {
        key: nextKey("pay"),
        payment_method_id: first.id,
        amount: String(remaining),
        reference: "",
        notes: "",
      },
    ]);
  }

  function updatePayment(key: string, patch: Partial<PaymentLine>) {
    setPayments((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  async function resolveClientId(): Promise<number | null> {
    if (selectedClient) return selectedClient.id;
    const name = createClientName.trim();
    if (!name) return null;
    const created = await createCustomer({ name });
    return created.id;
  }

  async function handleSubmit() {
    if (saving) return;
    setError(null);
    if (items.length === 0) {
      setError("Agrega al menos un producto.");
      return;
    }
    if (orderType === "ORDER" && !tableId && !selectedClient && !createClientName.trim()) {
      setError("Debes seleccionar o crear un cliente (o una mesa) para guardar la orden.");
      return;
    }
    if (!chargeNow && !selectedClient && !createClientName.trim()) {
      setError("Debes seleccionar o crear un cliente para dejar la venta pendiente.");
      return;
    }
    if (chargeNow && activeMethods.length === 0) {
      setError("No hay métodos de pago activos.");
      return;
    }
    if (chargeNow && paidTotal < Math.round(grandTotal)) {
      setError(`Faltan ${formatCLP(Math.round(grandTotal) - paidTotal)} para completar el cobro.`);
      return;
    }

    setSaving(true);
    try {
      const clientId = await resolveClientId();
      const table = tableId ? Number(tableId) : null;
      // El backend no tiene aún un campo estructurado de impuestos por orden:
      // se persiste el desglose aplicado en la observación para que quede por
      // venta y sea visible en el detalle.
      const taxLine = taxBreakdown.length
        ? `Impuestos aplicados: ${taxBreakdown
            .map(
              (b) =>
                `${b.tax.name}${b.tax.tax_calc === "PERCENTAGE" ? ` ${toNum(b.tax.rate)}%` : ""} → ${formatCLP(Math.round(b.amount))}${b.included ? " (incluido)" : " (agregado)"}`,
            )
            .join("; ")}`
        : "";
      const cleanObservation = observation
        .split("\n")
        .filter((l) => !l.startsWith("Impuestos aplicados:"))
        .join("\n")
        .trim();
      const finalObservation = [cleanObservation, taxLine].filter(Boolean).join("\n") || null;

      let orderId: string;
      if (existingOrderId) {
        const activeItems: EditOrderItemInput[] = items.map((i) => ({
          ...(i.orderProductId ? { id: i.orderProductId } : {}),
          product: i.productId,
          quantity: i.quantity,
          unit_price: i.unitPrice.toFixed(2),
          notes: null,
          is_active: true,
        }));
        const removedItems: EditOrderItemInput[] = removedOrderProductIds.map((id) => ({
          id,
          is_active: false,
        }));
        await editOrder(existingOrderId, {
          client_id: clientId,
          table_id: table,
          delivery_address: deliveryMode === "delivery" ? deliveryAddress.trim() || null : null,
          delivery_date: deliveryMode === "delivery" && deliveryDate ? new Date(deliveryDate).toISOString() : null,
          observation: finalObservation,
          items: [...activeItems, ...removedItems],
        });
        orderId = existingOrderId;
      } else {
        const orderItems: OrderItemInput[] = items.map((i) => ({
          product: i.productId,
          quantity: i.quantity,
          unit_price: i.unitPrice.toFixed(2),
          notes: null,
        }));
        const order = await createOrder({
          items: orderItems,
          order_type: orderType,
          client_id: clientId,
          table_id: table,
          delivery_address: deliveryMode === "delivery" ? deliveryAddress.trim() || null : null,
          delivery_date: deliveryMode === "delivery" && deliveryDate ? new Date(deliveryDate).toISOString() : null,
          observation: finalObservation,
        });
        orderId = order.id;

        if (orderType === "ORDER" && table) {
          try {
            await occupyTable(table, { action: "occupy", order_id: order.id });
            queryClient.invalidateQueries({ queryKey: ["tables"] });
          } catch {
            // La mesa pudo quedar ocupada por otro proceso; no bloquea la venta.
          }
        }
      }

      if (chargeNow) {
        for (const payment of payments) {
          const amount = parseInt(payment.amount || "0", 10);
          if (amount <= 0) continue;
          await createPayment({
            payment_method_id: payment.payment_method_id,
            order_id: orderId,
            amount: Number(amount.toFixed(2)),
            status: "COMPLETED",
            cash_register_id: selectedRegister ? selectedRegister.id : null,
            skip_cash_register_validation: !selectedRegister,
            reference: payment.reference.trim() || null,
            notes: payment.notes.trim() || null,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["order", "quick-sale"] });

      toast.success(
        chargeNow
          ? `${orderType === "ORDER" ? "Orden" : "Venta"} registrada y cobrada`
          : `${orderType === "ORDER" ? "Orden" : "Cuenta"} guardada como pendiente`,
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar la venta");
    } finally {
      setSaving(false);
    }
  }

  const title = existingOrderId
    ? "Agregar a cuenta"
    : orderType === "ORDER"
      ? "Nueva orden"
      : "Nueva venta";
  const TypeIcon = orderType === "ORDER" ? ClipboardList : Store;
  const remaining = Math.max(0, Math.round(grandTotal) - paidTotal);
  const missing = chargeNow && paidTotal < Math.round(grandTotal);

  return (
    <Modal open={open} onClose={onClose} size="xl" className="sm:max-h-[92vh]" hideCloseButton>
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <TypeIcon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold leading-tight">{title}</h2>
            <p className="text-xs text-muted-foreground">
              Registro manual · sin terminal POS
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onOpenFullPos && !existingOrderId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onClose();
                onOpenFullPos();
              }}
              className="h-8 gap-1.5 text-xs text-muted-foreground"
            >
              <MonitorSmartphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Terminal POS</span>
            </Button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ModalBody className="px-4 py-4 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          {/* Productos */}
          <div className="flex min-w-0 flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Buscar producto por nombre o código…"
                className="h-10 pl-9 text-sm"
                autoFocus
              />
              {productQuery.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setProductQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {productQuery.trim().length > 0 && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg">
                  {searchingProducts && (
                    <p className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
                    </p>
                  )}
                  {!searchingProducts && (productResults?.results ?? []).length === 0 && (
                    <p className="px-3 py-2.5 text-xs text-muted-foreground">Sin resultados</p>
                  )}
                  {!searchingProducts &&
                    (productResults?.results ?? []).map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addItem(product)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{product.name}</span>
                          {product.code && (
                            <span className="block text-[11px] text-muted-foreground">{product.code}</span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums">
                            {formatCLP(toNum(product.price))}
                          </span>
                          <Plus className="h-4 w-4 text-primary" />
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {items.length === 0 ? (
                <div className="grid place-items-center rounded-2xl border border-dashed border-border py-10 text-center">
                  <div>
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Busca y agrega productos
                    </p>
                  </div>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex items-center rounded-lg border border-border bg-background">
                          <button
                            type="button"
                            onClick={() => updateItem(item.key, { quantity: Math.max(1, item.quantity - 1) })}
                            className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
                            aria-label="Disminuir cantidad"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <Input
                            value={String(item.quantity)}
                            onChange={(e) => {
                              const qty = parseInt(e.target.value || "0", 10);
                              updateItem(item.key, { quantity: Number.isNaN(qty) ? 0 : Math.max(0, qty) });
                            }}
                            className="h-7 w-12 border-0 bg-transparent p-0 text-center text-sm tabular-nums shadow-none focus-visible:ring-0"
                            inputMode="numeric"
                          />
                          <button
                            type="button"
                            onClick={() => updateItem(item.key, { quantity: item.quantity + 1 })}
                            className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
                            aria-label="Aumentar cantidad"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>$</span>
                          <Input
                            value={String(Math.round(item.unitPrice))}
                            onChange={(e) => {
                              const price = parseInt(e.target.value || "0", 10);
                              updateItem(item.key, { unitPrice: Number.isNaN(price) ? 0 : Math.max(0, price) });
                            }}
                            className="h-7 w-20 border-border bg-background px-2 text-xs tabular-nums"
                            inputMode="numeric"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <p className="text-sm font-bold tabular-nums">
                        {formatCLP(item.quantity * item.unitPrice)}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        className="text-muted-foreground transition-colors hover:text-danger"
                        aria-label={`Quitar ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Detalle, cliente y cobro */}
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Cliente {orderType === "ORDER" ? "" : "(opcional)"}
              </label>
              {selectedClient ? (
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{selectedClient.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClient(null);
                      setClientQuery("");
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Quitar cliente"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={clientQuery}
                    onChange={(e) => {
                      setClientQuery(e.target.value);
                      setShowClientResults(true);
                    }}
                    onFocus={() => setShowClientResults(true)}
                    placeholder="Buscar cliente…"
                    className="h-9 pl-8 text-sm"
                  />
                  {showClientResults && debouncedClientQuery.trim().length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg">
                      {searchingCustomers && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">Buscando…</p>
                      )}
                      {!searchingCustomers && clientResults.length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</p>
                      )}
                      {!searchingCustomers &&
                        clientResults.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => {
                              setSelectedClient(client);
                              setClientQuery(client.name);
                              setShowClientResults(false);
                              // Precargar la dirección del cliente en reparto.
                              if (client.address && deliveryMode === "delivery" && !deliveryAddress) {
                                setDeliveryAddress(client.address);
                              }
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            {client.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
              {!selectedClient &&
                (!showCreateClient ? (
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
                ))}
            </div>

            {showTables && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="quick-sale-table" className="text-xs font-medium text-muted-foreground">
                  Mesa (opcional)
                </label>
                <Select
                  id="quick-sale-table"
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                  className="h-9 text-sm"
                >
                  <option value="">Sin mesa</option>
                  {(tablesPage?.results ?? []).map((table: TableItem) => (
                    <option key={table.id} value={String(table.id)}>
                      Mesa {table.number}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {/* Entrega: retiro en tienda o reparto */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Entrega</label>
              <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-0.5">
                <button
                  type="button"
                  onClick={() => setDeliveryMode("pickup")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors",
                    deliveryMode === "pickup"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <Store className="h-3.5 w-3.5" />
                  Retiro en tienda
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryMode("delivery")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors",
                    deliveryMode === "delivery"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <Truck className="h-3.5 w-3.5" />
                  Reparto
                </button>
              </div>
              {deliveryMode === "delivery" && (
                <div className="flex flex-col gap-1.5">
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Dirección de entrega…"
                      className="h-9 pl-8 text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="datetime-local"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="h-9 pl-8 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="quick-sale-obs" className="text-xs font-medium text-muted-foreground">
                Observación (opcional)
              </label>
              <Input
                id="quick-sale-obs"
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Nota interna de la venta…"
                className="h-9 text-sm"
              />
            </div>

            {/* Impuestos configurados (Finanzas → Configuración) */}
            {(taxTypes ?? []).length > 0 && (
              <div className="rounded-2xl border border-border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Impuestos
                </p>
                <div className="flex flex-col gap-1.5">
                  {(taxTypes ?? []).map((t) => (
                    <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedTaxIds.includes(t.id)}
                        onChange={() => toggleTax(t.id)}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      <span className="flex-1 truncate">{t.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t.tax_calc === "PERCENTAGE" ? `${toNum(t.rate)}%` : formatCLP(toNum(t.rate))}
                        {t.is_included_in_price ? " · incluido" : " · se agrega"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Cobro */}
            <div className="rounded-2xl border border-border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cobro
                </p>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => setChargeNow(true)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      chargeNow ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Cobrar ahora
                  </button>
                  <button
                    type="button"
                    onClick={() => setChargeNow(false)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      !chargeNow ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Pendiente
                  </button>
                </div>
              </div>

              {chargeNow ? (
                <div className="flex flex-col gap-2">
                  {payments.length === 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={ensurePaymentRows}
                      className="h-8 text-xs"
                    >
                      <Banknote className="mr-1.5 h-3.5 w-3.5" />
                      Agregar pago de {formatCLP(defaultAmount)}
                    </Button>
                  )}
                  {payments.map((payment) => {
                    const method = activeMethods.find((m) => m.id === payment.payment_method_id);
                    return (
                      <div key={payment.key} className="flex flex-col gap-1.5 rounded-xl border border-border bg-background p-2">
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={payment.payment_method_id}
                            onChange={(e) => updatePayment(payment.key, { payment_method_id: e.target.value })}
                            className="h-8 flex-1 text-xs"
                          >
                            {activeMethods.map((m: YggdraPaymentMethod) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </Select>
                          <div className="flex w-24 items-center gap-1 rounded-lg border border-border px-2">
                            <span className="text-xs text-muted-foreground">$</span>
                            <Input
                              value={payment.amount}
                              onChange={(e) => updatePayment(payment.key, { amount: e.target.value.replace(/[^0-9]/g, "") })}
                              className="h-8 border-0 bg-transparent p-0 text-xs tabular-nums shadow-none focus-visible:ring-0"
                              inputMode="numeric"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setPayments((prev) => prev.filter((p) => p.key !== payment.key))}
                            className="text-muted-foreground hover:text-danger"
                            aria-label="Quitar pago"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {method?.requires_reference && (
                          <Input
                            value={payment.reference}
                            onChange={(e) => updatePayment(payment.key, { reference: e.target.value })}
                            placeholder="Referencia (n° operación, folio, etc.)"
                            className="h-8 text-xs"
                          />
                        )}
                      </div>
                    );
                  })}
                  {payments.length > 0 && (
                    <button
                      type="button"
                      onClick={addPaymentRow}
                      className="self-start text-xs text-primary hover:underline"
                    >
                      + Agregar otro método
                    </button>
                  )}
                  <div className="relative flex flex-col gap-1" ref={registerRef}>
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Caja
                    </label>
                    <button
                      type="button"
                      onClick={() => setRegisterOpen((v) => !v)}
                      className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 text-left text-xs shadow-sm transition-colors hover:bg-muted"
                    >
                      <span className="truncate">
                        {selectedRegister
                          ? registerLabel(selectedRegister)
                          : "Sin caja"}
                      </span>
                      <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", registerOpen && "rotate-180")} />
                    </button>
                    {registerOpen && (
                      <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-40 overflow-auto rounded-xl border border-border bg-card shadow-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setCashRegisterChoice("");
                            setRegisterOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted",
                            cashRegisterChoice === "" && "bg-primary/5 font-medium text-primary",
                          )}
                        >
                          Sin caja
                          {cashRegisterChoice === "" && <Check className="h-3.5 w-3.5" />}
                        </button>
                        {openRegisters.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setCashRegisterChoice(String(r.id));
                              setRegisterOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted",
                              cashRegisterChoice === String(r.id) && "bg-primary/5 font-medium text-primary",
                            )}
                          >
                            <span className="truncate">{registerLabel(r)}</span>
                            {cashRegisterChoice === String(r.id) && <Check className="h-3.5 w-3.5 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                    {openRegisters.length === 0 && (
                      <p className="text-[11px] text-amber-600">
                        No hay cajas abiertas: regístralo sin caja o ábrela en Caja.
                      </p>
                    )}
                    {cashRegisterChoice === "" && openRegisters.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Sin caja: el pago queda registrado sin ingreso en caja.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Se guarda como {orderType === "ORDER" ? "orden" : "cuenta"} pendiente de cobro. Requiere cliente.
                </p>
              )}

              <div className="mt-2 border-t border-border pt-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold tabular-nums">{formatCLP(total)}</span>
                </div>
                {taxBreakdown.map((b) => (
                  <div key={b.tax.id} className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {b.tax.name}
                      {b.included ? " (incluido)" : ""}
                    </span>
                    <span className="tabular-nums">{formatCLP(Math.round(b.amount))}</span>
                  </div>
                ))}
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="text-base font-extrabold tabular-nums">{formatCLP(grandTotal)}</span>
                </div>
                {chargeNow && payments.length > 0 && (
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {missing ? "Falta por cobrar" : "Pagando"}
                    </span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        missing ? "text-amber-600" : "text-emerald-600",
                      )}
                    >
                      {formatCLP(paidTotal)}
                      {missing ? ` · restan ${formatCLP(remaining)}` : " · completo"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
            )}
          </div>
        </div>
      </ModalBody>

      <ModalFooter className="px-4 sm:px-6">
        <div className="mr-auto hidden text-sm text-muted-foreground sm:block">
          {items.length} ítem{items.length === 1 ? "" : "s"} · {formatCLP(grandTotal)}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          isLoading={saving}
          disabled={items.length === 0 || (chargeNow && payments.length === 0)}
        >
          {chargeNow
            ? `Registrar y cobrar · ${formatCLP(paidTotal || grandTotal)}`
            : existingOrderId
              ? "Guardar cambios"
              : `Guardar ${orderType === "ORDER" ? "orden" : "cuenta"} pendiente`}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
