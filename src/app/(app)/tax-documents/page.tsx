"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Plus,
  Search,
  X,
  Loader2,
  AlertCircle,
  RotateCcw,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  CreditCard,
  Download,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionsMenu, type ActionMenuItem } from "@/components/ui/actions-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchTaxDocuments,
  fetchTaxDocumentsSummary,
  fetchPendingSiiDocuments,
  generateTaxDocumentFromOrder,
  issueTaxDocument,
  sendToSii,
  cancelTaxDocument,
  createCreditNote,
  type TaxDocument,
} from "@/lib/api/tax-documents";
import { useToast } from "@/lib/store/toast";
import { isValidRUT } from "@/lib/validation";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { fetchOrders } from "@/lib/api/orders";
import { mediaUrl } from "@/lib/api/client";
import { formatCLP as formatCLPShared, cn } from "@/lib/utils";
import { statusBadge as statusBadgeTokens } from "@/lib/status-styles";
import { getCurrentMonthRange } from "@/lib/date-range";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { SII_CAF_TYPES, siiTypeLabel } from "@/lib/sii-document-types";
import { useCurrentBranch } from "@/lib/store/session";
import { fetchBranchFinanceConfigByBranch } from "@/lib/api/branch-finance-config";
import {
  fetchExternalAppEndpoints,
  fetchExternalAppInstallations,
  type ExternalAppInstallation,
} from "@/lib/api/external-app-installations";
import { fetchTaxFolios } from "@/lib/api/tax-folios";

const DOC_TYPE_OPTIONS = [
  { value: "", label: "Todos los tipos" },
  ...SII_CAF_TYPES.map((t) => ({ value: t.code as string, label: t.label })),
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "DRAFT", label: "Borrador" },
  { value: "ISSUED", label: "Emitido · por enviar" },
  { value: "SENT", label: "Enviado al SII" },
  { value: "ACCEPTED", label: "Aceptado" },
  { value: "REJECTED", label: "Rechazado" },
  { value: "CANCELLED", label: "Anulado" },
];

const QUICK_FILTERS: { id: string; label: string; type?: string; status?: string }[] = [
  { id: "all", label: "Todos" },
  { id: "boletas", label: "Boletas", type: "39" },
  { id: "facturas", label: "Facturas", type: "33" },
  { id: "pending", label: "Por enviar al SII", status: "ISSUED" },
  { id: "rejected", label: "Rechazados", status: "REJECTED" },
];

const FILTERS_KEY = "frig.tax-documents.filters";

function formatCLP(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(num);
}

function statusBadge(status?: string | null) {
  switch (status) {
    case "DRAFT":
      return "bg-muted text-muted-foreground";
    case "ISSUED":
      return "bg-primary/10 text-primary";
    case "SENT":
      return "bg-warning/10 text-warning";
    case "ACCEPTED":
      return "bg-success/10 text-success";
    case "REJECTED":
      return "bg-danger/10 text-danger";
    case "CANCELLED":
      return "bg-danger/10 text-danger";
    default:
      return statusBadgeTokens(status);
  }
}

function statusIcon(status?: string | null) {
  switch (status) {
    case "DRAFT": return Clock;
    case "ISSUED": return FileText;
    case "SENT": return Send;
    case "ACCEPTED": return CheckCircle2;
    case "REJECTED": return XCircle;
    case "CANCELLED": return XCircle;
    default: return Clock;
  }
}

function docTypeLabel(t?: string | null) {
  return siiTypeLabel(t);
}

function looksLikeRut(q: string): boolean {
  return /^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$/.test(q.trim()) || /^\d{7,8}-[\dkK]$/.test(q.trim());
}

