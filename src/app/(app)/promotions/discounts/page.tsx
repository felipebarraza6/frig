"use client";

import { useMemo, useState } from "react";
import { StatCard as SharedStatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/page-header";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Percent,
  X,
  Calendar,
  FileDown,
  BarChart3,
  TrendingUp,
  Tag,
  SlidersHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { TableSkeleton } from "@/components/ui/skeleton";
import { formatCLP, cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import { isDateRangeValid } from "@/lib/validation";
import { useQuery } from "@tanstack/react-query";
import {
  useAllDiscounts,
  useCreateDiscountMutation,
  useUpdateDiscountMutation,
  useDeleteDiscountMutation,
  useDiscountDashboard,
  type PromotionDiscount,
  type PromotionDiscountList,
  type DiscountFormPayload,
} from "@/lib/hooks/useDiscounts";
import { useCategoryOptions } from "@/lib/hooks/useCategoryOptions";
import { fetchDiscount, exportDiscountsExcel, discountFlagTrue } from "@/lib/api/discounts";
import { fetchProducts, searchProductsForSale } from "@/lib/api/products";
import { useCurrentBranch } from "@/lib/store/session";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";

const DISCOUNT_TYPES = [
  { value: "PERCENTAGE", label: "Porcentaje" },
  { value: "FIXED_AMOUNT", label: "Monto fijo" },
  { value: "BUY_X_GET_Y", label: "Compra X lleva Y" },
  { value: "BULK_DISCOUNT", label: "Descuento por volumen" },
  { value: "LOYALTY", label: "Lealtad" },
  { value: "SEASONAL", label: "Estacional" },
  { value: "PROMOTIONAL", label: "Promocional" },
] as const;

const APPLY_TO = [
  { value: "ALL_PRODUCTS", label: "Todos los productos" },
  { value: "SPECIFIC_PRODUCTS", label: "Productos específicos" },
  { value: "CATEGORY", label: "Por categoría" },
  { value: "ORDER_TOTAL", label: "Total de la orden" },
] as const;

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Activo" },
  { value: "INACTIVE", label: "Inactivo" },
  { value: "SCHEDULED", label: "Programado" },
  { value: "EXPIRED", label: "Expirado" },
] as const;

type DiscountFormState = {
  name: string;
  code: string;
  description: string;
  discount_type: (typeof DISCOUNT_TYPES)[number]["value"];
  apply_to: (typeof APPLY_TO)[number]["value"];
  status: (typeof STATUS_OPTIONS)[number]["value"];
  discount_value: string;
  minimum_amount: string;
  maximum_discount: string;
  buy_quantity: string;
  get_quantity: string;
  bulk_threshold: string;
  start_date: string;
  end_date: string;
  max_uses: string;
  products: number[];
  categories: number[];
  is_stackable: boolean;
  is_first_time_only: boolean;
};

function emptyForm(): DiscountFormState {
  return {
    name: "",
    code: "",
    description: "",
    discount_type: "PERCENTAGE",
    apply_to: "ALL_PRODUCTS",
    status: "ACTIVE",
    discount_value: "",
    minimum_amount: "",
    maximum_discount: "",
    buy_quantity: "",
    get_quantity: "",
    bulk_threshold: "",
    start_date: "",
    end_date: "",
    max_uses: "",
    products: [],
    categories: [],
    is_stackable: false,
    is_first_time_only: false,
  };
}

function discountToForm(d: PromotionDiscount): DiscountFormState {
  return {
    name: d.name,
    code: d.code,
    description: d.description ?? "",
    discount_type: d.discount_type,
    apply_to: d.apply_to ?? "ALL_PRODUCTS",
    status: d.status ?? "ACTIVE",
    discount_value: String(d.discount_value),
    minimum_amount: d.minimum_amount?.toString() ?? "",
    maximum_discount: d.maximum_discount?.toString() ?? "",
    buy_quantity: d.buy_quantity?.toString() ?? "",
    get_quantity: d.get_quantity?.toString() ?? "",
    bulk_threshold: d.bulk_threshold?.toString() ?? "",
    start_date: d.start_date ? new Date(d.start_date).toISOString().slice(0, 10) : "",
    end_date: d.end_date ? new Date(d.end_date).toISOString().slice(0, 10) : "",
    max_uses: d.max_uses?.toString() ?? "",
    products: d.products ?? [],
    categories: d.categories ?? [],
    is_stackable: d.is_stackable ?? false,
    is_first_time_only: d.is_first_time_only ?? false,
  };
}

function toIsoDateTime(dateValue: string, endOfDay = false): string | null {
  if (!dateValue) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, 0);
  return date.toISOString();
}

