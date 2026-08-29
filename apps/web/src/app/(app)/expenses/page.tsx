"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Pencil,
  Trash2,

  X,
  Ban,
  TrendingUp,
  FileDown,
  SlidersHorizontal,
  DollarSign,
  CheckCircle2,
  Clock,
  RotateCcw,
  Tags,
  AlertCircle,
  Eye,
  Download,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  fetchExpenses,
  fetchExpenseSummary,
  fetchExpenseCategories,
  createExpense,
  updateExpense,
  deleteExpense,
  cancelExpense,
  exportExpensesExcel,
  downloadExpenseVoucher,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  toggleExpenseCategoryActive,
  type FixedExpense,
  type FixedExpenseRequest,
  type ExpenseCategory,
  type ExpenseCategoryRequest,
  type ExpenseSummary,
} from "@/lib/api/expenses";
import { useCurrentBranch } from "@/lib/store/session";
import { formatCLP, expenseFrequencyLabel, expenseCategoryTypeLabel } from "@/lib/utils";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { useViewFile } from "@/lib/hooks/useViewFile";
import { useToast } from "@/lib/store/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";

const EXPENSE_CATEGORY_TYPES = [
  { value: "RENT", label: "Renta" },
  { value: "UTILITIES", label: "Servicios Públicos" },
  { value: "SALARIES", label: "Salarios" },
  { value: "INSURANCE", label: "Seguros" },
  { value: "MAINTENANCE", label: "Mantenimiento" },
  { value: "MARKETING", label: "Marketing" },
  { value: "LICENSES", label: "Licencias" },
  { value: "EQUIPMENT", label: "Equipos" },
  { value: "SUPPLIES", label: "Suministros" },
  { value: "OTHER", label: "Otros" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "ACTIVE", label: "Activo" },
  { value: "INACTIVE", label: "Inactivo" },
  { value: "PENDING", label: "Pendiente" },
  { value: "CANCELLED", label: "Cancelado" },
];

const FORM_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Activo" },
  { value: "INACTIVE", label: "Inactivo" },
  { value: "PENDING", label: "Pendiente" },
  { value: "CANCELLED", label: "Cancelado" },
];

const FREQUENCY_OPTIONS = [
  { value: "ONE_TIME", label: "Una vez" },
  { value: "MONTHLY", label: "Mensual" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMI_ANNUAL", label: "Semestral" },
  { value: "ANNUAL", label: "Anual" },
];

const PERIOD_OPTIONS = [
  { value: "", label: "Personalizado" },
  { value: "today", label: "Hoy" },
  { value: "this_week", label: "Esta semana" },
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Mes pasado" },
  { value: "last_3_months", label: "Últimos 3 meses" },
];

function statusLabel(value?: string | null): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
}

function frequencyLabel(value?: string | null): string {
  return FREQUENCY_OPTIONS.find((o) => o.value === value)?.label ?? expenseFrequencyLabel(value);
}

