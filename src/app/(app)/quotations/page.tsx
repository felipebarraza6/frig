"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Plus,
  Search,
  FileText,
  FileSpreadsheet,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  DollarSign,
  RotateCcw,
  LayoutGrid,
  List,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton, StatCardSkeleton } from "@/components/ui/skeleton";
import { StatCard as SharedStatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/page-header";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  fetchQuotations,
  fetchQuotationStats,
  exportQuotationsExcel,
  type Quotation,
} from "@/lib/api/quotations";
import { searchCustomers } from "@/lib/api/customers";
import { QuotationCreateModal } from "@/components/sales/quotation-create-modal";
import { QuotationDetailModal } from "@/components/sales/quotation-detail-modal";
import { formatCLP, orderTypeLabel } from "@/lib/utils";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { useToast } from "@/lib/store/toast";
import { useCurrentBranch } from "@/lib/store/session";
import { useRecentPickerSuggestions } from "@/lib/hooks/useRecentPickerSuggestions";

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Borrador" },
  { value: "PENDING", label: "Pendiente" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "COMPLETED", label: "Completada" },
  { value: "CANCELLED", label: "Cancelada" },
];

const ORDER_TYPE_OPTIONS = [
  { value: "SALE", label: "Venta" },
  { value: "ORDER", label: "Pedido" },
  { value: "AGREEMENT", label: "Convenio" },
];

function statusLabel(value?: string | null): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  DRAFT: "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
  PENDING: "rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning",
  IN_PROGRESS: "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary",
  COMPLETED: "rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success",
  CANCELLED: "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger",
};

function statusBadgeClass(status?: string | null) {
  return (
    (status && STATUS_BADGE_CLASSES[status]) ??
    "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
  );
}

/** ¿La fecha de vencimiento ya pasó? Solo aplica a cotizaciones abiertas. */
function isExpiredQuotation(q: Quotation): boolean {
  const value = q.expiration_date;
  if (!value || (q.status !== "DRAFT" && q.status !== "PENDING")) return false;
  const end = new Date(`${value.slice(0, 10)}T23:59:59`);
  return !Number.isNaN(end.getTime()) && end.getTime() < Date.now();
}

/** Formato de fecha corto en es-CL, anclado a mediodía para evitar desfases TZ. */
function formatDateCL(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CL");
}

/** Filtros que persisten entre visitas al módulo. */
const QUOTATIONS_FILTERS_KEY = "quotations-filters";

type QuotationView = "cards" | "list";

interface PersistedQuotationFilters {
  search?: string;
  status?: string | string[];
  orderType?: string | string[];
  clientId?: string;
  clientName?: string;
  startDate?: string;
  endDate?: string;
  view?: QuotationView;
}

function asArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
}

function loadPersistedFilters(): PersistedQuotationFilters {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(QUOTATIONS_FILTERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedQuotationFilters;
    if (!parsed || typeof parsed !== "object") return {};
    // Validar la vista persistida: solo valores conocidos, si no, tarjetas.
    return { ...parsed, view: parsed.view === "list" ? "list" : "cards" };
  } catch {
    return {};
  }
}

