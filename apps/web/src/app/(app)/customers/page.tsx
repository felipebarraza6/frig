"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Power, Loader2, User, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchCustomerTags,
  type CustomersFilter,
  type CustomerPayload,
} from "@/lib/api/customers";
import { useCanManageCustomers } from "@/lib/store/session";
import type { YggdraSchemas } from "@/lib/api/types";

type Customer = YggdraSchemas["Client"];

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const canManage = useCanManageCustomers();

  const [search, setSearch] = useState("");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);

  const [form, setForm] = useState<CustomerPayload>({
    name: "",
    dni: "",
    phone_number: "",
    email: "",
    commercial_business: "",
    address: "",
    tags: [],
    is_active: true,
  });
  const [tagInput, setTagInput] = useState("");

  const filter = useMemo<CustomersFilter>(
    () => ({
      search: search || undefined,
      dni: dni || undefined,
      phone: phone || undefined,
      ...pageUrl,
    }),
    [search, dni, phone, pageUrl],
  );

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["customers", "manage", filter],
    queryFn: () => fetchCustomers(filter),
    enabled: canManage,
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ["customers", "tags"],
    queryFn: fetchCustomerTags,
    enabled: canManage,
  });

  const totalCustomers = page?.count ?? 0;

  const filteredCustomers = useMemo(() => {
    const customers = page?.results ?? [];
    if (!tagFilter.trim()) return customers;
    const q = tagFilter.trim().toLowerCase();
    return customers.filter((c) =>
      ((c as unknown as { tags?: string[] }).tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [page, tagFilter]);

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        await updateCustomer(editing.id, form);
      } else {
        await createCustomer(form);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      closeModal();
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      updateCustomer(id, { is_active: isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setConfirmDelete(null);
    },
  });

  function openModal(customer?: Customer) {
    setEditing(customer ?? null);
    if (customer) {
      setForm({
        name: customer.name ?? "",
        dni: customer.dni ?? "",
        phone_number: customer.phone_number ?? "",
        email: customer.email ?? "",
        commercial_business: customer.commercial_business ?? "",
        address: customer.address ?? "",
        tags: (customer as unknown as { tags?: string[] }).tags ?? [],
        is_active: customer.is_active ?? true,
      });
    } else {
      setForm({
        name: "",
        dni: "",
        phone_number: "",
        email: "",
        commercial_business: "",
        address: "",
        tags: [],
        is_active: true,
      });
    }
    setTagInput("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function updateFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setPageUrl({});
  }

  if (!canManage) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <User className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Clientes</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          No tienes permisos para gestionar clientes. Contacta al administrador de la sucursal.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Clientes</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona la base de clientes de la sucursal
          </p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => updateFilter(setSearch, e.target.value)}
              placeholder="Buscar por nombre…"
              className="pl-9"
              aria-label="Buscar cliente"
            />
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={dni}
              onChange={(e) => updateFilter(setDni, e.target.value)}
              placeholder="Buscar por RUT/DNI…"
              className="pl-9"
              aria-label="Buscar por DNI"
            />
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={phone}
              onChange={(e) => updateFilter(setPhone, e.target.value)}
              placeholder="Buscar por teléfono…"
              className="pl-9"
              aria-label="Buscar por teléfono"
            />
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              list="tag-filter-suggestions"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              placeholder="Filtrar por tag…"
              className="pl-9"
              aria-label="Filtrar por tag"
            />
            <datalist id="tag-filter-suggestions">
              {allTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudieron cargar los clientes.</p>
        ) : isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">RUT/DNI</th>
                    <th className="px-4 py-3">Teléfono</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Giro</th>
                    <th className="px-4 py-3">Tags</th>
                    <th className="px-4 py-3 text-center">Activo</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{c.name}</p>
                            {c.address && (
                              <p className="text-xs text-muted-foreground">{c.address}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.dni ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.phone_number ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.commercial_business ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {((c as unknown as { tags?: string[] }).tags ?? []).length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            ((c as unknown as { tags?: string[] }).tags ?? []).map((t) => (
                              <span
                                key={t}
                                className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                              >
                                {t}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() =>
                            toggleActive.mutate({ id: c.id, isActive: !c.is_active })
                          }
                          aria-label={`${c.is_active ? "Desactivar" : "Activar"} ${c.name}`}
                          className={
                            c.is_active
                              ? "text-emerald-600 hover:text-emerald-700"
                              : "text-muted-foreground hover:text-danger"
                          }
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openModal(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:text-danger"
                            onClick={() => setConfirmDelete(c)}
                          >
                            Eliminar
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
                {filteredCustomers.length} de {totalCustomers} cliente{totalCustomers === 1 ? "" : "s"}
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
              <h2 className="text-base font-semibold">
                {editing ? "Editar cliente" : "Nuevo cliente"}
              </h2>
              <button onClick={closeModal} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label htmlFor="customer-name" className="text-sm font-medium">Nombre</label>
                <Input
                  id="customer-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Ej: Juan Pérez"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="customer-dni" className="text-sm font-medium">RUT/DNI</label>
                <Input
                  id="customer-dni"
                  value={form.dni ?? ""}
                  onChange={(e) => setForm({ ...form, dni: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="customer-phone" className="text-sm font-medium">Teléfono</label>
                <Input
                  id="customer-phone"
                  value={form.phone_number ?? ""}
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label htmlFor="customer-email" className="text-sm font-medium">Email</label>
                <Input
                  id="customer-email"
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="customer-business" className="text-sm font-medium">Giro (opcional)</label>
                <Input
                  id="customer-business"
                  value={form.commercial_business ?? ""}
                  onChange={(e) => setForm({ ...form, commercial_business: e.target.value })}
                  placeholder="Ej: Retail, servicios, alimentación"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="customer-address" className="text-sm font-medium">Dirección</label>
                <Input
                  id="customer-address"
                  value={form.address ?? ""}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label className="text-sm font-medium">Tags</label>
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  {(form.tags ?? []).map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, tags: (form.tags ?? []).filter((x) => x !== t) })}
                        className="hover:text-danger"
                        aria-label={`Quitar tag ${t}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <Input
                    list="tag-form-suggestions"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tagInput.trim()) {
                        e.preventDefault();
                        const tag = tagInput.trim();
                        if (!(form.tags ?? []).includes(tag)) {
                          setForm({ ...form, tags: [...(form.tags ?? []), tag] });
                        }
                        setTagInput("");
                      }
                    }}
                    placeholder="Escribe y presiona Enter…"
                    className="h-7 min-w-[120px] flex-1 border-0 bg-transparent px-0 focus-visible:ring-0"
                  />
                  <datalist id="tag-form-suggestions">
                    {allTags
                      .filter((t) => !(form.tags ?? []).includes(t))
                      .map((t) => (
                        <option key={t} value={t} />
                      ))}
                  </datalist>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 accent-primary"
                />
                Activo
              </label>
              {save.isError && (
                <p className="text-sm text-danger sm:col-span-2">
                  {save.error instanceof Error ? save.error.message : "Error al guardar"}
                </p>
              )}
              <div className="flex justify-end gap-2 sm:col-span-2">
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
            <h2 className="text-base font-semibold">¿Eliminar cliente?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se eliminará <span className="font-medium text-foreground">{confirmDelete.name}</span>.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={remove.isPending}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => remove.mutate(confirmDelete.id)}
                disabled={remove.isPending}
              >
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
