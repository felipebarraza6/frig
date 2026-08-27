"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  CheckCircle2,
  FileDown,
  Receipt,
  SlidersHorizontal,
  DollarSign,
  TrendingUp,
  Clock,
  Ban,
  RotateCcw,
  Tags,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  fetchRevenues,
  fetchRevenueSummary,
  fetchRevenueCategories,
  createRevenue,
  updateRevenue,
  deleteRevenue,
  cancelRevenue,
  markRevenueAsReceived,
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
  type RevenueSummary,
} from "@/lib/api/revenues";
import { useCurrentBranch } from "@/lib/store/session";
import { formatCLP } from "@/lib/utils";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { Skeleton } from "@/components/ui/skeleton";

const REVENUE_CATEGORY_TYPES = [
  { value: "SALES", label: "Ventas" },
  { value: "SERVICES", label: "Servicios" },
  { value: "RENTAL", label: "Alquiler" },
  { value: "COMMISSION", label: "Comisión" },
  { value: "INVESTMENT", label: "Inversión" },
  { value: "REFUND", label: "Reembolso" },
  { value: "OTHER", label: "Otro" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "PENDING", label: "Pendiente" },
  { value: "RECEIVED", label: "Recibido" },
  { value: "CANCELLED", label: "Cancelado" },
  { value: "REFUNDED", label: "Reembolsado" },
  { value: "SCHEDULED", label: "Programado" },
];

