"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  FileDown,
  SlidersHorizontal,
  DollarSign,
  TrendingUp,
  Clock,
  Ban,
  RotateCcw,
  Tags,
  AlertCircle,
  FileText,
  Package,
  Lock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  fetchRevenues,
  fetchRevenueCategories,
  createRevenue,
  updateRevenue,
  deleteRevenue,
  cancelRevenue,
  exportRevenuesExcel,
  downloadRevenueVoucher,
  createRevenueCategory,
  updateRevenueCategory,
  deleteRevenueCategory,
  toggleRevenueCategoryActive,
  type Revenue,
  type RevenueRequest,
  type RevenueCategory,
  type RevenueCategoryRequest,
} from "@/lib/api/revenues";
import { fetchOrder, type PaymentInstallment } from "@/lib/api/orders";
import { fetchTables } from "@/lib/api/tables";
import type { YggdraSchemas } from "@/lib/api/types";
import { useCurrentBranch, useIsModuleEnabledFromConfig } from "@/lib/store/session";
import {
  formatCLP,
  revenueCategoryTypeLabel,
  orderTypeLabel,
  orderStatusLabel,
  paymentStatusLabel,
} from "@/lib/utils";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";

const REVENUE_CATEGORY_TYPES: { value: string; label: string; hint: string }[] = [
  {
    value: "SALES",
    label: "Ventas",
    hint: "La usan automáticamente las ventas del POS. En los reportes de rentabilidad se contabiliza como ingreso por ventas.",
  },
  {
    value: "SERVICES",
    label: "Servicios",
    hint: "La usan automáticamente las órdenes a facturar. En los reportes se contabiliza como ingreso por servicios.",
  },
  {
    value: "RENTAL",
    label: "Alquiler",
    hint: "Arriendo de bienes o espacios. Uso manual; se agrupa en los reportes financieros.",
  },
  {
    value: "COMMISSION",
    label: "Comisión",
    hint: "Comisiones recibidas. Uso manual; se agrupa en los reportes financieros.",
  },
  {
    value: "INVESTMENT",
    label: "Inversión",
    hint: "Rendimientos de inversiones. Uso manual; se agrupa en los reportes financieros.",
  },
  {
    value: "REFUND",
    label: "Reembolso",
    hint: "Devoluciones a clientes. Los ingresos reembolsados se clasifican con este tipo.",
  },
  {
    value: "OTHER",
    label: "Otro",
    hint: "Categoría genérica. La usan automáticamente los ingresos registrados desde caja.",
  },
];

/** Filtro de estado derivado (igual que en la tabla): pagado / proyectado / atrasado.
 *  Cancelados y reembolsados solo aparecen en "Todos". */
type DerivedStatus = "pagado" | "proyectado" | "atrasado";

const STATUS_FILTER_OPTIONS: { value: "" | DerivedStatus; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "pagado", label: "Pagado" },
  { value: "proyectado", label: "Proyectado" },
  { value: "atrasado", label: "Atrasado" },
];

/** Estado derivado de un ingreso según su pago y fecha. `null` = cancelado/reembolsado. */
function derivedStatus(r: Revenue, today: string): DerivedStatus | null {
  if (r.status === "CANCELLED" || r.status === "REFUNDED") return null;
  const paid = r.total_paid || 0;
  const pending = Math.max(r.pending_amount || 0, 0);
  if (pending <= 0 && paid > 0) return "pagado";
  if (pending > 0 && r.revenue_date < today) return "atrasado";
  return "proyectado";
}

/** Estados permitidos al editar un ingreso ya existente. Al crear, el estado
 *  siempre es PENDING (la fecha define cuándo está proyectado), así que no hay
 *  selector de estado en la creación. */
const EDIT_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pendiente" },
  { value: "SCHEDULED", label: "Proyección" },
  { value: "CANCELLED", label: "Cancelado" },
  { value: "REFUNDED", label: "Reembolsado" },
];


type OrderDetail = YggdraSchemas["Order"] & {
  order_number?: string | null;
  delivery_status?: string | null;
  delivery_address?: string | null;
  delivery_date?: string | null;
  installments?: PaymentInstallment[];
  payments?: {
    id: string;
    amount: string;
    status?: string;
    status_display?: string;
    payment_method_name?: string;
    reference?: string | null;
  }[];
};

function orderDisplayStatus(order: OrderDetail): {
  label: string;
  tone: "success" | "info" | "warning" | "danger" | "accent";
} {
  const active = order.installments?.filter((i) => i.status !== "CANCELLED") ?? [];
  const allPaid = active.length > 0 && active.every((i) => i.status === "PAID");
  if (order.status === "CANCELLED") return { label: "Cancelada", tone: "danger" };
  if (active.length > 0 && !allPaid) return { label: "En cuotas", tone: "accent" };
  if (order.payment_status === "PAID" && order.delivery_status === "DELIVERED")
    return { label: "Completada", tone: "success" };
  if (order.payment_status === "PAID") return { label: "Por entregar", tone: "info" };
  if (order.delivery_status === "DELIVERED") return { label: "Por cobrar", tone: "info" };
  return { label: orderStatusLabel(order.status), tone: "warning" };
}

const INSTALLMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

/** Datos de la orden asociada. Comparten queryKey y caché con el modal y las cuotas. */
function useOrderDetail(orderId: string | null | undefined) {
  return useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => (await fetchOrder(orderId!)) as OrderDetail,
    enabled: Boolean(orderId),
    staleTime: 60_000,
  });
}

/** Título para ingresos con orden: el correlativo es el identificador principal. */
function OrderLinkedTitle({
  orderId,
  onView,
}: {
  orderId: string;
  onView: (orderId: string) => void;
}) {
  const { data: order } = useOrderDetail(orderId);
  return (
    <button
      type="button"
      onClick={() => onView(orderId)}
      className="block max-w-full truncate text-left font-mono font-medium text-primary hover:underline"
      title="Ver orden asociada"
    >
      #{order?.order_number ?? orderId.slice(0, 8).toUpperCase()}
    </button>
  );
}

/** Categoría mostrada para ingresos con orden: el tipo de orden
 *  (Orden / Venta / Convenio), no la categoría contable. */