function statusBadgeClass(status?: string | null) {
  if (status === "ACTIVE") {
    return "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700";
  }
  if (status === "CANCELLED") {
    return "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger";
  }
  return "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700";
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [period, setPeriod] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FixedExpense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FixedExpense | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [form, setForm] = useState<FixedExpenseRequest>({
    name: "",
    description: "",
    branch: 0,
    category: "",
    amount: "",
    frequency: "ONE_TIME",
    start_date: toISODate(new Date()),
    status: "ACTIVE",
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
    data: page,
    isLoading: isLoadingPage,
    isError: isPageError,
    refetch: refetchPage,
  } = useQuery({
    queryKey: ["expenses", { search, category, status, startDate, endDate, pageUrl }],
    queryFn: () => fetchExpenses({ search, category, status, startDate, endDate, ...pageUrl }),
  });

  const summaryFilter = { search, category, status, startDate, endDate };
  const {
    data: summary,
    isLoading: isLoadingSummary,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["expenses", "summary", summaryFilter],
    queryFn: () => fetchExpenseSummary(summaryFilter),
  });

  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();
  const filter = { search, category, status, startDate, endDate };

  async function handleExportExcel() {
    await downloadFile(() => exportExpensesExcel(filter), {
      filename: exportFilename("egresos", "xlsx"),
      extension: "xlsx",
    });
  }

  async function handleDownloadVoucher(expense: FixedExpense) {
    await downloadFile(() => downloadExpenseVoucher(expense.id), {
      filename: `comprobante_${expense.id.slice(0, 8)}.pdf`,
    });
  }

  const { view: viewFile } = useViewFile();

  async function handleViewVoucher(expense: FixedExpense) {
    await viewFile(() => downloadExpenseVoucher(expense.id), {
      onError: (err) => toast.error(err.message || "No se pudo previsualizar el comprobante"),
    });
  }

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: fetchExpenseCategories,
  });

  const expenses = useMemo(() => page?.results ?? [], [page]);
  const totalExpenses = page?.count ?? 0;

  const stats = useMemo(() => {
    const amount = (field: keyof ExpenseSummary): number => {
      const raw = summary?.[field];
      if (raw === undefined || raw === null) return 0;
      return parseFloat(String(raw)) || 0;
    };
    let total = amount("total_amount") || amount("total");
    let active = amount("active_amount") || amount("active");
    let pending = amount("pending_amount") || amount("pending");
    let cancelled = amount("cancelled_amount") || amount("cancelled");

    // Fallback: calcular desde los items de la página si el summary está vacío
    if (total === 0 && active === 0 && pending === 0 && cancelled === 0 && expenses.length > 0) {
      total = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      active = expenses.filter((e) => e.status === "ACTIVE").reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      pending = expenses.filter((e) => e.status === "PENDING").reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      cancelled = expenses.filter((e) => e.status === "CANCELLED").reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    }

    return { total, active, pending, cancelled };
  }, [summary, expenses]);

  const pageTotal = useMemo(
    () => expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0),
    [expenses],
  );

  const hasActiveFilters = search || category || status || startDate || endDate;

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        await updateExpense(editing.id, form);
      } else {
        await createExpense(form);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      closeModal();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setConfirmDelete(null);
    },
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelExpense(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
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
    setEditing(expense ?? null);
    if (expense) {
      setForm({
        name: expense.name,
        description: expense.description ?? "",
        branch: expense.branch,
        category: expense.category,
        amount: expense.amount,
        frequency: expense.frequency ?? "ONE_TIME",
        start_date: expense.start_date,
        end_date: expense.end_date ?? undefined,
        status: expense.status ?? "ACTIVE",
        is_recurring: expense.is_recurring ?? false,
        supplier: expense.supplier ?? "",
        notes: expense.notes ?? "",
      });
    } else {
      setForm({
        name: "",
        description: "",
        branch: 0,
        category: "",
        amount: "",
        frequency: "ONE_TIME",
        start_date: toISODate(new Date()),
        status: "ACTIVE",
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
  }

  function updateFilter<T extends string>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  function applyPeriod(value: string) {
    setPeriod(value);
    setPageUrl({});

    if (!value) {
      setStartDate("");
      setEndDate("");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (value) {
      case "today": {
        const d = toISODate(today);
        setStartDate(d);
        setEndDate(d);
        break;
      }
      case "this_week": {
        setStartDate(toISODate(startOfWeek(today)));
        setEndDate(toISODate(today));
        break;
      }
      case "this_month": {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(toISODate(start));
        setEndDate(toISODate(today));
        break;
      }
      case "last_month": {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        setStartDate(toISODate(start));
        setEndDate(toISODate(end));
        break;
      }
      case "last_3_months": {
        const start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        setStartDate(toISODate(start));
        setEndDate(toISODate(today));
        break;
      }
    }
  }

  function handleStartDateChange(value: string) {
    setStartDate(value);
    setPeriod("");
    setPageUrl({});
  }

  function handleEndDateChange(value: string) {
    setEndDate(value);
    setPeriod("");
    setPageUrl({});
  }

  function clearFilters() {
    setSearch("");
    setCategory("");
    setStatus("");
    setStartDate("");
    setEndDate("");
    setPeriod("");
    setPageUrl({});
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Egresos</h1>
          <p className="text-xs text-muted-foreground">
            Gastos, proveedores y pagos recurrentes
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
          <div className="hidden flex-wrap items-end gap-3 md:flex">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => updateFilter(setSearch, e.target.value)}
                placeholder="Buscar gasto…"
                className="pl-9"
                aria-label="Buscar gasto"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-category" className="text-xs text-muted-foreground">Categoría</label>
              <Select
                id="filter-category"
                value={category}
                onChange={(e) => updateFilter(setCategory, e.target.value)}
              >
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
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
              <label htmlFor="filter-period" className="text-xs text-muted-foreground">Período</label>
              <Select
                id="filter-period"
                value={period}
                onChange={(e) => applyPeriod(e.target.value)}
              >
                {PERIOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-start" className="text-xs text-muted-foreground">Desde</label>
              <Input
                id="filter-start"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-end" className="text-xs text-muted-foreground">Hasta</label>
              <Input
                id="filter-end"
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="h-10"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Limpiar filtros
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
                  placeholder="Buscar gasto…"
                  className="h-10 pl-9"
                  aria-label="Buscar gasto"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-10 px-3"
                onClick={() => setShowMobileFilters((v) => !v)}
                aria-expanded={showMobileFilters}
                aria-controls="mobile-filters-panel"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="ml-2">Filtros</span>
              </Button>
            </div>

            <div
              id="mobile-filters-panel"
              className={`rounded-2xl border border-border bg-card p-4 shadow-sm ${showMobileFilters ? "" : "hidden"}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">Filtros avanzados</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => setShowMobileFilters(false)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Cerrar filtros</span>
                </Button>
              </div>
              <div className="grid gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-category-mobile" className="text-xs text-muted-foreground">Categoría</label>
                  <Select
                    id="filter-category-mobile"
                    value={category}
                    onChange={(e) => updateFilter(setCategory, e.target.value)}
                  >
                    <option value="">Todas</option>
                    {categories.map((c) => (
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
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-period-mobile" className="text-xs text-muted-foreground">Período</label>
                  <Select
                    id="filter-period-mobile"
                    value={period}
                    onChange={(e) => applyPeriod(e.target.value)}
                  >
                    {PERIOD_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="filter-start-mobile" className="text-xs text-muted-foreground">Desde</label>
                    <Input
                      id="filter-start-mobile"
                      type="date"
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="filter-end-mobile" className="text-xs text-muted-foreground">Hasta</label>
                    <Input
                      id="filter-end-mobile"
                      type="date"
                      value={endDate}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  className="h-10"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Limpiar filtros
                </Button>
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {isLoadingSummary ? (
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
                tone="rose"
              />
              <StatCard
                label="Activos"
                value={formatCLP(stats.active)}
                icon={CheckCircle2}
                sub="gastos vigentes"
                tone="emerald"
              />
              <StatCard
                label="Pendientes"
                value={formatCLP(stats.pending)}
                icon={Clock}
                sub="por pagar"
                tone="amber"
              />
              <StatCard
                label="Cancelados"
                value={formatCLP(stats.cancelled)}
                icon={Ban}
                sub="anulados"
                tone="rose"
              />
            </>
          )}
        </section>

        {isPageError || isSummaryError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
            <AlertCircle className="h-10 w-10 text-danger" />
            <p className="text-sm font-medium">No se pudieron cargar los egresos</p>
            <p className="max-w-md text-xs text-muted-foreground">
              {isPageError && isSummaryError
                ? "Ocurrió un error al consultar el listado y el resumen."
                : isPageError
                  ? "Ocurrió un error al consultar el listado."
                  : "Ocurrió un error al consultar el resumen."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (isPageError) refetchPage();
                if (isSummaryError) refetchSummary();
              }}
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
                <TrendingUp className="h-7 w-7 text-muted-foreground" />
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
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Gasto</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">Frecuencia</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Inicio</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
                            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{e.name}</p>
                            {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{e.category_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.supplier_name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{frequencyLabel(e.frequency)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCLP(e.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={statusBadgeClass(e.status)}>
                          {statusLabel(e.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{e.start_date}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <ActionsMenu
                            ariaLabel="Comprobante"
                            items={[
                              {
                                label: "Ver PDF",
                                icon: Eye,
                                onClick: () => handleViewVoucher(e),
                              },
                              {
                                label: "Descargar comprobante",
                                icon: Download,
                                onClick: () => handleDownloadVoucher(e),
                              },
                            ]}
                          />
                          <Button variant="ghost" size="sm" onClick={() => openModal(e)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Editar
                          </Button>
                          {e.status !== "CANCELLED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancel.mutate(e.id)}
                              disabled={cancel.isPending}
                            >
                              <Ban className="mr-1.5 h-3.5 w-3.5" />
                              Anular
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-danger hover:text-danger"
                            onClick={() => setConfirmDelete(e)}
                            title="Eliminar"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Eliminar</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {expenses.map((e) => (
                <div
                  key={e.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{e.name}</p>
                        {e.description && (
                          <p className="break-words text-xs text-muted-foreground">{e.description}</p>
                        )}
                        <span className={`mt-1 inline-flex ${statusBadgeClass(e.status)}`}>
                          {statusLabel(e.status)}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-bold tabular-nums text-rose-700">{formatCLP(e.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">{e.start_date}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Categoría</span>
                      <span className="block truncate font-medium text-foreground">{e.category_name}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Frecuencia</span>
                      <span className="block truncate font-medium text-foreground">{frequencyLabel(e.frequency)}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Inicio</span>
                      <span className="block truncate font-medium text-foreground">{e.start_date}</span>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Estado</span>
                      <span className="block truncate font-medium text-foreground">{statusLabel(e.status)}</span>
                    </div>
                    {e.supplier_name && (
                      <div className="col-span-2 min-w-0">
                        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Proveedor</span>
                        <span className="block truncate font-medium text-foreground">{e.supplier_name}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <ActionsMenu
                      ariaLabel="Comprobante"
                      items={[
                        {
                          label: "Ver PDF",
                          icon: Eye,
                          onClick: () => handleViewVoucher(e),
                        },
                        {
                          label: "Descargar comprobante",
                          icon: Download,
                          onClick: () => handleDownloadVoucher(e),
                        },
                      ]}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 shrink-0 p-0"
                      onClick={() => openModal(e)}
                      title="Editar"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {e.status !== "CANCELLED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 w-10 shrink-0 p-0 text-amber-600 hover:text-amber-600"
                        onClick={() => cancel.mutate(e.id)}
                        disabled={cancel.isPending}
                        title="Anular"
                        aria-label="Anular"
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 shrink-0 p-0 text-danger hover:text-danger"
                      onClick={() => setConfirmDelete(e)}
                      title="Eliminar"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="expense-name" className="text-sm font-medium">Nombre</label>
                    <Input
                      id="expense-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="expense-category" className="text-sm font-medium">Categoría</label>
                      <Select
                        id="expense-category"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        required
                      >
                        <option value="">Selecciona</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="expense-amount" className="text-sm font-medium">Monto</label>
                      <Input
                        id="expense-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="expense-frequency" className="text-sm font-medium">Frecuencia</label>
                      <Select
                        id="expense-frequency"
                        value={form.frequency}
                        onChange={(e) => {
                          const freq = e.target.value as FixedExpenseRequest["frequency"];
                          setForm({ ...form, frequency: freq, is_recurring: freq !== "ONE_TIME" });
                        }}
                      >
                        {FREQUENCY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="expense-date" className="text-sm font-medium">Fecha inicio</label>
                      <Input
                        id="expense-date"
                        type="date"
                        value={form.start_date}
                        onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="expense-status" className="text-sm font-medium">Estado</label>
                    <Select
                      id="expense-status"
                      value={form.status ?? "ACTIVE"}
                      onChange={(e) => setForm({ ...form, status: e.target.value as FixedExpenseRequest["status"] })}
                    >
                      {FORM_STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="expense-supplier" className="text-sm font-medium">Proveedor</label>
                    <Input
                      id="expense-supplier"
                      value={form.supplier ?? ""}
                      onChange={(e) => setForm({ ...form, supplier: e.target.value || null })}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="expense-notes" className="text-sm font-medium">Notas</label>
                    <Input
                      id="expense-notes"
                      value={form.notes ?? ""}
                      onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
                      placeholder="Opcional"
                    />
                  </div>
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
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">Categorías de egreso</h2>
              <button onClick={closeCategoriesModal} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4">
                {categories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Tags className="h-10 w-10 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">No hay categorías</p>
                    <p className="text-xs text-muted-foreground">
                      Crea la primera categoría de egreso usando el formulario.
                    </p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {categories.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{c.name}</p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                c.is_active
                                  ? "bg-emerald-500/10 text-emerald-700"
                                  : "bg-slate-500/10 text-slate-700"
                              }`}
                            >
                              {c.is_active ? "Activa" : "Inactiva"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {expenseCategoryTypeLabel(c.category_type) ?? EXPENSE_CATEGORY_TYPES.find((t) => t.value === c.category_type)?.label ?? c.category_type}
                          </p>
                          {c.description && (
                            <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
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
                            <span className="sr-only">{c.is_active ? "Desactivar" : "Activar"}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEditCategory(c)}
                            title="Editar"
                            aria-label="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-danger hover:text-danger"
                            onClick={() => openConfirmDeleteCategory(c)}
                            disabled={deleteCategory.isPending}
                            title="Eliminar"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Eliminar</span>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="shrink-0 border-t border-border p-4">
                <form onSubmit={handleSaveCategory} className="flex flex-col gap-3">
                  <h3 className="text-sm font-medium">
                    {editingCategory ? "Editar categoría" : "Nueva categoría"}
                  </h3>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="expense-category-name" className="text-sm font-medium">
                      Nombre
                    </label>
                    <Input
                      id="expense-category-name"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      placeholder="Nombre de la categoría"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="expense-category-type" className="text-sm font-medium">
                      Tipo de categoría
                    </label>
                    <Select
                      id="expense-category-type"
                      value={categoryForm.category_type}
                      onChange={(e) =>
                        setCategoryForm({
                          ...categoryForm,
                          category_type: e.target.value as ExpenseCategoryRequest["category_type"],
                        })
                      }
                      required
                    >
                      {EXPENSE_CATEGORY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="expense-category-desc" className="text-sm font-medium">
                      Descripción
                    </label>
                    <Input
                      id="expense-category-desc"
                      value={categoryForm.description ?? ""}
                      onChange={(e) =>
                        setCategoryForm({ ...categoryForm, description: e.target.value || null })
                      }
                      placeholder="Opcional"
                    />
                  </div>
                  {(createCategory.isError || updateCategory.isError) && (
                    <p className="text-sm text-danger">
                      {(createCategory.error ?? updateCategory.error) instanceof Error
                        ? ((createCategory.error ?? updateCategory.error) as Error).message
                        : "Error al guardar"}
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    {editingCategory && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetCategoryForm}
                        disabled={createCategory.isPending || updateCategory.isPending}
                      >
                        Cancelar edición
                      </Button>
                    )}
                    <Button
                      type="submit"
                      isLoading={createCategory.isPending || updateCategory.isPending}
                    >
                      Guardar
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
      </AnimatedOverlay>

      <AnimatedOverlay
        open={!!confirmDeleteCategory}
        onClose={() => setConfirmDeleteCategory(null)}
        panelClassName="flex items-end justify-center p-0 md:items-center md:p-4"
      >
          <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <h2 className="text-base font-semibold">¿Eliminar categoría?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se eliminará <span className="font-medium text-foreground">{confirmDeleteCategory!.name}</span>.
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
                onClick={() => deleteCategory.mutate(confirmDeleteCategory!.id)}
                isLoading={deleteCategory.isPending}
              >
                Eliminar
              </Button>
            </div>
          </div>
      </AnimatedOverlay>
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
  tone?: "emerald" | "rose" | "amber" | "teal" | "slate";
}) {
  const toneStyles = {
    emerald: "from-emerald-50/60 via-white/90 to-white/90",
    rose: "from-rose-50/60 via-white/90 to-white/90",
    amber: "from-amber-50/60 via-white/90 to-white/90",
    teal: "from-teal-50/60 via-white/90 to-white/90",
    slate: "from-muted/50 via-white/90 to-white/90",
  };
  const toneText = {
    emerald: "text-emerald-700/90",
    rose: "text-rose-700/90",
    amber: "text-amber-700/90",
    teal: "text-teal-700/90",
    slate: "text-muted-foreground",
  };
  const toneIcon = {
    emerald: "bg-emerald-500/12 text-emerald-600",
    rose: "bg-rose-500/12 text-rose-600",
    amber: "bg-amber-500/12 text-amber-600",
    teal: "bg-teal-500/12 text-teal-600",
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
            {Array.from({ length: 8 }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <Skeleton className="h-3.5 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, row) => (
            <tr key={row} className="border-b border-border last:border-0">
              {Array.from({ length: 8 }).map((__, col) => (
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
          className="rounded-2xl border border-border bg-card p-4 shadow-sm"
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
