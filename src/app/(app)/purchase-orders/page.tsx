"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  X,
  Ban,
  CheckCircle2,
  FileText,
  Banknote,
  Trash2,
  FileDown,
  FileSpreadsheet,
  Package,
  Calendar,
  Building2,
  Receipt,
  DollarSign,
  Clock,
  RotateCcw,
  Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TableSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  fetchPurchaseOrders,
  fetchPurchaseOrder,
  fetchSuppliers,
  fetchSupplierProducts,
  createPurchaseOrder,
  cancelPurchaseOrder,
  markPurchaseOrderCompleted,
  updatePurchaseOrderReceivedQuantities,
  fetchPurchaseOrderPaymentSummary,
  downloadPurchaseOrderVoucher,
  updatePurchaseOrder,
  createPurchaseOrderItem,
  updatePurchaseOrderItem,
  deletePurchaseOrderItem,
  type PurchaseOrderList,
  type PurchaseOrderCreatePayload,
  type PurchaseOrderItem,
  type SupplierList,
} from "@/lib/api/suppliers";
import { useCurrentBranch } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import { formatCLP } from "@/lib/utils";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { generateExcelBlob } from "@/lib/export-excel";
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

function statusLabel(value?: string | null, display?: string | null): string {
  if (display) return display;
  const found = STATUS_OPTIONS.find(
    (o) => o.value.toLowerCase() === (value ?? "").toLowerCase(),
  );
  return (
    found?.label ??
    (value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : "—")
  );
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  DRAFT: "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
  SENT: "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary",
  CONFIRMED: "rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground",
  PARTIAL_RECEIVED: "rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning",
  RECEIVED: "rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success",
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
  { value: "", label: "Todos" },
  { value: "PENDING", label: "Pendiente" },
  { value: "PARTIAL", label: "Parcial" },
  { value: "PAID", label: "Pagada" },
  { value: "OVERDUE", label: "Vencida" },
];

function paymentStatusLabel(value?: string | null): string {
  const found = PAYMENT_STATUS_OPTIONS.find(
    (o) => o.value.toLowerCase() === (value ?? "").toLowerCase(),
  );
  return (
    found?.label ??
    (value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : "—")
  );
}

function paymentStatusBadgeClass(status?: string | null) {
  if (status === "PAID") {
    return "rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success";
  }
  if (status === "OVERDUE") {
    return "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger";
  }
  if (status === "PARTIAL") {
    return "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary";
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

/** Porcentaje pagado de una orden (0 si no tiene total válido). */
function paidPct(order: PurchaseOrderList): number {
  const total = Number(order.total_amount ?? 0);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((Number(order.paid_amount ?? 0) / total) * 100)));
}

/** Filtros que persisten entre visitas al módulo. */
const PO_FILTERS_KEY = "po-filters";

interface PersistedPOFilters {
  search?: string;
  supplier?: string;
  status?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
}

function loadPersistedFilters(): PersistedPOFilters {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PO_FILTERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedPOFilters;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

interface FormItem {
  supplier_product?: number | null;
  description: string;
  quantity: string;
  unit_price: string;
  measurement_unit: string;
  create_product_if_not_exists: boolean;
}

/** Ítem del formulario de edición: los existentes llevan su id para el diff. */
interface EditFormItem extends FormItem {
  id: number | null;
}

interface EditFormState {
  supplier: string;
  order_date: string;
  expected_delivery_date: string;
  notes: string;
  items: EditFormItem[];
}

function emptyEditForm(): EditFormState {
  return {
    supplier: "",
    order_date: "",
    expected_delivery_date: "",
    notes: "",
    items: [],
  };
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
      create_product_if_not_exists: false,
    } as FormItem],
  };
}

