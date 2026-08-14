"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Loader2, Truck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
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
  postal_code: "",
  supplier_type: "WHOLESALE",
  commercial_business: "",
  status: "ACTIVE",
  credit_limit: "",
  payment_terms: 0,
  discount_percentage: "",
  website: "",
  notes: "",
};

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierList | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SupplierList | null>(null);
  const [form, setForm] = useState<SupplierRequest>(EMPTY_FORM);

  const { data: page, isLoading } = useQuery({
    queryKey: ["suppliers", { search, status, pageUrl }],
    queryFn: () => fetchSuppliers({ search, status, ...pageUrl }),
  });

  const suppliers: SupplierList[] = page?.results ?? [];
  const totalSuppliers = page?.count ?? 0;

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        await updateSupplier(editing.id, form);
      } else {
        await createSupplier(form);
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

  function openModal(supplier?: SupplierList) {
    setEditing(supplier ?? null);
    if (supplier) {
      setForm({
        name: supplier.name,
        business_name: supplier.business_name ?? "",
        tax_id: supplier.tax_id,
        email: supplier.email ?? "",
        phone: supplier.phone ?? "",
        address: supplier.address ?? "",
        city: supplier.city ?? "",
        state: supplier.state ?? "",
        country: supplier.country ?? "",
        postal_code: supplier.postal_code ?? "",
        supplier_type: supplier.supplier_type ?? "WHOLESALE",
        commercial_business: supplier.commercial_business ?? "",
        status: supplier.status ?? "ACTIVE",
        credit_limit: supplier.credit_limit ?? "",
        payment_terms: supplier.payment_terms ?? 0,
        discount_percentage: "",
        website: null,
        notes: null,
      });
    } else {
      setForm(EMPTY_FORM);
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

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Proveedores</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona proveedores y sus datos de contacto
          </p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="h-4 w-4" />
          Nuevo proveedor
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => updateFilter(setSearch, e.target.value)}
              placeholder="Buscar proveedor…"
              className="pl-9"
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

        {isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[900px] text-sm">
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
                        <span
                          className={
                            s.status === "ACTIVE"
                              ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                              : s.status === "BLACKLISTED"
                                ? "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger"
                                : "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700"
                          }
                        >
                          {statusLabel(s.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openModal(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:text-danger"
                            onClick={() => setConfirmDelete(s)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm">
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
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ next: page?.next })}
                  disabled={!page?.next}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
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
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="supplier-address" className="text-sm font-medium">Dirección</label>
                <Input
                  id="supplier-address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="supplier-website" className="text-sm font-medium">Sitio web</label>
                  <Input
                    id="supplier-website"
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
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="supplier-notes" className="text-sm font-medium">Notas</label>
                <Input
                  id="supplier-notes"
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
              <div className="flex justify-end gap-2">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h2 className="text-base font-semibold">¿Eliminar proveedor?</h2>
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
    </div>
  );
}
