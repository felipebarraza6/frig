"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, FileDown, Eye, FileText, Inbox, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { fetchQuotations, exportQuotationsExcel, type Quotation } from "@/lib/api/quotations";
import { formatCLP, cn } from "@/lib/utils";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";

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

export default function QuotationsPage() {
  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [orderType, setOrderType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [detail, setDetail] = useState<Quotation | null>(null);

  const filter = useMemo(
    () => ({
      search: search || undefined,
      status: status || undefined,
      order_type: orderType || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      ...pageUrl,
    }),
    [search, status, orderType, startDate, endDate, pageUrl],
  );

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["quotations", filter],
    queryFn: () => fetchQuotations(filter),
  });

  const quotations = (page?.results ?? []) as Quotation[];
  const totalQuotations = page?.count ?? 0;

  function updateFilter<T extends string>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  function updateDateRange(start: string, end: string) {
    setStartDate(start);
    setEndDate(end);
    setPageUrl({});
  }

  async function handleExportExcel() {
    await downloadFile(() => exportQuotationsExcel(filter), {
      filename: exportFilename("cotizaciones", "xlsx"),
      extension: "xlsx",
    });
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Cotizaciones</h1>
          <p className="text-xs text-muted-foreground">
            Historial de cotizaciones y presupuestos
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportExcel}
          isLoading={isDownloading}
          className="h-9 w-full sm:w-auto"
        >
          <FileDown className="mr-0 h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Exportar Excel</span>
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => updateFilter(setSearch, e.target.value)}
              placeholder="Buscar cotización…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-status" className="text-xs text-muted-foreground">Estado</label>
            <Select id="filter-status" value={status} onChange={(e) => updateFilter(setStatus, e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-type" className="text-xs text-muted-foreground">Tipo</label>
            <Select id="filter-type" value={orderType} onChange={(e) => updateFilter(setOrderType, e.target.value)}>
              {ORDER_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-start" className="text-xs text-muted-foreground">Desde</label>
            <Input
              id="filter-start"
              type="date"
              value={startDate}
              onChange={(e) => updateDateRange(e.target.value, endDate)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-end" className="text-xs text-muted-foreground">Hasta</label>
            <Input
              id="filter-end"
              type="date"
              value={endDate}
              onChange={(e) => updateDateRange(startDate, e.target.value)}
            />
          </div>
        </div>

        {error ? (
          <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border p-8 text-center">
            <div>
              <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">No se pudieron cargar las cotizaciones</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {error instanceof Error ? error.message : "Ocurrió un error inesperado."}
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border px-4 py-3">
              <Skeleton className="h-3 w-44" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="hidden h-4 w-20 sm:block" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
            ))}
          </div>
        ) : quotations.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border p-8 text-center">
            <div>
              <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">No hay cotizaciones</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ajusta los filtros o crea una nueva cotización.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">N° Orden</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((quotation) => (
                    <tr key={quotation.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">
                        {quotation.order_number ?? quotation.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {quotation.client?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {quotation.order_type === "SALE" ? "Venta" : quotation.order_type === "ORDER" ? "Pedido" : "Convenio"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            quotation.status === "COMPLETED"
                              ? "bg-emerald-500/10 text-emerald-700"
                              : quotation.status === "CANCELLED"
                                ? "bg-danger/10 text-danger"
                                : "bg-amber-500/10 text-amber-700",
                          )}
                        >
                          {statusLabel(quotation.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatCLP(quotation.total_amount ?? "0")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(quotation.date).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetail(quotation)}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {quotations.map((quotation) => (
                <div
                  key={quotation.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold tabular-nums">
                        {quotation.order_number ?? quotation.id.slice(0, 8)}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {quotation.client?.name ?? "Sin cliente"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        quotation.status === "COMPLETED"
                          ? "bg-emerald-500/10 text-emerald-700"
                          : quotation.status === "CANCELLED"
                            ? "bg-danger/10 text-danger"
                            : "bg-amber-500/10 text-amber-700",
                      )}
                    >
                      {statusLabel(quotation.status)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tipo</p>
                      <p className="font-medium">
                        {quotation.order_type === "SALE" ? "Venta" : quotation.order_type === "ORDER" ? "Pedido" : "Convenio"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
                      <p className="font-semibold tabular-nums">{formatCLP(quotation.total_amount ?? "0")}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fecha</p>
                      <p className="font-medium">{new Date(quotation.date).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setDetail(quotation)}>
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      Ver
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-sm">
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

      <AnimatedOverlay
        open={!!detail}
        onClose={() => setDetail(null)}
        panelClassName="flex items-end justify-center p-0 sm:items-center sm:p-4"
      >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-xl sm:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">Cotización {detail!.id.slice(0, 8)}</h2>
              <button
                onClick={() => setDetail(null)}
                aria-label="Cerrar"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-2 text-sm">
                <p><span className="text-muted-foreground">N° Orden:</span> {detail!.order_number ?? detail!.id.slice(0, 8)}</p>
                <p><span className="text-muted-foreground">Cliente:</span> {detail!.client?.name ?? "—"}</p>
                <p><span className="text-muted-foreground">Tipo:</span> {detail!.order_type}</p>
                <p><span className="text-muted-foreground">Estado:</span> {statusLabel(detail!.status)}</p>
                <p><span className="text-muted-foreground">Total:</span> {formatCLP(detail!.total_amount ?? "0")}</p>
                <p><span className="text-muted-foreground">Fecha:</span> {new Date(detail!.date).toLocaleString()}</p>
                {detail!.observation && (
                  <p><span className="text-muted-foreground">Observación:</span> {detail!.observation}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 justify-end border-t border-border p-4">
              <Button variant="outline" size="sm" onClick={() => setDetail(null)}>
                Cerrar
              </Button>
            </div>
          </div>
      </AnimatedOverlay>
    </div>
  );
}