// mark_completed es una acción manual ("marcar como completada sin registrar
// pago"): se muestra solo mientras la orden no está recepcionada por completo
// ni en un estado terminal; el backend tiene la última palabra — si un estado
// no aplica, responde 400 con su motivo. Las ya recibidas (entregadas) no la
// muestran: su inventario ya ingresó a bodega y no queda nada que cerrar.
function canComplete(order: PurchaseOrderList): boolean {
  return order.status !== "COMPLETED" && order.status !== "CANCELLED" && order.status !== "RECEIVED";
}

function canCancel(order: PurchaseOrderList): boolean {
  return order.status !== "CANCELLED" && order.status !== "COMPLETED";
}

export default function PurchaseOrdersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const branch = useCurrentBranch();
  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();
  const [persistedFilters] = useState(loadPersistedFilters);
  const [search, setSearch] = useState(persistedFilters.search ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(persistedFilters.search ?? "");
  const [supplier, setSupplier] = useState(persistedFilters.supplier ?? "");
  const [status, setStatus] = useState(persistedFilters.status ?? "");
  const [paymentStatus, setPaymentStatus] = useState(persistedFilters.paymentStatus ?? "");
  const [startDate, setStartDate] = useState(persistedFilters.startDate ?? "");
  const [endDate, setEndDate] = useState(persistedFilters.endDate ?? "");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<PurchaseOrderList | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: "cancel" | "complete"; order: PurchaseOrderList } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(initialFormState);

  // Edición (solo órdenes en borrador).
  const [editing, setEditing] = useState<PurchaseOrderList | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(emptyEditForm);
  const [originalItems, setOriginalItems] = useState<PurchaseOrderItem[]>([]);
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Persistir filtros para que el usuario retome su búsqueda al volver al módulo.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        PO_FILTERS_KEY,
        JSON.stringify({ search, supplier, status, paymentStatus, startDate, endDate }),
      );
    } catch {
      // sin almacenamiento disponible: los filtros solo viven en la sesión
    }
  }, [search, supplier, status, paymentStatus, startDate, endDate]);

  const { data: page, isLoading } = useQuery({
    queryKey: ["purchase-orders", { search: debouncedSearch, supplier, status, paymentStatus, startDate, endDate, pageUrl }],
    queryFn: () =>
      fetchPurchaseOrders({
        search: debouncedSearch,
        supplier,
        status,
        payment_status: paymentStatus,
        start_date: startDate,
        end_date: endDate,
        ...pageUrl,
      }),
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

  const orders = useMemo<PurchaseOrderList[]>(() => page?.results ?? [], [page]);
  const totalOrders = page?.count ?? 0;

  async function handleExportExcel() {
    const headers = [
      "Número",
      "Proveedor",
      "Estado",
      "Estado pago",
      "Fecha orden",
      "Entrega esperada",
      "Ítems",
      "Total",
      "Pagado",
      "Por pagar",
    ];
    const rows = orders.map((o) => [
      o.order_number,
      o.supplier_name ?? "—",
      statusLabel(o.status, o.status_display),
      paymentStatusLabel(o.payment_status),
      formatDateCL(o.order_date),
      formatDateCL(o.expected_delivery_date),
      Number(o.items_count),
      Number(o.total_amount ?? 0),
      Number(o.paid_amount ?? 0),
      Number(o.remaining_amount ?? 0),
    ]);
    const blob = await generateExcelBlob("Ordenes de compra", headers, rows);
    await downloadFile(async () => ({ blob }), {
      filename: exportFilename("ordenes_de_compra", "xlsx"),
      extension: "xlsx",
    });
  }

  // Estadísticas de la página cargada (no agregados del backend).
  const stats = useMemo(() => {
    let total = 0;
    let paid = 0;
    let remaining = 0;
    for (const order of orders) {
      total += Number(order.total_amount ?? 0) || 0;
      paid += Number(order.paid_amount ?? 0) || 0;
      remaining += Number(order.remaining_amount ?? 0) || 0;
    }
    return { count: orders.length, total, paid, remaining };
  }, [orders]);

  const { data: supplierProducts = [] } = useQuery({
    queryKey: ["supplier-products", form.supplier],
    queryFn: () => fetchSupplierProducts(form.supplier),
    enabled: !!form.supplier,
  });

  // Productos del proveedor para el formulario de edición (misma queryKey: cache compartido).
  const { data: editSupplierProducts = [] } = useQuery({
    queryKey: ["supplier-products", editForm.supplier],
    queryFn: () => fetchSupplierProducts(editForm.supplier),
    enabled: !!editing && !!editForm.supplier,
  });

  const { data: paymentSummary } = useQuery({
    queryKey: ["purchase-order-payment-summary", detail?.id],
    queryFn: () => fetchPurchaseOrderPaymentSummary(detail!.id),
    enabled: !!detail,
  });

  // Detalle completo de la orden (con ítems) para el modal.
  const { data: orderDetail } = useQuery({
    queryKey: ["purchase-order", detail?.id],
    queryFn: () => fetchPurchaseOrder(detail!.id),
    enabled: !!detail,
    staleTime: 30_000,
  });

  const supplierProductOptions = useMemo(
    () =>
      supplierProducts.map((sp) => ({
        value: String(sp.id),
        label: sp.supplier_product_name || sp.product_name || sp.supplier_product_code || `Producto #${sp.id}`,
      })),
    [supplierProducts],
  );

  const editSupplierProductOptions = useMemo(
    () =>
      editSupplierProducts.map((sp) => ({
        value: String(sp.id),
        label: sp.supplier_product_name || sp.product_name || sp.supplier_product_code || `Producto #${sp.id}`,
      })),
    [editSupplierProducts],
  );

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: s.name })),
    [suppliers],
  );

  const create = useMutation({
    mutationFn: (filledItems: FormItem[]) => {
      const items: PurchaseOrderCreatePayload["items"] = filledItems.map((item) => ({
        supplier_product: item.supplier_product,
        description: item.description,
        quantity_ordered: Number(item.quantity),
        unit_price: Number(item.unit_price),
        notes: null,
        create_product_if_not_exists: item.create_product_if_not_exists,
        measurement_unit: item.measurement_unit || "UN",
      }));
      return createPurchaseOrder({
        supplier: form.supplier,
        expense_category: null,
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

  const editEstimatedTotal = editForm.items.reduce(
    (sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unit_price) || 0),
    0,
  );

  const cancel = useMutation({
    mutationFn: (id: string) => cancelPurchaseOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setConfirmAction(null);
      toast.success("Orden anulada");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Error al anular la orden");
    },
  });

  const complete = useMutation({
    // Completar = fin de la orden: primero se marca la recepción total de los
    // ítems (lo que mueve inventario a bodega) y luego se cierra la orden.
    mutationFn: async (order: PurchaseOrderList) => {
      const full = await fetchPurchaseOrder(order.id);
      const updates: Record<string, number> = {};
      for (const it of full.items) {
        if (Number(it.remaining_quantity) > 0) {
          updates[it.id] = Number(it.quantity_ordered);
        }
      }
      if (Object.keys(updates).length > 0) {
        await updatePurchaseOrderReceivedQuantities(order.id, updates);
      }
      return markPurchaseOrderCompleted(order.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order"] });
      setConfirmAction(null);
      toast.success("Orden completada — ítems recepcionados y orden cerrada");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Error al completar la orden");
    },
  });

  // Edición de una OC en borrador: PATCH del encabezado y sincronización de
  // ítems por diferencia contra los originales (PATCH/POST/DELETE por ítem).
  // El estado (status) no se toca: una orden en borrador sigue en borrador.
  const editSave = useMutation({
    mutationFn: async ({ orderId, items }: { orderId: string; items: EditFormItem[] }) => {
      await updatePurchaseOrder(orderId, {
        supplier: editForm.supplier || null,
        order_date: editForm.order_date,
        expected_delivery_date: editForm.expected_delivery_date,
        notes: editForm.notes || null,
      });
      for (const item of items) {
        if (item.id !== null) {
          const original = originalItems.find((o) => o.id === item.id);
          const changed =
            original &&
            (Number(item.quantity) !== Number(original.quantity_ordered) ||
              Number(item.unit_price) !== Number(original.unit_price));
          if (changed) {
            await updatePurchaseOrderItem(item.id, {
              quantity_ordered: Number(item.quantity),
              unit_price: Number(item.unit_price),
            });
          }
        } else {
          await createPurchaseOrderItem({
            purchase_order: orderId,
            supplier_product: item.supplier_product,
            description: item.description,
            quantity_ordered: Number(item.quantity),
            unit_price: Number(item.unit_price),
            notes: null,
            create_product_if_not_exists: false,
            measurement_unit: item.measurement_unit || "UN",
          });
        }
      }
      const keepIds = new Set(items.filter((i) => i.id !== null).map((i) => i.id));
      for (const original of originalItems) {
        if (!keepIds.has(original.id)) {
          await deletePurchaseOrderItem(original.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order"] });
      toast.success("Orden actualizada");
      closeEdit();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Error al guardar los cambios");
    },
  });

  function updateFilter<T extends string>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  function resetFilters() {
    setSearch("");
    setDebouncedSearch("");
    setSupplier("");
    setStatus("");
    setPaymentStatus("");
    setStartDate("");
    setEndDate("");
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

  function handleDownloadVoucher(order: PurchaseOrderList) {
    downloadFile(() => downloadPurchaseOrderVoucher(order.id), {
      filename: `comprobante_${order.order_number ?? order.id.slice(0, 8)}.pdf`,
      onError: (error) => toast.error(error.message || "Error al descargar el comprobante"),
    });
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
    if (!form.supplier) {
      setFormError("Selecciona un proveedor — los gastos comunes van en el módulo Gastos.");
      return;
    }
    // Las filas totalmente vacías se descartan: una OC puede no tener ítems
    // (p. ej. un pago directo al proveedor sin recepción) y en ese caso no
    // impacta inventario.
    const filledItems = form.items.filter(
      (item) =>
        item.supplier_product !== null ||
        item.description.trim() !== "" ||
        item.unit_price.trim() !== "",
    );
    for (const item of filledItems) {
      if (!item.supplier_product) {
        setFormError("Selecciona un producto del proveedor para cada ítem.");
        return;
      }
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setFormError("La cantidad de cada ítem debe ser mayor que 0.");
        return;
      }
      const price = Number(item.unit_price);
      // El servicio rechaza precios en 0 ("El precio unitario debe ser mayor a 0").
      if (!Number.isFinite(price) || price <= 0) {
        setFormError("El precio unitario de cada ítem debe ser mayor que 0.");
        return;
      }
    }
    create.mutate(filledItems);
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
        unit_price: sp ? String(sp.cost_price ?? "") : next[index].unit_price,
      };
      return { ...prev, items: next };
    });
  }

  async function openEdit(order: PurchaseOrderList) {
    if (order.status !== "DRAFT") return;
    setEditFormError(null);
    setEditLoading(true);
    try {
      const full = await fetchPurchaseOrder(order.id);
      setOriginalItems([...(full.items ?? [])]);
      setEditForm({
        supplier: full.supplier ?? "",
        order_date: (full.order_date ?? "").slice(0, 10),
        expected_delivery_date: (full.expected_delivery_date ?? "").slice(0, 10),
        notes: full.notes ?? "",
        items: (full.items ?? []).map((it) => ({
          id: it.id,
          supplier_product: it.supplier_product ?? null,
          description: it.description ?? it.supplier_product_name ?? it.product_name ?? "",
          quantity: String(it.quantity_ordered),
          unit_price: String(it.unit_price),
          measurement_unit: "UN",
          create_product_if_not_exists: false,
        })),
      });
      setEditing(order);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al cargar la orden");
    } finally {
      setEditLoading(false);
    }
  }

  function closeEdit() {
    setEditing(null);
    setEditForm(emptyEditForm());
    setOriginalItems([]);
    setEditFormError(null);
    editSave.reset();
  }

  function addEditItem() {
    setEditForm((prev) => ({
      ...prev,
      items: [...prev.items, {
        id: null,
        supplier_product: null,
        description: "",
        quantity: "1",
        unit_price: "",
        measurement_unit: "UN",
        create_product_if_not_exists: false,
      }],
    }));
  }

  function removeEditItem(index: number) {
    setEditForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  function updateEditItem<K extends keyof EditFormItem>(index: number, field: K, value: EditFormItem[K]) {
    setEditForm((prev) => {
      const next = [...prev.items];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, items: next };
    });
  }

  function selectEditSupplierProduct(index: number, supplierProductId: string) {
    const sp = editSupplierProducts.find((p) => String(p.id) === supplierProductId);
    setEditForm((prev) => {
      const next = [...prev.items];
      next[index] = {
        ...next[index],
        supplier_product: sp ? sp.id : null,
        description: sp
          ? (sp.supplier_product_name || sp.product_name || sp.supplier_product_code || "")
          : "",
        unit_price: sp ? String(sp.cost_price ?? "") : next[index].unit_price,
      };
      return { ...prev, items: next };
    });
  }

  function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    setEditFormError(null);
    if (!editing) return;
    if (!editForm.supplier) {
      setEditFormError("Selecciona un proveedor — los gastos comunes van en el módulo Gastos.");
      return;
    }
    const filledItems = editForm.items.filter(
      (item) =>
        item.supplier_product !== null ||
        item.description.trim() !== "" ||
        item.unit_price.trim() !== "",
    );
    for (const item of filledItems) {
      if (!item.supplier_product) {
        setEditFormError("Selecciona un producto del proveedor para cada ítem.");
        return;
      }
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        setEditFormError("La cantidad de cada ítem debe ser mayor que 0.");
        return;
      }
      const price = Number(item.unit_price);
      if (!Number.isFinite(price) || price <= 0) {
        setEditFormError("El precio unitario de cada ítem debe ser mayor que 0.");
        return;
      }
    }
    editSave.mutate({ orderId: editing.id, items: filledItems });
  }

  // Cierra los modales abiertos con la tecla Escape.
  useEffect(() => {
    if (!modalOpen && !detail && !editing) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      closeModal();
      closeDetail();
      closeEdit();
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
            Compras a proveedores
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={handleExportExcel}
            disabled={isDownloading || orders.length === 0}
            className="h-9 w-9 sm:hidden"
            title="Exportar Excel"
            aria-label="Exportar Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            disabled={isDownloading || orders.length === 0}
            className="hidden sm:flex"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
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
        {/* Estadísticas de la página cargada */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {isLoading ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="Órdenes"
                value={String(stats.count)}
                icon={Package}
                sub="registros de la página"
                tone="slate"
              />
              <StatCard
                label="Total comprado"
                value={formatCLP(String(stats.total))}
                icon={DollarSign}
                sub="suma de la página actual"
                tone="info"
              />
              <StatCard
                label="Pagado"
                value={formatCLP(String(stats.paid))}
                icon={CheckCircle2}
                sub="montos ya cancelados"
                tone="success"
              />
              <StatCard
                label="Por pagar"
                value={formatCLP(String(stats.remaining))}
                icon={Clock}
                sub="se paga desde Pagos"
                tone="warning"
              />
            </>
          )}
        </section>

        {/* Filtros: una sola fila que envuelve en pantallas chicas */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[200px] flex-1">
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
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-payment-status" className="text-xs text-muted-foreground">Estado pago</label>
            <Select
              id="filter-payment-status"
              value={paymentStatus}
              onChange={(e) => updateFilter(setPaymentStatus, e.target.value)}
            >
              {PAYMENT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-start-date" className="text-xs text-muted-foreground">Desde</label>
            <Input
              id="filter-start-date"
              type="date"
              value={startDate}
              onChange={(e) => updateFilter(setStartDate, e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-end-date" className="text-xs text-muted-foreground">Hasta</label>
            <Input
              id="filter-end-date"
              type="date"
              value={endDate}
              onChange={(e) => updateFilter(setEndDate, e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-10 px-3"
            onClick={resetFilters}
            title="Limpiar filtros"
            aria-label="Limpiar filtros"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
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
            {/* Galería de órdenes */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {orders.map((order) => {
                const pct = paidPct(order);
                return (
                  <div
                    key={order.id}
                    onClick={() => setDetail(order)}
                    className={`cursor-pointer rounded-2xl border border-border bg-muted/30 p-4 shadow-sm transition-colors hover:border-primary/40 ${
                      order.status === "CANCELLED" ? "opacity-70" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          order.supplier_name
                            ? "bg-primary/10 text-primary"
                            : "bg-warning/10 text-warning"
                        }`}
                        title={order.supplier_name ? "Orden con proveedor" : "Gasto común sin proveedor"}
                      >
                        {order.supplier_name
                          ? <Building2 className="h-4 w-4" />
                          : <Receipt className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{order.order_number}</p>
                        <p className="text-xs font-mono uppercase text-muted-foreground">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={statusBadgeClass(order.status)}>
                          {statusLabel(order.status, order.status_display)}
                        </span>
                        {order.payment_status && (
                          <span className={paymentStatusBadgeClass(order.payment_status)}>
                            {paymentStatusLabel(order.payment_status)}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{order.supplier_name ?? "Gasto común"}</span>
                    </p>

                    <div className="mt-3 flex items-start justify-between gap-2">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Total</span>
                        <span className="text-base font-semibold tabular-nums">{formatCLP(order.total_amount ?? "0")}</span>
                      </div>
                      <div className="text-right text-xs tabular-nums text-muted-foreground">
                        <p>Pagado {formatCLP(order.paid_amount ?? "0")}</p>
                        <p>Por pagar {formatCLP(order.remaining_amount ?? "0")}</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-success"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {pct > 0 ? `${pct}% pagado` : "Sin pagos"}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {formatDateCL(order.expected_delivery_date)}
                      </span>
                    </div>
                  </div>
                );
              })}
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
                    <label htmlFor="po-supplier" className="text-sm font-medium">
                      Proveedor <span className="text-danger">*</span>
                    </label>
                    <SearchableSelect
                      options={supplierOptions}
                      value={form.supplier}
                      onChange={(value) => setForm({ ...form, supplier: value })}
                      placeholder="Buscar proveedor…"
                      searchPlaceholder="Escribe para buscar…"
                      emptyMessage="Sin coincidencias"
                    />
                    <p className="text-xs text-muted-foreground">
                      Obligatorio — los gastos comunes sin proveedor van en el módulo Gastos.
                    </p>
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
                      <label className="text-sm font-medium">Ítems</label>
                      <span className="text-xs text-muted-foreground">
                        {form.items.length} ítem{form.items.length === 1 ? "" : "s"} · opcional, solo si impacta inventario
                      </span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {form.items.map((item, index) => (
                        <div
                          key={index}
                          className="rounded-2xl border border-border bg-muted/30 p-3 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Ítem {index + 1}</span>
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
                          </div>
                          <div className="mt-2 flex flex-col gap-3">
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
                            <div className="grid grid-cols-2 gap-3">
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateItem(index, "quantity", e.target.value)}
                                placeholder="Cantidad"
                              />
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={item.unit_price}
                                onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                                placeholder="Precio unitario"
                              />
                            </div>
                            {item.supplier_product && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Package className="h-3 w-3" />
                                {item.description || "Producto seleccionado"}
                              </span>
                            )}
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
        key={`detail-${detail.id}`}
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
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={statusBadgeClass(detail.status)}>
                  {statusLabel(detail.status, detail.status_display)}
                </span>
                {detail.payment_status && (
                  <span className={paymentStatusBadgeClass(detail.payment_status)}>
                    {paymentStatusLabel(detail.payment_status)}
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Proveedor</span>
                  <p className="mt-0.5 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{detail.supplier_name ?? "Gasto común"}</span>
                  </p>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Fecha de orden</span>
                  <p className="mt-0.5 tabular-nums">{formatDateCL(detail.order_date)}</p>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Entrega esperada</span>
                  <p className="mt-0.5 flex items-center gap-1.5 tabular-nums">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {formatDateCL(detail.expected_delivery_date)}
                  </p>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Ítems</span>
                  <p className="mt-0.5 flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {detail.items_count}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Total</span>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatCLP(detail.total_amount ?? "0")}</p>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Pagado</span>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-success">{formatCLP(detail.paid_amount ?? "0")}</p>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Por pagar</span>
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-warning">{formatCLP(detail.remaining_amount ?? "0")}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-success"
                      style={{ width: `${paidPct(detail)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {paidPct(detail) > 0 ? `${paidPct(detail)}% pagado` : "Sin pagos"}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-medium">Ítems</h3>
                {(orderDetail?.items?.length ?? 0) > 0 ? (
                  <>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Al completar la orden, estos ítems ingresan a bodega.
                    </p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {orderDetail!.items.map((it) => (
                        <li
                          key={it.id}
                          className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 flex-1 truncate text-xs font-semibold">
                              {(it.product_name ?? it.supplier_product_name) || it.description || "Ítem"}
                            </p>
                            <p className="shrink-0 text-xs font-semibold tabular-nums">
                              {formatCLP(it.total_price ?? 0)}
                            </p>
                          </div>
                          <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                            {it.quantity_received ?? 0}/{it.quantity_ordered} recibidos
                            {" · "}
                            {formatCLP(it.unit_price ?? 0)} c/u
                          </p>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    Sin ítems — esta orden no impacta inventario.
                  </p>
                )}
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-medium">Historial de pagos</h3>
                {(paymentSummary?.payments?.length ?? 0) > 0 ? (
                  <ul className="mt-2 flex flex-col gap-2">
                    {paymentSummary!.payments.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                          <Banknote className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold tabular-nums">{formatCLP(p.amount ?? 0)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {p.payment_method ?? "—"}
                            {p.payment_date && ` · ${formatDateCL(p.payment_date)}`}
                          </p>
                          {p.reference && (
                            <p className="truncate text-[11px] text-muted-foreground">{p.reference}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    Sin pagos registrados — se pagan desde el módulo Pagos.
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={closeDetail}>
                Cerrar
              </Button>
              {canCancel(detail!) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-danger hover:text-danger sm:w-auto"
                  onClick={() => openConfirmCancel(detail!)}
                  disabled={cancel.isPending}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Anular
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => handleDownloadVoucher(detail!)}
                disabled={isDownloading}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Comprobante PDF
              </Button>
              {detail.status === "DRAFT" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => openEdit(detail!)}
                  disabled={editLoading || editSave.isPending}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {editLoading ? "Cargando…" : "Editar"}
                </Button>
              )}
              {canComplete(detail!) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => openConfirmComplete(detail!)}
                  disabled={complete.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Completar
                </Button>
              )}
            </div>
          </div>
      </AnimatedOverlay>
)}

{editing && (
      <AnimatedOverlay
        key={`edit-${editing.id}`}
        open={true}
        onClose={closeEdit}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">Editar orden {editing.order_number}</h2>
              <button onClick={closeEdit} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={handleEditSubmit}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="po-edit-supplier" className="text-sm font-medium">
                      Proveedor <span className="text-danger">*</span>
                    </label>
                    <SearchableSelect
                      options={supplierOptions}
                      value={editForm.supplier}
                      onChange={(value) => setEditForm({ ...editForm, supplier: value })}
                      placeholder="Buscar proveedor…"
                      searchPlaceholder="Escribe para buscar…"
                      emptyMessage="Sin coincidencias"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="po-edit-date" className="text-sm font-medium">Fecha <span className="text-danger">*</span></label>
                      <Input
                        id="po-edit-date"
                        type="date"
                        value={editForm.order_date}
                        onChange={(e) => setEditForm({ ...editForm, order_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="po-edit-delivery" className="text-sm font-medium">Entrega esperada <span className="text-danger">*</span></label>
                      <Input
                        id="po-edit-delivery"
                        type="date"
                        value={editForm.expected_delivery_date}
                        onChange={(e) => setEditForm({ ...editForm, expected_delivery_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Ítems</label>
                      <span className="text-xs text-muted-foreground">
                        {editForm.items.length} ítem{editForm.items.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {editForm.items.map((item, index) => (
                        <div
                          key={item.id ?? `new-${index}`}
                          className="rounded-xl border border-border/60 bg-muted/30 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Ítem {index + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-danger hover:text-danger"
                              onClick={() => removeEditItem(index)}
                              aria-label="Eliminar ítem"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="mt-2 flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs text-muted-foreground">Producto del proveedor</label>
                              <SearchableSelect
                                options={editSupplierProductOptions}
                                value={item.supplier_product ? String(item.supplier_product) : ""}
                                onChange={(value) => selectEditSupplierProduct(index, value)}
                                disabled={!editForm.supplier || editSupplierProducts.length === 0}
                                placeholder={
                                  !editForm.supplier
                                    ? "Selecciona un proveedor primero"
                                    : editSupplierProducts.length === 0
                                      ? "Sin productos asignados"
                                      : "Seleccionar producto…"
                                }
                                searchPlaceholder="Buscar producto…"
                                emptyMessage="Sin coincidencias"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateEditItem(index, "quantity", e.target.value)}
                                placeholder="Cantidad"
                              />
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={item.unit_price}
                                onChange={(e) => updateEditItem(index, "unit_price", e.target.value)}
                                placeholder="Precio unitario"
                              />
                            </div>
                            {item.supplier_product && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Package className="h-3 w-3" />
                                {item.description || "Producto seleccionado"}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addEditItem}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar ítem
                    </Button>
                    <div className="flex justify-end text-sm">
                      <span className="text-muted-foreground">Total estimado:</span>
                      <span className="ml-2 font-semibold tabular-nums">{formatCLP(String(editEstimatedTotal))}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="po-edit-notes" className="text-sm font-medium">Notas de la orden</label>
                    <Input
                      id="po-edit-notes"
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  {editFormError && (
                    <p className="text-sm text-danger">{editFormError}</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
                <Button type="button" variant="outline" onClick={closeEdit} disabled={editSave.isPending}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={editSave.isPending}>
                  Guardar cambios
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
                : `Se registrará la recepción total de sus ítems (ingresan a bodega) y la orden ${confirmAction.order.order_number} quedará completada y cerrada. Esta acción no se puede deshacer.`}
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
                    complete.mutate(confirmAction.order);
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

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sub: string;
  tone?: "success" | "info" | "warning" | "danger" | "slate";
}) {
  const toneStyles = {
    success: "from-success/10 via-background to-background",
    info: "from-primary/10 via-background to-background",
    warning: "from-warning/10 via-background to-background",
    danger: "from-danger/10 via-background to-background",
    slate: "from-muted/50 via-background to-background",
  };
  const toneText = {
    success: "text-success",
    info: "text-primary",
    warning: "text-warning",
    danger: "text-danger",
    slate: "text-muted-foreground",
  };
  const toneIcon = {
    success: "bg-success/12 text-success",
    info: "bg-primary/12 text-primary",
    warning: "bg-warning/12 text-warning",
    danger: "bg-danger/12 text-danger",
    slate: "bg-muted text-muted-foreground",
  };

  return (
    <div className={`rounded-2xl border border-border/60 bg-gradient-to-br p-4 shadow-sm ${toneStyles[tone]}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`block text-[11px] font-medium uppercase tracking-wider ${toneText[tone]}`}>
            {label}
          </span>
          <p className="mt-1 break-words text-base font-bold tabular-nums tracking-tight text-foreground sm:text-lg lg:text-xl">{value}</p>
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toneIcon[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-3 w-20" />
    </div>
  );
}
