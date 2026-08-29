"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Pencil,
  Power,

  User,
  X,
  FileDown,
  FileText,
  SlidersHorizontal,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Tag,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchCustomerTags,
  exportCustomersExcel,
  exportCustomersPdf,
  type CustomersFilter,
  type CustomerPayload,
  type CustomerStatusFilter,
} from "@/lib/api/customers";
import { useCanManageCustomers } from "@/lib/store/session";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import type { YggdraSchemas } from "@/lib/api/types";

type Customer = YggdraSchemas["Client"];

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const canManage = useCanManageCustomers();

  const [search, setSearch] = useState("");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerStatusFilter>("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

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
      status: statusFilter,
      ...pageUrl,
    }),
    [search, dni, phone, statusFilter, pageUrl],
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

  function getTags(customer: Customer): string[] {
    return ((customer as unknown as { tags?: string[] }).tags ?? []);
  }

  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();

  async function handleExportExcel() {
    await downloadFile(() => exportCustomersExcel(filter), {
      filename: exportFilename("clientes", "xlsx"),
      extension: "xlsx",
    });
  }

  async function handleExportPdf() {
    await downloadFile(() => exportCustomersPdf(filter), {
      filename: exportFilename("reporte_clientes", "pdf"),
      extension: "pdf",
    });
  }

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

  function updateFilter<T>(setter: (v: T) => void, value: T) {
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
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Clientes</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona la base de clientes de la sucursal
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
            <span className="hidden sm:inline">Excel</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            isLoading={isDownloading}
            className="h-9 w-9 px-0 sm:w-auto sm:px-3"
            title="Exportar PDF"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button onClick={() => openModal()} className="h-9">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nuevo cliente</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3">
          {/* Desktop: todos los filtros en una fila */}
          <div className="hidden flex-wrap items-end gap-2 md:flex">
            <div className="relative w-[180px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => updateFilter(setSearch, e.target.value)}
                placeholder="Nombre…"
                className="pl-9"
                aria-label="Buscar cliente"
              />
            </div>
            <div className="relative w-[140px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={dni}
                onChange={(e) => updateFilter(setDni, e.target.value)}
                placeholder="RUT/DNI…"
                className="pl-9"
                aria-label="Buscar por DNI"
              />
            </div>
            <div className="relative w-[150px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={phone}
                onChange={(e) => updateFilter(setPhone, e.target.value)}
                placeholder="Teléfono…"
                className="pl-9"
                aria-label="Buscar por teléfono"
              />
            </div>
            <div className="relative w-[140px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                list="tag-filter-suggestions"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="Tag…"
                className="pl-9"
                aria-label="Filtrar por tag"
              />
              <datalist id="tag-filter-suggestions">
                {allTags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-status" className="text-xs text-muted-foreground">Estado</label>
              <Select
                id="filter-status"
                value={statusFilter}
                onChange={(e) => updateFilter(setStatusFilter, e.target.value as CustomerStatusFilter)}
              >
                <option value="">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </Select>
            </div>
          </div>

          {/* Mobile/tablet: búsqueda principal + botón filtros */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => updateFilter(setSearch, e.target.value)}
                placeholder="Buscar cliente por nombre…"
                className="pl-9"
                aria-label="Buscar cliente"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-3"
              onClick={() => setShowMobileFilters((v) => !v)}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile/tablet: filtros avanzados colapsables */}
          <div className={`flex flex-col gap-3 md:hidden ${showMobileFilters ? "" : "hidden"} sm:flex-row sm:flex-wrap sm:items-end`}>
            <div className="relative w-full sm:max-w-[160px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={dni}
                onChange={(e) => updateFilter(setDni, e.target.value)}
                placeholder="RUT/DNI…"
                className="pl-9"
                aria-label="Buscar por DNI"
              />
            </div>
            <div className="relative w-full sm:max-w-[160px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={phone}
                onChange={(e) => updateFilter(setPhone, e.target.value)}
                placeholder="Teléfono…"
                className="pl-9"
                aria-label="Buscar por teléfono"
              />
            </div>
            <div className="relative w-full sm:max-w-[160px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                list="tag-filter-suggestions"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="Tag…"
                className="pl-9"
                aria-label="Filtrar por tag"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-status" className="text-xs text-muted-foreground">Estado</label>
              <Select
                id="filter-status"
                value={statusFilter}
                onChange={(e) => updateFilter(setStatusFilter, e.target.value as CustomerStatusFilter)}
              >
                <option value="">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </Select>
            </div>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudieron cargar los clientes.</p>
        ) : isLoading ? (
          <>
            {/* Vista desktop */}
            <div className="hidden overflow-hidden rounded-xl border border-border sm:block">
              <div className="border-b border-border px-3 py-3">
                <Skeleton className="h-3 w-44" />
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-0"
                >
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="ml-auto h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
            {/* Vista móvil */}
            <div className="flex flex-col gap-3 sm:hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="ml-auto h-5 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-40" />
                </div>
              ))}
            </div>
          </>
        ) : filteredCustomers.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <User className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No se encontraron clientes</p>
              <p className="text-xs text-muted-foreground">
                Prueba con otros filtros o agrega un nuevo cliente.
              </p>
              <Button className="mt-4" size="sm" onClick={() => openModal()}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Nuevo cliente
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Vista desktop */}
            <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-3">Cliente</th>
                    <th className="px-3 py-3">RUT/DNI</th>
                    <th className="px-3 py-3">Teléfono</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Giro</th>
                    <th className="px-3 py-3">Tags</th>
                    <th className="w-24 px-2 py-3 text-center">Estado</th>
                    <th className="w-20 px-2 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{c.name}</p>
                            {c.address && (
                              <p className="text-xs text-muted-foreground">{c.address}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{c.dni ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{c.phone_number ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{c.commercial_business ?? "—"}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {getTags(c).length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            getTags(c).map((t) => (
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
                      <td className="px-2 py-3 text-center">
                        <button
                          onClick={() =>
                            toggleActive.mutate({ id: c.id, isActive: !c.is_active })
                          }
                          aria-label={`${c.is_active ? "Desactivar" : "Activar"} ${c.name}`}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            c.is_active
                              ? "bg-success/10 text-success hover:bg-success/20"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          <Power className="h-3 w-3" />
                          {c.is_active ? "Activo" : "Inactivo"}
                        </button>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Editar"
                            onClick={() => openModal(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Editar</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-danger hover:text-danger"
                            title="Eliminar"
                            onClick={() => setConfirmDelete(c)}
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

            {/* Vista móvil */}
            <div className="grid gap-3 sm:hidden">
              {filteredCustomers.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.name}</p>
                        <button
                          onClick={() =>
                            toggleActive.mutate({ id: c.id, isActive: !c.is_active })
                          }
                          className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            c.is_active
                              ? "bg-success/10 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Power className="h-3 w-3" />
                          {c.is_active ? "Activo" : "Inactivo"}
                        </button>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Editar"
                        onClick={() => openModal(c)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-danger hover:text-danger"
                        title="Eliminar"
                        onClick={() => setConfirmDelete(c)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    {c.dni && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Search className="h-3 w-3" />
                        <span className="truncate">{c.dni}</span>
                      </div>
                    )}
                    {c.phone_number && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span className="truncate">{c.phone_number}</span>
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {c.commercial_business && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{c.commercial_business}</span>
                      </div>
                    )}
                    {c.address && (
                      <div className="col-span-2 flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{c.address}</span>
                      </div>
                    )}
                  </div>

                  {getTags(c).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {getTags(c).map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                        >
                          <Tag className="h-3 w-3" />
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
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
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center p-0 sm:items-center sm:p-4"
      >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl sm:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">
                {editing ? "Editar cliente" : "Nuevo cliente"}
              </h2>
              <button onClick={closeModal} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate();
                }}
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                id="customer-form"
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
              </form>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
              <Button type="button" variant="outline" onClick={closeModal} disabled={save.isPending}>
                Cancelar
              </Button>
              <Button type="submit" form="customer-form" isLoading={save.isPending}>
                Guardar
              </Button>
            </div>
          </div>
      </AnimatedOverlay>

{confirmDelete && (
      <AnimatedOverlay
        open={true}
        onClose={() => setConfirmDelete(null)}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center p-0 sm:items-center sm:p-4"
      >
          <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg sm:max-w-md sm:rounded-xl sm:border sm:p-6">
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
                isLoading={remove.isPending}
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
