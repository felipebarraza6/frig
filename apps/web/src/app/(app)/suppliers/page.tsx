"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Loader2, Truck, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchSupplier,
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  type SupplierList,
  type SupplierRequest,
} from "@/lib/api/suppliers";

const SUPPLIER_TYPES = [
  { value: "WHOLESALE", label: "Mayorista" },
  { value: "RETAIL", label: "Minorista" },
  { value: "MANUFACTURER", label: "Fabricante" },
  { value: "DISTRIBUTOR", label: "Distribuidor" },
  { value: "IMPORTER", label: "Importador" },
  { value: "LOCAL_PRODUCER", label: "Productor local" },
] as const;

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "ACTIVE", label: "Activo" },
  { value: "INACTIVE", label: "Inactivo" },
  { value: "SUSPENDED", label: "Suspendido" },
  { value: "BLACKLISTED", label: "Lista negra" },
];

function supplierTypeLabel(value?: string | null): string {
  return SUPPLIER_TYPES.find((t) => t.value === value)?.label ?? (value ?? "—");
}

function statusLabel(value?: string | null): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
}

function statusBadgeClass(status?: string | null) {
  if (status === "ACTIVE") {
    return "rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success";
  }
  if (status === "BLACKLISTED") {
    return "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger";
  }
  return "rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning";
}

const EMPTY_FORM: SupplierRequest = {
  name: "",
  business_name: "",
  tax_id: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  country: "",
  supplier_type: "WHOLESALE",
  status: "ACTIVE",
  website: "",
  notes: "",
};

/**
 * Construye el payload de creación/edición omitiendo strings vacíos en
 * campos opcionales (el backend rechaza "" en email, website, etc.).
 */
