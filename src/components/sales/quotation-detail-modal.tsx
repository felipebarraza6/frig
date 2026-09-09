"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Check,
  FileDown,
  User,
  Calendar,
  Package,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import {
  fetchQuotation,
  downloadQuotationPdf,
  convertQuotationToOrder,
  cancelQuotation,
  type Quotation,
} from "@/lib/api/quotations";
import { useToast } from "@/lib/store/toast";
import { useDownloadFile } from "@/lib/hooks/useDownloadFile";
import { formatCLP, orderTypeLabel } from "@/lib/utils";

const STATUS_BADGE_CLASSES: Record<string, string> = {
  DRAFT: "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
  PENDING: "rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning",
  IN_PROGRESS: "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary",
  COMPLETED: "rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success",
  CANCELLED: "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

function statusBadgeClass(status?: string | null) {
  return (
    (status && STATUS_BADGE_CLASSES[status]) ??
    "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
  );
}

function statusLabel(status?: string | null): string {
  return (status && STATUS_LABELS[status]) ?? (status ?? "—");
}

/** Formato de fecha corto en es-CL, anclado a mediodía para evitar desfases TZ. */
function formatDateCL(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CL");
}

function isPendingApproval(status?: string | null): boolean {
  return status === "DRAFT" || status === "PENDING";
}

function isConverted(status?: string | null): boolean {
  return status === "COMPLETED" || status === "IN_PROGRESS";
}

/** ¿La fecha de vencimiento ya pasó? (comparación a fin del día local) */
function isExpired(value?: string | null): boolean {
  if (!value) return false;
  const end = new Date(`${value.slice(0, 10)}T23:59:59`);
  return !Number.isNaN(end.getTime()) && end.getTime() < Date.now();
}

export function QuotationDetailModal({
  quotation,
  onClose,
  onEdit,
}: {
  quotation: Quotation;
  onClose: () => void;
  /** Abre el modal de edición con la cotización ya cargada (DRAFT/PENDING). */
  onEdit?: (quotation: Quotation) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);
  const [targetOrderType, setTargetOrderType] = useState<"ORDER" | "SALE">("ORDER");

  // Detalle completo con ítems inline (el listado no los trae).
  const { data: detail, isLoading } = useQuery({
    queryKey: ["quotation", quotation.id],
    queryFn: () => fetchQuotation(quotation.id),
    staleTime: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["quotations"] });
    queryClient.invalidateQueries({ queryKey: ["quotation", quotation.id] });
  };

  const approve = useMutation({
    mutationFn: () => convertQuotationToOrder(quotation.id, targetOrderType),
    onSuccess: () => {
      invalidate();
      setConfirmAction(null);
      toast.success(
        targetOrderType === "SALE"
          ? "Cotización aprobada y convertida en venta directa"
          : "Cotización aprobada y convertida en orden de venta",
      );
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo aprobar la cotización");
    },
  });

  const reject = useMutation({
    mutationFn: () => cancelQuotation(quotation.id),
    onSuccess: () => {
      invalidate();
      setConfirmAction(null);
      toast.success("Cotización rechazada");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo rechazar la cotización");
    },
  });

  function handleDownloadPdf() {
    downloadFile(() => downloadQuotationPdf(quotation.id), {
      filename: `cotizacion_${quotation.order_number ?? quotation.id.slice(0, 8)}.pdf`,
      onError: (error) => toast.error(error.message || "Error al descargar el PDF"),
    });
  }

  const items = detail?.products ?? [];
  const hasTax =
    detail !== undefined &&
    Number(detail.tax_amount ?? 0) > 0 &&
    Number(detail.total_amount ?? 0) > 0;
  // Estado fresco del fetch: tras rechazar, la UI se actualiza sin reabrir el modal.
  const currentStatus = detail?.status ?? quotation.status;
  const expiration = detail?.expiration_date ?? quotation.expiration_date ?? null;
  const expired = isPendingApproval(currentStatus) && isExpired(expiration);

  return (
    <>
      <AnimatedOverlay
        open={true}
        onClose={onClose}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
        <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-xl md:border">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold">
              Cotización {quotation.order_number ?? quotation.id.slice(0, 8)}
            </h2>
            <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={statusBadgeClass(currentStatus)}>
                {statusLabel(currentStatus)}
              </span>
              {isConverted(currentStatus) && (
                <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  Convertida
                </span>
              )}
              {expired && (
                <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                  Vencida
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="min-w-0">
                <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Cliente</span>
                <p className="mt-0.5 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{quotation.client?.name ?? "Sin cliente"}</span>
                </p>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Fecha</span>
                <p className="mt-0.5 flex items-center gap-1.5 tabular-nums">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {formatDateCL(quotation.date)}
                </p>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Vence</span>
                <p className={`mt-0.5 tabular-nums ${expired ? "font-medium text-danger" : "text-muted-foreground"}`}>
                  {expiration ? formatDateCL(expiration) : "Sin vencimiento"}
                </p>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Tipo</span>
                <p className="mt-0.5">{orderTypeLabel(quotation.order_type)}</p>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Ítems</span>
                <p className="mt-0.5 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {isLoading ? "…" : items.length}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-3">
              <div className={`grid gap-2 text-center ${hasTax ? "grid-cols-3" : "grid-cols-1"}`}>
                {hasTax && (
                  <>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Neto</span>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">
                        {formatCLP(detail?.net_amount ?? 0)}
                      </p>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                        IVA ({Number(detail?.tax_rate ?? 0)}%)
                      </span>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">
                        {formatCLP(detail?.tax_amount ?? 0)}
                      </p>
                    </div>
                  </>
                )}
                <div className={hasTax ? "" : "text-left"}>
                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Total</span>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">
                    {formatCLP(quotation.total_amount ?? detail?.total_amount ?? 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-medium">Ítems</h3>
              {isLoading ? (
                <div className="mt-2 flex flex-col gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : items.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-2">
                  {items.map((it) => (
                    <li
                      key={it.id}
                      className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-xs font-semibold">
                          {it.product_name || "Ítem"}
                        </p>
                        <p className="shrink-0 text-xs font-semibold tabular-nums">
                          {formatCLP(it.total_price ?? 0)}
                        </p>
                      </div>
                      <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                        {it.quantity ?? 0} × {formatCLP(it.unit_price ?? 0)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  Sin ítems registrados.
                </p>
              )}
            </div>

            {(detail?.observation ?? quotation.observation) && (
              <div className="mt-4">
                <h3 className="text-sm font-medium">Observación</h3>
                <p className="mt-1 whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {detail?.observation ?? quotation.observation}
                </p>
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={onClose}>
              Cerrar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Descargar PDF
            </Button>
            {isPendingApproval(currentStatus) && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => onEdit?.(detail ?? quotation)}
                  disabled={!detail}
                  title={detail ? "Editar cotización" : "Cargando detalle…"}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-danger hover:text-danger sm:w-auto"
                  onClick={() => {
                    reject.reset();
                    setConfirmAction("reject");
                  }}
                  disabled={reject.isPending}
                >
                  <X className="mr-2 h-4 w-4" />
                  Rechazar
                </Button>
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    approve.reset();
                    setConfirmAction("approve");
                  }}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Aprobar
                </Button>
              </>
            )}
          </div>
        </div>
      </AnimatedOverlay>

      {confirmAction && (
        <AnimatedOverlay
          open={true}
          onClose={() => setConfirmAction(null)}
          zIndex="z-[80]"
          panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
        >
          <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <h2 className="text-base font-semibold">
              {confirmAction === "approve" ? "¿Aprobar cotización?" : "¿Rechazar cotización?"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {confirmAction === "approve"
                ? `La cotización ${quotation.order_number ?? quotation.id.slice(0, 8)} dejará de ser cotización y pasará a ser una orden de venta del cliente.`
                : `La cotización ${quotation.order_number ?? quotation.id.slice(0, 8)} quedará rechazada/cancelada. Esta acción no se puede deshacer.`}
            </p>
            {confirmAction === "approve" && (
              <div className="mt-3 flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground">Convertir en</label>
                {([
                  { value: "ORDER", label: "Orden de venta", hint: "Queda pendiente de entrega y pago" },
                  { value: "SALE", label: "Venta directa", hint: "Venta inmediata (POS)" },
                ] as const).map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      targetOrderType === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name="quotation-target-type"
                      checked={targetOrderType === opt.value}
                      onChange={() => setTargetOrderType(opt.value)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-medium">{opt.label}</span>
                      <span className="block text-xs text-muted-foreground">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {(approve.isError || reject.isError) && (
              <p className="mt-2 text-sm text-danger">
                {(approve.error ?? reject.error) instanceof Error
                  ? ((approve.error ?? reject.error) as Error).message
                  : "Error al procesar la cotización"}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmAction(null)}
                disabled={approve.isPending || reject.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant={confirmAction === "reject" ? "danger" : "default"}
                onClick={() => {
                  if (confirmAction === "approve") {
                    approve.mutate();
                  } else {
                    reject.mutate();
                  }
                }}
                isLoading={approve.isPending || reject.isPending}
              >
                {confirmAction === "approve" ? "Aprobar y convertir" : "Rechazar"}
              </Button>
            </div>
          </div>
        </AnimatedOverlay>
      )}
    </>
  );
}
