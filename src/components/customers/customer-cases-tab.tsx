"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageSquareWarning, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchSupportTickets,
  isSupportTicketOpen,
  supportStatusLabel,
  type SupportTicketList,
} from "@/lib/api/support";
import { cn } from "@/lib/utils";
import { statusBadge } from "@/lib/status-styles";

function shortDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ticketTone(status?: string | null): "ACTIVE" | "PENDING" | "COMPLETED" | "CANCELLED" {
  const key = (status ?? "").toUpperCase();
  if (key === "RESOLVED" || key === "CLOSED") return "COMPLETED";
  if (key === "CANCELLED") return "CANCELLED";
  if (key === "IN_PROGRESS" || key === "PENDING_VISIT") return "ACTIVE";
  return "PENDING";
}

export function CustomerCasesTab({
  customerId,
  onCreateClaim,
}: {
  customerId: number;
  onCreateClaim: () => void;
}) {
  const ticketsQuery = useQuery({
    queryKey: ["support-tickets", "client", customerId],
    queryFn: () => fetchSupportTickets({ client: customerId, page_size: 50 }),
  });

  const tickets = ticketsQuery.data ?? [];
  const open = tickets.filter((t) => isSupportTicketOpen(t.status));
  const closed = tickets.filter((t) => !isSupportTicketOpen(t.status));

  if (ticketsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }

  if (ticketsQuery.isError) {
    return (
      <p className="text-sm text-danger">No se pudieron cargar los casos de este cliente.</p>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border px-4 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <MessageSquareWarning className="h-6 w-6" />
        </span>
        <p className="mt-3 text-sm font-medium">Sin casos</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Los reclamos e incidencias vinculados a este cliente aparecen acá.
        </p>
        <Button className="mt-4" size="sm" onClick={onCreateClaim}>
          <MessageSquareWarning className="mr-1.5 h-3.5 w-3.5" />
          Registrar reclamo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {open.length} abierto{open.length === 1 ? "" : "s"}
          {closed.length > 0 ? ` · ${closed.length} cerrado${closed.length === 1 ? "" : "s"}` : ""}
        </p>
        <Button size="sm" variant="outline" onClick={onCreateClaim}>
          <MessageSquareWarning className="mr-1.5 h-3.5 w-3.5" />
          Reclamo
        </Button>
      </div>
      <TicketGroup title="Abiertos" items={open} />
      {closed.length > 0 && <TicketGroup title="Cerrados" items={closed} />}
    </div>
  );
}

function TicketGroup({
  title,
  items,
}: {
  title: string;
  items: SupportTicketList[];
}) {
  if (items.length === 0) {
    return (
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">Ninguno.</p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="flex flex-col gap-2">
        {items.map((t) => (
          <li key={t.id}>
            <Link
              href={`/support?id=${t.id}`}
              className="glass flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-primary/5"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MessageSquareWarning className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{t.subject}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      statusBadge(ticketTone(t.status)),
                    )}
                  >
                    {supportStatusLabel(t.status)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t.ticket_number}
                  {t.category_name ? ` · ${t.category_name}` : ""}
                  {t.created_date ? ` · ${shortDate(t.created_date)}` : ""}
                </p>
              </div>
              <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