export default function QuotationsPage() {
  const toast = useToast();
  const branch = useCurrentBranch();
  const branchId =
    branch?.branch_id !== undefined && branch?.branch_id !== null
      ? Number(branch.branch_id)
      : undefined;
  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();
  const [persistedFilters] = useState(loadPersistedFilters);
  const [search, setSearch] = useState(persistedFilters.search ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(persistedFilters.search ?? "");
  const [status, setStatus] = useState<string[]>(() => asArray(persistedFilters.status));
  const [orderType, setOrderType] = useState<string[]>(() => asArray(persistedFilters.orderType));
  const [clientId, setClientId] = useState(persistedFilters.clientId ?? "");
  const [clientName, setClientName] = useState(persistedFilters.clientName ?? "");
  const [clientQuery, setClientQuery] = useState("");
  const [debouncedClientQuery, setDebouncedClientQuery] = useState("");
  const [startDate, setStartDate] = useState(persistedFilters.startDate ?? "");
  const [endDate, setEndDate] = useState(persistedFilters.endDate ?? "");
  const [view, setView] = useState<QuotationView>(persistedFilters.view ?? "cards");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Quotation | null>(null);
  const [editing, setEditing] = useState<Quotation | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedClientQuery(clientQuery), 150);
    return () => clearTimeout(t);
  }, [clientQuery]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        QUOTATIONS_FILTERS_KEY,
        JSON.stringify({
          search,
          status,
          orderType,
          clientId,
          clientName,
          startDate,
          endDate,
          view,
        }),
      );
    } catch {
      // sin almacenamiento disponible
    }
  }, [search, status, orderType, clientId, clientName, startDate, endDate, view]);

  const filter = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: status.length ? status : undefined,
      order_type: orderType.length ? orderType : undefined,
      client__in: clientId || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      ...pageUrl,
    }),
    [debouncedSearch, status, orderType, clientId, startDate, endDate, pageUrl],
  );

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["quotations", filter],
    queryFn: () => fetchQuotations(filter),
  });

  const quotations = (page?.results ?? []) as Quotation[];
  const totalQuotations = page?.count ?? 0;
  const hasActiveFilters = Boolean(
    debouncedSearch || status.length || orderType.length || clientId || startDate || endDate,
  );

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["quotations", "stats"],
    queryFn: fetchQuotationStats,
    staleTime: 60_000,
  });

  const { recentClients } = useRecentPickerSuggestions(true);

  const clientSearchQuery = useQuery({
    queryKey: ["customers", "search", "quotations-filter", debouncedClientQuery, branchId],
    queryFn: () => searchCustomers(debouncedClientQuery, branchId),
    enabled: debouncedClientQuery.trim().length > 0,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const clientFilterOptions = useMemo(() => {
    const recents = recentClients.map((c) => ({
      value: String(c.id),
      label: c.name,
      description: [c.dni, c.phone_number].filter(Boolean).join(" · ") || "Reciente",
    }));
    const q = debouncedClientQuery.trim();
    if (!q) {
      if (clientId && clientName && !recents.some((o) => o.value === clientId)) {
        return [{ value: clientId, label: clientName }, ...recents];
      }
      return recents;
    }
    const found = (clientSearchQuery.data ?? []).map((c) => ({
      value: String(c.id),
      label: c.name ?? "Sin nombre",
      description: [c.dni, c.phone_number].filter(Boolean).join(" · ") || undefined,
    }));
    const merged = [...found];
    for (const r of recents) {
      if (!merged.some((o) => o.value === r.value)) merged.push(r);
    }
    if (clientId && clientName && !merged.some((o) => o.value === clientId)) {
      merged.unshift({ value: clientId, label: clientName, description: undefined });
    }
    return merged;
  }, [clientSearchQuery.data, recentClients, clientId, clientName, debouncedClientQuery]);

  function updateFilter<T>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  function resetFilters() {
    setSearch("");
    setDebouncedSearch("");
    setStatus([]);
    setOrderType([]);
    setClientId("");
    setClientName("");
    setClientQuery("");
    setDebouncedClientQuery("");
    setStartDate("");
    setEndDate("");
    setPageUrl({});
  }

  async function handleExportExcel() {
    await downloadFile(() => exportQuotationsExcel(filter), {
      filename: exportFilename("cotizaciones", "xlsx"),
      extension: "xlsx",
      onError: (err) => toast.error(err.message || "No se pudo exportar el Excel"),
    });
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
      <PageHeader
        title="Cotizaciones"
        icon={<FileText className="h-5 w-5" />}
        subtitle="Presupuestos y cotizaciones a clientes"
        actions={
          <>
            <Button
              size="icon"
              variant="outline"
              onClick={handleExportExcel}
              disabled={isDownloading || quotations.length === 0}
              className="h-9 w-9 sm:hidden"
              title="Exportar Excel"
              aria-label="Exportar Excel"
            >
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportExcel}
              disabled={isDownloading || quotations.length === 0}
              className="hidden sm:flex"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
            <Button
              size="icon"
              onClick={() => setCreating(true)}
              className="h-9 w-9 sm:hidden"
              title="Nueva cotización"
              aria-label="Nueva cotización"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setCreating(true)}
              className="hidden sm:flex"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva cotización
            </Button>
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statsLoading && !stats ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <SharedStatCard
                label="Cotizaciones"
                value={String(stats?.total ?? 0)}
                icon={FileText}
                sub="registros en total"
                tone="muted"
              />
              <SharedStatCard
                label="Pendientes"
                value={String(stats?.pending ?? 0)}
                icon={Clock}
                sub="borrador o por aprobar"
                tone="warning"
              />
              <SharedStatCard
                label="Aprobadas"
                value={String(stats?.approved ?? 0)}
                icon={CheckCircle2}
                sub="convertidas en venta"
                tone="success"
              />
              <SharedStatCard
                label="Monto pendiente"
                value={formatCLP(stats?.pending_amount ?? 0)}
                icon={DollarSign}
                sub="suma de cotizaciones abiertas"
                tone="primary"
              />
            </>
          )}
        </section>

        {/* Filtros: una sola fila que envuelve en pantallas chicas */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => updateFilter(setSearch, e.target.value)}
              placeholder="Buscar cotización…"
              className="pl-9"
              aria-label="Buscar cotización"
            />
          </div>
          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
            <label className="text-xs text-muted-foreground">Cliente</label>
            <SearchableSelect
              options={clientFilterOptions}
              value={clientId}
              onChange={(value) => {
                setClientId(value);
                const opt = clientFilterOptions.find((o) => o.value === value);
                setClientName(opt?.label ?? "");
                setPageUrl({});
              }}
              onQueryChange={setClientQuery}
              minChars={0}
              loading={clientSearchQuery.isFetching}
              clearable
              selectedOption={
                clientId && clientName ? { value: clientId, label: clientName } : null
              }
              placeholder="Filtrar por cliente…"
              searchPlaceholder="Nombre, RUT o teléfono…"
              emptyMessage="Sin coincidencias"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Estado</label>
            <MultiSelect
              options={STATUS_OPTIONS}
              value={status}
              onChange={(v) => updateFilter(setStatus, v)}
              placeholder="Todos"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Tipo</label>
            <MultiSelect
              options={ORDER_TYPE_OPTIONS}
              value={orderType}
              onChange={(v) => updateFilter(setOrderType, v)}
              placeholder="Todos"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-start-date" className="text-xs text-muted-foreground">Desde</label>
            <Input
              id="filter-start-date"
              type="date"
              value={startDate}
              onChange={(e) => updateFilter(setStartDate, e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-end-date" className="text-xs text-muted-foreground">Hasta</label>
            <Input
              id="filter-end-date"
              type="date"
              value={endDate}
              onChange={(e) => updateFilter(setEndDate, e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-10 px-3"
            onClick={resetFilters}
            title="Limpiar filtros"
            aria-label="Limpiar filtros"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <div
            className="flex h-10 items-center gap-0.5 rounded-lg border border-border p-1"
            role="group"
            aria-label="Cambiar vista"
          >
            <button
              type="button"
              onClick={() => setView("cards")}
              aria-pressed={view === "cards"}
              title="Vista de tarjetas"
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                view === "cards"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              title="Vista de lista"
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                view === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {error ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No se pudieron cargar las cotizaciones</p>
              <p className="text-xs text-muted-foreground">
                {error instanceof Error ? error.message : "Ocurrió un error inesperado."}
              </p>
            </div>
          </div>
        ) : isLoading ? (
          view === "list" ? (
            <div className="overflow-hidden rounded-xl border border-border shadow-sm">
              <div className="border-b border-border bg-background px-4 py-3">
                <Skeleton className="h-3 w-56" />
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-border/60 px-4 py-3 last:border-b-0"
                >
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="ml-auto h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-background p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="mt-3 h-3 w-40" />
                <Skeleton className="mt-3 h-5 w-24" />
                <Skeleton className="mt-3 h-3 w-28" />
              </div>
            ))}
          </div>
          )
        ) : quotations.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                {hasActiveFilters ? "Sin resultados con estos filtros" : "Aún no hay cotizaciones"}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasActiveFilters
                  ? "Prueba limpiar filtros o cambia el criterio de búsqueda."
                  : "Crea la primera cotización para un cliente."}
              </p>
              <div className="mt-4 flex justify-center gap-2">
                {hasActiveFilters ? (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Limpiar filtros
                  </Button>
                ) : null}
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva cotización
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {view === "list" ? (
              /* Tabla para la vista de lista (scroll horizontal en pantallas chicas) */
              <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">N°</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Fecha</th>
                      <th className="px-4 py-3 text-right">Vence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.map((quotation) => (
                      <tr
                        key={quotation.id}
                        onClick={() => setDetail(quotation)}
                        className={`cursor-pointer border-b border-border/60 transition-colors last:border-b-0 hover:bg-muted/40 ${
                          quotation.status === "CANCELLED" ? "opacity-70" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-medium">
                          {quotation.order_number ?? `#${quotation.id.slice(0, 8).toUpperCase()}`}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3">
                          {quotation.client?.name ?? "Sin cliente"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {orderTypeLabel(quotation.order_type)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={statusBadgeClass(quotation.status)}>
                            {statusLabel(quotation.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {formatCLP(quotation.total_amount ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {formatDateCL(quotation.date)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right ${
                            isExpiredQuotation(quotation)
                              ? "font-medium text-danger"
                              : "text-muted-foreground"
                          }`}
                        >
                          {quotation.expiration_date
                            ? formatDateCL(quotation.expiration_date)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
            /* Galería de tarjetas */
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {quotations.map((quotation) => (
                <div
                  key={quotation.id}
                  onClick={() => setDetail(quotation)}
                  className={`cursor-pointer rounded-2xl border border-border bg-background p-4 shadow-sm transition-colors hover:border-primary/40 ${
                    quotation.status === "CANCELLED" ? "opacity-70" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {quotation.order_number ?? quotation.id.slice(0, 8)}
                      </p>
                      <p className="text-xs font-mono uppercase text-muted-foreground">
                        #{quotation.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={statusBadgeClass(quotation.status)}>
                        {statusLabel(quotation.status)}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {orderTypeLabel(quotation.order_type)}
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{quotation.client?.name ?? "Sin cliente"}</span>
                  </p>

                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Total</span>
                      <span className="text-base font-semibold tabular-nums">
                        {formatCLP(quotation.total_amount ?? 0)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      {formatDateCL(quotation.date)}
                    </span>
                    <span
                      className={`text-xs tabular-nums ${
                        isExpiredQuotation(quotation) ? "font-medium text-danger" : "text-muted-foreground"
                      }`}
                    >
                      Vence: {quotation.expiration_date ? formatDateCL(quotation.expiration_date) : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            )}

            <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
              <p className="text-muted-foreground">
                {totalQuotations} cotizaci{totalQuotations === 1 ? "ón" : "ones"} en total
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

      <QuotationCreateModal
        open={creating || !!editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        quotation={editing}
      />

      {detail && (
        <QuotationDetailModal
          quotation={detail}
          onClose={() => setDetail(null)}
          onEdit={(q) => {
            setDetail(null);
            setEditing(q);
          }}
        />
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
  tone?: "success" | "info" | "warning" | "danger" | "slate";
}) {
  const toneStyles = {
    success: "from-success/10 via-background to-background",
    info: "from-primary/10 via-background to-background",
    warning: "from-warning/10 via-background to-background",
    danger: "from-danger/10 via-background to-background",
    slate: "from-muted/50 via-background to-background",
  };
  const toneText = {
    success: "text-success",
    info: "text-primary",
    warning: "text-warning",
    danger: "text-danger",
    slate: "text-muted-foreground",
  };
  const toneIcon = {
    success: "bg-success/12 text-success",
    info: "bg-primary/12 text-primary",
    warning: "bg-warning/12 text-warning",
    danger: "bg-danger/12 text-danger",
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
