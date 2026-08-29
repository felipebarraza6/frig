"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X, Eye, Ban, CheckCircle2, FileText, SlidersHorizontal, Banknote, Trash2, FileDown, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  fetchPurchaseOrders,
  fetchSuppliers,
  fetchSupplierProducts,
  createPurchaseOrder,
  cancelPurchaseOrder,
  markPurchaseOrderCompleted,
  payPurchaseOrder,
  fetchPurchaseOrderPaymentSummary,
  downloadPurchaseOrderPdf,
  downloadPurchaseOrderVoucher,
  type PurchaseOrderList,
  type PurchaseOrderCreatePayload,
  type SupplierList,
} from "@/lib/api/suppliers";
import { fetchPaymentMethods } from "@/lib/api/payments";
import { useCurrentBranch } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import { formatCLP } from "@/lib/utils";
import { useDownloadFile } from "@/lib/hooks/useDownloadFile";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "DRAFT", label: "Borrador" },
  { value: "SENT", label: "Enviada" },
  { value: "CONFIRMED", label: "Confirmada" },
  { value: "PARTIAL_RECEIVED", label: "Parcial" },
  { value: "RECEIVED", label: "Recibida" },
  { value: "COMPLETED", label: "Completada" },
  { value: "CANCELLED", label: "Anulada" },
];

function statusLabel(value?: string | null): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  DRAFT: "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
  SENT: "rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-700",
  CONFIRMED: "rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-700",
  PARTIAL_RECEIVED: "rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning",
  RECEIVED: "rounded-full bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-700",
  COMPLETED: "rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success",
  CANCELLED: "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger",
};

function statusBadgeClass(status?: string | null) {
  return (
    (status && STATUS_BADGE_CLASSES[status]) ??
    "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
  );
}

const PAYMENT_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pendiente" },
  { value: "PARTIAL", label: "Parcial" },
  { value: "PAID", label: "Pagada" },
  { value: "OVERDUE", label: "Vencida" },
];

function paymentStatusLabel(value?: string | null): string {
  return PAYMENT_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
}

function paymentStatusBadgeClass(status?: string | null) {
  if (status === "PAID") {
    return "rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success";
  }
  if (status === "OVERDUE") {
    return "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger";
  }
  if (status === "PARTIAL") {
    return "rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-700";
  }
  return "rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning";
}

function formatDateCL(value?: string | null): string {
  if (!value) return "—";
  // Se ancla a mediodía local para evitar desfases de zona horaria con fechas YYYY-MM-DD.
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CL");
}

interface FormItem {
  supplier_product?: number | null;
  description: string;
  quantity: string;
  unit_price: string;
  measurement_unit: string;
  is_common_expense: boolean;
  create_product_if_not_exists: boolean;
}

function initialFormState() {
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    supplier: "",
    order_date: today,
    expected_delivery_date: nextWeek,
    notes: "",
    items: [{
      supplier_product: null as number | null,
      description: "",
      quantity: "1",
      unit_price: "",
      measurement_unit: "UN",
      is_common_expense: false,
      create_product_if_not_exists: false,
    } as FormItem],
  };
}

interface PayTarget {
  order: PurchaseOrderList;
  amount: string;
  notes: string;
  paymentMethod: string;
}

function canPay(order: PurchaseOrderList): boolean {
  return order.status !== "CANCELLED" && !order.is_fully_paid;
}

