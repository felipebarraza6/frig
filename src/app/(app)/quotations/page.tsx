"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { fetchQuotations, exportQuotationsExcel, type Quotation } from "@/lib/api/quotations";
import { QuotationCreateModal } from "@/components/sales/quotation-create-modal";
import { QuotationDetailModal } from "@/components/sales/quotation-detail-modal";
import { formatCLP, orderTypeLabel } from "@/lib/utils";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { useToast } from "@/lib/store/toast";

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "DRAFT", label: "Borrador" },
  { value: "PENDING", label: "Pendiente" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "COMPLETED", label: "Completada" },
  { value: "CANCELLED", label: "Cancelada" },
];

const ORDER_TYPE_OPTIONS = [
  { value: "", label: "Todos" },
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
  status?: string;
  orderType?: string;
  startDate?: string;
  endDate?: string;
  view?: QuotationView;
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

/** Tamaño de página para el fetch de métricas (snapshot global, sin filtros). */
const STATS_PAGE_SIZE = 500;

export default function QuotationsPage() {
  const toast = useToast();
  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();
  const [persistedFilters] = useState(loadPersistedFilters);
  const [search, setSearch] = useState(persistedFilters.search ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(persistedFilters.search ?? "");
  const [status, setStatus] = useState(persistedFilters.status ?? "");
  const [orderType, setOrderType] = useState(persistedFilters.orderType ?? "");
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

  // Persistir filtros para que el usuario retome su búsqueda al volver al módulo.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        QUOTATIONS_FILTERS_KEY,
        JSON.stringify({ search, status, orderType, startDate, endDate, view }),
      );
    } catch {
      // sin almacenamiento disponible: los filtros solo viven en la sesión
    }
  }, [search, status, orderType, startDate, endDate, view]);

  const filter = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: status || undefined,
      order_type: orderType || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      ...pageUrl,
    }),
    [debouncedSearch, status, orderType, startDate, endDate, pageUrl],
  );

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["quotations", filter],
    queryFn: () => fetchQuotations(filter),
  });

  const quotations = (page?.results ?? []) as Quotation[];
  const totalQuotations = page?.count ?? 0;

  // Métricas calculadas client-side desde un snapshot sin filtros (page_size
  // grande). No se usa /stats/: su forma de respuesta no está garantizada.
  const { data: statsPage } = useQuery({
    queryKey: ["quotations", "stats"],
    queryFn: () => fetchQuotations({ page_size: STATS_PAGE_SIZE }),
    staleTime: 60_000,
  });

  const stats = useMemo(() => {
    const all = statsPage?.results ?? [];
    let pending = 0;
    let approved = 0;
    let pendingAmount = 0;
    for (const q of all) {
      if (q.status === "DRAFT" || q.status === "PENDING") {
        pending += 1;
        pendingAmount += Number(q.total_amount ?? 0) || 0;
      } else if (q.status === "COMPLETED" || q.status === "IN_PROGRESS") {
        approved += 1;
      }
    }
    return {
      total: statsPage?.count ?? all.length,
      pending,
      approved,
      pendingAmount,
    };
  }, [statsPage]);

  function updateFilter<T extends string>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  function resetFilters() {
    setSearch("");
    setDebouncedSearch("");
    setStatus("");
    setOrderType("");
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
    <div className="flex min-h-full flex-col">
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Cotizaciones</h1>
          <p className="text-xs text-muted-foreground">
            Presupuestos y cotizaciones a clientes
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {/* Estadísticas calculadas client-side (snapshot sin filtros). */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {isLoading ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="Cotizaciones"
                value={String(stats.total)}
                icon={FileText}
                sub="registros en total"
                tone="slate"
              />
              <StatCard
                label="Pendientes"
                value={String(stats.pending)}
                icon={Clock}
                sub="borrador o por aprobar"
                tone="warning"
              />
              <StatCard
                label="Aprobadas"
                value={String(stats.approved)}
                icon={CheckCircle2}
                sub="convertidas en venta"
                tone="success"
              />
              <StatCard
                label="Monto pendiente"
                value={formatCLP(stats.pendingAmount)}
                icon={DollarSign}
                sub="suma de cotizaciones abiertas"
                tone="info"
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
            <label htmlFor="filter-type" className="text-xs text-muted-foreground">Tipo</label>
            <Select
              id="filter-type"
              value={orderType}
              onChange={(e) => updateFilter(setOrderType, e.target.value)}
            >
              {ORDER_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
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
              <div className="border-b border-border bg-muted/50 px-4 py-3">
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
                className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm"
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
              <p className="mt-3 text-sm font-medium">No se encontraron cotizaciones</p>
              <p className="text-xs text-muted-foreground">
                Prueba con otros filtros o crea una nueva cotización.
              </p>
            </div>
          </div>
        ) : (
          <>
            {view === "list" ? (
              /* Tabla para la vista de lista (scroll horizontal en pantallas chicas) */
              <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
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
                  className={`cursor-pointer rounded-2xl border border-border bg-muted/30 p-4 shadow-sm transition-colors hover:border-primary/40 ${
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

function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-3 w-20" />
    </div>
  );
}
