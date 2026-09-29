"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Star,
  CheckCircle2,
  UserRound,
  ArrowLeft,
  CalendarClock,
  Timer,
  MapPin,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  appendTicketAttachments,
  canRateSupportTicket,
  createTicketComment,
  fetchSupportTicket,
  fetchTicketComments,
  fetchTicketFileAttachments,
  fetchWorkOrdersForTicket,
  mergeTicketAttachments,
  isSupportTicketOpen,
  slaDeadlineStatus,
  supportPriorityLabel,
  supportStatusLabel,
  updateTicketSatisfaction,
  workOrderStatusLabel,
  type SupportAttachment,
} from "@/lib/api/support";
import {
  SupportAttachmentGallery,
  SupportAttachmentPicker,
} from "@/components/support/support-attachment-picker";
import { useSessionStore } from "@/lib/store/session";
import { statusBadge } from "@/lib/status-styles";
import { useToast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

interface SupportTicketCaseProps {
  ticketId: string;
  onBack: () => void;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SupportTicketCase({ ticketId, onBack }: SupportTicketCaseProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useSessionStore((s) => s.user);
  const [reply, setReply] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<SupportAttachment[]>([]);
  const [rating, setRating] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingComment, setRatingComment] = useState("");

  // Reset del formulario de respuesta al cambiar de ticket (ajuste en render).
  const [ticketKey, setTicketKey] = useState(ticketId);
  if (ticketKey !== ticketId) {
    setTicketKey(ticketId);
    setReply("");
    setReplyAttachments([]);
    setRating(0);
    setRatingHover(0);
    setRatingComment("");
  }

  const ticketQuery = useQuery({
    queryKey: ["support-ticket", ticketId],
    queryFn: () => fetchSupportTicket(ticketId),
    enabled: !!ticketId,
  });

  const commentsQuery = useQuery({
    queryKey: ["support-ticket-comments", ticketId],
    queryFn: () => fetchTicketComments(ticketId),
    enabled: !!ticketId,
  });

  const filesQuery = useQuery({
    queryKey: ["support-ticket-files", ticketId],
    queryFn: () => fetchTicketFileAttachments(ticketId),
    enabled: !!ticketId,
  });

  const workOrdersQuery = useQuery({
    queryKey: ["support-work-orders", ticketId],
    queryFn: () => fetchWorkOrdersForTicket(ticketId),
    enabled: !!ticketId,
  });

  const comment = useMutation({
    mutationFn: async () => {
      const text = reply.trim();
      const names = replyAttachments.map((a) => a.name);
      const content =
        names.length > 0
          ? `${text}${text ? "\n\n" : ""}Adjuntos: ${names.join(", ")}`
          : text;
      if (!content) throw new Error("Escribe un mensaje o adjunta un archivo.");
      if (replyAttachments.length > 0) {
        await appendTicketAttachments(
          ticketId,
          ticketQuery.data?.custom_data,
          replyAttachments,
        );
      }
      return createTicketComment({ ticket: ticketId, content });
    },
    onSuccess: () => {
      setReply("");
      setReplyAttachments([]);
      toast.success("Información enviada");
      queryClient.invalidateQueries({ queryKey: ["support-ticket-comments", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["support-ticket-files", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo enviar."),
  });

  const rate = useMutation({
    mutationFn: () =>
      updateTicketSatisfaction(ticketId, {
        satisfaction_score: rating,
        satisfaction_comment: ratingComment.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Gracias por tu evaluación");
      queryClient.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo guardar la evaluación."),
  });

  function handleReply(e: FormEvent) {
    e.preventDefault();
    if (!reply.trim() && replyAttachments.length === 0) return;
    comment.mutate();
  }

  const ticket = ticketQuery.data;
  const attachments = mergeTicketAttachments(
    ticket?.custom_data,
    filesQuery.data ?? [],
  );
  const comments = (commentsQuery.data ?? []).filter(
    (c) => (c.visibility ?? "PUBLIC").toUpperCase() !== "INTERNAL",
  );
  const open = isSupportTicketOpen(ticket?.status);
  const showRating = ticket ? canRateSupportTicket(ticket) : false;
  const alreadyRated =
    ticket?.satisfaction_score != null && Number(ticket.satisfaction_score) > 0;
  const workOrders = workOrdersQuery.data ?? [];
  const slaRes = slaDeadlineStatus(ticket?.sla_resolution_deadline);
  const slaResp = slaDeadlineStatus(ticket?.sla_response_deadline);

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-border bg-background">
      <div className="flex shrink-0 items-start gap-3 border-b border-border px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          className="mt-0.5 inline-flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label="Volver al tablero"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          {ticketQuery.isLoading ? (
            <Skeleton className="h-5 w-48" />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {ticket?.ticket_number || "—"}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    statusBadge(ticket?.status),
                  )}
                >
                  {supportStatusLabel(ticket?.status)}
                </span>
              </div>
              <h2 className="mt-0.5 text-sm font-semibold leading-snug">{ticket?.subject}</h2>
            </>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4">
        {ticketQuery.isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : ticket ? (
          <div className="flex flex-col gap-4">
            <div className="glass grid gap-3 rounded-2xl p-4 sm:grid-cols-2">
              <MetaCell label="Prioridad">{supportPriorityLabel(ticket.priority)}</MetaCell>
              <MetaCell label="Categoría">{ticket.category_name || "—"}</MetaCell>
              <MetaCell label="Creada">
                {formatDateTime(ticket.created_date || ticket.created)}
              </MetaCell>
              <MetaCell label="Asignado">
                {ticket.assigned_to_name?.trim() ? ticket.assigned_to_name : "Sin asignar"}
              </MetaCell>
            </div>

            <section className="glass rounded-2xl p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Timer className="h-3.5 w-3.5" />
                Tiempos de atención
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <SlaLine
                  label="Primera respuesta"
                  iso={ticket.sla_response_deadline}
                  met={ticket.sla_response_met}
                  status={slaResp}
                />
                <SlaLine
                  label="Resolución"
                  iso={ticket.sla_resolution_deadline}
                  met={ticket.sla_resolution_met}
                  status={slaRes}
                />
              </div>
              {ticket.sla_policy_name && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Política: {ticket.sla_policy_name}
                </p>
              )}
            </section>

            {workOrders.length > 0 && (
              <section>
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Wrench className="h-3.5 w-3.5" />
                  Agenda de visita
                </p>
                <ul className="flex flex-col gap-2">
                  {workOrders.map((wo) => (
                    <li
                      key={wo.id}
                      className="glass rounded-2xl px-3.5 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {wo.work_order_number || "OT"}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            statusBadge(wo.status),
                          )}
                        >
                          {workOrderStatusLabel(wo.status)}
                        </span>
                      </div>
                      <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium">
                        <CalendarClock className="h-3.5 w-3.5 text-primary" />
                        {formatDateTime(wo.scheduled_date)}
                      </p>
                      {wo.technician_name && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Técnico: {wo.technician_name}
                        </p>
                      )}
                      {wo.location_address && (
                        <p className="mt-0.5 flex items-start gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                          {wo.location_address}
                        </p>
                      )}
                      {wo.estimated_duration_minutes ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Duración estimada: {wo.estimated_duration_minutes} min
                        </p>
                      ) : null}
                      {wo.notes && (
                        <p className="mt-1 text-xs text-foreground/80">{wo.notes}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {ticket.status === "PENDING_VISIT" && workOrders.length === 0 && (
              <p className="glass rounded-2xl px-3.5 py-3 text-xs leading-5 text-muted-foreground">
                Esta solicitud quedó como visita técnica. Cuando el equipo programe la visita,
                verás aquí la fecha, el técnico y el lugar.
              </p>
            )}

            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Descripción
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p>
            </div>

            <SupportAttachmentGallery attachments={attachments} />

            <div className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4" />
                Seguimiento
                <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {comments.length}
                </span>
              </h3>
              {commentsQuery.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aún no hay respuestas. El equipo escribirá aquí.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {comments.map((c) => {
                    const mine =
                      c.author != null &&
                      user?.id != null &&
                      Number(c.author) === Number(user.id);
                    return (
                      <li
                        key={c.id}
                        className={cn(
                          "rounded-2xl px-3.5 py-2.5",
                          mine ? "bg-primary/8" : "glass",
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                            <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                            {mine ? "Tú" : c.author_name || "Soporte"}
                            {c.is_resolution ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-success">
                                <CheckCircle2 className="h-3 w-3" />
                                Resolución
                              </span>
                            ) : null}
                          </span>
                          <span>{formatDateTime(c.created)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.content}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {alreadyRated && (
              <div className="bg-success/5 px-3 py-2.5">
                <p className="text-xs font-medium text-success">Ya evaluaste esta atención</p>
                <div className="mt-1 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-4 w-4",
                        i < Number(ticket.satisfaction_score)
                          ? "fill-warning text-warning"
                          : "text-muted-foreground/30",
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {showRating && (
              <div className="border border-border/70 bg-muted/15 p-3">
                <p className="text-sm font-semibold">¿Cómo fue la atención?</p>
                <div className="mt-2 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const value = i + 1;
                    const active = (ratingHover || rating) >= value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-label={`${value} estrella${value === 1 ? "" : "s"}`}
                        onMouseEnter={() => setRatingHover(value)}
                        onMouseLeave={() => setRatingHover(0)}
                        onClick={() => setRating(value)}
                      >
                        <Star
                          className={cn(
                            "h-6 w-6",
                            active ? "fill-warning text-warning" : "text-muted-foreground/35",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  rows={2}
                  placeholder="Comentario opcional…"
                  className="mt-3 w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    disabled={rating < 1}
                    isLoading={rate.isPending}
                    onClick={() => rate.mutate()}
                  >
                    Enviar evaluación
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No se pudo cargar la solicitud.</p>
        )}
      </div>

      {ticket && open && (
        <form
          onSubmit={handleReply}
          className="shrink-0 space-y-2 border-t border-border px-3 py-3 sm:px-4"
        >
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            placeholder="Aporta más información…"
            className="w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <SupportAttachmentPicker
            value={replyAttachments}
            onChange={setReplyAttachments}
            existingCount={attachments.length}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={!reply.trim() && replyAttachments.length === 0}
              isLoading={comment.isPending}
            >
              Enviar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 text-xs font-medium text-foreground">{children}</div>
    </div>
  );
}

function SlaLine({
  label,
  iso,
  met,
  status,
}: {
  label: string;
  iso?: string | null;
  met?: boolean | null;
  status: "ok" | "soon" | "late" | "none";
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-xs font-medium",
          status === "late" && "text-danger",
          status === "soon" && "text-warning",
          status === "ok" && "text-foreground",
        )}
      >
        {iso ? formatDateTime(iso) : "Sin plazo fijo"}
        {met === true ? " · cumplido" : met === false ? " · no cumplido" : ""}
      </p>
    </div>
  );
}
