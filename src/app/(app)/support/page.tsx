"use client";

import { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LifeBuoy,
  Plus,
  Search,
  MessageSquareWarning,
  Inbox,
  AlertTriangle,
  CircleHelp,
  MessageSquareHeart,
  BookOpen,
  FolderKanban,
  ArrowRight,
  Timer,
  CalendarClock,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageBody, PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SupportCreateModal } from "@/components/support/support-create-modal";
import { SupportTicketCase } from "@/components/support/support-ticket-case";
import {
  HelpCardsSkeleton,
  HelpMotionItem,
  HelpMotionSection,
} from "@/components/help/help-motion";
import {
  fetchSupportTickets,
  slaDeadlineStatus,
  supportPriorityLabel,

  type SupportInquiryKind,
  type SupportTicketList,
} from "@/lib/api/support";
import { useSessionStore } from "@/lib/store/session";
import { cn } from "@/lib/utils";

type HubSection = "board" | "feedback";

const KANBAN_COLUMNS: {
  id: string;
  label: string;
  match: (status?: string | null) => boolean;
}[] = [
  { id: "OPEN", label: "Abiertas", match: (s) => (s ?? "").toUpperCase() === "OPEN" },
  {
    id: "IN_PROGRESS",
    label: "En curso",
    match: (s) => {
      const k = (s ?? "").toUpperCase();
      return k === "IN_PROGRESS" || k === "REVISION";
    },
  },
  { id: "WAITING", label: "En espera", match: (s) => (s ?? "").toUpperCase() === "WAITING" },
  {
    id: "PENDING_VISIT",
    label: "Visita",
    match: (s) => (s ?? "").toUpperCase() === "PENDING_VISIT",
  },
  {
    id: "DONE",
    label: "Cerradas",
    match: (s) => {
      const k = (s ?? "").toUpperCase();
      return k === "RESOLVED" || k === "CLOSED" || k === "CANCELLED";
    },
  },
];

const ACTION_PORTALS: {
  kind: SupportInquiryKind;
  title: string;
  blurb: string;
  cta: string;
  icon: typeof AlertTriangle;
  tone: "danger" | "primary" | "secondary" | "success";
}[] = [
  {
    kind: "incident",
    title: "Reportar incidencia",
    blurb: "Algo falló en caja, POS, mesas o inventario.",
    cta: "Abrir reporte",
    icon: AlertTriangle,
    tone: "danger",
  },
  {
    kind: "doubt",
    title: "Pedir ayuda",
    blurb: "Dudas de uso, configuración o un módulo.",
    cta: "Nueva duda",
    icon: CircleHelp,
    tone: "primary",
  },
  {
    kind: "feedback",
    title: "Enviar feedback",
    blurb: "Ideas y mejoras para el producto.",
    cta: "Dejar feedback",
    icon: MessageSquareHeart,
    tone: "secondary",
  },
  {
    kind: "manual",
    title: "Pedir manual",
    blurb: "Guías o material para capacitar al equipo.",
    cta: "Solicitar guía",
    icon: BookOpen,
    tone: "success",
  },
];

const TONE_CHIP: Record<(typeof ACTION_PORTALS)[number]["tone"], string> = {
  danger: "bg-danger/12 text-danger",
  primary: "bg-primary/12 text-primary",
  secondary: "bg-secondary text-secondary-foreground",
  success: "bg-success/12 text-success",
};

function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function priorityDot(priority?: string | null): string {
  switch ((priority ?? "").toUpperCase()) {
    case "CRITICAL":
    case "HIGH":
      return "bg-danger";
    case "MEDIUM":
      return "bg-warning";
    default:
      return "bg-muted-foreground/40";
  }
}

function isFeedbackTicket(t: SupportTicketList): boolean {
  const cat = (t.category_name ?? "").toLowerCase();
  const sub = (t.subject ?? "").toLowerCase();
  return cat.includes("feedback") || sub.includes("[feedback]");
}

function SupportInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");
  const user = useSessionStore((s) => s.user);
  const [section, setSection] = useState<HubSection>("board");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<SupportInquiryKind>("doubt");

  const ticketsQuery = useQuery({
    queryKey: ["support-tickets", user?.email ?? ""],
    queryFn: () =>
      fetchSupportTickets({
        page_size: 50,
        requester_email: user?.email || undefined,
      }),
    staleTime: 30_000,
  });

  const allTickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);
  const feedbackTickets = useMemo(
    () => allTickets.filter(isFeedbackTicket),
    [allTickets],
  );
  const pool = section === "feedback" ? feedbackTickets : allTickets;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pool;
    return pool.filter((t) =>
      `${t.ticket_number} ${t.subject} ${t.category_name} ${t.status}`.toLowerCase().includes(q),
    );
  }, [pool, search]);

  function openCreate(kind: SupportInquiryKind) {
    setCreateKind(kind);
    setCreateOpen(true);
  }

  function openTicket(id: string) {
    router.replace(`/support?id=${id}`);
  }

  function closeTicket() {
    router.replace("/support");
  }

  const activeCount = allTickets.filter((t) => {
    const s = (t.status ?? "").toUpperCase();
    return s !== "RESOLVED" && s !== "CLOSED" && s !== "CANCELLED";
  }).length;

  return (
    <PageShell className={selectedId ? "max-w-none" : undefined}>
      <PageHeader
        title="Soporte"
        subtitle="Tablero de casos, visitas técnicas y seguimiento."
        icon={<LifeBuoy className="h-5 w-5" />}
        actions={
          <Button size="sm" onClick={() => openCreate("doubt")}>
            <Plus className="mr-1.5 h-4 w-4" />
            Nueva solicitud
          </Button>
        }
      />

      <div
        className={cn(
          "flex min-h-0 flex-1",
          selectedId ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]" : "flex-col",
        )}
      >
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-col",
            selectedId && "hidden lg:flex",
          )}
        >
          <PageBody className={cn(selectedId && "lg:pr-3")}>
            <HelpMotionSection className="flex flex-col gap-4">
              {!selectedId && (
                <>
                  <HelpMotionItem>
                    <section className="glass rounded-2xl p-5">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <LifeBuoy className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-display text-[15px] font-semibold tracking-tight">
                            ¿Qué necesitas hoy?
                          </p>
                          <p className="mt-0.5 text-[13px] leading-6 text-muted-foreground">
                            {activeCount} en seguimiento · {feedbackTickets.length} feedback
                          </p>
                        </div>
                      </div>
                    </section>
                  </HelpMotionItem>

                  <HelpMotionSection className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {ACTION_PORTALS.map((portal) => {
                      const Icon = portal.icon;
                      return (
                        <HelpMotionItem key={portal.kind}>
                          <button
                            type="button"
                            onClick={() => openCreate(portal.kind)}
                            className="glass group flex h-full w-full flex-col gap-3 rounded-2xl p-4 text-left transition-all hover:shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={cn(
                                  "flex h-9 w-9 items-center justify-center rounded-xl",
                                  TONE_CHIP[portal.tone],
                                )}
                              >
                                <Icon className="h-4 w-4" strokeWidth={2} />
                              </span>
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-hover:text-primary" />
                            </div>
                            <p className="font-display text-sm font-semibold tracking-tight">
                              {portal.title}
                            </p>
                            <p className="text-[12px] leading-5 text-muted-foreground text-pretty">
                              {portal.blurb}
                            </p>
                          </button>
                        </HelpMotionItem>
                      );
                    })}
                  </HelpMotionSection>
                </>
              )}

              <HelpMotionItem className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex flex-wrap gap-1">
                  <SectionTab
                    active={section === "board"}
                    onClick={() => setSection("board")}
                    icon={<FolderKanban className="h-3.5 w-3.5" />}
                    label="Tablero"
                    count={allTickets.length}
                  />
                  <SectionTab
                    active={section === "feedback"}
                    onClick={() => setSection("feedback")}
                    icon={<MessageSquareHeart className="h-3.5 w-3.5" />}
                    label="Feedback"
                    count={feedbackTickets.length}
                  />
                </div>
                <div className="relative w-full sm:ml-auto sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar caso…"
                    className="h-8 border-0 bg-muted/30 pl-8 text-xs shadow-none"
                  />
                </div>
              </HelpMotionItem>

              {ticketsQuery.isLoading ? (
                <HelpCardsSkeleton count={4} className="sm:grid-cols-2" />
              ) : ticketsQuery.isError ? (
                <div className="px-2 py-8 text-center">
                  <MessageSquareWarning className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">No pudimos cargar el tablero</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => ticketsQuery.refetch()}>
                    Reintentar
                  </Button>
                </div>
              ) : visible.length === 0 ? (
                <div className="px-2 py-10 text-center">
                  <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-semibold">Sin casos en esta vista</p>
                  <Button
                    className="mt-3"
                    size="sm"
                    onClick={() => openCreate(section === "feedback" ? "feedback" : "incident")}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Nueva solicitud
                  </Button>
                </div>
              ) : (
                <div className="-mx-1 overflow-x-auto px-1 pb-2">
                  <div className="flex min-w-[52rem] gap-2 lg:min-w-0 lg:grid lg:grid-cols-5">
                    {KANBAN_COLUMNS.map((col) => {
                      const items = visible.filter((t) => col.match(t.status));
                      return (
                        <div
                          key={col.id}
                          className="glass flex w-56 shrink-0 flex-col rounded-2xl lg:w-auto"
                        >
                          <div className="flex items-center justify-between px-3.5 py-3">
                            <span className="text-[13px] font-semibold tracking-tight">
                              {col.label}
                            </span>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
                              {items.length}
                            </span>
                          </div>
                          <ul className="flex max-h-[min(52vh,28rem)] flex-col gap-2 overflow-y-auto px-2 pb-2.5">
                            {items.length === 0 ? (
                              <li className="px-1 py-4 text-center text-[10px] text-muted-foreground">
                                Vacío
                              </li>
                            ) : (
                              items.map((t) => (
                                <li key={t.id}>
                                  <KanbanCard
                                    ticket={t}
                                    active={selectedId === t.id}
                                    onOpen={() => openTicket(t.id)}
                                  />
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </HelpMotionSection>
          </PageBody>
        </div>

        {selectedId && (
          <div className="min-h-[calc(100dvh-8rem)] min-w-0 lg:min-h-0">
            <SupportTicketCase ticketId={selectedId} onBack={closeTicket} />
          </div>
        )}
      </div>

      <SupportCreateModal
        open={createOpen}
        initialKind={createKind}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setSection("board");
          openTicket(id);
        }}
      />
    </PageShell>
  );
}

function SectionTab({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "glass-chip inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium",
        active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {label}
      <span className="tabular-nums opacity-80">{count}</span>
    </button>
  );
}

function KanbanCard({
  ticket,
  active,
  onOpen,
}: {
  ticket: SupportTicketList;
  active: boolean;
  onOpen: () => void;
}) {
  const sla = slaDeadlineStatus(
    ticket.sla_resolution_deadline ?? ticket.sla_response_deadline,
  );
  const visit = (ticket.status ?? "").toUpperCase() === "PENDING_VISIT";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "w-full rounded-xl bg-background/70 p-3 text-left transition-all",
        "hover:bg-primary/[0.05] hover:shadow-sm",
        active && "bg-primary/10 ring-1 ring-primary/35",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-mono text-[9px] text-muted-foreground">
          {ticket.ticket_number || "—"}
        </span>
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", priorityDot(ticket.priority))} />
      </div>
      <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-snug">{ticket.subject}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px] text-muted-foreground">
        {ticket.category_name && <span>{ticket.category_name}</span>}
        <span>{supportPriorityLabel(ticket.priority)}</span>
        {visit && (
          <span className="inline-flex items-center gap-0.5 text-primary">
            <CalendarClock className="h-2.5 w-2.5" />
            Visita
          </span>
        )}
        {sla === "late" && (
          <span className="inline-flex items-center gap-0.5 text-danger">
            <Timer className="h-2.5 w-2.5" />
            Fuera de plazo
          </span>
        )}
        {sla === "soon" && (
          <span className="inline-flex items-center gap-0.5 text-warning">
            <Timer className="h-2.5 w-2.5" />
            Por vencer
          </span>
        )}
        <span className="ml-auto">
          {relativeTime(ticket.created_date || ticket.created)}
        </span>
      </div>
    </button>
  );
}

export default function SupportPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <PageHeader title="Soporte" icon={<LifeBuoy className="h-5 w-5" />} />
          <PageBody>
            <HelpCardsSkeleton count={4} />
          </PageBody>
        </PageShell>
      }
    >
      <SupportInner />
    </Suspense>
  );
}
