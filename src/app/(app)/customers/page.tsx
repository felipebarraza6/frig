"use client";

import { Suspense, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,

  Banknote,
  Building2,

  ChevronRight,
  CreditCard,

  FileDown,
  FileText,

  LayoutGrid,
  List,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  NotebookPen,
  Pencil,
  Percent,
  Phone,
  Plus,
  Power,
  Search,
  Trash2,
  User,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { fetchDiscountDashboard } from "@/lib/api/discounts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { PageHeader } from "@/components/page-header";
import { PageBody, PageShell } from "@/components/page-shell";
import { CustomerProfilePanel } from "@/components/customers/customer-profile-panel";
import { CrmDenied } from "@/components/customers/crm-denied";
import { CrmNav } from "@/components/customers/crm-nav";
import { EmptyState } from "@/components/ui/empty-state";
import { CustomerAvatar } from "@/components/customers/customer-avatar";
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  formatRut,
  uploadCustomerPhoto,
  clearCustomerPhoto,
  fetchCustomerTags,
  exportCustomersExcel,
  exportCustomersPdf,
  getCustomerTags,
  fetchCustomerStats,
  fetchClientsWithPendingRevenues,
  type CustomersFilter,
  type CustomerPayload,
} from "@/lib/api/customers";
import { useCrmNavCounts } from "@/lib/hooks/useCrm";
import { useCanManageCustomers, useIsModuleEnabledFromConfig } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { cn, formatCLP } from "@/lib/utils";
import type { YggdraSchemas } from "@/lib/api/types";

type Customer = YggdraSchemas["Client"] & { photo?: string | null };

function cleanPhoneForWa(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <PageHeader title="Clientes" icon={<UserCircle className="h-5 w-5" />} />
          <PageBody>
            <Skeleton className="h-40 w-full rounded-2xl" />
          </PageBody>
        </PageShell>
      }
    >
      <CustomersInner />
    </Suspense>
  );
}

