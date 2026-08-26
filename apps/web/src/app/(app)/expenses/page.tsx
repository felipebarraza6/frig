"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  X,
  Ban,
  TrendingUp,
  FileDown,
  Receipt,
  SlidersHorizontal,
  DollarSign,
  CheckCircle2,
  Clock,
  RotateCcw,
  Tags,
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
} from "@/lib/api/expenses";
import { useCurrentBranch } from "@/lib/store/session";
import { formatCLP } from "@/lib/utils";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";

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
  return FREQUENCY_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
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
  const branch = useCurrentBranch();
  const [categoryForm, setCategoryForm] = useState<ExpenseCategoryRequest>({
    name: "",
    category_type: "RENT",
    description: "",
    branch: Number(branch?.branch_id ?? 0),
  });

  const { data: page, isLoading } = useQuery({
    queryKey: ["expenses", { search, category, status, startDate, endDate, pageUrl }],
    queryFn: () => fetchExpenses({ search, category, status, startDate, endDate, ...pageUrl }),
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

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: fetchExpenseCategories,
  });

  const expenses = useMemo(() => page?.results ?? [], [page]);
  const totalExpenses = page?.count ?? 0;

  const stats = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const active = expenses
      .filter((e) => e.status === "ACTIVE")
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const pending = expenses
      .filter((e) => e.status === "PENDING")
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const cancelled = expenses
      .filter((e) => e.status === "CANCELLED")
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    return { total, active, pending, cancelled };
  }, [expenses]);

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

  function handleDeleteCategory(id: string) {
    if (confirm("¿Eliminar esta categoría?")) {
      deleteCategory.mutate(id);
    }
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
            disabled={isDownloading}
            className="h-9 w-9 px-0 sm:w-auto sm:px-3"
            title="Exportar Excel"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
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
                  className="pl-9"
                  aria-label="Buscar gasto"
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

        {expenses.length > 0 && (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total egresos"
              value={formatCLP(stats.total)}
              icon={DollarSign}
              sub={`${expenses.length} registros visibles`}
            />
            <StatCard
              label="Activos"
              value={formatCLP(stats.active)}
              icon={CheckCircle2}
              sub="gastos vigentes"
            />
            <StatCard
              label="Pendientes"
              value={formatCLP(stats.pending)}
              icon={Clock}
              sub="por pagar"
            />
            <StatCard
              label="Cancelados"
              value={formatCLP(stats.cancelled)}
              icon={Ban}
              sub="anulados"
            />
          </section>
        )}

        {isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No se encontraron egresos</p>
              <p className="text-xs text-muted-foreground">
                {hasActiveFilters
                  ? "Prueba con otros filtros o crea un nuevo egreso."
                  : "Aún no hay egresos registrados."}
              </p>
              {!hasActiveFilters && (
                <Button size="sm" onClick={() => openModal()} className="mt-4">
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleDownloadVoucher(e)}
                            disabled={isDownloading}
                            title="Descargar comprobante"
                            aria-label="Descargar comprobante"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            <span className="sr-only">Comprobante</span>
                          </Button>
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                        <TrendingUp className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{e.name}</p>
                        {e.description && (
                          <p className="text-xs text-muted-foreground">{e.description}</p>
                        )}
                        <span className={`mt-1 inline-flex ${statusBadgeClass(e.status)}`}>
                          {statusLabel(e.status)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleDownloadVoucher(e)}
                        disabled={isDownloading}
                        title="Descargar comprobante"
                        aria-label="Descargar comprobante"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        <span className="sr-only">Comprobante</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openModal(e)}
                        title="Editar"
                        aria-label="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      {e.status !== "CANCELLED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-danger hover:text-danger"
                          onClick={() => cancel.mutate(e.id)}
                          disabled={cancel.isPending}
                          title="Anular"
                          aria-label="Anular"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          <span className="sr-only">Anular</span>
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
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Categoría</span>
                      <span className="font-medium text-foreground">{e.category_name}</span>
                    </div>
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Frecuencia</span>
                      <span className="font-medium text-foreground">{frequencyLabel(e.frequency)}</span>
                    </div>
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Monto</span>
                      <span className="font-medium tabular-nums text-foreground">{formatCLP(e.amount)}</span>
                    </div>
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Inicio</span>
                      <span className="font-medium text-foreground">{e.start_date}</span>
                    </div>
                    {e.supplier_name && (
                      <div className="col-span-2 text-muted-foreground">
                        <span className="block text-[10px] uppercase tracking-wide">Proveedor</span>
                        <span className="font-medium text-foreground">{e.supplier_name}</span>
                      </div>
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

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/40 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
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
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/40 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
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
              <Button variant="danger" onClick={() => remove.mutate(confirmDelete.id)} disabled={remove.isPending}>
                {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}

      {categoriesModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/40 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
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
                            {EXPENSE_CATEGORY_TYPES.find((t) => t.value === c.category_type)?.label ?? c.category_type}
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
                            onClick={() => handleDeleteCategory(c.id)}
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
                      disabled={createCategory.isPending || updateCategory.isPending}
                    >
                      {(createCategory.isPending || updateCategory.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Guardar
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
