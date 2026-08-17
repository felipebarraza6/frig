"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Percent,
  X,
  Calendar,
  FileDown,
  BarChart3,
  TrendingUp,
  Tag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatCLP, cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
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
import { useProducts } from "@/lib/hooks/useCatalog";
import { useCategories } from "@/lib/hooks/useCatalog";
import { fetchDiscount, exportDiscountsExcel } from "@/lib/api/discounts";
import { useCurrentBranch } from "@/lib/store/session";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";

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
    discount_value: d.discount_value,
    minimum_amount: d.minimum_amount ?? "",
    maximum_discount: d.maximum_discount ?? "",
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

export default function DiscountsPage() {
  const branch = useCurrentBranch();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [applyToFilter, setApplyToFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionDiscountList | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PromotionDiscountList | null>(null);
  const [form, setForm] = useState<DiscountFormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingDiscount, setLoadingDiscount] = useState(false);
  const toast = useToast();

  const { data: discounts = [], isLoading, error } = useAllDiscounts();
  const { data: dashboard } = useDiscountDashboard(branch?.branch_id);
  const { data: products = [] } = useProducts();
  const { data: categories = [] } = useCategories();
  const createMutation = useCreateDiscountMutation();
  const updateMutation = useUpdateDiscountMutation();
  const deleteMutation = useDeleteDiscountMutation();
  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();

  const filtered = useMemo(() => {
    return discounts.filter((d) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q);
      const matchesType = !typeFilter || d.discount_type === typeFilter;
      const matchesStatus = !statusFilter || d.status === statusFilter;
      const matchesApplyTo = !applyToFilter || d.apply_to === applyToFilter;
      const matchesActive = !activeOnly || (d.status === "ACTIVE" && !d.is_expired);
      return matchesSearch && matchesType && matchesStatus && matchesApplyTo && matchesActive;
    });
  }, [discounts, search, typeFilter, statusFilter, applyToFilter, activeOnly]);

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
  }

  function toggleProduct(productId: number) {
    setForm((prev) => ({
      ...prev,
      products: prev.products.includes(productId)
        ? prev.products.filter((id) => id !== productId)
        : [...prev.products, productId],
    }));
  }

  function toggleCategory(categoryId: number) {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(categoryId)
        ? prev.categories.filter((id) => id !== categoryId)
        : [...prev.categories, categoryId],
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

    const payload: DiscountFormPayload = {
      branch: Number(branch?.branch_id ?? 0),
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || null,
      discount_type: form.discount_type,
      apply_to: form.apply_to,
      status: form.status,
      discount_value: value.toFixed(2),
      minimum_amount: form.minimum_amount ? Number(form.minimum_amount).toFixed(2) : null,
      maximum_discount: form.maximum_discount ? Number(form.maximum_discount).toFixed(2) : null,
      buy_quantity: form.buy_quantity ? Number(form.buy_quantity) : null,
      get_quantity: form.get_quantity ? Number(form.get_quantity) : null,
      bulk_threshold: form.bulk_threshold ? Number(form.bulk_threshold) : null,
      start_date: toIsoDateTime(form.start_date) ?? new Date().toISOString(),
      end_date: toIsoDateTime(form.end_date, true) ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      products: form.apply_to === "SPECIFIC_PRODUCTS" ? form.products : [],
      categories: form.apply_to === "CATEGORY" ? form.categories : [],
      is_stackable: form.is_stackable,
      is_first_time_only: form.is_first_time_only,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, payload });
        toast.success("Descuento actualizado");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Descuento creado");
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
      toast.success("Descuento eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el descuento");
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Descuentos y cupones</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona promociones, códigos y descuentos para el POS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={isDownloading || isLoading}
          >
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Exportar Excel
          </Button>
          <Button onClick={() => openModal()}>
            <Plus className="h-4 w-4" />
            Nuevo descuento
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-6">
        {dashboard && (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total descuentos"
              value={dashboard.summary.total_discounts}
              icon={Tag}
              sub={`${dashboard.summary.active_discounts} activos`}
            />
            <StatCard
              label="Usos totales"
              value={dashboard.summary.total_usage}
              icon={TrendingUp}
              sub="acumulados"
            />
            <StatCard
              label="Monto descontado"
              value={formatCLP(dashboard.summary.total_discount_amount)}
              icon={BarChart3}
              sub="total"
            />
            <StatCard
              label="Promos expirando"
              value={dashboard.expiring_soon.length}
              icon={Calendar}
              sub="en 7 días"
            />
          </section>
        )}

        <div className="flex flex-wrap items-end gap-3">
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
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-muted-foreground">Solo activos</span>
          </label>
        </div>

        {error ? (
          <div className="rounded-lg bg-danger/10 p-4 text-sm text-danger">
            <p className="font-medium">No se pudieron cargar los descuentos.</p>
            {error instanceof Error && <p className="mt-1 opacity-90">{error.message}</p>}
          </div>
        ) : isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              {search ? "No se encontraron descuentos." : "Aún no hay descuentos creados."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Nombre / Código</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Vigencia</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
                            <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium">{d.name}</p>
                            <p className="text-xs text-muted-foreground">{d.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {d.discount_type_display}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {d.discount_type === "PERCENTAGE"
                          ? `${parseFloat(d.discount_value)}%`
                          : formatCLP(parseFloat(d.discount_value))}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded px-2 py-0.5 text-xs font-medium",
                            d.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-700"
                              : d.status === "SCHEDULED"
                              ? "bg-blue-500/10 text-blue-700"
                              : d.status === "EXPIRED"
                              ? "bg-amber-500/10 text-amber-700"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
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
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openModal(d)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:text-danger"
                            onClick={() => setConfirmDelete(d)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-sm text-muted-foreground">
              {filtered.length} descuento{filtered.length === 1 ? "" : "s"} en total
            </p>
          </>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-lg">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
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
              <div className="relative flex-1 overflow-y-auto p-6">
                {loadingDiscount && (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-card/80">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                      Fecha inicio
                    </label>
                    <Input
                      id="discount-start"
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="discount-end" className="text-sm font-medium">
                      Fecha fin
                    </label>
                    <Input
                      id="discount-end"
                      type="date"
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
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2">
                        {products.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No hay productos disponibles.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                            {products.map((p) => (
                              <label
                                key={p.id}
                                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted"
                              >
                                <input
                                  type="checkbox"
                                  checked={form.products.includes(p.id)}
                                  onChange={() => toggleProduct(p.id)}
                                  className="h-4 w-4 rounded border-border"
                                />
                                <span className="text-sm">{p.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {form.apply_to === "CATEGORY" && (
                    <div className="flex flex-col gap-2 sm:col-span-2">
                      <label className="text-sm font-medium">Categorías aplicables</label>
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2">
                        {categories.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No hay categorías disponibles.</p>
                        ) : (
                          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                            {categories.map((c) => (
                              <label
                                key={c.id}
                                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted"
                              >
                                <input
                                  type="checkbox"
                                  checked={form.categories.includes(c.id)}
                                  onChange={() => toggleCategory(c.id)}
                                  className="h-4 w-4 rounded border-border"
                                />
                                <span className="text-sm">{c.name}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
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

              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">
                <Button type="button" variant="outline" onClick={closeModal} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
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
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