function CustomersInner() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedIdRaw = searchParams.get("id");
  const selectedId = selectedIdRaw && /^\d+$/.test(selectedIdRaw) ? Number(selectedIdRaw) : null;
  const selectedTab = searchParams.get("tab");
  const canManage = useCanManageCustomers();
  const invoicesEnabled = useIsModuleEnabledFromConfig("invoices");

  // Filter States
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<"all" | "debt" | "companies" | "people" | "inactive">("all");
  const [tagFilter, setTagFilter] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});

  // Modal states
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
    receiver_type: "PERSONA_NATURAL",
    default_document_type: "BOLETA",
    tags: [],
    is_active: true,
  });
  const [tagInput, setTagInput] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [clearPhoto, setClearPhoto] = useState(false);

  // Query filter (segmentos resueltos server-side)
  const filter = useMemo<CustomersFilter>(() => {
    return {
      search: search.trim() || undefined,
      status: segment === "inactive" ? "inactive" : undefined,
      receiver_type:
        segment === "companies"
          ? "EMPRESA"
          : segment === "people"
            ? "PERSONA_NATURAL"
            : undefined,
      has_pending: segment === "debt" ? true : undefined,
      tag: tagFilter.trim() || undefined,
      ...pageUrl,
    };
  }, [search, segment, tagFilter, pageUrl]);

  // Reset de paginación al cambiar filtros (ajuste durante render, sin effect).
  const [filterKey, setFilterKey] = useState(`${search}|${segment}|${tagFilter}`);
  if (filterKey !== `${search}|${segment}|${tagFilter}`) {
    setFilterKey(`${search}|${segment}|${tagFilter}`);
    setPageUrl({});
  }

  const { data: page, isLoading, isFetching, error } = useQuery({
    queryKey: ["customers", "manage", filter],
    queryFn: () => fetchCustomers(filter),
    enabled: canManage,
    placeholderData: keepPreviousData,
  });

  function handleNextPage() {
    if (!page?.next || isFetching) return;
    setPageUrl({ next: page.next, previous: null });
  }

  function handlePrevPage() {
    if (!page?.previous || isFetching) return;
    setPageUrl({ previous: page.previous, next: null });
  }

  const { data: allTags = [] } = useQuery({
    queryKey: ["customers", "tags"],
    queryFn: fetchCustomerTags,
    enabled: canManage,
  });

  const statsQuery = useQuery({
    queryKey: ["customers", "stats"],
    queryFn: fetchCustomerStats,
    enabled: canManage,
    staleTime: 30_000,
  });

  const pendingQuery = useQuery({
    queryKey: ["customers", "with-pending"],
    queryFn: () => fetchClientsWithPendingRevenues(),
    enabled: canManage,
    staleTime: 30_000,
  });

  const crmCounts = useCrmNavCounts();

  const promotionsDashboardQuery = useQuery({
    queryKey: ["discounts", "hub-kpi"],
    queryFn: () => fetchDiscountDashboard(),
    enabled: canManage,
    staleTime: 45_000,
  });

  // Map of client ID -> pending debt amount
  const debtMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of pendingQuery.data?.results ?? []) {
      map.set(String(row.id), Number(row.pending_amount) || 0);
    }
    return map;
  }, [pendingQuery.data]);

  const openProspects = crmCounts.prospectsCount;

  const totalCustomers = page?.count ?? 0;

  function openCustomer(id: number) {
    router.replace(`/customers?id=${id}`);
  }

  function closeCustomer() {
    router.replace("/customers");
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

  // Segmentos/tags ya filtrados por el backend: el listado se usa directo.
  const filteredCustomers = useMemo(() => page?.results ?? [], [page]);

  const save = useMutation({
    mutationFn: async () => {
      const saved = editing
        ? await updateCustomer(editing.id, form)
        : await createCustomer(form);
      if (photoFile) {
        await uploadCustomerPhoto(saved.id, photoFile);
      } else if (clearPhoto && editing) {
        await clearCustomerPhoto(saved.id);
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
    onError: () =>
      toast.error("No se pudo cambiar el estado del cliente"),
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
        receiver_type: (customer as unknown as { receiver_type?: "PERSONA_NATURAL" | "EMPRESA" | null }).receiver_type ?? "PERSONA_NATURAL",
        default_document_type: (customer as unknown as { default_document_type?: "BOLETA" | "FACTURA" | null }).default_document_type ?? "BOLETA",
        tags: getCustomerTags(customer),
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
        receiver_type: "PERSONA_NATURAL",
        default_document_type: "BOLETA",
        tags: [],
        is_active: true,
      });
    }
    setTagInput("");
    setPhotoFile(null);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setClearPhoto(false);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setPhotoFile(null);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setClearPhoto(false);
  }

  function onPhotoPicked(file: File | null) {
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    setPhotoFile(file);
    setClearPhoto(false);
  }

  function handleAddTag(tagToAdd: string) {
    const clean = tagToAdd.trim();
    if (!clean) return;
    const current = form.tags ?? [];
    if (!current.includes(clean)) {
      setForm({ ...form, tags: [...current, clean] });
    }
    setTagInput("");
  }

  function handleRemoveTag(tagToRemove: string) {
    setForm({
      ...form,
      tags: (form.tags ?? []).filter((t) => t !== tagToRemove),
    });
  }

  if (!canManage) {
    return <CrmDenied title="Clientes" icon={<UserCircle className="h-5 w-5" />} />;
  }

  return (
    <PageShell>
      {selectedId != null ? (
        <CustomerProfilePanel
          customerId={selectedId}
          invoicesEnabled={invoicesEnabled}
          initialTab={selectedTab}
          onClose={closeCustomer}
          onEdit={(customer) => openModal(customer)}
        />
      ) : (
        <>
          <PageHeader
        title="Directorio de Clientes"
        icon={<UserCircle className="h-5 w-5" />}
        subtitle="Gestión comercial 360, saldos por cobrar, historial y fidelización de clientes."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              isLoading={isDownloading}
              className="h-9 px-3"
              title="Exportar a Excel"
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              isLoading={isDownloading}
              className="h-9 px-3"
              title="Exportar a PDF"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button onClick={() => openModal()} className="h-9">
              <Plus className="h-4 w-4" />
              <span>Nuevo cliente</span>
            </Button>
          </div>
        }
      />

      <PageBody className="gap-4">
        {/* Navigation Tabs */}
        <CrmNav className="glass rounded-2xl p-1.5" />

        {/* Commercial KPIs Bar */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            variant="compact"
            label="Total Clientes"
            value={statsQuery.data?.total_clients ?? totalCustomers}
            sub={`${statsQuery.data?.active_clients ?? "—"} activos`}
            icon={UserCircle}
            tone="primary"
            onClick={() => setSegment("all")}
            className={segment === "all" ? "ring-2 ring-primary cursor-pointer" : "cursor-pointer"}
          />
          <StatCard
            variant="compact"
            label="Cartera por Cobrar"
            value={formatCLP(pendingQuery.data?.total_pending_amount ?? 0)}
            sub={`${pendingQuery.data?.count ?? 0} con saldo`}
            icon={Banknote}
            tone={(pendingQuery.data?.total_pending_amount ?? 0) > 0 ? "warning" : "muted"}
            onClick={() => setSegment(segment === "debt" ? "all" : "debt")}
            className={segment === "debt" ? "ring-2 ring-warning cursor-pointer" : "cursor-pointer"}
          />
          <StatCard
            variant="compact"
            label="Prospectos Abiertos"
            value={openProspects}
            sub="En prospección"
            icon={Users}
            tone="primary"
            href="/customers/prospects"
          />
          <StatCard
            variant="compact"
            label="Acciones del Día"
            value={crmCounts.followUpsCount}
            sub="Tareas pendientes"
            icon={NotebookPen}
            tone="muted"
            href="/customers/follow-ups"
          />
          <StatCard
            variant="compact"
            label="Promos Activas"
            value={promotionsDashboardQuery.data?.summary?.active_discounts ?? 0}
            sub={`${promotionsDashboardQuery.data?.summary?.total_discounts ?? 0} promociones`}
            icon={Percent}
            tone="success"
            href="/promotions/discounts"
          />
        </div>

        {/* Single-Row Minimal Filter Bar */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {/* Unified Omnisearch */}
            <div className="relative w-52 sm:w-64 shrink-0">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPageUrl({});
                }}
                placeholder="Buscar cliente (RUT, nombre, tel)…"
                className="pl-8 pr-7 h-8 text-xs rounded-xl bg-card"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPageUrl({});
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Segment Filter Chips */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setSegment("all")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium transition-all",
                  segment === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                <span>Todos</span>
                <span className="rounded-full bg-card px-1 py-0.1 text-[10px] tabular-nums text-foreground">
                  {totalCustomers}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSegment("debt")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium transition-all",
                  segment === "debt"
                    ? "bg-warning text-card shadow-xs"
                    : "border border-warning bg-card text-warning",
                )}
              >
                <Banknote className="h-3 w-3" />
                <span>Deuda</span>
                {pendingQuery.data?.count ? (
                  <span
                    className={cn(
                      "rounded-full px-1 py-0.1 text-[10px] tabular-nums",
                      segment === "debt" ? "bg-card text-warning" : "bg-warning text-card",
                    )}
                  >
                    {pendingQuery.data.count}
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => setSegment("companies")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium transition-all",
                  segment === "companies"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                <Building2 className="h-3 w-3" />
                <span>Empresas</span>
              </button>

              <button
                type="button"
                onClick={() => setSegment("people")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium transition-all",
                  segment === "people"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                <User className="h-3 w-3" />
                <span>Personas</span>
              </button>

              <button
                type="button"
                onClick={() => setSegment("inactive")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium transition-all",
                  segment === "inactive"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                <Power className="h-3 w-3" />
                <span>Inactivos</span>
              </button>
            </div>

            {/* Tag Filter Dropdown */}
            {allTags.length > 0 && (
              <Select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                containerClassName="w-28 shrink-0"
                className="h-8 text-xs rounded-xl"
              >
                <option value="">Tag: Todos</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            )}

            {(search || segment !== "all" || tagFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSegment("all");
                  setTagFilter("");
                  setPageUrl({});
                }}
                className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* View Switcher */}
          <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-border bg-card p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                viewMode === "table"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Vista en tabla ejecutiva"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                viewMode === "cards"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Vista en directorio comercial"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Content presentation */}
        {error ? (
          <EmptyState
            icon={AlertCircle}
            title="Error al cargar clientes"
            description="Hubo un problema al consultar la lista de clientes. Verificá tu conexión o reintentá."
            action={
              <Button size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["customers"] })}>
                Reintentar
              </Button>
            }
          />
        ) : isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-2xl" />
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <EmptyState
            icon={UserCircle}
            title={search || tagFilter || segment !== "all" ? "No hay clientes con estos filtros" : "Sin clientes registrados"}
            description="Agregá tus clientes para gestionar pedidos, líneas de crédito y ficha 360."
            action={
              <Button size="sm" onClick={() => openModal()}>
                <Plus className="mr-1.5 h-4 w-4" />
                Crear cliente
              </Button>
            }
          />
        ) : viewMode === "cards" ? (
          /* Cards / Directory View */
          <div
            className={cn(
              "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 transition-opacity duration-300",
              isFetching ? "opacity-60 pointer-events-none" : "opacity-100",
            )}
          >
            {filteredCustomers.map((c) => {
              const wa = cleanPhoneForWa(c.phone_number);
              const debt = debtMap.get(String(c.id));
              const tags = getCustomerTags(c);
              const isCompany = (c as { receiver_type?: string | null }).receiver_type === "EMPRESA";

              return (
                <div
                  key={c.id}
                  onClick={() => openCustomer(c.id)}
                  className={cn(
                    "group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-2xs transition-all hover:border-primary/50 hover:shadow-xs cursor-pointer",
                    selectedId === c.id && "ring-2 ring-primary/50 border-primary",
                  )}
                >
                  <div>
                    {/* Header: Avatar, Name & Type Badge */}
                    <div className="flex items-start gap-3">
                      <CustomerAvatar
                        name={c.name}
                        photo={(c as Record<string, unknown>).photo as string | undefined}
                        className="h-11 w-11 rounded-2xl text-sm shadow-xs"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="truncate font-semibold text-sm leading-snug group-hover:text-primary transition-colors">
                            {c.name}
                          </h3>
                        </div>

                        {invoicesEnabled && c.dni ? (
                          <p className="mt-0.5 whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                            {formatRut(c.dni)}
                          </p>
                        ) : null}

                        <span
                          className={cn(
                            "mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.2 text-[10px] font-medium",
                            isCompany
                              ? "bg-purple-500/10 text-purple-700 dark:text-purple-400"
                              : "bg-blue-500/10 text-blue-700 dark:text-blue-400",
                          )}
                        >
                          {isCompany ? <Building2 className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
                          {isCompany ? "Empresa" : "Persona"}
                        </span>
                      </div>
                    </div>

                    {/* Pending Debt Pill */}
                    {debt && debt > 0 ? (
                      <div className="mt-3 flex items-center justify-between rounded-xl border border-warning bg-card p-2 text-xs">
                        <span className="font-medium text-warning">Por cobrar:</span>
                        <strong className="font-bold tabular-nums text-warning">
                          {formatCLP(debt)}
                        </strong>
                      </div>
                    ) : null}

                    {/* Contact details */}
                    <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
                      {c.phone_number ? (
                        <span className="flex items-center gap-1.5 truncate">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span className="truncate">{c.phone_number}</span>
                        </span>
                      ) : null}

                      {c.email ? (
                        <span className="flex items-center gap-1.5 truncate">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </span>
                      ) : null}

                      {c.address ? (
                        <span className="flex items-center gap-1.5 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{c.address}</span>
                        </span>
                      ) : null}
                    </div>

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                          >
                            {t}
                          </span>
                        ))}
                        {tags.length > 3 && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            +{tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Quick Actions */}
                  <div
                    className="mt-4 flex min-w-0 items-center justify-between gap-2 border-t border-border/70 pt-2.5 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1.5">
                      {wa ? (
                        <a
                          href={`https://wa.me/${wa}?text=Hola%20${encodeURIComponent(c.name)},`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-success/30 bg-success/10 px-2 text-[11px] font-medium text-success hover:bg-success/20 transition-colors"
                          title="Enviar WhatsApp"
                        >
                          <MessageCircle className="h-3 w-3" />
                          <span>WhatsApp</span>
                        </a>
                      ) : null}

                      {c.phone_number ? (
                        <a
                          href={`tel:${c.phone_number}`}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Llamar"
                        >
                          <Phone className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => openModal(c)}
                        title="Editar cliente"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground"
                        onClick={() => openCustomer(c.id)}
                        title="Abrir ficha"
                        aria-label="Abrir ficha"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div
            className={cn(
              "overflow-x-auto rounded-2xl border border-border bg-card shadow-xs transition-opacity duration-300",
              isFetching ? "opacity-60 pointer-events-none" : "opacity-100",
            )}
          >
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  {invoicesEnabled && (
                    <th className="w-px whitespace-nowrap px-3 py-3 font-semibold">RUT</th>
                  )}
                  <th className="px-4 py-3 font-semibold">Contacto & WhatsApp</th>
                  <th className="px-4 py-3 font-semibold">Saldo Pendiente</th>
                  <th className="px-4 py-3 font-semibold">Tipo & Tags</th>
                  <th className="px-4 py-3 text-center font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredCustomers.map((c) => {
                  const wa = cleanPhoneForWa(c.phone_number);
                  const debt = debtMap.get(String(c.id));
                  const tags = getCustomerTags(c);
                  const isCompany = (c as { receiver_type?: string | null }).receiver_type === "EMPRESA";

                  return (
                    <tr
                      key={c.id}
                      onClick={() => openCustomer(c.id)}
                      className={cn(
                        "cursor-pointer hover:bg-muted/30 transition-colors",
                        selectedId === c.id && "bg-primary/5",
                      )}
                    >
                      {/* Cliente (Avatar + Name) */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <CustomerAvatar
                            name={c.name}
                            photo={(c as Record<string, unknown>).photo as string | undefined}
                            className="h-9 w-9 rounded-xl text-xs"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-sm hover:underline">{c.name}</p>
                            {c.commercial_business ? (
                              <p className="truncate text-xs text-muted-foreground">{c.commercial_business}</p>
                            ) : c.address ? (
                              <p className="truncate text-xs text-muted-foreground">{c.address}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* RUT/DNI */}
                      {invoicesEnabled && (
                        <td className="w-px whitespace-nowrap px-3 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                          {c.dni ? formatRut(c.dni) : "—"}
                        </td>
                      )}

                      {/* Contacto & WhatsApp */}
                      <td className="px-4 py-3 text-xs" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          {c.phone_number ? (
                            <a href={`tel:${c.phone_number}`} className="hover:underline font-medium">
                              {c.phone_number}
                            </a>
                          ) : null}

                          {wa ? (
                            <a
                              href={`https://wa.me/${wa}?text=Hola%20${encodeURIComponent(c.name)},`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-success hover:opacity-80 p-0.5"
                              title="Abrir chat en WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          ) : null}

                          {c.email ? (
                            <a href={`mailto:${c.email}`} className="text-muted-foreground hover:text-foreground" title={c.email}>
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                          ) : null}

                          {!c.phone_number && !c.email && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>

                      {/* Saldo Pendiente */}
                      <td className="px-4 py-3 text-xs">
                        {debt && debt > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-warning bg-card px-2.5 py-0.5 font-bold tabular-nums text-warning">
                            {formatCLP(debt)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-medium">Al día</span>
                        )}
                      </td>

                      {/* Tipo & Tags */}
                      <td className="px-4 py-3 text-xs">
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.2 text-[10px] font-semibold",
                              isCompany
                                ? "bg-purple-500/10 text-purple-700 dark:text-purple-400"
                                : "bg-blue-500/10 text-blue-700 dark:text-blue-400",
                            )}
                          >
                            {isCompany ? "Empresa" : "Persona"}
                          </span>

                          {tags.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-primary/10 px-2 py-0.2 text-[10px] font-medium text-primary"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleActive.mutate({ id: c.id, isActive: !c.is_active })}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                            c.is_active
                              ? "bg-success/10 text-success hover:bg-success/20"
                              : "bg-muted text-muted-foreground hover:bg-muted/80",
                          )}
                          title={c.is_active ? "Desactivar cliente" : "Activar cliente"}
                        >
                          <Power className="h-3 w-3" />
                          <span>{c.is_active ? "Activo" : "Inactivo"}</span>
                        </button>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Editar"
                            onClick={() => openModal(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="Eliminar"
                            onClick={() => setConfirmDelete(c)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {(page?.next || page?.previous) && (
          <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Mostrando {filteredCustomers.length} de {totalCustomers} clientes
              </span>
              {isFetching && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Actualizando…
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={!page?.previous || isFetching}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!page?.next || isFetching}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </PageBody>

        </>
      )}

      {/* Modal: Crear / Editar Cliente */}
      <AnimatedOverlay
        open={modalOpen}
        onClose={closeModal}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center p-0 sm:items-center sm:p-4"
      >
        <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-2xl border border-border bg-background p-4 shadow-xl sm:max-w-xl sm:rounded-2xl sm:p-6">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-semibold">
                {editing ? "Editar cliente" : "Nuevo cliente"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Información comercial, datos de contacto y facturación.
              </p>
            </div>
            <button
              onClick={closeModal}
              aria-label="Cerrar"
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className="mt-4 flex flex-col gap-4"
          >
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <CustomerAvatar
                name={form.name || "Cliente"}
                photo={clearPhoto ? null : photoPreview || editing?.photo}
                className="h-14 w-14 rounded-2xl text-base"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">Foto del cliente</p>
                <p className="text-[11px] text-muted-foreground">
                  Se usa como avatar en el listado y en la ficha.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted">
                    Elegir imagen
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      onChange={(e) => onPhotoPicked(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {(photoPreview || (editing?.photo && !clearPhoto)) && (
                    <button
                      type="button"
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        onPhotoPicked(null);
                        setClearPhoto(true);
                      }}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            </div>
            {/* Sección: Datos Generales */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Nombre / Razón Social *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Ej: Distribuidora Alimentos SpA"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Teléfono</label>
                <Input
                  value={form.phone_number ?? ""}
                  onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                  placeholder="+56 9…"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Correo electrónico</label>
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contacto@empresa.cl"
                />
              </div>

              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Giro o Actividad Comercial</label>
                <Input
                  value={form.commercial_business ?? ""}
                  onChange={(e) => setForm({ ...form, commercial_business: e.target.value })}
                  placeholder="Ej: Restaurant, Minimarket, Particular…"
                />
              </div>

              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Dirección</label>
                <Input
                  value={form.address ?? ""}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Calle, Número, Comuna…"
                />
              </div>
            </div>

            {/* Sección: Facturación SII */}
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-primary" />
                <span>Perfil de Facturación</span>
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                {invoicesEnabled && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">RUT / DNI</label>
                    <Input
                      value={form.dni ?? ""}
                      onChange={(e) => setForm({ ...form, dni: e.target.value })}
                      placeholder="12.345.678-9"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Tipo de receptor</label>
                  <Select
                    value={form.receiver_type ?? "PERSONA_NATURAL"}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        receiver_type: e.target.value as "PERSONA_NATURAL" | "EMPRESA",
                      })
                    }
                  >
                    <option value="PERSONA_NATURAL">Persona Natural</option>
                    <option value="EMPRESA">Empresa (Factura)</option>
                  </Select>
                </div>

                {invoicesEnabled && (
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-xs text-muted-foreground">Documento por defecto</label>
                    <Select
                      value={form.default_document_type ?? "BOLETA"}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          default_document_type: e.target.value as "BOLETA" | "FACTURA",
                        })
                      }
                    >
                      <option value="BOLETA">Boleta Electrónica</option>
                      <option value="FACTURA">Factura Electrónica</option>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Sección: Etiquetas / Tags */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Etiquetas (Tags)</label>
              <div className="flex items-center gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag(tagInput);
                    }
                  }}
                  placeholder="Escribí un tag y pulsá Enter…"
                  className="text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddTag(tagInput)}
                >
                  Agregar
                </Button>
              </div>

              {/* Tags seleccionados */}
              {(form.tags ?? []).length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {(form.tags ?? []).map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="rounded-full hover:bg-primary/20 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Tags sugeridos */}
              {allTags.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                  <span>Sugerencias:</span>
                  {allTags.slice(0, 5).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleAddTag(t)}
                      className="rounded-md border border-border px-1.5 py-0.5 hover:bg-muted transition-colors"
                    >
                      +{t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {save.isError ? (
              <p className="text-xs text-danger">
                No se pudo guardar el cliente. Si elegiste una foto, probá de nuevo.
              </p>
            ) : null}
            <div className="mt-2 flex justify-end gap-2 border-t border-border pt-3">
              <Button type="button" variant="outline" size="sm" onClick={closeModal}>
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!form.name.trim() || save.isPending}
                isLoading={save.isPending}
              >
                {editing ? "Guardar cambios" : "Crear cliente"}
              </Button>
            </div>
          </form>
        </div>
      </AnimatedOverlay>

      {/* Dialog: Confirm Delete */}
      {confirmDelete && (
        <AnimatedOverlay
          open={Boolean(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
          zIndex="z-[80]"
          panelClassName="flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold">¿Eliminar cliente?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Vas a eliminar a <strong>{confirmDelete.name}</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={remove.isPending}
                isLoading={remove.isPending}
                onClick={() => remove.mutate(confirmDelete.id)}
              >
                Sí, eliminar
              </Button>
            </div>
          </div>
        </AnimatedOverlay>
      )}
    </PageShell>
  );
}