function statusBadgeClass(status: PromotionDiscountList["status"]) {
  return cn(
    "inline-flex rounded px-2 py-0.5 text-xs font-medium",
    status === "ACTIVE"
      ? "bg-success/10 text-success"
      : status === "SCHEDULED"
      ? "bg-primary/10 text-primary"
      : status === "EXPIRED"
      ? "bg-warning/10 text-warning"
      : "bg-muted text-muted-foreground",
  );
}

export default function DiscountsPage() {
  const branch = useCurrentBranch();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [applyToFilter, setApplyToFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionDiscountList | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PromotionDiscountList | null>(null);
  const [form, setForm] = useState<DiscountFormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingDiscount, setLoadingDiscount] = useState(false);
  const toast = useToast();

  // status/tipo van al API; búsqueda nombre+código y apply_to quedan en cliente
  // sobre el listado ya paginado completo (catálogo de promos suele ser chico).
  const listFilters = useMemo(
    () => ({
      status: statusFilter || undefined,
      discount_type: typeFilter || undefined,
    }),
    [statusFilter, typeFilter],
  );
  const { data: discounts = [], isLoading, error } = useAllDiscounts(listFilters);
  const { data: dashboard } = useDiscountDashboard(branch?.branch_id);
  const { options: categoryOptions } = useCategoryOptions();
  const [productPickerQuery, setProductPickerQuery] = useState("");
  const debouncedProductPickerQuery = useDebouncedValue(productPickerQuery, 300);
  const [categoryPickerQuery, setCategoryPickerQuery] = useState("");
  const [manualProductNames, setManualProductNames] = useState<Record<number, string>>({});

  const productPickerSearch = useQuery({
    queryKey: ["products", "for-sale", "discounts", debouncedProductPickerQuery],
    queryFn: () => searchProductsForSale({ search: debouncedProductPickerQuery }),
    enabled: modalOpen && form.apply_to === "SPECIFIC_PRODUCTS" && debouncedProductPickerQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  const selectedProductsQuery = useQuery({
    queryKey: ["products", "ids", form.products],
    queryFn: () => fetchProducts({ ids: form.products, page_size: Math.max(form.products.length, 1) }),
    enabled: modalOpen && form.apply_to === "SPECIFIC_PRODUCTS" && form.products.length > 0,
    staleTime: 60_000,
  });

  const productNameMap = useMemo(() => {
    const next = { ...manualProductNames };
    for (const p of selectedProductsQuery.data?.results ?? []) {
      next[p.id] = p.name;
    }
    return next;
  }, [manualProductNames, selectedProductsQuery.data]);

  const productPickerOptions = useMemo(() => {
    return (productPickerSearch.data ?? [])
      .filter((p) => !form.products.includes(p.id))
      .map((p) => ({
        value: String(p.id),
        label: p.name,
        description: p.code ?? undefined,
      }));
  }, [productPickerSearch.data, form.products]);

  const categoryPickerOptions = useMemo(() => {
    const q = categoryPickerQuery.trim().toLowerCase();
    return categoryOptions
      .filter((c) => !form.categories.includes(c.id))
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .map((c) => ({ value: String(c.id), label: c.name }));
  }, [categoryOptions, form.categories, categoryPickerQuery]);

  const createMutation = useCreateDiscountMutation();
  const updateMutation = useUpdateDiscountMutation();
  const deleteMutation = useDeleteDiscountMutation();
  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return discounts.filter((d) => {
      // Búsqueda por código en cliente (el API filtra name__icontains; code se cruza aquí).
      const matchesSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q);
      const matchesApplyTo = !applyToFilter || d.apply_to === applyToFilter;
      const matchesActive =
        !activeOnly || (d.status === "ACTIVE" && !discountFlagTrue(d.is_expired));
      return matchesSearch && matchesApplyTo && matchesActive;
    });
  }, [discounts, search, applyToFilter, activeOnly]);

  async function handleExportExcel() {
    await downloadFile(
      () => exportDiscountsExcel({ status: statusFilter, discount_type: typeFilter }),
      {
        filename: exportFilename("descuentos", "xlsx"),
        extension: "xlsx",
      },
    );
  }

  function openModal(discount?: PromotionDiscountList) {
    setEditing(discount ?? null);
    setForm(discount ? discountToForm(discount as unknown as PromotionDiscount) : emptyForm());
    setFormError(null);
    setLoadingDiscount(false);
    setModalOpen(true);

    if (discount) {
      setLoadingDiscount(true);
      fetchDiscount(discount.id)
        .then((full) => setForm(discountToForm(full)))
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "No se pudo cargar el descuento.");
          setForm(emptyForm());
        })
        .finally(() => setLoadingDiscount(false));
    }
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setProductPickerQuery("");
    setCategoryPickerQuery("");
    setManualProductNames({});
  }

  function addProductToDiscount(productId: number, name: string) {
    setForm((prev) =>
      prev.products.includes(productId)
        ? prev
        : { ...prev, products: [...prev.products, productId] },
    );
    setManualProductNames((prev) => ({ ...prev, [productId]: name }));
    setProductPickerQuery("");
  }

  function removeProductFromDiscount(productId: number) {
    setForm((prev) => ({
      ...prev,
      products: prev.products.filter((id) => id !== productId),
    }));
  }

  function addCategoryToDiscount(categoryId: number) {
    setForm((prev) =>
      prev.categories.includes(categoryId)
        ? prev
        : { ...prev, categories: [...prev.categories, categoryId] },
    );
    setCategoryPickerQuery("");
  }

  function removeCategoryFromDiscount(categoryId: number) {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.filter((id) => id !== categoryId),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim() || !form.code.trim()) {
      setFormError("Nombre y código son obligatorios.");
      return;
    }
    const value = parseFloat(form.discount_value || "0");
    if (Number.isNaN(value) || value < 0) {
      setFormError("El valor del descuento debe ser un número positivo.");
      return;
    }
    if (form.discount_type === "PERCENTAGE" && value > 100) {
      setFormError("El porcentaje no puede ser mayor a 100.");
      return;
    }
    if (!form.start_date || !form.end_date) {
      setFormError("Las fechas de inicio y fin son obligatorias.");
      return;
    }
    if (!isDateRangeValid(form.start_date, form.end_date)) {
      setFormError("La fecha de inicio debe ser anterior a la fecha de fin.");
      return;
    }
    if (form.apply_to === "SPECIFIC_PRODUCTS" && form.products.length === 0) {
      setFormError("Agrega al menos un producto para este alcance.");
      return;
    }
    if (form.apply_to === "CATEGORY" && form.categories.length === 0) {
      setFormError("Agrega al menos una categoría para este alcance.");
      return;
    }
    if (form.discount_type === "BUY_X_GET_Y") {
      const buy = Number(form.buy_quantity);
      const get = Number(form.get_quantity);
      if (!buy || buy < 1 || !get || get < 1) {
        setFormError("Compra X lleva Y requiere cantidades válidas (≥ 1).");
        return;
      }
    }
    if (form.discount_type === "BULK_DISCOUNT") {
      const threshold = Number(form.bulk_threshold);
      if (!threshold || threshold < 1) {
        setFormError("El umbral de volumen debe ser al menos 1.");
        return;
      }
    }

    const payload: DiscountFormPayload = {
      branch: Number(branch?.branch_id ?? 0),
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || undefined,
      discount_type: form.discount_type,
      apply_to: form.apply_to,
      status: form.status,
      discount_value: value.toFixed(2),
      minimum_amount: form.minimum_amount
        ? Number(form.minimum_amount).toFixed(2)
        : undefined,
      maximum_discount: form.maximum_discount
        ? Number(form.maximum_discount).toFixed(2)
        : undefined,
      buy_quantity: form.buy_quantity ? Number(form.buy_quantity) : undefined,
      get_quantity: form.get_quantity ? Number(form.get_quantity) : undefined,
      bulk_threshold: form.bulk_threshold ? Number(form.bulk_threshold) : undefined,
      start_date: toIsoDateTime(form.start_date)!,
      end_date: toIsoDateTime(form.end_date, true)!,
      max_uses: form.max_uses ? Number(form.max_uses) : undefined,
      products: form.apply_to === "SPECIFIC_PRODUCTS" ? form.products : [],
      categories: form.apply_to === "CATEGORY" ? form.categories : [],
      is_stackable: form.is_stackable,
      is_first_time_only: form.is_first_time_only,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el descuento.");
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteMutation.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el descuento");
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
      <PageHeader
        title="Descuentos y cupones"
        icon={<Percent className="h-5 w-5" />}
        subtitle="Gestiona promociones, códigos y descuentos para el POS"
        actions={
          <>
            {/* Mobile: icon-only export */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleExportExcel}
              disabled={isDownloading || isLoading}
              isLoading={isDownloading}
              className="sm:hidden"
              title="Exportar Excel"
              aria-label="Exportar Excel"
            >
              <FileDown className="h-4 w-4" />
            </Button>
            {/* Desktop: export with text */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={isDownloading || isLoading}
              isLoading={isDownloading}
              className="hidden sm:flex"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>

            {/* Mobile: icon-only new discount */}
            <Button
              size="icon"
              onClick={() => openModal()}
              className="sm:hidden"
              title="Nuevo descuento"
              aria-label="Nuevo descuento"
            >
              <Plus className="h-4 w-4" />
            </Button>
            {/* Desktop: new discount with text */}
            <Button
              size="sm"
              onClick={() => openModal()}
              className="hidden sm:flex"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo descuento
            </Button>
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        {dashboard && (
          <>
            <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <SharedStatCard
                label="Total descuentos"
                value={dashboard.summary.total_discounts}
                icon={Tag}
                sub={`${dashboard.summary.active_discounts} activos`}
              />
              <SharedStatCard
                label="Usos totales"
                value={dashboard.summary.total_usage}
                icon={TrendingUp}
                sub="acumulados"
              />
              <SharedStatCard
                label="Monto descontado"
                value={formatCLP(dashboard.summary.total_discount_amount)}
                icon={BarChart3}
                sub="total"
              />
              <SharedStatCard
                label="Promos expirando"
                value={dashboard.expiring_soon.length}
                icon={Calendar}
                sub="en 7 días"
              />
            </section>

            {(dashboard.top_performing.length > 0 ||
              dashboard.recent_usage.length > 0 ||
              dashboard.expiring_soon.length > 0) && (
              <section className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <h3 className="text-sm font-semibold">Mejor rendimiento</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Por usos y monto descontado</p>
                  {dashboard.top_performing.length === 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">Sin datos aún.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {dashboard.top_performing.slice(0, 5).map((p) => (
                        <li key={p.id} className="flex items-start justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.code}</p>
                          </div>
                          <div className="shrink-0 text-right text-xs tabular-nums">
                            <p>{p.total_usage} usos</p>
                            <p className="text-muted-foreground">{formatCLP(p.total_discount_amount)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <h3 className="text-sm font-semibold">Usos recientes</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Últimas aplicaciones</p>
                  {dashboard.recent_usage.length === 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">Sin usos registrados.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {dashboard.recent_usage.slice(0, 5).map((u, idx) => (
                        <li key={`${u.order_id}-${idx}`} className="flex items-start justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{u.discount_code}</p>
                            <p className="text-xs text-muted-foreground">
                              {u.user_name || "—"} · {new Date(u.usage_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="shrink-0 text-right text-xs tabular-nums text-emerald-700">
                            -{formatCLP(u.discount_amount)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <h3 className="text-sm font-semibold">Por expirar</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Próximos 7 días</p>
                  {dashboard.expiring_soon.length === 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">Ninguna promo por expirar.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {dashboard.expiring_soon.slice(0, 5).map((p) => (
                        <li key={p.id} className="flex items-start justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.code}</p>
                          </div>
                          <div className="shrink-0 text-right text-xs tabular-nums">
                            <p>{p.days_remaining}d</p>
                            <p className="text-muted-foreground">
                              {new Date(p.end_date).toLocaleDateString()}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )}
          </>
        )}

        {/* Desktop filters */}
        <div className="hidden flex-wrap items-end gap-3 md:flex">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar descuento…"
              className="pl-9"
              aria-label="Buscar descuento"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-type" className="text-xs text-muted-foreground">Tipo</label>
            <Select
              id="filter-type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Todos</option>
              {DISCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-status" className="text-xs text-muted-foreground">Estado</label>
            <Select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-apply" className="text-xs text-muted-foreground">Aplicar a</label>
            <Select
              id="filter-apply"
              value={applyToFilter}
              onChange={(e) => setApplyToFilter(e.target.value)}
            >
              <option value="">Todos</option>
              {APPLY_TO.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </Select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-muted-foreground">Solo activos</span>
          </label>
        </div>

        {/* Mobile filters */}
        <div className="flex flex-col gap-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar descuento…"
                className="pl-9"
                aria-label="Buscar descuento"
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
              <label htmlFor="filter-type-mobile" className="text-xs text-muted-foreground">Tipo</label>
              <Select
                id="filter-type-mobile"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {DISCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-status-mobile" className="text-xs text-muted-foreground">Estado</label>
              <Select
                id="filter-status-mobile"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-apply-mobile" className="text-xs text-muted-foreground">Aplicar a</label>
              <Select
                id="filter-apply-mobile"
                value={applyToFilter}
                onChange={(e) => setApplyToFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {APPLY_TO.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </Select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-muted-foreground">Solo activos</span>
            </label>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg bg-danger/10 p-4 text-sm text-danger">
            <p className="font-medium">No se pudieron cargar los descuentos.</p>
            {error instanceof Error && <p className="mt-1 opacity-90">{error.message}</p>}
          </div>
        ) : isLoading ? (
          <div className="grid flex-1 place-items-center">
            <TableSkeleton rows={5} columns={4} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <Percent className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                {search ? "No se encontraron descuentos." : "Aún no hay descuentos creados."}
              </p>
              <p className="text-xs text-muted-foreground">
                {search ? "Prueba con otros filtros." : "Crea el primer descuento para comenzar."}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-sm md:block">
              <table className="w-full min-w-full whitespace-nowrap text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Nombre / Código</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Alcance</th>
                    <th className="px-4 py-3">Usos</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Vigencia</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-medium">{d.name}</p>
                          <p className="text-xs text-muted-foreground">{d.code}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {d.discount_type_display}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {d.discount_type === "PERCENTAGE"
                          ? `${d.discount_value}%`
                          : formatCLP(d.discount_value)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {d.apply_to_display ?? d.apply_to}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-xs">
                        {d.current_uses ?? 0}
                        {d.max_uses != null ? ` / ${d.max_uses}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusBadgeClass(d.status)}>
                          {d.status_display}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {d.start_date && d.end_date ? (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(d.start_date).toLocaleDateString()} →{" "}
                            {new Date(d.end_date).toLocaleDateString()}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openModal(d)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:text-danger"
                            onClick={() => setConfirmDelete(d)}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Eliminar
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
              {filtered.map((d) => (
                <div
                  key={d.id}
                  className="rounded-2xl border border-border bg-background p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.code}</p>
                      <span className={cn("mt-1", statusBadgeClass(d.status))}>
                        {d.status_display}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Editar"
                        aria-label="Editar"
                        onClick={() => openModal(d)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-danger hover:text-danger"
                        title="Eliminar"
                        aria-label="Eliminar"
                        onClick={() => setConfirmDelete(d)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Tipo</span>
                      <span className="font-medium text-foreground">{d.discount_type_display}</span>
                    </div>
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Valor</span>
                      <span className="font-medium tabular-nums text-foreground">
                        {d.discount_type === "PERCENTAGE"
                          ? `${d.discount_value}%`
                          : formatCLP(d.discount_value)}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Alcance</span>
                      <span className="font-medium text-foreground">
                        {d.apply_to_display ?? d.apply_to}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Usos</span>
                      <span className="font-medium tabular-nums text-foreground">
                        {d.current_uses ?? 0}
                        {d.max_uses != null ? ` / ${d.max_uses}` : ""}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {d.start_date && d.end_date ? (
                          <>
                            {new Date(d.start_date).toLocaleDateString()} →{" "}
                            {new Date(d.end_date).toLocaleDateString()}
                          </>
                        ) : (
                          "Sin vigencia definida"
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-sm text-muted-foreground">
              {filtered.length} descuento{filtered.length === 1 ? "" : "s"} en total
            </p>
          </>
        )}
      </div>

      <AnimatedOverlay
        open={modalOpen}
        onClose={closeModal}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-background shadow-lg md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 md:px-6 md:py-4">
              <h2 className="text-base font-semibold">
                {editing ? "Editar descuento" : "Nuevo descuento"}
              </h2>
              <button
                onClick={closeModal}
                aria-label="Cerrar"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="relative flex min-h-0 flex-1 flex-col">
              <div className="relative flex-1 overflow-y-auto p-4 md:p-6">
                {loadingDiscount && (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-background/80">
                    <TableSkeleton rows={3} columns={4} />
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label htmlFor="discount-name" className="text-sm font-medium">
                      Nombre
                    </label>
                    <Input
                      id="discount-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      placeholder="Ej: Descuento de bienvenida"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="discount-code" className="text-sm font-medium">
                      Código
                    </label>
                    <Input
                      id="discount-code"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      required
                      placeholder="Ej: BIENVENIDO20"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="discount-status" className="text-sm font-medium">
                      Estado
                    </label>
                    <Select
                      id="discount-status"
                      value={form.status}
                      onChange={(e) =>
                        setForm({ ...form, status: e.target.value as DiscountFormState["status"] })
                      }
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="discount-type" className="text-sm font-medium">
                      Tipo de descuento
                    </label>
                    <Select
                      id="discount-type"
                      value={form.discount_type}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          discount_type: e.target.value as DiscountFormState["discount_type"],
                        })
                      }
                    >
                      {DISCOUNT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="discount-apply" className="text-sm font-medium">
                      Aplicar a
                    </label>
                    <Select
                      id="discount-apply"
                      value={form.apply_to}
                      onChange={(e) =>
                        setForm({ ...form, apply_to: e.target.value as DiscountFormState["apply_to"] })
                      }
                    >
                      {APPLY_TO.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="discount-value" className="text-sm font-medium">
                      Valor
                    </label>
                    <Input
                      id="discount-value"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.discount_value}
                      onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                      required
                      placeholder={form.discount_type === "PERCENTAGE" ? "Ej: 20" : "Ej: 5000"}
                      className="tabular-nums"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="discount-min" className="text-sm font-medium">
                      Monto mínimo de compra
                    </label>
                    <Input
                      id="discount-min"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.minimum_amount}
                      onChange={(e) => setForm({ ...form, minimum_amount: e.target.value })}
                      placeholder="Opcional"
                      className="tabular-nums"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="discount-max" className="text-sm font-medium">
                      Descuento máximo
                    </label>
                    <Input
                      id="discount-max"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.maximum_discount}
                      onChange={(e) => setForm({ ...form, maximum_discount: e.target.value })}
                      placeholder="Opcional"
                      className="tabular-nums"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="discount-max-uses" className="text-sm font-medium">
                      Usos máximos
                    </label>
                    <Input
                      id="discount-max-uses"
                      type="number"
                      min={0}
                      value={form.max_uses}
                      onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                      placeholder="Opcional"
                      className="tabular-nums"
                    />
                  </div>

                  {form.discount_type === "BUY_X_GET_Y" && (
                    <>
                      <div className="flex flex-col gap-2">
                        <label htmlFor="discount-buy" className="text-sm font-medium">
                          Comprar
                        </label>
                        <Input
                          id="discount-buy"
                          type="number"
                          min={1}
                          value={form.buy_quantity}
                          onChange={(e) => setForm({ ...form, buy_quantity: e.target.value })}
                          className="tabular-nums"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label htmlFor="discount-get" className="text-sm font-medium">
                          Llevar
                        </label>
                        <Input
                          id="discount-get"
                          type="number"
                          min={1}
                          value={form.get_quantity}
                          onChange={(e) => setForm({ ...form, get_quantity: e.target.value })}
                          className="tabular-nums"
                        />
                      </div>
                    </>
                  )}

                  {form.discount_type === "BULK_DISCOUNT" && (
                    <div className="flex flex-col gap-2">
                      <label htmlFor="discount-bulk" className="text-sm font-medium">
                        Umbral de volumen
                      </label>
                      <Input
                        id="discount-bulk"
                        type="number"
                        min={1}
                        value={form.bulk_threshold}
                        onChange={(e) => setForm({ ...form, bulk_threshold: e.target.value })}
                        className="tabular-nums"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <label htmlFor="discount-start" className="text-sm font-medium">
                      Fecha inicio <span className="text-danger">*</span>
                    </label>
                    <Input
                      id="discount-start"
                      type="date"
                      required
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="discount-end" className="text-sm font-medium">
                      Fecha fin <span className="text-danger">*</span>
                    </label>
                    <Input
                      id="discount-end"
                      type="date"
                      required
                      value={form.end_date}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label htmlFor="discount-description" className="text-sm font-medium">
                      Descripción
                    </label>
                    <Input
                      id="discount-description"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>

                  {form.apply_to === "SPECIFIC_PRODUCTS" && (
                    <div className="flex flex-col gap-2 sm:col-span-2">
                      <label className="text-sm font-medium">Productos aplicables</label>
                      <SearchableSelect
                        options={productPickerOptions}
                        value=""
                        onChange={(value) => {
                          const id = Number(value);
                          const opt = productPickerOptions.find((o) => o.value === value);
                          if (!id || !opt) return;
                          addProductToDiscount(id, opt.label);
                        }}
                        onQueryChange={setProductPickerQuery}
                        minChars={2}
                        loading={productPickerSearch.isFetching}
                        placeholder="Buscar y agregar producto…"
                        searchPlaceholder="Nombre o código…"
                        emptyMessage="Sin coincidencias"
                      />
                      {form.products.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                          Agrega al menos un producto.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {form.products.map((id) => (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs"
                            >
                              {productNameMap[id] ?? `Producto #${id}`}
                              <button
                                type="button"
                                onClick={() => removeProductFromDiscount(id)}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label="Quitar producto"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {form.apply_to === "CATEGORY" && (
                    <div className="flex flex-col gap-2 sm:col-span-2">
                      <label className="text-sm font-medium">Categorías aplicables</label>
                      <SearchableSelect
                        options={categoryPickerOptions}
                        value=""
                        onChange={(value) => {
                          const id = Number(value);
                          if (!id) return;
                          addCategoryToDiscount(id);
                        }}
                        onQueryChange={setCategoryPickerQuery}
                        placeholder="Buscar y agregar categoría…"
                        searchPlaceholder="Nombre de categoría…"
                        emptyMessage="Sin coincidencias"
                      />
                      {form.categories.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                          Agrega al menos una categoría.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {form.categories.map((id) => (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs"
                            >
                              {categoryOptions.find((c) => c.id === id)?.name ?? `Categoría #${id}`}
                              <button
                                type="button"
                                onClick={() => removeCategoryFromDiscount(id)}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label="Quitar categoría"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 sm:col-span-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.is_stackable}
                        onChange={(e) => setForm({ ...form, is_stackable: e.target.checked })}
                        className="h-4 w-4 rounded border-border"
                      />
                      <span className="text-sm">Acumulable con otros descuentos</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.is_first_time_only}
                        onChange={(e) => setForm({ ...form, is_first_time_only: e.target.checked })}
                        className="h-4 w-4 rounded border-border"
                      />
                      <span className="text-sm">Solo primera compra</span>
                    </label>
                  </div>
                </div>

                {formError && (
                  <p className="mt-4 text-sm text-danger">{formError}</p>
                )}
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3 md:px-6 md:py-4">
                <Button type="button" variant="outline" onClick={closeModal} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={isSaving}>
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
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="w-full rounded-t-xl border-x border-t border-border bg-background p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <h2 className="text-base font-semibold">¿Eliminar descuento?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se eliminará{" "}
              <span className="font-medium text-foreground">{confirmDelete.name}</span>. Esta
              acción no se puede deshacer.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(null)}
                disabled={deleteMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                isLoading={deleteMutation.isPending}
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


