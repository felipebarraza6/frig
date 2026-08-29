"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import {
  fetchTaxDocuments,
  createTaxDocument,
  issueTaxDocument,
  sendToSii,
  cancelTaxDocument,
  createCreditNote,
  type TaxDocument,
} from "@/lib/api/tax-documents";
import { useToast } from "@/lib/store/toast";

const DOC_TYPE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "39", label: "Boleta Electrónica" },
  { value: "33", label: "Factura Electrónica" },
  { value: "61", label: "Nota de Crédito" },
  { value: "56", label: "Nota de Débito" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "DRAFT", label: "Borrador" },
  { value: "ISSUED", label: "Emitido" },
  { value: "SENT", label: "Enviado al SII" },
  { value: "ACCEPTED", label: "Aceptado" },
  { value: "REJECTED", label: "Rechazado" },
  { value: "CANCELLED", label: "Anulado" },
];

function formatCLP(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(num);
}

function statusBadge(status?: string | null) {
  switch (status) {
    case "DRAFT": return "bg-muted text-muted-foreground";
    case "ISSUED": return "bg-blue-500/10 text-blue-700";
    case "SENT": return "bg-amber-500/10 text-amber-700";
    case "ACCEPTED": return "bg-emerald-500/10 text-emerald-700";
    case "REJECTED": return "bg-danger/10 text-danger";
    case "CANCELLED": return "bg-rose-500/10 text-rose-700";
    default: return "bg-muted text-muted-foreground";
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
  return DOC_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t ?? "—";
}

export default function TaxDocumentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [confirmCancel, setConfirmCancel] = useState<TaxDocument | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [detail, setDetail] = useState<TaxDocument | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: documents = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["tax-documents", statusFilter, typeFilter],
    queryFn: () => fetchTaxDocuments({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(typeFilter ? { document_type: typeFilter } : {}),
    }),
  });

  const filtered = documents.filter((d) =>
    d.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    d.customer_rut?.includes(search) ||
    d.folio?.includes(search) ||
    d.document_number?.toLowerCase().includes(search.toLowerCase())
  );

  const issueMut = useMutation({
    mutationFn: issueTaxDocument,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tax-documents"] }); toast.success("Documento emitido"); },
  });

  const sendMut = useMutation({
    mutationFn: sendToSii,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tax-documents"] }); toast.success("Enviado al SII"); },
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelTaxDocument(id, reason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tax-documents"] }); setConfirmCancel(null); setCancelReason(""); toast.success("Documento anulado"); },
  });

  const creditNoteMut = useMutation({
    mutationFn: ({ id }: { id: string }) => createCreditNote(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tax-documents"] }); toast.success("Nota de crédito creada"); },
  });

  const createMut = useMutation({
    mutationFn: createTaxDocument,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tax-documents"] }); setCreateOpen(false); toast.success("Documento creado"); },
  });

  // KPIs
  const draftCount = documents.filter((d) => d.status === "DRAFT").length;
  const issuedCount = documents.filter((d) => d.status === "ISSUED" || d.status === "SENT").length;
  const acceptedCount = documents.filter((d) => d.status === "ACCEPTED").length;
  const totalAmount = documents.reduce((s, d) => s + (parseFloat(d.total_amount) || 0), 0);

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Documentos tributarios</h1>
          <p className="text-xs text-muted-foreground">Boletas, facturas, notas de crédito y débito</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />Nuevo documento
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Borradores</p>
            <p className="text-lg font-semibold tabular-nums">{draftCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Emitidos / Enviados</p>
            <p className="text-lg font-semibold tabular-nums">{issuedCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Aceptados SII</p>
            <p className="text-lg font-semibold tabular-nums text-emerald-600">{acceptedCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Monto total</p>
            <p className="text-lg font-semibold tabular-nums">{formatCLP(totalAmount)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente, RUT o folio..." className="pl-9" aria-label="Buscar" />
          </div>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full sm:w-44">
            {DOC_TYPE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full sm:w-40">
            {STATUS_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </Select>
        </div>

        {/* Content */}
        {isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
            <AlertCircle className="h-7 w-7 text-danger" />
            <p className="text-sm font-medium">No se pudieron cargar los documentos</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reintentar</Button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (<div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-muted/30" />))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">{search ? "Sin resultados" : "No hay documentos tributarios"}</p>
              <p className="text-xs text-muted-foreground">Crea un documento para comenzar.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Folio</th>
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
                      <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 text-muted-foreground text-xs">{docTypeLabel(d.document_type)}</td>
                        <td className="px-4 py-3 font-mono text-xs">{d.folio ?? d.document_number}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{d.issue_date}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-xs">{d.customer_name}</p>
                          <p className="text-[11px] text-muted-foreground">{d.customer_rut}</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs">{formatCLP(d.net_amount)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs">{formatCLP(d.tax_amount)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs font-semibold">{formatCLP(d.total_amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(d.status)}`}>
                            <StatusIcon className="h-3 w-3" />{d.status_display ?? d.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetail(d)} title="Ver detalle">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {d.status === "DRAFT" && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => issueMut.mutate(d.id)} disabled={issueMut.isPending} title="Emitir">
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {d.status === "ISSUED" && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" onClick={() => sendMut.mutate(d.id)} disabled={sendMut.isPending} title="Enviar al SII">
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {d.status === "ACCEPTED" && d.is_factura && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => creditNoteMut.mutate({ id: d.id })} disabled={creditNoteMut.isPending} title="Nota de crédito">
                                <CreditCard className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {!["CANCELLED", "REJECTED", "ACCEPTED"].includes(d.status ?? "") && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" onClick={() => setConfirmCancel(d)} title="Anular">
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="grid gap-3 md:hidden">
              {filtered.map((d) => {
                const StatusIcon = statusIcon(d.status);
                return (
                  <div key={d.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">{docTypeLabel(d.document_type)} · {d.folio ?? d.document_number}</p>
                        <p className="font-medium text-sm">{d.customer_name}</p>
                        <p className="text-[11px] text-muted-foreground">{d.customer_rut}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(d.status)}`}>
                        <StatusIcon className="h-3 w-3" />{d.status ?? "—"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{d.issue_date}</span>
                      <span className="font-semibold tabular-nums">{formatCLP(d.total_amount)}</span>
                    </div>
                    <div className="mt-2 flex justify-end gap-1 border-t border-border pt-2">
                      {d.status === "DRAFT" && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => issueMut.mutate(d.id)} disabled={issueMut.isPending}>
                          <Send className="mr-1 h-3 w-3" />Emitir
                        </Button>
                      )}
                      {d.status === "ISSUED" && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => sendMut.mutate(d.id)} disabled={sendMut.isPending}>
                          <Send className="mr-1 h-3 w-3" />Enviar SII
                        </Button>
                      )}
                      {!["CANCELLED", "REJECTED", "ACCEPTED"].includes(d.status ?? "") && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-danger" onClick={() => setConfirmCancel(d)}>
                          <XCircle className="mr-1 h-3 w-3" />Anular
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatedOverlay open={!!detail} onClose={() => setDetail(null)} panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4">
        <div className="flex h-[90dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-w-lg md:rounded-xl md:border">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold">{detail && docTypeLabel(detail.document_type)}</h2>
            <button onClick={() => setDetail(null)} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>
          {detail && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground text-xs">Folio:</span><p className="font-mono font-medium">{detail.folio ?? detail.document_number}</p></div>
                  <div><span className="text-muted-foreground text-xs">Estado:</span><p><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(detail.status)}`}>{detail.status_display ?? detail.status}</span></p></div>
                  <div><span className="text-muted-foreground text-xs">Fecha emisión:</span><p className="font-medium">{detail.issue_date}</p></div>
                  {detail.due_date && <div><span className="text-muted-foreground text-xs">Vencimiento:</span><p className="font-medium">{detail.due_date}</p></div>}
                </div>
                <hr className="border-border" />
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground text-xs">Cliente:</span><p className="font-medium">{detail.customer_name}</p></div>
                  <div><span className="text-muted-foreground text-xs">RUT:</span><p className="font-mono">{detail.customer_rut}</p></div>
                  {detail.customer_address && <div className="col-span-2"><span className="text-muted-foreground text-xs">Dirección:</span><p>{detail.customer_address}</p></div>}
                </div>
                <hr className="border-border" />
                <div className="grid grid-cols-3 gap-3">
                  <div><span className="text-muted-foreground text-xs">Neto:</span><p className="font-medium tabular-nums">{formatCLP(detail.net_amount)}</p></div>
                  <div><span className="text-muted-foreground text-xs">IVA:</span><p className="font-medium tabular-nums">{formatCLP(detail.tax_amount)}</p></div>
                  <div><span className="text-muted-foreground text-xs">Total:</span><p className="font-semibold tabular-nums">{formatCLP(detail.total_amount)}</p></div>
                </div>
                {detail.sii_track_id && (
                  <>
                    <hr className="border-border" />
                    <div><span className="text-muted-foreground text-xs">Track ID SII:</span><p className="font-mono text-xs">{detail.sii_track_id}</p></div>
                  </>
                )}
                {detail.notes && (
                  <>
                    <hr className="border-border" />
                    <div><span className="text-muted-foreground text-xs">Observaciones:</span><p>{detail.notes}</p></div>
                  </>
                )}
                <div className="flex gap-2 pt-2">
                  {detail.pdf_file && (
                    <a href={detail.pdf_file} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium hover:bg-muted">
                      <Download className="h-3.5 w-3.5" />PDF
                    </a>
                  )}
                  {detail.xml_file && (
                    <a href={detail.xml_file} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium hover:bg-muted">
                      <Download className="h-3.5 w-3.5" />XML
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </AnimatedOverlay>

      {/* Cancel Confirmation */}
      <AnimatedOverlay open={!!confirmCancel} onClose={() => { setConfirmCancel(null); setCancelReason(""); }} panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4">
        <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10">
              <AlertCircle className="h-5 w-5 text-danger" />
            </div>
            <div>
              <h2 className="text-base font-semibold">¿Anular documento?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {confirmCancel && `${docTypeLabel(confirmCancel.document_type)} ${confirmCancel.folio ?? ""} de ${confirmCancel.customer_name}`} será anulado.
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Motivo de anulación (requerido)" />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setConfirmCancel(null); setCancelReason(""); }} disabled={cancelMut.isPending}>Cancelar</Button>
            <Button variant="danger" onClick={() => confirmCancel && cancelMut.mutate({ id: confirmCancel.id, reason: cancelReason })} disabled={!cancelReason.trim()} isLoading={cancelMut.isPending}>Anular</Button>
          </div>
        </div>
      </AnimatedOverlay>

      {/* Create Modal */}
      <CreateDocModal open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={(p) => createMut.mutate(p)} isPending={createMut.isPending} />
    </div>
  );
}

function CreateDocModal({ open, onClose, onSubmit, isPending }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Parameters<typeof createTaxDocument>[0]) => void;
  isPending: boolean;
}) {
  const [docType, setDocType] = useState<"39" | "33">("39");
  const [rut, setRut] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [netAmount, setNetAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [order, setOrder] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      branch: 1,
      document_type: docType,
      customer_rut: rut,
      customer_name: name,
      customer_address: address || undefined,
      net_amount: netAmount,
      notes: notes || undefined,
      order: order || undefined,
    });
    setRut(""); setName(""); setAddress(""); setNetAmount(""); setNotes(""); setOrder("");
  };

  const handleClose = () => { onClose(); setRut(""); setName(""); setAddress(""); setNetAmount(""); setNotes(""); setOrder(""); };

  return (
    <AnimatedOverlay open={open} onClose={handleClose} panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4">
      <div className="flex h-[90dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-w-lg md:rounded-xl md:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">Nuevo documento tributario</h2>
          <button onClick={handleClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Tipo de documento</label>
                <Select value={docType} onChange={(e) => setDocType(e.target.value as typeof docType)}>
                  <option value="39">Boleta Electrónica</option>
                  <option value="33">Factura Electrónica</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">RUT cliente</label>
                  <Input value={rut} onChange={(e) => setRut(e.target.value)} placeholder="12345678-9" required />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Nombre cliente</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Pérez" required />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Dirección</label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Av. Libertad 123" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Monto neto</label>
                  <Input type="number" step="1" value={netAmount} onChange={(e) => setNetAmount(e.target.value)} required />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">Orden (opcional)</label>
                  <Input value={order} onChange={(e) => setOrder(e.target.value)} placeholder="ID de orden" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Observaciones</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas..." />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending || !rut || !name || !netAmount}>
              {isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Creando...</> : "Crear documento"}
            </Button>
          </div>
        </form>
      </div>
    </AnimatedOverlay>
  );
}