const REVENUE_TYPES = [
  { value: "SALE", label: "Venta" },
  { value: "SERVICE", label: "Servicio" },
  { value: "RENTAL", label: "Alquiler" },
  { value: "COMMISSION", label: "Comisión" },
  { value: "INVESTMENT", label: "Inversión" },
  { value: "REFUND", label: "Reembolso" },
  { value: "OTHER", label: "Otro" },
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

function statusBadgeClass(status?: string | null) {
  if (status === "RECEIVED") {
    return "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700";
  }
  if (status === "CANCELLED" || status === "REFUNDED") {
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

export default function RevenuesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [period, setPeriod] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Revenue | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Revenue | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [form, setForm] = useState<RevenueRequest>({
    title: "",
    description: "",
    branch: 0,
    category: "",
    revenue_type: "SALE",
    amount: "",
    revenue_date: toISODate(new Date()),
    status: "PENDING",
  });
  const [categoriesModalOpen, setCategoriesModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<RevenueCategory | null>(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<RevenueCategory | null>(null);
  const branch = useCurrentBranch();
  const [categoryForm, setCategoryForm] = useState<RevenueCategoryRequest>({
    name: "",
    category_type: "SALES",
    description: "",
    branch: Number(branch?.branch_id ?? 0),
  });

  const {
    data: page,
    isLoading: isLoadingPage,
    isError: isPageError,
    refetch: refetchPage,
  } = useQuery({
    queryKey: ["revenues", { search, category, status, startDate, endDate, pageUrl }],
    queryFn: () => fetchRevenues({ search, category, status, startDate, endDate, ...pageUrl }),
  });

  const summaryFilter = { search, category, status, startDate, endDate };
  const {
    data: summary,
    isLoading: isLoadingSummary,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["revenues", "summary", summaryFilter],
    queryFn: () => fetchRevenueSummary(summaryFilter),
  });

  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();
  const filter = { search, category, status, startDate, endDate };

  async function handleExportExcel() {
    await downloadFile(() => exportRevenuesExcel(filter), {
      filename: exportFilename("ingresos", "xlsx"),
      extension: "xlsx",
    });
  }

  async function handleDownloadVoucher(revenue: Revenue) {
    await downloadFile(() => downloadRevenueVoucher(revenue.id), {
      filename: `comprobante_${revenue.id.slice(0, 8)}.pdf`,
    });
  }

  const { data: categories = [] } = useQuery({
    queryKey: ["revenue-categories"],
    queryFn: fetchRevenueCategories,
  });

  const revenues = useMemo(() => page?.results ?? [], [page]);
  const totalRevenues = page?.count ?? 0;

  const stats = useMemo(() => {
    const amount = (field: keyof RevenueSummary): number => {
      const raw = summary?.[field];
      if (raw === undefined || raw === null) return 0;
      return parseFloat(String(raw)) || 0;
    };
    const total = amount("total_amount") || amount("total");
    const received = amount("received_amount") || amount("received");
    const pending = amount("pending_amount") || amount("pending");
    const cancelled =
      amount("cancelled_amount") ||
      amount("cancelled") ||
      amount("refunded_amount") ||
      amount("refunded");
    return { total, received, pending, cancelled };
  }, [summary]);

  const pageTotal = useMemo(
    () => revenues.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0),
    [revenues],
  );

  const hasActiveFilters = search || category || status || startDate || endDate;

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        await updateRevenue(editing.id, form);
      } else {
        await createRevenue(form);
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

  const markReceived = useMutation({
    mutationFn: (id: string) => markRevenueAsReceived(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["revenues"] }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelRevenue(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["revenues"] }),
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
        branch: Number(branch?.branch_id ?? 0),
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
        revenue_type: revenue.revenue_type,
        amount: revenue.amount,
        revenue_date: revenue.revenue_date,
        status: revenue.status ?? "PENDING",
      });
    } else {
      setForm({
        title: "",
        description: "",
        branch: 0,
        category: "",
        revenue_type: "SALE",
        amount: "",
        revenue_date: toISODate(new Date()),
        status: "PENDING",
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
          <div className="hidden flex-wrap items-end gap-3 md:flex">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => updateFilter(setSearch, e.target.value)}
                placeholder="Buscar ingreso…"
                className="pl-9"
                aria-label="Buscar ingreso"
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
                  placeholder="Buscar ingreso…"
                  className="h-10 pl-9"
                  aria-label="Buscar ingreso"
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
                <div className="grid grid-cols-2 gap-3">
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

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                label="Total ingresos"
                value={formatCLP(stats.total)}
                icon={DollarSign}
                sub={`${totalRevenues} registros`}
                tone="emerald"
              />
              <StatCard
                label="Recibido"
                value={formatCLP(stats.received)}
                icon={TrendingUp}
                sub="ingresos cobrados"
                tone="emerald"
              />
              <StatCard
                label="Pendiente"
                value={formatCLP(stats.pending)}
                icon={Clock}
                sub="por cobrar"
                tone="amber"
              />
              <StatCard
                label="Cancelado / Reembolsado"
                value={formatCLP(stats.cancelled)}
                icon={Ban}
                sub="no efectivos"
                tone="rose"
              />
            </>
          )}
        </section>

        {isPageError || isSummaryError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
            <AlertCircle className="h-10 w-10 text-danger" />
            <p className="text-sm font-medium">No se pudieron cargar los ingresos</p>
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
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Título</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {revenues.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-medium">{r.title}</p>
                          {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.category_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.revenue_type_display}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCLP(r.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={statusBadgeClass(r.status)}>
                          {statusLabel(r.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.revenue_date}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.status === "PENDING" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markReceived.mutate(r.id)}
                              disabled={markReceived.isPending}
                            >
                              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                              Recibir
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleDownloadVoucher(r)}
                            disabled={isDownloading}
                            title="Descargar comprobante"
                            aria-label="Descargar comprobante"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            <span className="sr-only">Comprobante</span>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openModal(r)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Editar
                          </Button>
                          {r.status !== "CANCELLED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancel.mutate(r.id)}
                              disabled={cancel.isPending}
                            >
                              Cancelar
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-danger hover:text-danger"
                            onClick={() => setConfirmDelete(r)}
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
              {revenues.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.title}</p>
                        {r.description && (
                          <p className="text-xs text-muted-foreground">{r.description}</p>
                        )}
                        <span className={`mt-1 inline-flex ${statusBadgeClass(r.status)}`}>
                          {statusLabel(r.status)}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-bold tabular-nums text-emerald-700">{formatCLP(r.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">{r.revenue_date}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Categoría</span>
                      <span className="font-medium text-foreground">{r.category_name}</span>
                    </div>
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Tipo</span>
                      <span className="font-medium text-foreground">{r.revenue_type_display}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    {r.status === "PENDING" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 gap-1.5 px-3 text-xs"
                        onClick={() => markReceived.mutate(r.id)}
                        disabled={markReceived.isPending}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Recibir
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 p-0"
                      onClick={() => handleDownloadVoucher(r)}
                      disabled={isDownloading}
                      title="Comprobante"
                      aria-label="Comprobante"
                    >
                      <Receipt className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 p-0"
                      onClick={() => openModal(r)}
                      title="Editar"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {r.status !== "CANCELLED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 w-10 p-0 text-amber-600 hover:text-amber-600"
                        onClick={() => cancel.mutate(r.id)}
                        disabled={cancel.isPending}
                        title="Cancelar"
                        aria-label="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 p-0 text-danger hover:text-danger"
                      onClick={() => setConfirmDelete(r)}
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
                  {totalRevenues} ingreso{totalRevenues === 1 ? "" : "s"}
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
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="revenue-title" className="text-sm font-medium">Título</label>
                    <Input
                      id="revenue-title"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="revenue-category" className="text-sm font-medium">Categoría</label>
                      <Select
                        id="revenue-category"
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
                      <label htmlFor="revenue-type" className="text-sm font-medium">Tipo</label>
                      <Select
                        id="revenue-type"
                        value={form.revenue_type}
                        onChange={(e) => setForm({ ...form, revenue_type: e.target.value as RevenueRequest["revenue_type"] })}
                      >
                        {REVENUE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="revenue-amount" className="text-sm font-medium">Monto</label>
                      <Input
                        id="revenue-amount"
                        type="number"
                        step="0.01"
                        min="0"
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
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="revenue-status" className="text-sm font-medium">Estado</label>
                    <Select
                      id="revenue-status"
                      value={form.status ?? "PENDING"}
                      onChange={(e) => setForm({ ...form, status: e.target.value as RevenueRequest["status"] })}
                    >
                      {STATUS_OPTIONS.filter((o) => o.value !== "").map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="revenue-desc" className="text-sm font-medium">Descripción</label>
                    <Input
                      id="revenue-desc"
                      value={form.description ?? ""}
                      onChange={(e) => setForm({ ...form, description: e.target.value || null })}
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
            <h2 className="text-base font-semibold">¿Eliminar ingreso?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se eliminará <span className="font-medium text-foreground">{confirmDelete.title}</span>.
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
              <h2 className="text-base font-semibold">Categorías de ingreso</h2>
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
                      Crea la primera categoría de ingreso usando el formulario.
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
                            {REVENUE_CATEGORY_TYPES.find((t) => t.value === c.category_type)?.label ?? c.category_type}
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
                    <label htmlFor="category-name" className="text-sm font-medium">
                      Nombre
                    </label>
                    <Input
                      id="category-name"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      placeholder="Nombre de la categoría"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="category-type" className="text-sm font-medium">
                      Tipo de categoría
                    </label>
                    <Select
                      id="category-type"
                      value={categoryForm.category_type}
                      onChange={(e) =>
                        setCategoryForm({
                          ...categoryForm,
                          category_type: e.target.value as RevenueCategoryRequest["category_type"],
                        })
                      }
                      required
                    >
                      {REVENUE_CATEGORY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="category-desc" className="text-sm font-medium">
                      Descripción
                    </label>
                    <Input
                      id="category-desc"
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

      {confirmDeleteCategory && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/40 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
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
                disabled={deleteCategory.isPending}
              >
                {deleteCategory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Eliminar
              </Button>
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
          <p className="mt-1 text-xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8 ${toneIcon[tone]}`}>
          <Icon className="h-5 w-5 sm:h-4 sm:w-4" />
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
        <Skeleton className="h-10 w-10 rounded-full sm:h-8 sm:w-8" />
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
