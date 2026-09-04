"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Ban,
  TrendingDown,
  FileDown,
  SlidersHorizontal,
  DollarSign,
  CheckCircle2,
  Clock,
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
  fetchExpenses,
  fetchExpenseCategories,
  createExpense,
  updateExpense,
  deleteExpense,
  cancelExpense,
  downloadExpenseVoucher,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  toggleExpenseCategoryActive,
  type FixedExpense,
  type FixedExpenseRequest,
  type ExpenseCategory,
  type ExpenseCategoryRequest,
} from "@/lib/api/expenses";
import { useCurrentBranch } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import { formatCLP, expenseCategoryTypeLabel } from "@/lib/utils";
import { fetchPurchaseOrder, fetchPurchaseOrderPaymentSummary } from "@/lib/api/suppliers";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { generateExcelBlob } from "@/lib/export-excel";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";

const EXPENSE_CATEGORY_TYPES: { value: string; label: string; hint: string }[] = [
  {
    value: "RENT",
    label: "Renta",
    hint: "Arriendo del local o de equipos. Uso manual; se agrupa en los reportes financieros.",
  },
  {
    value: "UTILITIES",
    label: "Servicios Públicos",
    hint: "Luz, agua, gas e internet. Uso manual; se agrupa en los reportes financieros.",
  },
  {
    value: "SALARIES",
    label: "Salarios",
    hint: "La usan automáticamente las nóminas de empleados. Se agrupa en los reportes de costos de personal.",
  },
  {
    value: "INSURANCE",
    label: "Seguros",
    hint: "Primas de seguros. Uso manual; se agrupa en los reportes financieros.",
  },
  {
    value: "MAINTENANCE",
    label: "Mantenimiento",
    hint: "Reparaciones y mantención. Uso manual; se agrupa en los reportes financieros.",
  },
  {
    value: "MARKETING",
    label: "Marketing",
    hint: "Publicidad y promoción. Uso manual; se agrupa en los reportes financieros.",
  },
  {
    value: "LICENSES",
    label: "Licencias",
    hint: "Permisos y licencias de software. Uso manual; se agrupa en los reportes financieros.",
  },
  {
    value: "EQUIPMENT",
    label: "Equipos",
    hint: "Compra o arriendo de equipos. Uso manual; se agrupa en los reportes financieros.",
  },
  {
    value: "SUPPLIES",
    label: "Suministros",
    hint: "Insumos y materiales. Las órdenes de compra usan la categoría marcada como predeterminada para proveedores.",
  },
  {
    value: "OTHER",
    label: "Otros",
    hint: "La usan automáticamente los retiros de caja y como respaldo para los egresos de órdenes de compra.",
  },
];

/** Filtro de estado derivado (igual que el badge de la tabla): pagado / parcial /
 *  pendiente / atrasado / cancelado. */
type DerivedStatus = "pagado" | "parcial" | "pendiente" | "atrasado" | "cancelado";

const STATUS_FILTER_OPTIONS: { value: "" | DerivedStatus; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "pagado", label: "Pagado" },
  { value: "parcial", label: "Parcial" },
  { value: "pendiente", label: "Pendiente" },
  { value: "atrasado", label: "Atrasado" },
  { value: "cancelado", label: "Cancelado" },
];

const FORM_STATUS_OPTIONS = [
  { value: "PENDING", label: "Pendiente" },
  { value: "ACTIVE", label: "Activo" },
  { value: "INACTIVE", label: "Inactivo" },
  { value: "CANCELLED", label: "Cancelado" },
];

/** Estado del formulario: los inputs manejan strings y se convierte al enviar.
 *  `purchase_order` se excluye: la vinculación a una orden de compra la hace
 *  el sistema, no el formulario de creación. */
type ExpenseFormState = Omit<FixedExpenseRequest, "amount" | "purchase_order"> & {
  amount: string;
};

/** Estado derivado de un egreso según su pago y fecha de inicio. */
function derivedStatus(e: FixedExpense, today: string): DerivedStatus {
  if (e.status === "CANCELLED") return "cancelado";
  const paid = e.total_paid || 0;
  const pending = Math.max(e.pending_amount || 0, 0);
  if (e.is_fully_paid || (paid > 0 && pending <= 0)) return "pagado";
  // Parcial antes que atrasado: si ya hubo un pago y queda saldo, es "Parcial"
  // aunque la fecha haya pasado; "atrasado" queda para lo nunca pagado.
  if (paid > 0 && pending > 0) return "parcial";
  if (pending > 0 && e.start_date < today) return "atrasado";
  return "pendiente";
}