export default function PurchaseOrdersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const branch = useCurrentBranch();
  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [supplier, setSupplier] = useState("");
  const [status, setStatus] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<PurchaseOrderList | null>(null);
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: "cancel" | "complete"; order: PurchaseOrderList } | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(initialFormState);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: page, isLoading } = useQuery({
    queryKey: ["purchase-orders", { search: debouncedSearch, supplier, status, pageUrl }],
    queryFn: () => fetchPurchaseOrders({ search: debouncedSearch, supplier, status, ...pageUrl }),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", "select"],
    queryFn: async () => {
      // El listado está paginado: recorre todas las páginas para no cortar el selector.
      const all: SupplierList[] = [];
      let next: string | null | undefined;
      let first = true;
      while (first || next) {
        const data = await fetchSuppliers(first ? {} : { next });
        all.push(...(data.results ?? []));
        next = data.next;
        first = false;
      }
      return all;
    },
  });

  const orders: PurchaseOrderList[] = page?.results ?? [];
  const totalOrders = page?.count ?? 0;

  const { data: supplierProducts = [] } = useQuery({
    queryKey: ["supplier-products", form.supplier],
    queryFn: () => fetchSupplierProducts(form.supplier),
    enabled: !!form.supplier,
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  });

  const { data: paymentSummary } = useQuery({
    queryKey: ["purchase-order-payment-summary", detail?.id],
    queryFn: () => fetchPurchaseOrderPaymentSummary(detail!.id),
    enabled: !!detail,
  });

  const supplierProductOptions = useMemo(
    () =>
      supplierProducts.map((sp) => ({
        value: String(sp.id),
        label: sp.supplier_product_name || sp.product_name || sp.supplier_product_code || `Producto #${sp.id}`,
      })),
    [supplierProducts],
  );

  const create = useMutation({
    mutationFn: () => {
      const items: PurchaseOrderCreatePayload["items"] = form.items.map((item) => ({
        supplier_product: item.is_common_expense ? null : item.supplier_product,
        description: item.description,
        quantity_ordered: Number(item.quantity),
        unit_price: item.unit_price || "0",
        notes: null,
        create_product_if_not_exists: item.create_product_if_not_exists,
        measurement_unit: item.measurement_unit || "UN",
      }));
      return createPurchaseOrder({
        supplier: form.supplier || null,
        branch: Number(branch?.branch_id ?? 0),
        order_date: form.order_date,
        expected_delivery_date: form.expected_delivery_date,
        notes: form.notes || null,
        items,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      closeModal();
    },
  });

  const estimatedTotal = form.items.reduce(
    (sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unit_price) || 0),
    0,
  );

  const cancel = useMutation({
    mutationFn: (id: string) => cancelPurchaseOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Orden anulada");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Error al anular la orden");
    },
  });

  const complete = useMutation({
    mutationFn: (id: string) => markPurchaseOrderCompleted(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Orden completada");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Error al completar la orden");
    },
  });

  const pay = useMutation({
    // Un solo POST con el payload mínimo: reintentar con la orden completa
    // podía registrar el pago dos veces y sobrescribir las notas.
    mutationFn: (target: PayTarget) =>
      payPurchaseOrder(target.order.id, {
        paid_amount: target.amount,
        notes: target.notes || null,
        payment_method: target.paymentMethod || null,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order-payment-summary", updated.id] });
      setDetail((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
      setPayTarget(null);
      toast.success("Pago registrado");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Error al registrar el pago");
    },
  });

  function updateFilter<T extends string>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  function openModal() {
    create.reset();
    setFormError(null);
    setForm(initialFormState());
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    create.reset();
    setFormError(null);
  }

  function closeDetail() {
    setDetail(null);
  }

  function handleDownloadPdf(order: PurchaseOrderList) {
    downloadFile(() => downloadPurchaseOrderPdf(order.id), {
      filename: `orden_compra_${order.order_number ?? order.id.slice(0, 8)}.pdf`,
      onError: (error) => toast.error(error.message || "Error al descargar el PDF"),
    });
  }

  function handleDownloadVoucher(order: PurchaseOrderList) {
    downloadFile(() => downloadPurchaseOrderVoucher(order.id), {
      filename: `comprobante_${order.order_number ?? order.id.slice(0, 8)}.pdf`,
      onError: (error) => toast.error(error.message || "Error al descargar el comprobante"),
    });
  }

  function openPayModal(order: PurchaseOrderList) {
    pay.reset();
    setPayTarget({ order, amount: order.remaining_amount ?? "", notes: "", paymentMethod: "" });
  }

  function closePayModal() {
    setPayTarget(null);
    pay.reset();
  }

  function openConfirmCancel(order: PurchaseOrderList) {
    cancel.reset();
    setConfirmAction({ type: "cancel", order });
  }

  function openConfirmComplete(order: PurchaseOrderList) {
    complete.reset();
    setConfirmAction({ type: "complete", order });
  }

  function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!branch?.branch_id) {
      setFormError("No hay una sucursal seleccionada.");
      return;
    }
    if (form.items.length === 0) {
      setFormError("Agrega al menos un ítem.");
      return;
    }
    for (const item of form.items) {
      if (item.is_common_expense) {
        if (!item.description.trim()) {
          setFormError("Los gastos comunes deben tener descripción.");
          return;
        }
      } else if (!item.supplier_product) {
        setFormError("Selecciona un producto del proveedor para cada ítem o márcalo como gasto común.");
        return;
      }
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setFormError("La cantidad de cada ítem debe ser mayor que 0.");
        return;
      }
      const price = Number(item.unit_price);
      if (!Number.isFinite(price) || price < 0) {
        setFormError("El precio unitario no puede ser negativo.");
        return;
      }
    }
    create.mutate();
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, {
        supplier_product: null as number | null,
        description: "",
        quantity: "1",
        unit_price: "",
        measurement_unit: "UN",
        is_common_expense: false,
        create_product_if_not_exists: false,
      } as FormItem],
    }));
  }

  function removeItem(index: number) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  function updateItem<K extends keyof FormItem>(index: number, field: K, value: FormItem[K]) {
    setForm((prev) => {
      const next = [...prev.items];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, items: next };
    });
  }

  function selectSupplierProduct(index: number, supplierProductId: string) {
    const sp = supplierProducts.find((p) => String(p.id) === supplierProductId);
    setForm((prev) => {
      const next = [...prev.items];
      next[index] = {
        ...next[index],
        supplier_product: sp ? sp.id : null,
        description: sp
          ? (sp.supplier_product_name || sp.product_name || sp.supplier_product_code || "")
          : "",
        unit_price: sp ? sp.cost_price : next[index].unit_price,
        is_common_expense: false,
      };
      return { ...prev, items: next };
    });
  }

  function handlePaySubmit(e: FormEvent) {
    e.preventDefault();
    if (!payTarget) return;
    const amount = Number(payTarget.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const remaining = Number(payTarget.order.remaining_amount ?? "0");
    if (Number.isFinite(remaining) && amount > remaining) {
      toast.error(`El monto no puede superar el saldo pendiente (${formatCLP(payTarget.order.remaining_amount ?? "0")}).`);
      return;
    }
    pay.mutate(payTarget);
  }

  // Cierra los modales abiertos con la tecla Escape.
  useEffect(() => {
    if (!modalOpen && !detail && !payTarget) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      closePayModal();
      closeModal();
      closeDetail();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Órdenes de compra</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona compras a proveedores
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="icon"
            onClick={openModal}
            className="h-9 w-9 sm:hidden"
            title="Nueva orden"
            aria-label="Nueva orden"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={openModal}
            className="hidden sm:flex"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva orden
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3">
          {/* Desktop filters */}
          <div className="hidden flex-wrap items-end gap-3 md:flex">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => updateFilter(setSearch, e.target.value)}
                placeholder="Buscar orden…"
                className="pl-9"
                aria-label="Buscar orden"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-supplier" className="text-xs text-muted-foreground">Proveedor</label>
              <Select
                id="filter-supplier"
                value={supplier}
                onChange={(e) => updateFilter(setSupplier, e.target.value)}
              >
                <option value="">Todos</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-status" className="text-xs text-muted-foreground">Estado</label>
              <Select
                id="filter-status"
                value={status}
                onChange={(e) => updateFilter(setStatus, e.target.value)}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* Mobile filters */}
          <div className="flex flex-col gap-3 md:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => updateFilter(setSearch, e.target.value)}
                  placeholder="Buscar orden…"
                  className="pl-9"
                  aria-label="Buscar orden"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-10 px-3"
                onClick={() => setShowMobileFilters((v) => !v)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="ml-2">Filtros</span>
              </Button>
            </div>

            <div className={`flex flex-col gap-3 ${showMobileFilters ? "" : "hidden"}`}>
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-supplier-mobile" className="text-xs text-muted-foreground">Proveedor</label>
                <Select
                  id="filter-supplier-mobile"
                  value={supplier}
                  onChange={(e) => updateFilter(setSupplier, e.target.value)}
                >
                  <option value="">Todos</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-status-mobile" className="text-xs text-muted-foreground">Estado</label>
                <Select
                  id="filter-status-mobile"
                  value={status}
                  onChange={(e) => updateFilter(setStatus, e.target.value)}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 py-8">
            <TableSkeleton rows={5} columns={6} />
          </div>
        ) : orders.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No se encontraron órdenes</p>
              <p className="text-xs text-muted-foreground">
                Prueba con otros filtros o crea una nueva orden de compra.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full min-w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Número</th>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Pagado</th>
                    <th className="px-4 py-3 text-right">Pendiente</th>
                    <th className="px-4 py-3">Entrega esperada</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{order.order_number}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{order.supplier_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className={statusBadgeClass(order.status)}>
                            {statusLabel(order.status)}
                          </span>
                          {order.payment_status && (
                            <span className={paymentStatusBadgeClass(order.payment_status)}>
                              {paymentStatusLabel(order.payment_status)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCLP(order.total_amount ?? "0")}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatCLP(order.paid_amount ?? "0")}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatCLP(order.remaining_amount ?? "0")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateCL(order.expected_delivery_date)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Ver detalle"
                            onClick={() => setDetail(order)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span className="sr-only">Ver</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleDownloadVoucher(order)}
                            disabled={isDownloading}
                            title="Descargar comprobante PDF"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            <span className="sr-only">PDF</span>
                          </Button>
                          {canPay(order) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => openPayModal(order)}
                              title="Registrar pago"
                            >
                              <Banknote className="h-3.5 w-3.5" />
                              <span className="sr-only">Pagar</span>
                            </Button>
                          )}
                          {order.status !== "CANCELLED" && order.status !== "COMPLETED" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => openConfirmComplete(order)}
                                disabled={complete.isPending}
                                title="Completar orden"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span className="sr-only">Completar</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-danger hover:text-danger"
                                onClick={() => openConfirmCancel(order)}
                                disabled={cancel.isPending}
                                title="Anular orden"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                <span className="sr-only">Anular</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">{order.supplier_name ?? "Sin proveedor"}</p>
                      <span className={`mt-1 inline-flex ${statusBadgeClass(order.status)}`}>
                        {statusLabel(order.status)}
                      </span>
                      {order.payment_status && (
                        <span className={`ml-1 mt-1 inline-flex ${paymentStatusBadgeClass(order.payment_status)}`}>
                          {paymentStatusLabel(order.payment_status)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Total</span>
                      <span className="font-medium tabular-nums text-foreground">{formatCLP(order.total_amount ?? "0")}</span>
                    </div>
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Pagado</span>
                      <span className="font-medium tabular-nums text-foreground">{formatCLP(order.paid_amount ?? "0")}</span>
                    </div>
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Pendiente</span>
                      <span className="font-medium tabular-nums text-foreground">{formatCLP(order.remaining_amount ?? "0")}</span>
                    </div>
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Entrega esperada</span>
                      <span className="font-medium text-foreground">{formatDateCL(order.expected_delivery_date)}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-border pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 w-10 p-0"
                      title="Ver"
                      aria-label="Ver"
                      onClick={() => setDetail(order)}
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">Ver</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 w-10 p-0"
                      title="Descargar comprobante PDF"
                      aria-label="Descargar comprobante PDF"
                      onClick={() => handleDownloadVoucher(order)}
                      disabled={isDownloading}
                    >
                      <FileDown className="h-4 w-4" />
                      <span className="sr-only">Descargar comprobante PDF</span>
                    </Button>
                    {canPay(order) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0"
                        title="Registrar pago"
                        aria-label="Registrar pago"
                        onClick={() => openPayModal(order)}
                      >
                        <Banknote className="h-4 w-4" />
                        <span className="sr-only">Registrar pago</span>
                      </Button>
                    )}
                    {order.status !== "CANCELLED" && order.status !== "COMPLETED" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 p-0"
                          title="Completar"
                          aria-label="Completar"
                          onClick={() => openConfirmComplete(order)}
                          disabled={complete.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="sr-only">Completar</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 p-0 text-danger hover:text-danger"
                          title="Anular"
                          aria-label="Anular"
                          onClick={() => openConfirmCancel(order)}
                          disabled={cancel.isPending}
                        >
                          <Ban className="h-4 w-4" />
                          <span className="sr-only">Anular</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
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
                  <span className="sm:hidden">Ant.</span>
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ next: page?.next })}
                  disabled={!page?.next}
                >
                  <span className="sm:hidden">Sig.</span>
                  <span className="hidden sm:inline">Siguiente</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatedOverlay
        open={modalOpen}
        onClose={closeModal}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">Nueva orden de compra</h2>
              <button onClick={closeModal} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={handleCreateSubmit}
              className="flex flex-1 flex-col overflow-hidden"
              id="po-form"
            >
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="po-supplier" className="text-sm font-medium">Proveedor</label>
                    <Select
                      id="po-supplier"
                      value={form.supplier}
                      onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                    >
                      <option value="">Sin proveedor (gasto común)</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="po-date" className="text-sm font-medium">Fecha <span className="text-danger">*</span></label>
                      <Input
                        id="po-date"
                        type="date"
                        value={form.order_date}
                        onChange={(e) => setForm({ ...form, order_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="po-delivery" className="text-sm font-medium">Entrega esperada <span className="text-danger">*</span></label>
                      <Input
                        id="po-delivery"
                        type="date"
                        value={form.expected_delivery_date}
                        onChange={(e) => setForm({ ...form, expected_delivery_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Ítems <span className="text-danger">*</span></label>
                      <span className="text-xs text-muted-foreground">{form.items.length} ítem{form.items.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {form.items.map((item, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-border/60 bg-muted/30 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Ítem {index + 1}</span>
                            {form.items.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-danger hover:text-danger"
                                onClick={() => removeItem(index)}
                                aria-label="Eliminar ítem"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                          <div className="mt-2 flex flex-col gap-3">
                            {!item.is_common_expense && (
                              <div className="flex flex-col gap-1">
                                <label className="text-xs text-muted-foreground">Producto del proveedor</label>
                                <SearchableSelect
                                  options={supplierProductOptions}
                                  value={item.supplier_product ? String(item.supplier_product) : ""}
                                  onChange={(value) => selectSupplierProduct(index, value)}
                                  disabled={!form.supplier || supplierProducts.length === 0}
                                  placeholder={
                                    !form.supplier
                                      ? "Selecciona un proveedor primero"
                                      : supplierProducts.length === 0
                                        ? "Sin productos asignados"
                                        : "Seleccionar producto…"
                                  }
                                  searchPlaceholder="Buscar producto…"
                                  emptyMessage="Sin coincidencias"
                                />
                              </div>
                            )}
                            {item.is_common_expense && (
                              <Input
                                value={item.description}
                                onChange={(e) => updateItem(index, "description", e.target.value)}
                                placeholder="Descripción del gasto común"
                                required
                              />
                            )}
                            <div className="grid grid-cols-2 gap-3">
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateItem(index, "quantity", e.target.value)}
                                placeholder="Cantidad"
                                required
                              />
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unit_price}
                                onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                                placeholder="Precio unitario"
                                required
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => updateItem(index, "is_common_expense", !item.is_common_expense)}
                                className={
                                  item.is_common_expense
                                    ? "rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white"
                                    : "rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                                }
                              >
                                Gasto común
                              </button>
                              {!item.is_common_expense && item.supplier_product && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Package className="h-3 w-3" />
                                  {item.description || "Producto seleccionado"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addItem}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar ítem
                    </Button>
                    <div className="flex justify-end text-sm">
                      <span className="text-muted-foreground">Total estimado:</span>
                      <span className="ml-2 font-semibold tabular-nums">{formatCLP(String(estimatedTotal))}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="po-notes" className="text-sm font-medium">Notas de la orden</label>
                    <Input
                      id="po-notes"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  {formError && (
                    <p className="text-sm text-danger">{formError}</p>
                  )}
                  {create.isError && (
                    <p className="text-sm text-danger">
                      {create.error instanceof Error ? create.error.message : "Error al crear"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
                <Button type="button" variant="outline" onClick={closeModal} disabled={create.isPending}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={create.isPending}>
                  Crear orden
                </Button>
              </div>
            </form>
          </div>
      </AnimatedOverlay>

{detail && (
      <AnimatedOverlay
        open={true}
        onClose={closeDetail}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">Orden {detail.order_number}</h2>
              <button onClick={closeDetail} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-2 text-sm">
                <p><span className="text-muted-foreground">Proveedor:</span> {detail.supplier_name ?? "—"}</p>
                <p className="flex items-center gap-1">
                  <span className="text-muted-foreground">Estado:</span>
                  <span className={statusBadgeClass(detail.status)}>{statusLabel(detail.status)}</span>
                  {detail.payment_status && (
                    <span className={paymentStatusBadgeClass(detail.payment_status)}>
                      {paymentStatusLabel(detail.payment_status)}
                    </span>
                  )}
                </p>
                <p><span className="text-muted-foreground">Total:</span> {formatCLP(detail.total_amount ?? "0")}</p>
                <p><span className="text-muted-foreground">Pagado:</span> {formatCLP(detail.paid_amount ?? "0")}</p>
                <p><span className="text-muted-foreground">Pendiente:</span> {formatCLP(detail.remaining_amount ?? "0")}</p>
                <p><span className="text-muted-foreground">Entrega esperada:</span> {formatDateCL(detail.expected_delivery_date)}</p>
                <p><span className="text-muted-foreground">Ítems:</span> {detail.items_count}</p>
              </div>

              {paymentSummary && (paymentSummary.payments?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium">Historial de pagos</h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    {paymentSummary.payments!.map((p, i) => (
                      <li
                        key={p.id ?? i}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-medium tabular-nums">{formatCLP(p.amount ?? p.paid_amount ?? "0")}</p>
                          <p className="text-muted-foreground">
                            {p.payment_method_name ?? "—"}
                            {(p.payment_date ?? p.date ?? p.created) && ` · ${formatDateCL(p.payment_date ?? p.date ?? p.created)}`}
                          </p>
                          {(p.notes ?? p.reference) && (
                            <p className="truncate text-muted-foreground">{p.notes ?? p.reference}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadPdf(detail!)}
                disabled={isDownloading}
              >
                <FileDown className="mr-2 h-4 w-4" />
                PDF interno
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadVoucher(detail!)}
                disabled={isDownloading}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Comprobante PDF
              </Button>
              {canPay(detail!) && (
                <Button size="sm" onClick={() => openPayModal(detail!)}>
                  <Banknote className="mr-2 h-4 w-4" />
                  Registrar pago
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={closeDetail}>
                Cerrar
              </Button>
            </div>
          </div>
      </AnimatedOverlay>
)}

{payTarget && (
      <AnimatedOverlay
        open={true}
        onClose={closePayModal}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-sm md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">Registrar pago — {payTarget.order.order_number}</h2>
              <button onClick={closePayModal} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handlePaySubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    Pendiente: <span className="font-medium tabular-nums text-foreground">{formatCLP(payTarget.order.remaining_amount ?? "0")}</span>
                  </p>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="pay-amount" className="text-sm font-medium">Monto</label>
                    <Input
                      id="pay-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={payTarget.order.remaining_amount ?? undefined}
                      value={payTarget.amount}
                      onChange={(e) => setPayTarget({ ...payTarget!, amount: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Máximo: {formatCLP(payTarget.order.remaining_amount ?? "0")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="pay-method" className="text-sm font-medium">Método de pago</label>
                    <Select
                      id="pay-method"
                      value={payTarget.paymentMethod}
                      onChange={(e) => setPayTarget({ ...payTarget!, paymentMethod: e.target.value })}
                    >
                      <option value="">Sin especificar</option>
                      {paymentMethods.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="pay-notes" className="text-sm font-medium">Referencia / nota</label>
                    <Input
                      id="pay-notes"
                      value={payTarget.notes}
                      onChange={(e) => setPayTarget({ ...payTarget!, notes: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  {pay.isError && (
                    <p className="text-sm text-danger">
                      {pay.error instanceof Error ? pay.error.message : "Error al registrar el pago"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
                <Button type="button" variant="outline" onClick={closePayModal} disabled={pay.isPending}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={pay.isPending}>
                  Registrar pago
                </Button>
              </div>
            </form>
          </div>
      </AnimatedOverlay>
)}

{confirmAction && (
      <AnimatedOverlay
        open={true}
        onClose={() => setConfirmAction(null)}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <h2 className="text-base font-semibold">
              {confirmAction.type === "cancel" ? "¿Anular orden?" : "¿Completar orden?"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {confirmAction.type === "cancel"
                ? `Se anulará la orden ${confirmAction.order.order_number}. Esta acción no se puede deshacer.`
                : `Se marcará la orden ${confirmAction.order.order_number} como completada.`}
            </p>
            {(cancel.isError || complete.isError) && (
              <p className="mt-2 text-sm text-danger">
                {(cancel.error ?? complete.error) instanceof Error
                  ? ((cancel.error ?? complete.error) as Error).message
                  : "Error al procesar la orden"}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmAction(null)}
                disabled={cancel.isPending || complete.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant={confirmAction.type === "cancel" ? "danger" : "default"}
                onClick={() => {
                  if (confirmAction.type === "cancel") {
                    cancel.mutate(confirmAction.order.id);
                  } else {
                    complete.mutate(confirmAction.order.id);
                  }
                }}
                isLoading={cancel.isPending || complete.isPending}
              >
                {confirmAction.type === "cancel" ? "Anular" : "Completar"}
              </Button>
            </div>
          </div>
      </AnimatedOverlay>
)}
    </div>
  );
}