function loadPersisted(): { startDate?: string; endDate?: string; status?: string; type?: string } {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FILTERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export default function TaxDocumentsPage() {
  const month = getCurrentMonthRange();
  const persisted = useMemo(loadPersisted, []);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(persisted.status ?? "");
  const [typeFilter, setTypeFilter] = useState(persisted.type ?? "");
  const [startDate, setStartDate] = useState(persisted.startDate ?? month.start);
  const [endDate, setEndDate] = useState(persisted.endDate ?? month.end);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<TaxDocument | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [detail, setDetail] = useState<TaxDocument | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    try {
      window.localStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ startDate, endDate, status: statusFilter, type: typeFilter }),
      );
    } catch {
      /* ignore */
    }
  }, [startDate, endDate, statusFilter, typeFilter]);

  const rutQuery = looksLikeRut(debouncedSearch) ? debouncedSearch.trim() : "";

  const { data: documents = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["tax-documents", statusFilter, typeFilter, startDate, endDate, rutQuery],
    queryFn: () =>
      fetchTaxDocuments({
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(typeFilter ? { document_type: typeFilter } : {}),
        ...(startDate ? { date_from: startDate } : {}),
        ...(endDate ? { date_to: endDate } : {}),
        ...(rutQuery ? { customer_rut: rutQuery } : {}),
      }),
  });

  const { data: summary } = useQuery({
    queryKey: ["tax-documents-summary", startDate, endDate],
    queryFn: () => fetchTaxDocumentsSummary({ date_from: startDate, date_to: endDate }),
  });

  const { data: pendingSii = [] } = useQuery({
    queryKey: ["tax-documents-pending-sii"],
    queryFn: fetchPendingSiiDocuments,
  });

  const filtered = documents.filter((d) => {
    if (!debouncedSearch.trim() || rutQuery) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      d.customer_name?.toLowerCase().includes(q) ||
      d.customer_rut?.includes(debouncedSearch) ||
      d.folio?.includes(debouncedSearch) ||
      d.document_number?.toLowerCase().includes(q)
    );
  });

  const issueMut = useMutation({
    mutationFn: issueTaxDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-documents"] });
      toast.success("Documento emitido");
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo emitir"),
  });

  const sendMut = useMutation({
    mutationFn: sendToSii,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-documents"] });
      queryClient.invalidateQueries({ queryKey: ["tax-documents-pending-sii"] });
      toast.success("Enviado al SII");
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo enviar al SII"),
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, reason, isDraft }: { id: string; reason: string; isDraft: boolean }): Promise<unknown> =>
      isDraft ? cancelTaxDocument(id) : createCreditNote(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-documents"] });
      setConfirmCancel(null);
      setCancelReason("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo anular el documento");
    },
  });

  const creditNoteMut = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      createCreditNote(id, { reason: "Nota de crédito desde DTE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-documents"] });
      toast.success("Nota de crédito creada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMut = useMutation({
    mutationFn: generateTaxDocumentFromOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-documents"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setCreateOpen(false);
      toast.success("DTE generado desde la orden");
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo emitir el DTE"),
  });

  const draftCount = Number(summary?.by_status?.["Borrador"] ?? documents.filter((d) => d.status === "DRAFT").length);
  const issuedCount = pendingSii.length || documents.filter((d) => d.status === "ISSUED").length;
  const acceptedCount = Number(summary?.by_status?.["Aceptado por SII"] ?? summary?.by_status?.["Aceptado"] ?? documents.filter((d) => d.status === "ACCEPTED").length);
  const totalAmount = Number(summary?.total_amount ?? documents.reduce((s, d) => s + (d.total_amount || 0), 0));

  const hasActiveFilters = Boolean(statusFilter || typeFilter || search.trim() || startDate !== month.start || endDate !== month.end);
  const activeFilterCount = [statusFilter, typeFilter, startDate !== month.start || endDate !== month.end].filter(Boolean).length;

  function applyQuick(id: string) {
    const qf = QUICK_FILTERS.find((f) => f.id === id);
    if (!qf || qf.id === "all") {
      setTypeFilter("");
      setStatusFilter("");
      return;
    }
    setTypeFilter(qf.type ?? "");
    setStatusFilter(qf.status ?? "");
  }

  const activeQuick =
    QUICK_FILTERS.find((f) => f.id !== "all" && (f.type ?? "") === typeFilter && (f.status ?? "") === statusFilter)?.id
    ?? ((typeFilter || statusFilter) ? "" : "all");

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setStartDate(month.start);
    setEndDate(month.end);
  }

  function actionsFor(d: TaxDocument): ActionMenuItem[] {
    const items: ActionMenuItem[] = [
      { label: "Ver detalle", icon: Eye, onClick: () => setDetail(d) },
    ];
    if (d.status === "DRAFT") {
      items.push({ label: "Emitir", icon: Send, onClick: () => issueMut.mutate(d.id) });
    }
    if (d.status === "ISSUED") {
      items.push({ label: "Enviar al SII", icon: Send, onClick: () => sendMut.mutate(d.id) });
    }
    if (d.status === "ACCEPTED" && d.is_factura) {
      items.push({ label: "Nota de crédito", icon: CreditCard, onClick: () => creditNoteMut.mutate({ id: d.id }) });
    }
    if (!["CANCELLED", "REJECTED", "ACCEPTED"].includes(d.status ?? "")) {
      items.push({ label: "Anular", icon: XCircle, onClick: () => setConfirmCancel(d), danger: true });
    }
    return items;
  }

  const filterFields = (
    <>
      <div className="flex min-w-0 flex-1 basis-[8rem] flex-col gap-1">
        <label htmlFor="filter-type" className="text-xs text-muted-foreground">Tipo</label>
        <Select id="filter-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          {DOC_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>
      <div className="flex min-w-0 flex-1 basis-[8rem] flex-col gap-1">
        <label htmlFor="filter-status" className="text-xs text-muted-foreground">Estado</label>
        <Select id="filter-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>
      <div className="flex min-w-0 flex-1 basis-[9rem] flex-col gap-1">
        <label htmlFor="filter-start" className="text-xs text-muted-foreground">Desde</label>
        <Input id="filter-start" type="date" value={startDate} className="pr-10" onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <div className="flex min-w-0 flex-1 basis-[9rem] flex-col gap-1">
        <label htmlFor="filter-end" className="text-xs text-muted-foreground">Hasta</label>
        <Input id="filter-end" type="date" value={endDate} min={startDate} disabled={!startDate} className="pr-10" onChange={(e) => setEndDate(e.target.value)} />
      </div>
    </>
  );

  return (
    <div className="mx-auto flex min-h-full w-full min-w-0 max-w-7xl flex-col">
      <PageHeader
        title="Documentos tributarios"
        icon={<FileText className="h-5 w-5" />}
        subtitle="Boletas y facturas electrónicas de las ventas, con su estado ante el SII"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />Emitir desde orden
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 border-b border-border px-4 py-3 sm:px-6 lg:grid-cols-4">
        <StatCard
          icon={Clock}
          label="Borradores"
          value={String(draftCount)}
          tone="muted"
          sub="Aún no valen ante el SII"
          onClick={() => { setStatusFilter("DRAFT"); setTypeFilter(""); }}
        />
        <StatCard
          icon={Send}
          label="Por enviar"
          value={String(issuedCount)}
          tone="warning"
          sub="Emitidos, falta el SII"
          onClick={() => { setStatusFilter("ISSUED"); setTypeFilter(""); }}
        />
        <StatCard
          icon={CheckCircle2}
          label="Aceptados"
          value={String(acceptedCount)}
          tone="success"
          sub="El SII ya los tomó"
          onClick={() => { setStatusFilter("ACCEPTED"); setTypeFilter(""); }}
        />
        <StatCard
          icon={FileText}
          label="Monto del período"
          value={formatCLP(totalAmount)}
          tone="primary"
          sub={`${startDate} → ${endDate}`}
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <p className="text-xs text-muted-foreground">
          Un DTE es el comprobante electrónico de una venta. Boleta: consumidor final. Factura: empresa con RUT.{" "}
          <Link href="/finance/settings#fin-sii" className="font-medium text-primary hover:underline">
            Configurar app, funciones y CAF
          </Link>
        </p>

        <div className="flex flex-col gap-3">
          <div className="hidden min-w-0 flex-wrap items-end gap-2 md:flex">
            <div className="relative min-w-0 flex-[2] basis-[12rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cliente, RUT o folio…"
                className="pl-9"
                aria-label="Buscar documentos"
              />
            </div>
            {filterFields}
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="h-10 w-10 shrink-0 p-0"
              title="Limpiar filtros"
              aria-label="Limpiar filtros"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cliente, RUT o folio…"
                  className="h-10 pl-9"
                  aria-label="Buscar documentos"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="relative h-10 w-10 shrink-0 p-0"
                onClick={() => setShowMobileFilters((v) => !v)}
                aria-expanded={showMobileFilters}
                title="Filtros"
                aria-label="Filtros"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>
            {showMobileFilters && (
              <div className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium">Filtros</span>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowMobileFilters(false)} aria-label="Cerrar filtros">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3">{filterFields}</div>
                <Button variant="outline" size="sm" className="mt-3 w-full" onClick={clearFilters} disabled={!hasActiveFilters}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Limpiar
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {QUICK_FILTERS.map((qf) => (
              <button
                key={qf.id}
                type="button"
                onClick={() => applyQuick(qf.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  activeQuick === qf.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {qf.label}
              </button>
            ))}
          </div>
        </div>

        {isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
            <AlertCircle className="h-7 w-7 text-danger" />
            <p className="text-sm font-medium">No se pudieron cargar los documentos</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reintentar</Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={hasActiveFilters || search ? "Nada coincide con los filtros" : "Aún no hay documentos"}
            description={
              hasActiveFilters || search
                ? "Cambia el tipo, el estado o el período, o limpia los filtros."
                : "El DTE sale de una orden pagada. Emite desde una venta o con el botón de arriba."
            }
            action={
              hasActiveFilters || search ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>Limpiar filtros</Button>
              ) : (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />Emitir desde orden
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-sm md:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Folio</th>
                    <th className="px-4 py-3">Orden</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3 text-right">Neto</th>
                    <th className="px-4 py-3 text-right">IVA</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const StatusIcon = statusIcon(d.status);
                    return (
                      <tr key={d.id} className="border-b border-border last:border-0 hover:bg-background">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{docTypeLabel(d.document_type)}</td>
                        <td className="px-4 py-3 font-mono text-xs">{d.folio ?? d.document_number}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {(d as { order_number?: string }).order_number
                            ?? (typeof d.order === "string" ? d.order.slice(0, 8) : "—")}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{d.issue_date}</td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium">{d.customer_name}</p>
                          <p className="text-[11px] text-muted-foreground">{d.customer_rut}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-xs tabular-nums">{formatCLP(d.net_amount)}</td>
                        <td className="px-4 py-3 text-right text-xs tabular-nums">{formatCLP(d.tax_amount)}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold tabular-nums">{formatCLP(d.total_amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(d.status)}`}>
                            <StatusIcon className="h-3 w-3" />{d.status_display ?? d.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ActionsMenu items={actionsFor(d)} size="icon" className="h-7 w-7" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 md:hidden">
              {filtered.map((d) => {
                const StatusIcon = statusIcon(d.status);
                return (
                  <div key={d.id} className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDetail(d)}>
                        <p className="text-xs text-muted-foreground">{docTypeLabel(d.document_type)} · {d.folio ?? d.document_number}</p>
                        <p className="text-sm font-medium">{d.customer_name}</p>
                        <p className="text-[11px] text-muted-foreground">{d.customer_rut}</p>
                      </button>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(d.status)}`}>
                        <StatusIcon className="h-3 w-3" />{d.status_display ?? d.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{d.issue_date}</span>
                      <span className="font-semibold tabular-nums">{formatCLP(d.total_amount)}</span>
                    </div>
                    <div className="mt-2 flex justify-end border-t border-border pt-2">
                      <ActionsMenu items={actionsFor(d)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <AnimatedOverlay open={!!detail} onClose={() => setDetail(null)} panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4">
        <div className="flex h-[90dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-background shadow-lg md:h-auto md:max-w-lg md:rounded-xl md:border">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold">{detail && docTypeLabel(detail.document_type)}</h2>
            <button onClick={() => setDetail(null)} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>
          {detail && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-xs text-muted-foreground">Folio</span><p className="font-mono font-medium">{detail.folio ?? detail.document_number}</p></div>
                  <div><span className="text-xs text-muted-foreground">Estado</span><p><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(detail.status)}`}>{detail.status_display ?? detail.status}</span></p></div>
                  <div><span className="text-xs text-muted-foreground">Fecha de emisión</span><p className="font-medium">{detail.issue_date}</p></div>
                  {detail.due_date && <div><span className="text-xs text-muted-foreground">Vencimiento</span><p className="font-medium">{detail.due_date}</p></div>}
                </div>
                <hr className="border-border" />
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-xs text-muted-foreground">Cliente</span><p className="font-medium">{detail.customer_name}</p></div>
                  <div><span className="text-xs text-muted-foreground">RUT</span><p className="font-mono">{detail.customer_rut}</p></div>
                  {detail.customer_address && <div className="col-span-2"><span className="text-xs text-muted-foreground">Dirección</span><p>{detail.customer_address}</p></div>}
                </div>
                <hr className="border-border" />
                <div className="grid grid-cols-3 gap-3">
                  <div><span className="text-xs text-muted-foreground">Neto</span><p className="font-medium tabular-nums">{formatCLP(detail.net_amount)}</p></div>
                  <div><span className="text-xs text-muted-foreground">IVA</span><p className="font-medium tabular-nums">{formatCLP(detail.tax_amount)}</p></div>
                  <div><span className="text-xs text-muted-foreground">Total</span><p className="font-semibold tabular-nums">{formatCLP(detail.total_amount)}</p></div>
                </div>
                {detail.items && detail.items.length > 0 && (
                  <>
                    <hr className="border-border" />
                    <div>
                      <span className="text-xs text-muted-foreground">Líneas</span>
                      <ul className="mt-1 space-y-1">
                        {detail.items.map((item) => (
                          <li key={item.id} className="flex justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate">{item.description}</span>
                            <span className="shrink-0 tabular-nums">{formatCLP(item.line_total)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
                {detail.sii_track_id && (
                  <>
                    <hr className="border-border" />
                    <div><span className="text-xs text-muted-foreground">Track ID SII</span><p className="font-mono text-xs">{detail.sii_track_id}</p></div>
                  </>
                )}
                {detail.notes && (
                  <>
                    <hr className="border-border" />
                    <div><span className="text-xs text-muted-foreground">Observaciones</span><p>{detail.notes}</p></div>
                  </>
                )}
                <div className="flex gap-2 pt-2">
                  {detail.pdf_file && (
                    <a href={mediaUrl(detail.pdf_file) ?? detail.pdf_file} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium hover:bg-muted">
                      <Download className="h-3.5 w-3.5" />PDF
                    </a>
                  )}
                  {detail.xml_file && (
                    <a href={mediaUrl(detail.xml_file) ?? detail.xml_file} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium hover:bg-muted">
                      <Download className="h-3.5 w-3.5" />XML
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </AnimatedOverlay>

      <AnimatedOverlay open={!!confirmCancel} onClose={() => { setConfirmCancel(null); setCancelReason(""); }} panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4">
        <div className="w-full rounded-t-xl border-x border-t border-border bg-background p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10">
              <AlertCircle className="h-5 w-5 text-danger" />
            </div>
            <div>
              <h2 className="text-base font-semibold">¿Anular documento?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {confirmCancel && `${docTypeLabel(confirmCancel.document_type)} ${confirmCancel.folio ?? ""} de ${confirmCancel.customer_name}`}
                {confirmCancel?.status === "DRAFT"
                  ? " se marca como anulado (nunca fue al SII)."
                  : " se anula creando una nota de crédito ante el SII."}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Motivo de anulación (requerido)" />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setConfirmCancel(null); setCancelReason(""); }} disabled={cancelMut.isPending}>Cancelar</Button>
            <Button variant="danger" onClick={() => confirmCancel && cancelMut.mutate({ id: confirmCancel.id, reason: cancelReason, isDraft: confirmCancel.status === "DRAFT" })} disabled={!cancelReason.trim()} isLoading={cancelMut.isPending}>{confirmCancel?.status === "DRAFT" ? "Anular borrador" : "Crear nota de crédito"}</Button>
          </div>
        </div>
      </AnimatedOverlay>

      <FromOrderModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(p) => createMut.mutate(p)}
        isPending={createMut.isPending}
      />
    </div>
  );
}

const BOLETA_RUT = "66666666-6";

function FromOrderModal({
  open,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Parameters<typeof generateTaxDocumentFromOrder>[0]) => void;
  isPending: boolean;
}) {
  const toast = useToast();
  const branch = useCurrentBranch();
  const branchId = Number(branch?.branch_id ?? 0);
  const [orderId, setOrderId] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  const [docType, setDocType] = useState("39");
  const [rut, setRut] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const { data: financeConfig } = useQuery({
    queryKey: ["branch-finance-config", branchId, "dte-emit"],
    queryFn: () => fetchBranchFinanceConfigByBranch(branchId),
    enabled: open && branchId > 0,
  });
  const { data: installs = [] } = useQuery({
    queryKey: ["external-app-installations", branchId, "sii-emit"],
    queryFn: () => fetchExternalAppInstallations(branchId, { category: "sii" }),
    enabled: open && branchId > 0,
  });
  const install: ExternalAppInstallation | undefined =
    installs.find((i) => i.id === financeConfig?.sii_provider_installation) ?? installs[0];
  const appId = typeof install?.external_app === "object" ? install.external_app.id : install?.external_app ?? "";
  const { data: endpoints = [] } = useQuery({
    queryKey: ["external-app-endpoints", appId, "dte-emit"],
    queryFn: () => fetchExternalAppEndpoints(appId),
    enabled: open && Boolean(appId),
  });
  const { data: folios = [] } = useQuery({
    queryKey: ["tax-folios", branchId, "dte-emit"],
    queryFn: () => fetchTaxFolios(branchId),
    enabled: open && branchId > 0,
  });

  const preference = financeConfig?.sii_document_preference ?? "AUTO";
  const actionMap = ((install?.config_override as { action_endpoints?: Record<string, string> } | undefined)?.action_endpoints) ?? {};

  function typeStatus(code: string) {
    const meta = SII_CAF_TYPES.find((t) => t.code === code);
    const action = meta?.action ?? (code === "33" ? "factura" : "boleta");
    const slug = meta?.slug ?? (code === "33" ? "generate_factura" : "generate_boleta");
    const mapped = actionMap[action];
    const hasFn = Boolean(install) && endpoints.some((ep) => ep.id === mapped || (ep.slug ?? "") === slug);
    const hasCaf = folios.some(
      (f) => String(f.document_type) === code && f.is_active !== false && Number(f.available_folios ?? 0) > 0,
    );
    return { hasFn, hasCaf, ready: hasFn && hasCaf, label: meta?.label ?? code };
  }

  const saleTypes = ["39", "41", "33", "34"];
  const allowed = preference === "FACTURA"
    ? saleTypes.filter((c) => c === "33" || c === "34")
    : preference === "BOLETA"
      ? saleTypes.filter((c) => c === "39" || c === "41")
      : saleTypes;
  const readyTypes = allowed.filter((code) => typeStatus(code).ready);
  const blocked = allowed
    .filter((code) => !typeStatus(code).ready)
    .map((code) => {
      const st = typeStatus(code);
      if (!install) return "Falta instalar la app de facturación.";
      if (!st.hasFn) return `${st.label}: falta conectar la función.`;
      if (!st.hasCaf) return `${st.label}: falta un CAF con folios.`;
      return `${st.label} no está lista.`;
    });

  const { data: ordersPage, isFetching } = useQuery({
    queryKey: ["orders", "dte-source", orderQuery],
    queryFn: () =>
      fetchOrders({
        search: orderQuery.trim() || undefined,
        payment_status: ["PAID"],
        page_size: 10,
      }),
    enabled: open,
  });

  useEffect(() => {
    if (!open || readyTypes.length === 0) return;
    if (!readyTypes.includes(docType)) setDocType(readyTypes[0]);
  }, [open, docType, readyTypes]);

  const orderOptions = (ordersPage?.results ?? []).map((o) => ({
    value: String(o.id),
    label: `${o.order_number ?? o.id.slice(0, 8)} · ${formatCLPShared(o.total_amount ?? "0")}`,
    description: o.client?.name ?? "Sin cliente",
  }));

  const selected = (ordersPage?.results ?? []).find((o) => String(o.id) === orderId);

  function preferredType(client?: { default_document_type?: string | null; receiver_type?: string | null }) {
    if (preference === "FACTURA") return readyTypes.find((c) => c === "33" || c === "34") ?? "33";
    if (preference === "BOLETA") return readyTypes.find((c) => c === "39" || c === "41") ?? "39";
    const wantsFactura = client?.default_document_type === "FACTURA" || client?.receiver_type === "EMPRESA";
    const wanted = wantsFactura ? "33" : "39";
    if (readyTypes.includes(wanted)) return wanted;
    return readyTypes[0] ?? wanted;
  }

  function applyOrder(id: string) {
    setOrderId(id);
    const o = (ordersPage?.results ?? []).find((x) => String(x.id) === id);
    const client = o?.client as { name?: string; dni?: string; default_document_type?: string | null; receiver_type?: string | null } | undefined;
    const nextType = preferredType(client);
    setDocType(nextType);
    setName(client?.name ?? "Cliente");
    setRut(client?.dni?.trim() || (nextType === "39" || nextType === "41" ? BOLETA_RUT : ""));
    setAddress("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId) {
      toast.error("Elige una orden pagada.");
      return;
    }
    const useRut = (docType === "39" || docType === "41") && !rut.trim() ? BOLETA_RUT : rut.trim();
    if (!isValidRUT(useRut)) {
      toast.error("El RUT del cliente no es válido.");
      return;
    }
    if (!name.trim()) {
      toast.error("Falta el nombre del cliente.");
      return;
    }
    onSubmit({
      order_id: orderId,
      document_type: docType,
      customer_rut: useRut,
      customer_name: name.trim(),
      customer_address: address.trim() || undefined,
    });
  }

  function handleClose() {
    onClose();
    setOrderId("");
    setOrderQuery("");
    setRut("");
    setName("");
    setAddress("");
  }

  return (
    <AnimatedOverlay open={open} onClose={handleClose} panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4">
      <div className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border-x border-t border-border bg-background shadow-lg md:max-w-lg md:rounded-2xl md:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Emitir DTE</h2>
            <p className="text-xs text-muted-foreground">Sale de una orden pagada. Folio y líneas se copian de la venta.</p>
          </div>
          <button type="button" onClick={handleClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm font-medium">Orden</p>
              <SearchableSelect
                value={orderId}
                onChange={applyOrder}
                options={orderOptions}
                placeholder="Elige una venta pagada"
                searchPlaceholder="Buscar número o cliente…"
                emptyMessage="No hay órdenes pagadas"
                loading={isFetching}
                onQueryChange={setOrderQuery}
              />
              {selected && (
                <p className="text-xs text-muted-foreground">
                  Total {formatCLPShared(selected.total_amount ?? "0")}
                  {selected.client?.name ? ` · ${selected.client.name}` : ""}
                </p>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <p className="text-sm font-medium">Tipo</p>
              {readyTypes.length === 0 ? (
                <p className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                  {blocked[0] ?? "Configura la app, la función y el CAF antes de emitir."}
                </p>
              ) : (
                <div className={cn("grid gap-2", readyTypes.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                  {readyTypes.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setDocType(code);
                        if ((code === "39" || code === "41") && !rut.trim()) setRut(BOLETA_RUT);
                      }}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left text-sm font-semibold",
                        docType === code ? "border-primary bg-primary/10" : "border-border",
                      )}
                    >
                      {typeStatus(code).label.replace(" electrónica", "")}
                      <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                        Tipo {code}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {readyTypes.length > 0 && blocked.length > 0 ? (
                <p className="text-xs text-muted-foreground">{blocked.join(" ")}</p>
              ) : null}
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <label className="text-xs text-muted-foreground">RUT</label>
                <Input value={rut} onChange={(e) => setRut(e.target.value)} placeholder="12345678-9" />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <label className="text-xs text-muted-foreground">Nombre</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label className="text-xs text-muted-foreground">Dirección (opcional)</label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending || !orderId || !readyTypes.includes(docType as "33" | "39")}>
              {isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Emitiendo…</> : "Emitir DTE"}
            </Button>
          </div>
        </form>
      </div>
    </AnimatedOverlay>
  );
}