function buildPayload(form: SupplierRequest): Partial<SupplierRequest> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(form)) {
    if (typeof value === "string" && value.trim() === "" && key !== "name" && key !== "tax_id") {
      continue;
    }
    payload[key] = value;
  }
  return payload as Partial<SupplierRequest>;
}

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierList | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SupplierList | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [form, setForm] = useState<SupplierRequest>(EMPTY_FORM);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Debounce de búsqueda para no disparar una request por tecla.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPageUrl({});
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: page, isLoading } = useQuery({
    queryKey: ["suppliers", { search, status, pageUrl }],
    queryFn: () => fetchSuppliers({ search, status, ...pageUrl }),
  });

  const suppliers: SupplierList[] = page?.results ?? [];
  const totalSuppliers = page?.count ?? 0;

  const save = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(form);
      if (editing) {
        await updateSupplier(editing.id, payload);
      } else {
        await createSupplier(payload as SupplierRequest);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      closeModal();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setConfirmDelete(null);
    },
  });

  async function openModal(supplier?: SupplierList) {
    save.reset();
    setEditing(supplier ?? null);
    setDetailError(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
    if (!supplier) return;
    // El listado no incluye website/notes: se carga el detalle para no
    // pisar esos campos al guardar.
    setDetailLoading(true);
    try {
      const detail = await fetchSupplier(supplier.id);
      setForm({
        name: detail.name,
        business_name: detail.business_name ?? "",
        tax_id: detail.tax_id,
        email: detail.email ?? "",
        phone: detail.phone ?? "",
        address: detail.address ?? "",
        city: detail.city ?? "",
        state: detail.state ?? "",
        country: detail.country ?? "",
        supplier_type: detail.supplier_type ?? "WHOLESALE",
        status: detail.status ?? "ACTIVE",
        website: detail.website ?? "",
        notes: detail.notes ?? "",
      });
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Error al cargar el proveedor");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeModal() {
    save.reset();
    setModalOpen(false);
    setEditing(null);
    setDetailLoading(false);
    setDetailError(null);
  }

  function openConfirmDelete(supplier: SupplierList) {
    remove.reset();
    setConfirmDelete(supplier);
  }

  function updateFilter<T extends string>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-start md:justify-between md:px-6">
        <div>
          <h1 className="text-lg font-semibold">Proveedores</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona proveedores y sus datos de contacto
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            onClick={() => openModal()}
            className="md:hidden"
            title="Nuevo proveedor"
            aria-label="Nuevo proveedor"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => openModal()}
            className="hidden md:flex"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo proveedor
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
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar proveedor…"
                className="pl-9"
                aria-label="Buscar proveedor"
              />
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
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar proveedor…"
                  className="pl-9"
                  aria-label="Buscar proveedor"
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
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border px-4 py-3">
              <Skeleton className="h-3 w-44" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                <Skeleton className="h-7 w-7 rounded-md" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="hidden h-4 w-24 sm:block" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="ml-auto h-4 w-12" />
              </div>
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <Truck className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No se encontraron proveedores</p>
              <p className="text-xs text-muted-foreground">
                Prueba con otros filtros o agrega un nuevo proveedor.
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
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">RUT</th>
                    <th className="px-4 py-3">Contacto</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
                            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{s.name}</p>
                            {s.business_name && s.business_name !== s.name && (
                              <p className="text-xs text-muted-foreground">{s.business_name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{supplierTypeLabel(s.supplier_type)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.tax_id}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {s.email && <p>{s.email}</p>}
                        {s.phone && <p>{s.phone}</p>}
                        {!s.email && !s.phone && "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusBadgeClass(s.status)}>
                          {statusLabel(s.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openModal(s)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:text-danger"
                            onClick={() => openConfirmDelete(s)}
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
              {suppliers.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                        <Truck className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.name}</p>
                        {s.business_name && s.business_name !== s.name && (
                          <p className="text-xs text-muted-foreground">{s.business_name}</p>
                        )}
                        <span className={`mt-1 inline-flex ${statusBadgeClass(s.status)}`}>
                          {statusLabel(s.status)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Editar"
                        aria-label="Editar"
                        onClick={() => openModal(s)}
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
                        onClick={() => openConfirmDelete(s)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Tipo</span>
                      <span className="font-medium text-foreground">{supplierTypeLabel(s.supplier_type)}</span>
                    </div>
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">RUT</span>
                      <span className="font-medium text-foreground">{s.tax_id}</span>
                    </div>
                    {(s.email || s.phone) && (
                      <div className="col-span-2 text-muted-foreground">
                        <span className="block text-[10px] uppercase tracking-wide">Contacto</span>
                        <span className="font-medium text-foreground">
                          {[s.email, s.phone].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
              <p className="text-muted-foreground">
                {totalSuppliers} proveedor{totalSuppliers === 1 ? "" : "es"} en total
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
          className="fixed inset-0 z-[60] flex items-end justify-center overflow-hidden bg-black/40 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">{editing ? "Editar proveedor" : "Nuevo proveedor"}</h2>
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
              id="supplier-form"
            >
              <div className="flex-1 overflow-y-auto p-4">
                {detailLoading ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex flex-col gap-2">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-9 w-full" />
                      </div>
                    ))}
                  </div>
                ) : detailError ? (
                  <p className="text-sm text-danger">{detailError}</p>
                ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="supplier-name" className="text-sm font-medium">Nombre</label>
                    <Input
                      id="supplier-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="supplier-business" className="text-sm font-medium">Razón social</label>
                    <Input
                      id="supplier-business"
                      value={form.business_name}
                      onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="supplier-tax" className="text-sm font-medium">RUT</label>
                    <Input
                      id="supplier-tax"
                      value={form.tax_id}
                      onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="supplier-type" className="text-sm font-medium">Tipo</label>
                    <Select
                      id="supplier-type"
                      value={form.supplier_type}
                      onChange={(e) => setForm({ ...form, supplier_type: e.target.value as SupplierRequest["supplier_type"] })}
                    >
                      {SUPPLIER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="supplier-email" className="text-sm font-medium">Email</label>
                    <Input
                      id="supplier-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="supplier-phone" className="text-sm font-medium">Teléfono</label>
                    <Input
                      id="supplier-phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label htmlFor="supplier-address" className="text-sm font-medium">Dirección</label>
                    <Input
                      id="supplier-address"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="supplier-city" className="text-sm font-medium">Ciudad</label>
                    <Input
                      id="supplier-city"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="supplier-state" className="text-sm font-medium">Región</label>
                    <Input
                      id="supplier-state"
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="supplier-country" className="text-sm font-medium">País</label>
                    <Input
                      id="supplier-country"
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="supplier-website" className="text-sm font-medium">Sitio web</label>
                    <Input
                      id="supplier-website"
                      type="url"
                      value={form.website ?? ""}
                      onChange={(e) => setForm({ ...form, website: e.target.value || null })}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="supplier-status" className="text-sm font-medium">Estado</label>
                    <Select
                      id="supplier-status"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as SupplierRequest["status"] })}
                    >
                      {STATUS_OPTIONS.filter((o) => o.value !== "").map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label htmlFor="supplier-notes" className="text-sm font-medium">Notas</label>
                    <Input
                      id="supplier-notes"
                      value={form.notes ?? ""}
                      onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
                      placeholder="Opcional"
                    />
                  </div>
                  {save.isError && (
                    <p className="text-sm text-danger sm:col-span-2">
                      {save.error instanceof Error ? save.error.message : "Error al guardar"}
                    </p>
                  )}
                </div>
                )}
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
                <Button type="button" variant="outline" onClick={closeModal} disabled={save.isPending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={save.isPending || detailLoading}>
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
            <h2 className="text-base font-semibold">¿Eliminar proveedor?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se eliminará <span className="font-medium text-foreground">{confirmDelete.name}</span>.
            </p>
            {remove.isError && (
              <p className="mt-2 text-sm text-danger">
                {remove.error instanceof Error ? remove.error.message : "Error al eliminar"}
              </p>
            )}
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
    </div>
  );
}