function paymentStatus(e: FixedExpense, today: string): {
  label: string;
  className: string;
  total: number;
  paid: number;
  pending: number;
  pct: number;
} {
  const total = e.amount || 0;
  const paid = e.total_paid || 0;
  // Nunca negativo: en gastos recurrentes el pagado acumula varios períodos.
  const pending = Math.max(e.pending_amount || 0, 0);
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const base = { total, paid, pending, pct };

  switch (derivedStatus(e, today)) {
    case "cancelado":
      return { label: "Cancelado", className: "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger", ...base };
    case "pagado":
      return { label: "Pagado", className: "rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success", ...base };
    case "atrasado":
      return { label: "Atrasado", className: "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger", ...base };
    case "parcial":
      return { label: "Parcial", className: "rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning", ...base };
    default:
      return { label: "Pendiente", className: "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground", ...base };
  }
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Formato de fecha corto es-CL; tolera ISO con hora (toma solo la parte de fecha). */
function formatDateCL(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CL");
}

/** Filtros que persisten entre visitas al módulo. */
const EXPENSE_FILTERS_KEY = "frig.expenses.filters";
const PAGE_SIZE = 10;

interface PersistedExpenseFilters {
  startDate?: string;
  endDate?: string;
  category?: string;
  status?: string;
}

function loadPersistedFilters(): PersistedExpenseFilters {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(EXPENSE_FILTERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedExpenseFilters;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

type PurchaseOrderDetail = Awaited<ReturnType<typeof fetchPurchaseOrder>>;

/** Datos de la orden de compra asociada. Query con caché propia por orden. */
function usePurchaseOrderDetail(orderId: string | null | undefined) {
  return useQuery({
    queryKey: ["purchase-order", orderId],
    queryFn: () => fetchPurchaseOrder(orderId!),
    enabled: Boolean(orderId),
    staleTime: 60_000,
  });
}

/** Historial de pagos de la orden de compra (método, fecha, monto, referencia). */
function usePurchaseOrderPaymentSummary(orderId: string | null | undefined) {
  return useQuery({
    queryKey: ["purchase-order-payment-summary", orderId],
    queryFn: () => fetchPurchaseOrderPaymentSummary(orderId!),
    enabled: Boolean(orderId),
    staleTime: 60_000,
  });
}

/** Tono semántico del badge de estado de la orden de compra. */
function purchaseOrderTone(status: PurchaseOrderDetail["status"]): {
  label: string;
  tone: "success" | "info" | "warning" | "danger" | "muted";
} {
  switch (status) {
    case "COMPLETED":
    case "RECEIVED":
      return { label: "Completada", tone: "success" };
    case "PARTIAL_RECEIVED":
      return { label: "Recepción parcial", tone: "warning" };
    case "CANCELLED":
      return { label: "Anulada", tone: "danger" };
    case "SENT":
      return { label: "Enviada", tone: "info" };
    case "CONFIRMED":
      return { label: "Confirmada", tone: "info" };
    default:
      return { label: "Borrador", tone: "muted" };
  }
}

/** Título para egresos con orden de compra: el correlativo es el identificador principal. */
function PurchaseOrderLinkedTitle({
  orderId,
  orderNumber,
  onView,
}: {
  orderId: string;
  orderNumber?: string | null;
  onView: (orderId: string) => void;
}) {
  const { data: order } = usePurchaseOrderDetail(orderId);
  return (
    <button
      type="button"
      onClick={() => onView(orderId)}
      className="block max-w-full truncate text-left font-mono font-medium text-primary hover:underline"
      title="Ver orden de compra asociada"
    >
      #{order?.order_number ?? orderNumber ?? orderId.slice(0, 8).toUpperCase()}
    </button>
  );
}

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [persistedFilters] = useState(loadPersistedFilters);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(persistedFilters.category ?? "");
  const [status, setStatus] = useState(persistedFilters.status ?? "");
  const [startDate, setStartDate] = useState(persistedFilters.startDate ?? "");
  const [endDate, setEndDate] = useState(persistedFilters.endDate ?? "");
  const [pageNum, setPageNum] = useState(0);

  // Persistir rango de fechas, categoría y estado para que el usuario retome sus filtros.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        EXPENSE_FILTERS_KEY,
        JSON.stringify({ startDate, endDate, category, status }),
      );
    } catch {
      // sin almacenamiento disponible: los filtros solo viven en la sesión
    }
  }, [startDate, endDate, category, status]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FixedExpense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FixedExpense | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [viewingPurchaseOrderId, setViewingPurchaseOrderId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseFormState>({
    name: "",
    description: "",
    branch: 0,
    category: "",
    amount: "",
    frequency: "ONE_TIME",
    start_date: toISODate(new Date()),
    status: "PENDING",
    is_recurring: false,
    supplier: "",
    notes: "",
  });
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<ExpenseCategory | null>(null);
  const branch = useCurrentBranch();
  const [categoryForm, setCategoryForm] = useState<ExpenseCategoryRequest>({
    name: "",
    category_type: "RENT",
    description: "",
    branch: Number(branch?.branch_id ?? 0),
  });

  const {
    data: listPage,
    isLoading: isLoadingPage,
    isError: isPageError,
    refetch: refetchPage,
  } = useQuery({
    queryKey: ["expenses", "list", { search, category, startDate, endDate }],
    queryFn: () =>
      fetchExpenses({ search, category, startDate, endDate, page_size: 500 }),
  });

  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();

  async function handleDownloadVoucher(expense: FixedExpense) {
    await downloadFile(() => downloadExpenseVoucher(expense.id), {
      filename: `comprobante_${expense.id.slice(0, 8)}.pdf`,
    });
  }

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: fetchExpenseCategories,
  });

  const {
    data: purchaseOrderDetail,
    isLoading: isLoadingPurchaseOrder,
    isError: isPurchaseOrderError,
  } = usePurchaseOrderDetail(viewingPurchaseOrderId);
  const { data: purchaseOrderPayments } = usePurchaseOrderPaymentSummary(
    viewingPurchaseOrderId,
  );

  /** Solo los egresos manuales son editables: los generados automáticamente
   *  (orden de compra asociada o categoría de sistema) se gestionan desde su módulo origen. */
  const isManualExpense = (e: FixedExpense) =>
    !e.purchase_order_id && !categories.find((c) => c.id === e.category)?.is_system;

  /** En el gestor solo se listan las categorías creadas por el usuario;
   *  las de sistema se ocultan porque no se pueden administrar. */
  const userCategories = categories.filter((c) => !c.is_system);

  /** Categorías seleccionables en el formulario: manuales y activas. Si el egreso
   *  en edición usa una categoría inactiva, se incluye para no perder el valor. */
  const formCategoryOptions = categories.filter(
    (c) => (!c.is_system && c.is_active) || c.id === form.category,
  );

  /** Categorías ordenadas para los filtros: primero las de sistema, luego activas
   *  y al final las inactivas (se marcan en el label). */
  const sortedCategories = [...categories].sort((a, b) => {
    if (Boolean(a.is_system) !== Boolean(b.is_system)) {
      return a.is_system ? -1 : 1;
    }
    if (Boolean(a.is_active) !== Boolean(b.is_active)) {
      return a.is_active ? -1 : 1;
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
  // Los egresos generados por una orden de compra NO se listan aquí: viven en
  // el módulo Órdenes de compra. Gastos muestra solo egresos manuales.
  const allExpenses = useMemo(
    () => (listPage?.results ?? []).filter((e) => !e.purchase_order_id),
    [listPage],
  );
  // El filtro de estado es derivado (pagado/parcial/pendiente/atrasado/cancelado)
  // y se resuelve en cliente sobre el conjunto traído del servidor.
  const expenses = useMemo(
    () =>
      status
        ? allExpenses.filter((e) => derivedStatus(e, todayStr) === status)
        : allExpenses,
    [allExpenses, status, todayStr],
  );

  // Paginación en cliente sobre el conjunto filtrado.
  const totalExpenses = expenses.length;
  const pageCount = Math.max(1, Math.ceil(totalExpenses / PAGE_SIZE));
  const currentPage = Math.min(pageNum, pageCount - 1);
  const pageItems = useMemo(
    () => expenses.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [expenses, currentPage],
  );

  // Stats calculados sobre el conjunto filtrado en cliente.
  const stats = useMemo(() => {
    let total = 0;
    let paid = 0;
    let pending = 0;
    let overdue = 0;
    for (const e of expenses) {
      if (e.status === "CANCELLED") continue;
      total += e.amount || 0;
      paid += e.total_paid || 0;
      // Nunca negativo: en recurrentes el pagado acumula varios períodos.
      const pendingAmount = Math.max(e.pending_amount || 0, 0);
      pending += pendingAmount;
      // Pendiente real: lo pendiente cuya fecha de inicio ya pasó
      if (pendingAmount > 0 && e.start_date < todayStr) overdue += pendingAmount;
    }
    return { total, paid, pending, overdue };
  }, [expenses, todayStr]);

  const pageTotal = useMemo(
    () => pageItems.reduce((sum, e) => sum + (e.amount || 0), 0),
    [pageItems],
  );

  const hasActiveFilters = search || category || status || startDate || endDate;

  async function handleExportExcel() {
    // Exporta exactamente lo visible en pantalla (egresos manuales, sin los
    // generados por órdenes de compra), con el estado derivado resuelto.
    const headers = [
      "Nombre",
      "Descripción",
      "Categoría",
      "Monto",
      "Fecha inicio",
      "Estado",
      "Pagado",
      "Pendiente",
    ];
    const rows = expenses.map((e) => {
      const ps = paymentStatus(e, todayStr);
      return [
        e.name,
        e.description ?? "",
        e.category_name ?? "",
        e.amount,
        formatDateCL(e.start_date),
        ps.label,
        ps.paid,
        ps.pending,
      ];
    });
    const blob = await generateExcelBlob("Egresos", headers, rows);
    await downloadFile(async () => ({ blob }), {
      filename: exportFilename("egresos", "xlsx"),
      extension: "xlsx",
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      // is_recurring se deriva de la frecuencia para no depender de dos
      // campos que puedan contradecirse.
      const payload = {
        ...form,
        amount: Number(form.amount),
        is_recurring: form.frequency !== "ONE_TIME",
      };
      if (editing) {
        await updateExpense(editing.id, payload);
      } else {
        await createExpense(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(editing ? "Gasto actualizado" : "Gasto creado");
      closeModal();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Error al guardar el gasto");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setConfirmDelete(null);
      toast.success("Gasto eliminado");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Error al eliminar el gasto");
    },
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Gasto cancelado");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Error al cancelar el gasto");
    },
  });

  const createCategory = useMutation({
    mutationFn: (payload: ExpenseCategoryRequest) => createExpenseCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      resetCategoryForm();
    },
  });

  const updateCategory = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<ExpenseCategoryRequest>;
    }) => updateExpenseCategory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      resetCategoryForm();
    },
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => deleteExpenseCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
    },
  });

  const toggleCategory = useMutation({
    mutationFn: (id: string) => toggleExpenseCategoryActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
    },
  });

  function resetCategoryForm() {
    setEditingCategory(null);
    setCategoryForm({
      name: "",
      category_type: "RENT",
      description: "",
      branch: Number(branch?.branch_id ?? 0),
    });
  }

  function openCategoryModal() {
    setCategoriesModalOpen(true);
  }

  function closeCategoriesModal() {
    setCategoriesModalOpen(false);
    resetCategoryForm();
  }

  function handleEditCategory(category: ExpenseCategory) {
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
        branch: Number(branch?.branch_id ?? 0),
        description: categoryForm.description || null,
      });
    }
  }

  function openConfirmDeleteCategory(category: ExpenseCategory) {
    deleteCategory.reset();
    setConfirmDeleteCategory(category);
  }

  function openModal(expense?: FixedExpense) {
    save.reset();
    setEditing(expense ?? null);
    if (expense) {
      // Preservar frecuencia/recurrencia reales: forzar ONE_TIME aquí
      // convertía silenciosamente un gasto recurrente en único al editar.
      setForm({
        name: expense.name,
        description: expense.description ?? "",
        branch: expense.branch,
        category: expense.category,
        amount: String(expense.amount),
        frequency: expense.frequency ?? "ONE_TIME",
        start_date: expense.start_date,
        end_date: expense.end_date ?? undefined,
        status: expense.status ?? "PENDING",
        is_recurring: expense.is_recurring ?? false,
        supplier: expense.supplier ?? "",
        notes: expense.notes ?? "",
      });
    } else {
      setForm({
        name: "",
        description: "",
        branch: Number(branch?.branch_id ?? 0),
        category: "",
        amount: "",
        frequency: "ONE_TIME",
        start_date: toISODate(new Date()),
        status: "PENDING",
        is_recurring: false,
        supplier: "",
        notes: "",
      });
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    save.reset();
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
    setStartDate("");
    setEndDate("");
    setPageNum(0);
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Egresos</h1>
          <p className="text-xs text-muted-foreground">
            Gastos, proveedores y pagos del negocio
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
            title="Nuevo egreso"
            aria-label="Nuevo egreso"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => openModal()}
            className="hidden sm:flex"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo egreso
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
                aria-label="Buscar gasto"
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
                  <option key={c.id} value={c.id}>
                    {c.is_active ? c.name : `${c.name} (inactiva)`}
                  </option>
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
                  aria-label="Buscar gasto"
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
                        <option key={c.id} value={c.id}>
                          {c.is_active ? c.name : `${c.name} (inactiva)`}
                        </option>
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
                label="Total egresos"
                value={formatCLP(stats.total)}
                icon={DollarSign}
                sub={`${totalExpenses} registros`}
                tone="slate"
              />
              <StatCard
                label="Pagados"
                value={formatCLP(stats.paid)}
                icon={CheckCircle2}
                sub="monto efectivamente pagado"
                tone="success"
              />
              <StatCard
                label="Por pagar"
                value={formatCLP(stats.pending)}
                icon={Clock}
                sub="saldo pendiente"
                tone="warning"
              />
              <StatCard
                label="Atrasados"
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
            <p className="text-sm font-medium">No se pudieron cargar los egresos</p>
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
        ) : expenses.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border p-8 text-center">
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <TrendingDown className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="mt-4 text-base font-medium">No se encontraron egresos</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Ajusta los filtros o crea un nuevo egreso para comenzar."
                  : "Aún no hay egresos registrados. Registra el primero."}
              </p>
              {!hasActiveFilters && (
                <Button size="sm" onClick={() => openModal()} className="mt-5 h-10 px-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo egreso
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5">Egreso</th>
                    <th className="px-3 py-2.5">Categoría</th>
                    <th className="px-3 py-2.5">Proveedor</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-3 py-2.5">Estado de pago</th>
                    <th className="hidden px-3 py-3 2xl:table-cell">Inicio</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0">
                            {e.purchase_order_id ? (
                              <PurchaseOrderLinkedTitle
                                orderId={e.purchase_order_id}
                                orderNumber={e.purchase_order_number}
                                onView={setViewingPurchaseOrderId}
                              />
                            ) : (
                              <p className="max-w-[160px] truncate font-medium" title={e.name}>{e.name}</p>
                            )}
                            <p
                              className="font-mono text-[11px] text-muted-foreground"
                              title={`ID egreso: ${e.id}`}
                            >
                              #{e.id.slice(0, 8).toUpperCase()}
                            </p>
                            {e.description && !e.purchase_order_id && (
                              <p className="truncate text-xs text-muted-foreground">{e.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {e.purchase_order_id ? "Orden de compra" : e.category_name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{e.supplier_name || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCLP(e.amount)}</td>
                      <td className="px-3 py-2.5">
                        {(() => {
                          const ps = paymentStatus(e, todayStr);
                          const showDetail = e.status !== "CANCELLED";
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
                                  {ps.pending > 0 && (
                                    <span className="text-warning">
                                      Faltan {formatCLP(ps.pending)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="hidden px-3 py-3 text-muted-foreground 2xl:table-cell">{e.start_date}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 px-2 text-xs"
                            onClick={() => handleDownloadVoucher(e)}
                            title="Descargar comprobante A4"
                          >
                            <FileText className="h-4 w-4" />
                            A4
                          </Button>
                          {/* Los egresos automáticos (orden de compra o categoría de sistema)
                              no se tocan desde aquí: solo se puede descargar el comprobante. */}
                          {isManualExpense(e) && (
                            <ActionsMenu
                              ariaLabel="Acciones"
                              items={[
                                {
                                  label: "Editar",
                                  icon: Pencil,
                                  onClick: () => openModal(e),
                                },
                                ...(e.status !== "CANCELLED"
                                  ? [
                                      {
                                        label: "Cancelar",
                                        icon: X,
                                        onClick: () => cancel.mutate(e.id),
                                      },
                                    ]
                                  : []),
                                {
                                  label: "Eliminar",
                                  icon: Trash2,
                                  onClick: () => setConfirmDelete(e),
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
              {pageItems.map((e) => (
                <div
                  key={e.id}
                  className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="min-w-0 flex-1">
                        {e.purchase_order_id ? (
                          <PurchaseOrderLinkedTitle
                            orderId={e.purchase_order_id}
                            orderNumber={e.purchase_order_number}
                            onView={setViewingPurchaseOrderId}
                          />
                        ) : (
                          <p className="max-w-[160px] truncate font-medium" title={e.name}>{e.name}</p>
                        )}
                        <p
                          className="font-mono text-[10px] text-muted-foreground"
                          title={`ID egreso: ${e.id}`}
                        >
                          #{e.id.slice(0, 8).toUpperCase()}
                        </p>
                        {e.description && !e.purchase_order_id && (
                          <p className="break-words text-xs text-muted-foreground">{e.description}</p>
                        )}
                        {(() => {
                          const ps = paymentStatus(e, todayStr);
                          return (
                            <span className={`mt-1 inline-flex w-fit items-center gap-1 whitespace-nowrap ${ps.className}`}>
                              {ps.label}
                              {ps.pct > 0 && ps.pct < 100 && (
                                <span className="text-[10px] opacity-80">({ps.pct}%)</span>
                              )}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-bold tabular-nums text-foreground">{formatCLP(e.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">{e.start_date}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Categoría</span>
                      <span className="block truncate font-medium text-foreground">
                        {e.purchase_order_id ? "Orden de compra" : e.category_name}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Inicio</span>
                      <span className="block truncate font-medium text-foreground">{e.start_date}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Estado de pago</span>
                      {(() => {
                        const ps = paymentStatus(e, todayStr);
                        const showDetail = e.status !== "CANCELLED";
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
                            {showDetail && ps.pending > 0 && (
                              <span className="text-[10px] font-medium text-warning">
                                Faltan {formatCLP(ps.pending)}
                              </span>
                            )}
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
                    {e.supplier_name && (
                      <div className="col-span-2 min-w-0">
                        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Proveedor</span>
                        <span className="block truncate font-medium text-foreground">{e.supplier_name}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 px-2 text-xs"
                      onClick={() => handleDownloadVoucher(e)}
                      title="Descargar comprobante A4"
                    >
                      <FileText className="h-4 w-4" />
                      A4
                    </Button>
                    {isManualExpense(e) && (
                      <ActionsMenu
                        ariaLabel="Acciones"
                        variant="outline"
                        size="icon"
                        items={[
                          {
                            label: "Editar",
                            icon: Pencil,
                            onClick: () => openModal(e),
                          },
                          ...(e.status !== "CANCELLED"
                            ? [
                                {
                                  label: "Cancelar",
                                  icon: X,
                                  onClick: () => cancel.mutate(e.id),
                                },
                              ]
                            : []),
                          {
                            label: "Eliminar",
                            icon: Trash2,
                            onClick: () => setConfirmDelete(e),
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
                  {totalExpenses} gasto{totalExpenses === 1 ? "" : "s"}
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

      {/* Detalle de la orden de compra asociada al egreso */}
      <AnimatedOverlay
        open={!!viewingPurchaseOrderId}
        onClose={() => setViewingPurchaseOrderId(null)}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
        <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-xl md:border">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Orden de compra
              </p>
              <h2 className="text-base font-semibold tabular-nums">
                {purchaseOrderDetail?.order_number ?? viewingPurchaseOrderId?.slice(0, 8)}
              </h2>
            </div>
            <button
              onClick={() => setViewingPurchaseOrderId(null)}
              aria-label="Cerrar"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingPurchaseOrder ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : isPurchaseOrderError || !purchaseOrderDetail ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <AlertCircle className="h-8 w-8 text-danger" />
                <p className="text-sm font-medium">No se pudo cargar la orden de compra</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingPurchaseOrderId(null)}
                >
                  Cerrar
                </Button>
              </div>
            ) : (
              (() => {
                const status = purchaseOrderTone(purchaseOrderDetail.status);
                const toneBadge: Record<string, string> = {
                  success: "bg-success/10 text-success ring-success/20",
                  info: "bg-primary/10 text-primary ring-primary/20",
                  warning: "bg-warning/10 text-warning ring-warning/20",
                  danger: "bg-danger/10 text-danger ring-danger/20",
                  muted: "bg-muted text-muted-foreground ring-border",
                };
                const paymentBadge = purchaseOrderDetail.is_fully_paid
                  ? "bg-success/10 text-success ring-success/20"
                  : purchaseOrderDetail.is_partially_paid
                    ? "bg-warning/10 text-warning ring-warning/20"
                    : "bg-muted text-muted-foreground ring-border";
                const paymentLabel = purchaseOrderDetail.is_fully_paid
                  ? "Pagada"
                  : purchaseOrderDetail.is_partially_paid
                    ? "Pago parcial"
                    : "Sin pagar";
                return (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${toneBadge[status.tone]}`}>
                        {status.label}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${paymentBadge}`}>
                        {paymentLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border bg-background p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Proveedor</p>
                        <p className="mt-1 truncate text-sm font-semibold">
                          {purchaseOrderDetail.supplier_name ?? "Gasto común"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-background p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fecha</p>
                        <p className="mt-1 text-sm font-semibold">{purchaseOrderDetail.order_date}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-background p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Entrega esperada</p>
                        <p className="mt-1 text-sm font-semibold">{purchaseOrderDetail.expected_delivery_date}</p>
                      </div>
                      {purchaseOrderDetail.actual_delivery_date && (
                        <div className="rounded-xl border border-border bg-background p-3">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Entrega real</p>
                          <p className="mt-1 text-sm font-semibold">{purchaseOrderDetail.actual_delivery_date}</p>
                        </div>
                      )}
                      <div className="col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-primary/80">Total</p>
                        <p className="mt-1 text-lg font-extrabold tabular-nums">
                          {formatCLP(purchaseOrderDetail.total_amount ?? 0)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Pagado: <span className="font-medium text-success">{formatCLP(purchaseOrderDetail.paid_amount ?? 0)}</span>
                          {" · "}Por pagar: <span className="font-medium text-warning">{formatCLP(purchaseOrderDetail.remaining_amount ?? 0)}</span>
                        </p>
                      </div>
                      {(purchaseOrderDetail.subtotal !== undefined ||
                        (purchaseOrderDetail.tax_amount ?? 0) > 0 ||
                        (purchaseOrderDetail.discount_amount ?? 0) > 0) && (
                        <div className="col-span-2 flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
                          {purchaseOrderDetail.subtotal !== undefined && (
                            <span>Subtotal: <span className="font-medium text-foreground">{formatCLP(purchaseOrderDetail.subtotal)}</span></span>
                          )}
                          {(purchaseOrderDetail.tax_amount ?? 0) > 0 && (
                            <span>Impuestos: <span className="font-medium text-foreground">{formatCLP(purchaseOrderDetail.tax_amount ?? 0)}</span></span>
                          )}
                          {(purchaseOrderDetail.discount_amount ?? 0) > 0 && (
                            <span>Descuento: <span className="font-medium text-foreground">{formatCLP(purchaseOrderDetail.discount_amount ?? 0)}</span></span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Historial de pagos: cómo se llegó al total pagado */}
                    {purchaseOrderPayments && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Pagos ({purchaseOrderPayments.summary.payment_count})
                        </p>
                        {purchaseOrderPayments.payments.length === 0 ? (
                          <div className="mt-2 rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">
                            Sin pagos registrados
                          </div>
                        ) : (
                          <div className="mt-2 flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
                            {purchaseOrderPayments.payments.map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium">
                                    {p.payment_method ?? "Pago"}
                                  </p>
                                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                    {formatDateCL(p.payment_date)}
                                    {p.reference && ` · ${p.reference}`}
                                    {p.paid_by && ` · por ${p.paid_by}`}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <p className="font-semibold tabular-nums">
                                    {formatCLP(p.amount ?? 0)}
                                  </p>
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                                      p.status === "COMPLETED"
                                        ? "bg-success/10 text-success ring-success/20"
                                        : "bg-warning/10 text-warning ring-warning/20"
                                    }`}
                                  >
                                    {p.status === "COMPLETED" ? "Completado" : "Pendiente"}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {purchaseOrderDetail.items && purchaseOrderDetail.items.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Ítems ({purchaseOrderDetail.items.length})
                        </p>
                        <div className="mt-2 flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
                          {purchaseOrderDetail.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">
                                  {item.supplier_product_name || item.product_name || item.description || "Ítem"}
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  x{item.quantity_ordered ?? 0} · {formatCLP(item.unit_price ?? 0)} c/u
                                  {(item.quantity_received ?? 0) > 0 && ` · recibido: ${item.quantity_received}`}
                                </p>
                              </div>
                              <p className="shrink-0 font-semibold tabular-nums">
                                {formatCLP(item.total_price ?? 0)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {purchaseOrderDetail.notes && (
                      <div className="rounded-xl border border-border bg-background p-3 text-sm">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Notas</p>
                        <p className="mt-1">{purchaseOrderDetail.notes}</p>
                      </div>
                    )}
                    {purchaseOrderDetail.supplier_notes && (
                      <div className="rounded-xl border border-border bg-background p-3 text-sm">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Notas del proveedor</p>
                        <p className="mt-1">{purchaseOrderDetail.supplier_notes}</p>
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
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">{editing ? "Editar egreso" : "Nuevo egreso"}</h2>
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
              id="expense-form"
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
                      <label htmlFor="expense-name" className="text-sm font-medium">Nombre</label>
                      <Input
                        id="expense-name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Ej: Pago proveedor #1234"
                        required
                      />
                      {!editing && (
                        <p className="text-[11px] text-muted-foreground">
                          El egreso se crea por defecto como <strong>Pendiente</strong>; la fecha define cuándo está proyectado o atrasado.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="expense-desc" className="text-sm font-medium">Descripción</label>
                      <textarea
                        id="expense-desc"
                        value={form.description ?? ""}
                        onChange={(e) => setForm({ ...form, description: e.target.value || null })}
                        placeholder="Describe el origen del egreso…"
                        rows={3}
                        className="w-full resize-none rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="expense-category" className="text-sm font-medium">Categoría</label>
                      <Select
                        id="expense-category"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        required
                      >
                        <option value="">Selecciona una categoría</option>
                        {formCategoryOptions.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </Select>
                    </div>
                  </section>

                  {/* Monto y fecha */}
                  <section className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="expense-amount" className="text-sm font-medium">Monto</label>
                      <Input
                        id="expense-amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="expense-date" className="text-sm font-medium">Fecha</label>
                      <Input
                        id="expense-date"
                        type="date"
                        value={form.start_date}
                        onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                        required
                      />
                    </div>
                  </section>

                  {/* Estado: solo al editar. Al crear siempre es Pendiente; la fecha define cuándo está proyectado o atrasado. */}
                  {editing && (
                    <section className="flex flex-col gap-2">
                      <label htmlFor="expense-status" className="text-sm font-medium">Estado</label>
                      <Select
                        id="expense-status"
                        value={form.status ?? "PENDING"}
                        onChange={(e) => setForm({ ...form, status: e.target.value as FixedExpenseRequest["status"] })}
                      >
                        {FORM_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        <strong>Pagado</strong> se marca automáticamente cuando el egreso está totalmente pagado. Para pagarlo ve a <em>Pagos</em> o paga la orden de compra asociada.
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
              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={closeModal} disabled={save.isPending}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={save.isPending} className="w-full font-semibold sm:w-auto">
                  Guardar
                </Button>
              </div>
            </form>
          </div>
      </AnimatedOverlay>

{confirmDelete && (
      <AnimatedOverlay
        open={true}
        onClose={() => setConfirmDelete(null)}
        panelClassName="flex items-end justify-center p-0 md:items-center md:p-4"
      >
          <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <h2 className="text-base font-semibold">¿Eliminar egreso?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se eliminará <span className="font-medium text-foreground">{confirmDelete.name}</span>.
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
              <h2 className="text-base font-semibold">Categorías de egreso</h2>
              <button onClick={closeCategoriesModal} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
              {/* Panel informativo: qué es cada tipo y qué impacto tiene en el sistema */}
              <aside className="max-h-44 shrink-0 overflow-y-auto border-b border-border bg-muted/30 p-4 md:max-h-none md:w-72 md:border-b-0 md:border-r">
                <h3 className="text-sm font-semibold">¿Para qué sirve cada tipo?</h3>
                <ul className="mt-3 flex flex-col gap-3">
                  {EXPENSE_CATEGORY_TYPES.map((t) => (
                    <li key={t.value}>
                      <p className="text-xs font-medium">{t.label}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{t.hint}</p>
                    </li>
                  ))}
                </ul>
                {categories.some((c) => c.is_system) && (
                  <p className="mt-4 flex items-start gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
                    <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                    Las categorías del sistema las crea el ERP automáticamente (retiros de caja, nóminas, órdenes de compra); no se muestran en la lista porque no se pueden editar ni eliminar.
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
                      Crea la primera categoría de egreso usando el formulario de abajo.
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
                          <span className="truncate">{expenseCategoryTypeLabel(c.category_type) ?? EXPENSE_CATEGORY_TYPES.find((t) => t.value === c.category_type)?.label ?? c.category_type}</span>
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
                      id="expense-category-name"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      placeholder={editingCategory ? `Editando: ${editingCategory.name}` : "Nueva categoría…"}
                      className="h-9 flex-1"
                      required
                    />
                    <Select
                      id="expense-category-type"
                      value={categoryForm.category_type}
                      onChange={(e) =>
                        setCategoryForm({
                          ...categoryForm,
                          category_type: e.target.value as ExpenseCategoryRequest["category_type"],
                        })
                      }
                      className="h-9 w-36 shrink-0"
                      required
                    >
                      {EXPENSE_CATEGORY_TYPES.map((t) => (
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
                  </div>
                  {/* Sin este campo, editar una categoría enviaba description: null
                      y borraba la descripción existente. */}
                  <Input
                    id="expense-category-description"
                    value={categoryForm.description ?? ""}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    placeholder="Descripción (opcional)"
                    className="h-9"
                  />
                  <div className="flex justify-end">
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
        panelClassName="flex items-end justify-center p-0 md:items-center md:p-4"
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <th key={i} className="px-3 py-2.5">
                <Skeleton className="h-3.5 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, row) => (
            <tr key={row} className="border-b border-border last:border-0">
              {Array.from({ length: 8 }).map((__, col) => (
                <td key={col} className="px-3 py-2.5">
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