const ORDER_TYPE_CATEGORY_LABELS: Record<string, string> = {
  SALE: "Venta",
  ORDER: "Orden",
  AGREEMENT: "Convenio",
};

function OrderTypeCategory({ orderId }: { orderId: string }) {
  const { data: order } = useOrderDetail(orderId);
  return <>{order ? (ORDER_TYPE_CATEGORY_LABELS[order.order_type] ?? order.order_type) : "Orden"}</>;
}

/** Indicador suave de cuotas: un cuadrito por cuota pintado según su estado.
 *  Al hacer click abre el detalle de la orden con el detalle completo de cuotas. */
function InstallmentSquares({
  orderId,
  onView,
  fallback = null,
}: {
  orderId: string;
  onView: (orderId: string) => void;
  /** Contenido a mostrar si la orden no tiene cuotas (ej. "Faltan $X"). */
  fallback?: React.ReactNode;
}) {
  const { data: order } = useOrderDetail(orderId);
  const installments = order?.installments?.filter((i) => i.status !== "CANCELLED") ?? [];
  if (installments.length === 0) return <>{fallback}</>;
  const paidCount = installments.filter((i) => i.status === "PAID").length;
  return (
    <button
      type="button"
      onClick={() => onView(orderId)}
      title="Ver detalle de cuotas"
      className="flex w-fit items-center gap-1.5 rounded-lg border border-border bg-background px-1.5 py-1 transition-colors hover:border-primary/40"
    >
      <span className="flex items-center gap-0.5">
        {installments.map((inst, idx) => (
          <span
            key={inst.id}
            title={`Cuota ${idx + 1} · ${formatCLP(Number(inst.amount) || 0)} · ${INSTALLMENT_STATUS_LABELS[inst.status ?? ""] ?? "Pendiente"}${inst.due_date ? ` · vence ${inst.due_date}` : ""}${inst.status === "PAID" && inst.payment_date ? ` · pagada ${inst.payment_date}` : ""}`}
            className={`h-2.5 w-2.5 rounded-[3px] ${
              inst.status === "PAID"
                ? "bg-success"
                : inst.status === "OVERDUE"
                  ? "bg-danger"
                  : "bg-warning"
            }`}
          />
        ))}
      </span>
      <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
        {paidCount}/{installments.length}
      </span>
    </button>
  );
}

/** Estado del formulario: los inputs manejan strings y se convierte al enviar. */
type RevenueFormState = Omit<RevenueRequest, "amount"> & { amount: string };

function paymentStatus(r: Revenue, today: string): {
  label: string;
  className: string;
  total: number;
  paid: number;
  pending: number;
  pct: number;
} {
  const total = r.amount || 0;
  const paid = r.total_paid || 0;
  const pending = Math.max(r.pending_amount || 0, 0);
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;

  if (r.status === "CANCELLED") {
    return { label: "Cancelado", className: "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger", total, paid, pending, pct };
  }
  if (r.status === "REFUNDED") {
    return { label: "Reembolsado", className: "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger", total, paid, pending, pct };
  }
  if (r.is_fully_paid || (paid > 0 && pending <= 0)) {
    return { label: "Pagado", className: "rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success", total, paid, pending, pct };
  }
  if (pending > 0 && r.revenue_date < today) {
    return { label: "Atrasado", className: "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger", total, paid, pending, pct };
  }
  if (paid > 0 && pending > 0) {
    return { label: "Parcial", className: "rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning", total, paid, pending, pct };
  }
  return { label: "Proyectado", className: "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground", total, paid, pending, pct };
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Filtros que persisten entre visitas al módulo. */
const REVENUE_FILTERS_KEY = "frig.revenues.filters";
const PAGE_SIZE = 10;

interface PersistedRevenueFilters {
  startDate?: string;
  endDate?: string;
  category?: string;
  status?: string;
}

function loadPersistedFilters(): PersistedRevenueFilters {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(REVENUE_FILTERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedRevenueFilters;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export default function RevenuesPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const defaultStartDate = toISODate(startOfMonth(today));
  const defaultEndDate = toISODate(today);
  const queryClient = useQueryClient();
  const [persistedFilters] = useState(loadPersistedFilters);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(persistedFilters.category ?? "");
  const [status, setStatus] = useState(persistedFilters.status ?? "");
  const [startDate, setStartDate] = useState(persistedFilters.startDate ?? defaultStartDate);
  const [endDate, setEndDate] = useState(persistedFilters.endDate ?? defaultEndDate);
  const [pageNum, setPageNum] = useState(0);

  // Persistir rango de fechas, categoría y estado para que el usuario retome sus filtros.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        REVENUE_FILTERS_KEY,
        JSON.stringify({ startDate, endDate, category, status }),
      );
    } catch {
      // sin almacenamiento disponible: los filtros solo viven en la sesión
    }
  }, [startDate, endDate, category, status]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Revenue | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Revenue | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const branch = useCurrentBranch();
  const branchId = Number(branch?.branch_id ?? 0);

  const [form, setForm] = useState<RevenueFormState>({
    title: "",
    description: "",
    branch: branchId,
    category: "",
    amount: "",
    revenue_date: toISODate(new Date()),
    status: "PENDING",
    customer_name: "",
    reference: "",
    invoice_number: "",
    notes: "",
    is_recurring: false,
    frequency: "ONE_TIME",
    order: null,
  });
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<RevenueCategory | null>(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<RevenueCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState<RevenueCategoryRequest>({
    name: "",
    category_type: "SALES",
    description: "",
    branch: branchId,
  });

  const dateFilter = startDate && endDate ? { startDate, endDate } : {};

  // Un solo fetch con los filtros server-side (búsqueda, categoría y fechas);
  // el filtro de estado derivado (pagado/proyectado/atrasado) y la paginación
  // se resuelven en cliente sobre este conjunto.
  const {
    data: listPage,
    isLoading: isLoadingPage,
    isError: isPageError,
    refetch: refetchPage,
  } = useQuery({
    queryKey: ["revenues", "list", { search, category, ...dateFilter }],
    queryFn: () => fetchRevenues({ search, category, ...dateFilter, page_size: 500 }),
  });

  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();
  const filter = { search, category, ...dateFilter };

  async function handleExportExcel() {
    await downloadFile(() => exportRevenuesExcel(filter), {
      filename: exportFilename("ingresos", "xlsx"),
      extension: "xlsx",
    });
  }

  async function handleDownloadVoucher(revenue: Revenue) {
    await downloadFile(() => downloadRevenueVoucher(revenue.id, "a4"), {
      filename: `comprobante_${revenue.id.slice(0, 8)}_a4.pdf`,
    });
  }

  const {
    data: orderDetail,
    isLoading: isLoadingOrderDetail,
    isError: isOrderDetailError,
  } = useQuery({
    queryKey: ["order", viewingOrderId],
    queryFn: async () => (await fetchOrder(viewingOrderId!)) as OrderDetail,
    enabled: !!viewingOrderId,
  });

  const tablesEnabled = useIsModuleEnabledFromConfig("tables");
  const { data: tablesList } = useQuery({
    queryKey: ["tables", "active"],
    queryFn: async () => {
      try {
        return await fetchTables({ is_active: true, page_size: 200 });
      } catch {
        // Si el módulo de mesas no está activo o falla, solo no resolvemos el número de mesa.
        return { count: 0, results: [] } as Awaited<ReturnType<typeof fetchTables>>;
      }
    },
    enabled: tablesEnabled && !!viewingOrderId,
    retry: false,
  });
  const tableById = useMemo(
    () => new Map((tablesList?.results ?? []).map((t) => [t.id, t])),
    [tablesList],
  );

  const { data: categories = [] } = useQuery({
    queryKey: ["revenue-categories"],
    queryFn: fetchRevenueCategories,
  });

  /** Solo los ingresos manuales son editables: los generados automáticamente
   *  (orden asociada o categoría de sistema) se gestionan desde su módulo origen. */
  const isManualRevenue = (r: Revenue) =>
    !r.order && !categories.find((c) => c.id === r.category)?.is_system;

  /** En el gestor solo se listan las categorías creadas por el usuario;
   *  las de sistema se ocultan porque no se pueden administrar. */
  const userCategories = categories.filter((c) => !c.is_system);

  /** Categorías ordenadas para los filtros: primero las de sistema, luego las del usuario. */
  const sortedCategories = [...categories].sort((a, b) => {
    if (Boolean(a.is_system) !== Boolean(b.is_system)) {
      return a.is_system ? -1 : 1;
    }
    return a.name.localeCompare(b.name, "es");
  });

  /** Extras del filtro de categoría: las de sistema se marcan con ícono y negrita. */
  const categoryOptionExtras = Object.fromEntries(
    categories.map((c) => [
      c.id,
      c.is_system ? { icon: Lock, bold: true } : {},
    ]),
  );

  const todayStr = toISODate(new Date());
  const allRevenues = useMemo(() => listPage?.results ?? [], [listPage]);
  const revenues = useMemo(
    () =>
      status
        ? allRevenues.filter((r) => derivedStatus(r, todayStr) === status)
        : allRevenues,
    [allRevenues, status, todayStr],
  );

  // Paginación en cliente sobre el conjunto filtrado.
  const totalRevenues = revenues.length;
  const pageCount = Math.max(1, Math.ceil(totalRevenues / PAGE_SIZE));
  const currentPage = Math.min(pageNum, pageCount - 1);
  const pageItems = useMemo(
    () => revenues.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [revenues, currentPage],
  );

  const stats = useMemo(() => {
    let total = 0;
    let received = 0;
    let projected = 0;
    let overdue = 0;
    for (const r of revenues) {
      if (r.status === "CANCELLED" || r.status === "REFUNDED") continue;
      total += r.amount || 0;
      received += r.total_paid || 0;
      const pending = Math.max(r.pending_amount || 0, 0);
      projected += pending;
      // Pendiente real: lo proyectado cuya fecha ya pasó (hoy > fecha del ingreso)
      if (pending > 0 && r.revenue_date < todayStr) overdue += pending;
    }
    return { total, received, projected, overdue };
  }, [revenues, todayStr]);

  const pageTotal = useMemo(
    () => pageItems.reduce((sum, r) => sum + (r.amount || 0), 0),
    [pageItems],
  );

  const hasActiveFilters =
    search ||
    category ||
    status ||
    startDate !== defaultStartDate ||
    endDate !== defaultEndDate;

  function normalizeRevenuePayload(payload: RevenueFormState): RevenueRequest {
    const nullable = <T extends string | null>(v: T | undefined): T | null =>
      (v === undefined || v === "") ? null : v;
    return {
      ...payload,
      amount: Number(payload.amount),
      description: nullable(payload.description),
      customer_name: nullable(payload.customer_name),
      reference: nullable(payload.reference),
      invoice_number: nullable(payload.invoice_number),
      notes: nullable(payload.notes),
      frequency: payload.is_recurring ? (payload.frequency ?? "ONE_TIME") : "ONE_TIME",
      order: payload.order || null,
    };
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = normalizeRevenuePayload(form);
      if (editing) {
        await updateRevenue(editing.id, payload);
      } else {
        await createRevenue(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenues"] });
      closeModal();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteRevenue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenues"] });
      setConfirmDelete(null);
    },
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelRevenue(id),
    onSuccess: () => {
      setCancelError(null);
      queryClient.invalidateQueries({ queryKey: ["revenues"] });
    },
    onError: (error) => {
      setCancelError(error instanceof Error ? error.message : "No se pudo cancelar el ingreso");
    },
  });

  const createCategory = useMutation({
    mutationFn: (payload: RevenueCategoryRequest) => createRevenueCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenue-categories"] });
      resetCategoryForm();
    },
  });

  const updateCategory = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<RevenueCategoryRequest>;
    }) => updateRevenueCategory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenue-categories"] });
      resetCategoryForm();
    },
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => deleteRevenueCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenue-categories"] });
    },
  });

  const toggleCategory = useMutation({
    mutationFn: (id: string) => toggleRevenueCategoryActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenue-categories"] });
    },
  });

  function resetCategoryForm() {
    setEditingCategory(null);
    setCategoryForm({
      name: "",
      category_type: "SALES",
      description: "",
      branch: branchId,
    });
  }

  function openCategoryModal() {
    setCategoriesModalOpen(true);
  }

  function closeCategoriesModal() {
    setCategoriesModalOpen(false);
    resetCategoryForm();
  }

  function handleEditCategory(category: RevenueCategory) {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      category_type: category.category_type,
      description: category.description ?? "",
      branch: category.branch,
    });
  }

  function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    if (editingCategory) {
      updateCategory.mutate({
        id: editingCategory.id,
        payload: {
          name: categoryForm.name,
          category_type: categoryForm.category_type,
          description: categoryForm.description || null,
        },
      });
    } else {
      createCategory.mutate({
        ...categoryForm,
        branch: branchId,
        description: categoryForm.description || null,
      });
    }
  }

  function openConfirmDeleteCategory(category: RevenueCategory) {
    deleteCategory.reset();
    setConfirmDeleteCategory(category);
  }

  function openModal(revenue?: Revenue) {
    setEditing(revenue ?? null);
    if (revenue) {
      setForm({
        title: revenue.title,
        description: revenue.description ?? "",
        branch: revenue.branch,
        category: revenue.category,
        amount: String(revenue.amount),
        revenue_date: revenue.revenue_date,
        status: revenue.status ?? "PENDING",
        customer_name: revenue.customer_name ?? "",
        reference: revenue.reference ?? "",
        invoice_number: revenue.invoice_number ?? "",
        notes: revenue.notes ?? "",
        is_recurring: false,
        frequency: "ONE_TIME",
        order: revenue.order ?? null,
      });
    } else {
      setForm({
        title: "",
        description: "",
        branch: branchId,
        category: "",
        amount: "",
        revenue_date: toISODate(new Date()),
        status: "PENDING",
        customer_name: "",
        reference: "",
        invoice_number: "",
        notes: "",
        is_recurring: false,
        frequency: "ONE_TIME",
        order: null,
      });
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function updateFilter<T extends string>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageNum(0);
  }

  function handleStartDateChange(value: string) {
    setStartDate(value);
    setPageNum(0);
    if (!value) {
      setEndDate("");
      return;
    }
    if (endDate && endDate < value) {
      setEndDate(value);
    }
  }

  function handleEndDateChange(value: string) {
    if (!startDate) return;
    if (!value) {
      setEndDate("");
      setPageNum(0);
      return;
    }
    if (value < startDate) return;
    setEndDate(value);
    setPageNum(0);
  }

  function clearFilters() {
    setSearch("");
    setCategory("");
    setStatus("");
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
    setPageNum(0);
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Ingresos</h1>
          <p className="text-xs text-muted-foreground">
            Ventas, servicios y otros ingresos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            isLoading={isDownloading}
            className="h-9 w-9 px-0 sm:w-auto sm:px-3"
            title="Exportar Excel"
          >
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openCategoryModal}
            className="h-9 w-9 px-0 sm:w-auto sm:px-3"
            title="Categorías"
            aria-label="Categorías"
          >
            <Tags className="h-4 w-4" />
            <span className="hidden sm:inline">Categorías</span>
          </Button>
          <Button
            size="icon"
            onClick={() => openModal()}
            className="sm:hidden"
            title="Nuevo ingreso"
            aria-label="Nuevo ingreso"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => openModal()}
            className="hidden sm:flex"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo ingreso
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3">
          {/* Desktop filters */}
          <div className="hidden flex-nowrap items-end gap-2 md:flex">
            <div className="relative min-w-40 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => updateFilter(setSearch, e.target.value)}
                placeholder="Buscar…"
                className="pl-9"
                aria-label="Buscar ingreso"
              />
            </div>
            <div className="flex w-36 shrink-0 flex-col gap-1">
              <label htmlFor="filter-category" className="text-xs text-muted-foreground">Categoría</label>
              <Select
                id="filter-category"
                value={category}
                onChange={(e) => updateFilter(setCategory, e.target.value)}
                optionExtras={categoryOptionExtras}
              >
                <option value="">Todas</option>
                {sortedCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex w-32 shrink-0 flex-col gap-1">
              <label htmlFor="filter-status" className="text-xs text-muted-foreground">Estado</label>
              <Select
                id="filter-status"
                value={status}
                onChange={(e) => updateFilter(setStatus, e.target.value)}
              >
                {STATUS_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex w-40 shrink-0 flex-col gap-1">
              <label htmlFor="filter-start" className="text-xs text-muted-foreground">Desde</label>
              <Input
                id="filter-start"
                type="date"
                value={startDate}
                className="pr-10"
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
            </div>
            <div className="flex w-40 shrink-0 flex-col gap-1">
              <label htmlFor="filter-end" className="text-xs text-muted-foreground">Hasta</label>
              <Input
                id="filter-end"
                type="date"
                value={endDate}
                min={startDate}
                disabled={!startDate}
                className="pr-10"
                onChange={(e) => handleEndDateChange(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="h-10 w-10 shrink-0 p-0"
              title="Limpiar filtros"
              aria-label="Limpiar filtros"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile filters */}
          <div className="flex flex-col gap-3 md:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => updateFilter(setSearch, e.target.value)}
                  placeholder="Buscar…"
                  className="h-10 pl-9"
                  aria-label="Buscar ingreso"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-10 w-10 shrink-0 p-0"
                onClick={() => setShowMobileFilters((v) => !v)}
                aria-expanded={showMobileFilters}
                aria-controls="mobile-filters-panel"
                title="Filtros"
                aria-label="Filtros"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>

            <div
              id="mobile-filters-panel"
              className={`rounded-2xl border border-border bg-muted/30 p-4 shadow-sm ${showMobileFilters ? "" : "hidden"}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">Filtros avanzados</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-xs"
                  onClick={() => setShowMobileFilters(false)}
                  title="Cerrar filtros"
                  aria-label="Cerrar filtros"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="filter-category-mobile" className="text-xs text-muted-foreground">Categoría</label>
                    <Select
                      id="filter-category-mobile"
                      value={category}
                      onChange={(e) => updateFilter(setCategory, e.target.value)}
                      optionExtras={categoryOptionExtras}
                    >
                      <option value="">Todas</option>
                      {sortedCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
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
                      {STATUS_FILTER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="filter-start-mobile" className="text-xs text-muted-foreground">Desde</label>
                    <Input
                      id="filter-start-mobile"
                      type="date"
                      value={startDate}
                      className="pr-10"
                      onChange={(e) => handleStartDateChange(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="filter-end-mobile" className="text-xs text-muted-foreground">Hasta</label>
                    <Input
                      id="filter-end-mobile"
                      type="date"
                      value={endDate}
                      min={startDate}
                      disabled={!startDate}
                      className="pr-10"
                      onChange={(e) => handleEndDateChange(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  className="h-10 w-full p-0"
                  title="Limpiar filtros"
                  aria-label="Limpiar filtros"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {isLoadingPage ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="Total ingresos"
                value={formatCLP(stats.total)}
                icon={DollarSign}
                sub={`${totalRevenues} registros efectivos`}
                tone="success"
              />
              <StatCard
                label="Recibidos"
                value={formatCLP(stats.received)}
                icon={TrendingUp}
                sub="ingresos pagados"
                tone="info"
              />
              <StatCard
                label="Proyectado"
                value={formatCLP(stats.projected)}
                icon={Clock}
                sub="por cobrar · se paga desde Pagos"
                tone="warning"
              />
              <StatCard
                label="Atrasado"
                value={formatCLP(stats.overdue)}
                icon={AlertCircle}
                sub="vencido · fecha anterior a hoy"
                tone="danger"
              />
            </>
          )}
        </section>

        {isPageError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
            <AlertCircle className="h-10 w-10 text-danger" />
            <p className="text-sm font-medium">No se pudieron cargar los ingresos</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Ocurrió un error al consultar el listado.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchPage()}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reintentar
            </Button>
          </div>
        ) : isLoadingPage ? (
          <div className="flex flex-col gap-3">
            <TableSkeleton />
            <MobileCardsSkeleton />
            <div className="flex justify-end">
              <Skeleton className="h-9 w-40" />
            </div>
          </div>
        ) : revenues.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border p-8 text-center">
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <TrendingUp className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="mt-4 text-base font-medium">No se encontraron ingresos</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Ajusta los filtros o crea un nuevo ingreso para comenzar."
                  : "Aún no hay ingresos registrados. Registra el primero."}
              </p>
              {!hasActiveFilters && (
                <Button size="sm" onClick={() => openModal()} className="mt-5 h-10 px-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo ingreso
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {cancelError && (
              <div className="flex items-start justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                <p className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {cancelError}
                </p>
                <button
                  type="button"
                  onClick={() => setCancelError(null)}
                  aria-label="Cerrar aviso"
                  className="text-warning/80 transition-colors hover:text-warning"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Ingreso</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          {r.order ? (
                            <OrderLinkedTitle
                              orderId={r.order}
                              onView={(id) => setViewingOrderId(id)}
                            />
                          ) : (
                            <p className="truncate font-medium">{r.title}</p>
                          )}
                          <p
                            className="font-mono text-[11px] text-muted-foreground"
                            title={`ID ingreso: ${r.id}`}
                          >
                            #{r.id.slice(0, 8).toUpperCase()}
                          </p>
                          {r.description && !r.order && (
                            <p className="text-xs text-muted-foreground">{r.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.order ? <OrderTypeCategory orderId={r.order} /> : r.category_name}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCLP(r.amount)}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const ps = paymentStatus(r, todayStr);
                          const showDetail = r.status !== "CANCELLED" && r.status !== "REFUNDED";
                          return (
                            <div className="flex min-w-[8rem] flex-col gap-1">
                              <span className={`inline-flex w-fit items-center gap-1 whitespace-nowrap ${ps.className}`}>
                                {ps.label}
                                {ps.pct > 0 && ps.pct < 100 && (
                                  <span className="text-[10px] opacity-80">({ps.pct}%)</span>
                                )}
                              </span>
                              {showDetail && (
                                <div className="flex flex-col gap-0.5 text-[11px]">
                                  {ps.pending > 0 ? (
                                    <span className="text-muted-foreground">
                                      {formatCLP(ps.paid)} / {formatCLP(ps.total)}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 font-medium text-success">
                                      <CheckCircle2 className="h-3 w-3" />
                                      {formatCLP(ps.total)}
                                    </span>
                                  )}
                                  {ps.pending > 0 &&
                                    (r.order ? (
                                      <InstallmentSquares
                                        orderId={r.order}
                                        onView={(id) => setViewingOrderId(id)}
                                        fallback={
                                          <span className="text-warning">
                                            Faltan {formatCLP(ps.pending)}
                                          </span>
                                        }
                                      />
                                    ) : (
                                      <span className="text-warning">
                                        Faltan {formatCLP(ps.pending)}
                                      </span>
                                    ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{r.revenue_date}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 px-2 text-xs"
                            onClick={() => handleDownloadVoucher(r)}
                            title="Descargar comprobante A4"
                          >
                            <FileText className="h-4 w-4" />
                            A4
                          </Button>
                          {/* Los ingresos automáticos (orden o categoría de sistema) no se
                              tocan desde aquí: solo se puede ver su origen (click en el
                              título) y descargar el comprobante. */}
                          {isManualRevenue(r) && (
                            <ActionsMenu
                              ariaLabel="Acciones"
                              items={[
                                {
                                  label: "Editar",
                                  icon: Pencil,
                                  onClick: () => openModal(r),
                                },
                                ...(r.status !== "CANCELLED"
                                  ? [
                                      {
                                        label: "Cancelar",
                                        icon: X,
                                        onClick: () => cancel.mutate(r.id),
                                      },
                                    ]
                                  : []),
                                {
                                  label: "Eliminar",
                                  icon: Trash2,
                                  onClick: () => setConfirmDelete(r),
                                  danger: true,
                                },
                              ]}
                            />
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
              {pageItems.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {r.order ? (
                          <OrderLinkedTitle
                            orderId={r.order}
                            onView={(id) => setViewingOrderId(id)}
                          />
                        ) : (
                          <p className="truncate font-medium">{r.title}</p>
                        )}
                        <p
                          className="font-mono text-[10px] text-muted-foreground"
                          title={`ID ingreso: ${r.id}`}
                        >
                          #{r.id.slice(0, 8).toUpperCase()}
                        </p>
                        {r.description && !r.order && (
                          <p className="break-words text-xs text-muted-foreground">{r.description}</p>
                        )}
                        <span className={`mt-1 inline-flex ${paymentStatus(r, todayStr).className}`}>
                          {paymentStatus(r, todayStr).label}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-bold tabular-nums text-foreground">{formatCLP(r.amount)}</p>
                      <p className="whitespace-nowrap text-[10px] text-muted-foreground">{r.revenue_date}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Categoría</span>
                      <span className="block truncate font-medium text-foreground">
                        {r.order ? <OrderTypeCategory orderId={r.order} /> : r.category_name}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Fecha</span>
                      <span className="block truncate font-medium text-foreground">{r.revenue_date}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Estado de pago</span>
                      {(() => {
                        const ps = paymentStatus(r, todayStr);
                        const showDetail = r.status !== "CANCELLED" && r.status !== "REFUNDED";
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span className={`inline-flex w-fit items-center gap-1 whitespace-nowrap ${ps.className}`}>
                              {ps.label}
                              {ps.pct > 0 && ps.pct < 100 && (
                                <span className="text-[10px] opacity-80">({ps.pct}%)</span>
                              )}
                            </span>
                            {showDetail && ps.pending > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {formatCLP(ps.paid)} / {formatCLP(ps.total)}
                              </span>
                            )}
                            {showDetail && ps.pending > 0 &&
                              (r.order ? (
                                <InstallmentSquares
                                  orderId={r.order}
                                  onView={(id) => setViewingOrderId(id)}
                                  fallback={
                                    <span className="text-[10px] font-medium text-warning">
                                      Faltan {formatCLP(ps.pending)}
                                    </span>
                                  }
                                />
                              ) : (
                                <span className="text-[10px] font-medium text-warning">
                                  Faltan {formatCLP(ps.pending)}
                                </span>
                              ))}
                            {showDetail && ps.pending <= 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success">
                                <CheckCircle2 className="h-3 w-3" />
                                {formatCLP(ps.total)}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 px-2 text-xs"
                      onClick={() => handleDownloadVoucher(r)}
                      title="Descargar comprobante A4"
                    >
                      <FileText className="h-4 w-4" />
                      A4
                    </Button>
                    {isManualRevenue(r) && (
                      <ActionsMenu
                        ariaLabel="Acciones"
                        variant="outline"
                        size="icon"
                        items={[
                          {
                            label: "Editar",
                            icon: Pencil,
                            onClick: () => openModal(r),
                          },
                          ...(r.status !== "CANCELLED"
                            ? [
                                {
                                  label: "Cancelar",
                                  icon: X,
                                  onClick: () => cancel.mutate(r.id),
                                },
                              ]
                            : []),
                          {
                            label: "Eliminar",
                            icon: Trash2,
                            onClick: () => setConfirmDelete(r),
                            danger: true,
                          },
                        ]}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {totalRevenues} ingreso{totalRevenues === 1 ? "" : "s"}
                </span>
                {" "}· Total: <span className="font-semibold text-foreground">{formatCLP(pageTotal)}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageNum(currentPage - 1)}
                  disabled={currentPage <= 0}
                >
                  <span className="sm:hidden">Ant.</span>
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {currentPage + 1}/{pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageNum(currentPage + 1)}
                  disabled={currentPage >= pageCount - 1}
                >
                  <span className="sm:hidden">Sig.</span>
                  <span className="hidden sm:inline">Siguiente</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detalle de la orden asociada al ingreso */}
      <AnimatedOverlay
        open={!!viewingOrderId}
        onClose={() => setViewingOrderId(null)}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
        <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-xl md:border">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {orderDetail ? orderTypeLabel(orderDetail.order_type) : "Orden"}
              </p>
              <h2 className="text-base font-semibold tabular-nums">
                {orderDetail?.order_number ?? viewingOrderId?.slice(0, 8)}
              </h2>
            </div>
            <button
              onClick={() => setViewingOrderId(null)}
              aria-label="Cerrar"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingOrderDetail ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : isOrderDetailError || !orderDetail ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <AlertCircle className="h-8 w-8 text-danger" />
                <p className="text-sm font-medium">No se pudo cargar la orden</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingOrderId(null)}
                >
                  Cerrar
                </Button>
              </div>
            ) : (
              (() => {
                const display = orderDisplayStatus(orderDetail);
                const toneBadge: Record<string, string> = {
                  success: "bg-success/10 text-success ring-success/20",
                  info: "bg-primary/10 text-primary ring-primary/20",
                  accent: "bg-accent text-accent-foreground ring-border",
                  danger: "bg-danger/10 text-danger ring-danger/20",
                  warning: "bg-warning/10 text-warning ring-warning/20",
                };
                const deliveryBadge =
                  orderDetail.delivery_status === "DELIVERED"
                    ? "bg-success/10 text-success ring-success/20"
                    : orderDetail.delivery_status === "PARTIAL"
                      ? "bg-warning/10 text-warning ring-warning/20"
                      : "bg-primary/10 text-primary ring-primary/20";
                return (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${toneBadge[display.tone]}`}>
                        {display.label}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ring-border">
                        Pago: {paymentStatusLabel(orderDetail.payment_status)}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${deliveryBadge}`}>
                        {orderDetail.delivery_status === "DELIVERED"
                          ? "Entregado"
                          : orderDetail.delivery_status === "PARTIAL"
                            ? "Entrega parcial"
                            : "Por entregar"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border bg-background p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Cliente</p>
                        <p className="mt-1 truncate text-sm font-semibold">{orderDetail.client?.name ?? "—"}</p>
                        {orderDetail.client?.phone_number && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{orderDetail.client.phone_number}</p>
                        )}
                      </div>
                      <div className="rounded-xl border border-border bg-background p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fecha</p>
                        <p className="mt-1 text-sm font-semibold">
                          {new Date(orderDetail.date).toLocaleString("es-CL", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </p>
                      </div>
                      {orderDetail.table && (
                        <div className="rounded-xl border border-border bg-background p-3">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Mesa</p>
                          <p className="mt-1 text-sm font-semibold">
                            Mesa {tableById.get(orderDetail.table)?.number ?? orderDetail.table}
                          </p>
                        </div>
                      )}
                      {orderDetail.tax_document_number ? (
                        <div className="rounded-xl border border-border bg-background p-3">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Documento</p>
                          <p className="mt-1 truncate text-sm font-semibold">
                            {orderDetail.tax_document_type_display || "Documento"} · {orderDetail.tax_document_number}
                          </p>
                        </div>
                      ) : null}
                      <div className="col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-primary/80">Total</p>
                        <p className="mt-1 text-lg font-extrabold tabular-nums">
                          {formatCLP(orderDetail.total_amount ?? 0)}
                        </p>
                      </div>
                    </div>

                    {orderDetail.products && orderDetail.products.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Productos ({orderDetail.products.length})
                        </p>
                        <div className="mt-2 flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
                          {orderDetail.products.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{p.product_name}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  x{p.quantity ?? 0} · {formatCLP(p.unit_price ?? 0)} c/u
                                </p>
                              </div>
                              <p className="shrink-0 font-semibold tabular-nums">
                                {formatCLP(p.total_price ?? 0)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {orderDetail.installments && orderDetail.installments.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cuotas</p>
                        <div className="mt-2 flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
                          {orderDetail.installments.map((inst) => (
                            <div key={inst.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium">
                                  {formatCLP(parseFloat(inst.amount || "0"))}
                                  {inst.due_date ? ` · vence ${inst.due_date}` : ""}
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {INSTALLMENT_STATUS_LABELS[inst.status ?? ""] ?? inst.status ?? "—"}
                                  {inst.status === "PAID" && inst.payment_date ? ` el ${inst.payment_date}` : ""}
                                </p>
                              </div>
                              {inst.status === "PAID" ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                              ) : inst.status === "OVERDUE" ? (
                                <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                              ) : (
                                <Clock className="h-4 w-4 shrink-0 text-warning" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {orderDetail.payments && orderDetail.payments.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pagos registrados</p>
                        <div className="mt-2 flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
                          {orderDetail.payments.map((payment) => (
                            <div key={payment.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{payment.payment_method_name ?? "Pago"}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {payment.status_display ?? payment.status}
                                  {payment.reference ? ` · ${payment.reference}` : ""}
                                </p>
                              </div>
                              <p className="shrink-0 font-semibold tabular-nums">
                                {formatCLP(parseFloat(payment.amount ?? "0"))}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(orderDetail.delivery_address || orderDetail.delivery_date) && (
                      <div className="rounded-xl border border-border bg-background p-3 text-sm">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Entrega</p>
                        {orderDetail.delivery_address && (
                          <p className="mt-1">
                            <span className="text-muted-foreground">Dirección:</span> {orderDetail.delivery_address}
                          </p>
                        )}
                        {orderDetail.delivery_date && (
                          <p className="mt-1">
                            <span className="text-muted-foreground">Fecha:</span>{" "}
                            {new Date(orderDetail.delivery_date).toLocaleString("es-CL", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </p>
                        )}
                      </div>
                    )}

                    {orderDetail.observation && (
                      <div className="rounded-xl border border-border bg-background p-3 text-sm">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Observación</p>
                        <p className="mt-1">{orderDetail.observation}</p>
                      </div>
                    )}

                    {orderDetail.status === "CANCELLED" && orderDetail.cancellation_reason && (
                      <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-danger">Motivo de anulación</p>
                        <p className="mt-1">{orderDetail.cancellation_reason}</p>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      </AnimatedOverlay>

      <AnimatedOverlay
        open={modalOpen}
        onClose={closeModal}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">{editing ? "Editar ingreso" : "Nuevo ingreso"}</h2>
              <button onClick={closeModal} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
              className="flex flex-1 flex-col overflow-hidden"
              id="revenue-form"
            >
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-5">
                  {/* General */}
                  <section className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Package className="h-3.5 w-3.5" />
                      Información general
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="revenue-title" className="text-sm font-medium">Título</label>
                      <Input
                        id="revenue-title"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder="Título representativo del ingreso"
                        required
                      />
                      {!editing && (
                        <p className="text-[11px] text-muted-foreground">
                          El ingreso se crea por defecto como <strong>Pendiente</strong>; la fecha define para cuándo está proyectado.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="revenue-desc" className="text-sm font-medium">Descripción</label>
                      <textarea
                        id="revenue-desc"
                        value={form.description ?? ""}
                        onChange={(e) => setForm({ ...form, description: e.target.value || null })}
                        placeholder="Describe el origen del ingreso…"
                        rows={3}
                        className="w-full resize-none rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="revenue-category" className="text-sm font-medium">Categoría</label>
                      <Select
                        id="revenue-category"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        required
                      >
                        <option value="">Selecciona una categoría</option>
                        {categories
                          // Las categorías de sistema las usa automáticamente el ERP;
                          // en ingresos manuales solo se pueden usar las creadas por el usuario.
                          .filter((c) => !c.is_system || (editing && form.category === c.id))
                          .map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                      </Select>
                      {categories.some((c) => c.is_system) && (
                        <p className="text-[11px] text-muted-foreground">
                          Las categorías de sistema se usan automáticamente y no están disponibles para ingresos manuales.
                        </p>
                      )}
                    </div>
                  </section>

                  {/* Monto y fecha */}
                  <section className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="revenue-amount" className="text-sm font-medium">Monto</label>
                      <Input
                        id="revenue-amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="revenue-date" className="text-sm font-medium">Fecha</label>
                      <Input
                        id="revenue-date"
                        type="date"
                        value={form.revenue_date}
                        onChange={(e) => setForm({ ...form, revenue_date: e.target.value })}
                        required
                      />
                    </div>
                  </section>

                  {/* Estado: solo al editar. Al crear siempre es Pendiente; la fecha define cuándo está proyectado. */}
                  {editing && (
                    <section className="flex flex-col gap-2">
                      <label htmlFor="revenue-status" className="text-sm font-medium">Estado</label>
                      <Select
                        id="revenue-status"
                        value={form.status ?? "PENDING"}
                        onChange={(e) => setForm({ ...form, status: e.target.value as RevenueRequest["status"] })}
                      >
                        {EDIT_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        <strong>Recibido</strong> se marca automáticamente cuando el ingreso está totalmente pagado. Para pagarlo ve a <em>Pagos</em>.
                      </p>
                    </section>
                  )}

                  {save.isError && (
                    <p className="text-sm text-danger">
                      {save.error instanceof Error ? save.error.message : "Error al guardar"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
                <Button type="button" variant="outline" onClick={closeModal} disabled={save.isPending}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={save.isPending}>
                  {editing ? "Guardar cambios" : "Crear ingreso"}
                </Button>
              </div>
            </form>
          </div>
      </AnimatedOverlay>

{confirmDelete && (
      <AnimatedOverlay
        open={true}
        onClose={() => setConfirmDelete(null)}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <h2 className="text-base font-semibold">¿Eliminar ingreso?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se eliminará <span className="font-medium text-foreground">{confirmDelete.title}</span>.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={remove.isPending}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => remove.mutate(confirmDelete.id)} isLoading={remove.isPending}>
                Eliminar
              </Button>
            </div>
          </div>
      </AnimatedOverlay>
)}

      <AnimatedOverlay
        open={categoriesModalOpen}
        onClose={closeCategoriesModal}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-3xl md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">Categorías de ingreso</h2>
              <button onClick={closeCategoriesModal} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
              {/* Panel informativo: qué es cada tipo y qué impacto tiene en el sistema */}
              <aside className="max-h-44 shrink-0 overflow-y-auto border-b border-border bg-muted/30 p-4 md:max-h-none md:w-72 md:border-b-0 md:border-r">
                <h3 className="text-sm font-semibold">¿Para qué sirve cada tipo?</h3>
                <ul className="mt-3 flex flex-col gap-3">
                  {REVENUE_CATEGORY_TYPES.map((t) => (
                    <li key={t.value}>
                      <p className="text-xs font-medium">{t.label}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{t.hint}</p>
                    </li>
                  ))}
                </ul>
                {categories.some((c) => c.is_system) && (
                  <p className="mt-4 flex items-start gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
                    <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                    Las categorías del sistema las crea el ERP automáticamente (ventas, órdenes, caja); no se muestran en la lista porque no se pueden editar ni eliminar.
                  </p>
                )}
              </aside>

              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4">
                {userCategories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Tags className="h-10 w-10 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">No hay categorías</p>
                    <p className="text-xs text-muted-foreground">
                      Crea la primera categoría de ingreso usando el formulario de abajo.
                    </p>
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {userCategories.map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-col gap-1 rounded-xl border border-border bg-background p-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-medium">{c.name}</p>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => toggleCategory.mutate(c.id)}
                              disabled={toggleCategory.isPending}
                              title={c.is_active ? "Desactivar" : "Activar"}
                              aria-label={c.is_active ? "Desactivar" : "Activar"}
                            >
                              {c.is_active ? (
                                <Ban className="h-3.5 w-3.5" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => handleEditCategory(c)}
                              title="Editar"
                              aria-label="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-danger hover:text-danger"
                              onClick={() => openConfirmDeleteCategory(c)}
                              disabled={deleteCategory.isPending}
                              title="Eliminar"
                              aria-label="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              c.is_active ? "bg-success" : "bg-muted-foreground/40"
                            }`}
                            title={c.is_active ? "Activa" : "Inactiva"}
                          />
                          <span className="truncate">{revenueCategoryTypeLabel(c.category_type)}</span>
                        </div>
                        {c.description && (
                          <p className="truncate text-[11px] text-muted-foreground/80">{c.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="shrink-0 border-t border-border p-3">
                <form onSubmit={handleSaveCategory} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      id="category-name"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      placeholder={editingCategory ? `Editando: ${editingCategory.name}` : "Nueva categoría…"}
                      className="h-9 flex-1"
                      required
                    />
                    <Select
                      id="category-type"
                      value={categoryForm.category_type}
                      onChange={(e) =>
                        setCategoryForm({
                          ...categoryForm,
                          category_type: e.target.value as RevenueCategoryRequest["category_type"],
                        })
                      }
                      className="h-9 w-36 shrink-0"
                      required
                    >
                      {REVENUE_CATEGORY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                    {editingCategory && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 shrink-0 p-0"
                        onClick={resetCategoryForm}
                        disabled={createCategory.isPending || updateCategory.isPending}
                        title="Cancelar edición"
                        aria-label="Cancelar edición"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      type="submit"
                      size="sm"
                      className="h-9 shrink-0"
                      isLoading={createCategory.isPending || updateCategory.isPending}
                    >
                      {editingCategory ? "Guardar" : "Crear"}
                    </Button>
                  </div>
                  {(createCategory.isError || updateCategory.isError) && (
                    <p className="text-xs text-danger">
                      {(createCategory.error ?? updateCategory.error) instanceof Error
                        ? ((createCategory.error ?? updateCategory.error) as Error).message
                        : "Error al guardar"}
                    </p>
                  )}
                </form>
              </div>
              </div>
            </div>
          </div>
      </AnimatedOverlay>

{confirmDeleteCategory && (
      <AnimatedOverlay
        open={true}
        onClose={() => setConfirmDeleteCategory(null)}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <h2 className="text-base font-semibold">¿Eliminar categoría?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se eliminará <span className="font-medium text-foreground">{confirmDeleteCategory.name}</span>.
            </p>
            {deleteCategory.isError && (
              <p className="mt-2 text-sm text-danger">
                {deleteCategory.error instanceof Error ? deleteCategory.error.message : "Error al eliminar"}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDeleteCategory(null)} disabled={deleteCategory.isPending}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteCategory.mutate(confirmDeleteCategory.id)}
                isLoading={deleteCategory.isPending}
              >
                Eliminar
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

function TableSkeleton() {
  return (
    <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border">
            {Array.from({ length: 7 }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <Skeleton className="h-3.5 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, row) => (
            <tr key={row} className="border-b border-border last:border-0">
              {Array.from({ length: 7 }).map((__, col) => (
                <td key={col} className="px-4 py-3">
                  <Skeleton className="h-4 w-full max-w-[80px]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MobileCardsSkeleton() {
  return (
    <div className="grid gap-3 md:hidden">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
            <div className="shrink-0 space-y-1 text-right">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="ml-auto h-3 w-16" />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
            {Array.from({ length: 4 }).map((__, i) => (
              <div key={i} className="min-w-0 space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {Array.from({ length: 4 }).map((__, i) => (
              <Skeleton key={i} className="h-10 w-10 rounded-md" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
