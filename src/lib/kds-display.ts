import type { KitchenTicket } from "@/lib/api/kitchen";

/** Campos opcionales si el backend enriquece el serializer de KitchenTicket. */
export type KitchenTicketExtras = {
  order_number?: string | null;
  table_name?: string | null;
  table_number?: string | number | null;
  client_name?: string | null;
};

/**
 * Identidad visible de una comanda: correlativo legible.
 * Prefiere order_number si el API lo envía; si no, el id numérico del ticket.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function kitchenTicketCode(ticket: KitchenTicket & KitchenTicketExtras): string {
  const num = ticket.order_number?.trim();
  if (num && !UUID_RE.test(num.replace(/^#/, ""))) {
    return num.startsWith("#") ? num : `#${num}`;
  }
  return `#${ticket.id}`;
}

export function kitchenTicketMeta(ticket: KitchenTicket & KitchenTicketExtras): string | null {
  const parts: string[] = [];
  if (ticket.table_name) parts.push(ticket.table_name);
  else if (ticket.table_number != null && ticket.table_number !== "") {
    parts.push(`Mesa ${ticket.table_number}`);
  }
  if (ticket.client_name) parts.push(ticket.client_name);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return secs < 5 ? "<1 min" : `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) {
    const s = secs % 60;
    return s > 0 && mins < 10 ? `${mins}m ${s}s` : `${mins} min`;
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function msBetween(
  fromIso: string | null | undefined,
  toIsoOrNow: string | number | Date | null | undefined,
): number | null {
  if (!fromIso) return null;
  const from = new Date(fromIso).getTime();
  if (!Number.isFinite(from)) return null;
  const to =
    toIsoOrNow == null
      ? Date.now()
      : typeof toIsoOrNow === "number"
        ? toIsoOrNow
        : new Date(toIsoOrNow).getTime();
  if (!Number.isFinite(to)) return null;
  return Math.max(0, to - from);
}

/** @deprecated Prefer ticketTimingSummary; se mantiene para usos simples. */
export function ticketElapsedLabel(iso: string | null | undefined): string {
  return formatDurationMs(msBetween(iso, Date.now()));
}

export function ticketTimeLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type TicketTimingSummary = {
  /** Etiqueta corta principal (ej. "Prep 3m 12s"). */
  primary: string;
  /** Subtítulo (ej. "desde 14:02"). */
  secondary: string | null;
  /** Duración de preparación fija (started→completed), si ya terminó. */
  prepDurationMs: number | null;
  /** Espera hasta empezar (created→started). */
  waitMs: number | null;
  /** Prep en curso o final. */
  prepMs: number | null;
  /** Total desde creación. */
  totalMs: number | null;
};

/**
 * Tiempos de comanda usando timestamps del API:
 * - start() → started_at
 * - ready() → completed_at
 */
export function ticketTimingSummary(
  ticket: KitchenTicket,
  nowMs: number = Date.now(),
): TicketTimingSummary {
  const created = ticket.created;
  const started = ticket.started_at;
  const completed = ticket.completed_at;
  const status = ticket.status;

  const waitMs = msBetween(created, started ?? nowMs);
  const prepMs =
    started != null
      ? msBetween(started, completed ?? (status === "PREPARING" ? nowMs : completed))
      : null;
  const totalMs = msBetween(created, completed ?? nowMs);

  if (status === "PENDING") {
    return {
      primary: `Espera ${formatDurationMs(waitMs)}`,
      secondary: `llegó ${ticketTimeLabel(created)}`,
      prepDurationMs: null,
      waitMs,
      prepMs: null,
      totalMs,
    };
  }

  if (status === "PREPARING") {
    return {
      primary: `Prep ${formatDurationMs(prepMs)}`,
      secondary: started
        ? `desde ${ticketTimeLabel(started)}`
        : `llegó ${ticketTimeLabel(created)}`,
      prepDurationMs: null,
      waitMs,
      prepMs,
      totalMs,
    };
  }

  if (status === "READY") {
    return {
      primary: prepMs != null ? `Tardó ${formatDurationMs(prepMs)}` : "Listo",
      secondary: completed
        ? `listo ${ticketTimeLabel(completed)}`
        : `total ${formatDurationMs(totalMs)}`,
      prepDurationMs: prepMs,
      waitMs,
      prepMs,
      totalMs,
    };
  }

  if (status === "DELIVERED") {
    return {
      primary: prepMs != null ? `Prep ${formatDurationMs(prepMs)}` : "Entregado",
      secondary: `total ${formatDurationMs(totalMs)}`,
      prepDurationMs: prepMs,
      waitMs,
      prepMs,
      totalMs,
    };
  }

  return {
    primary: formatDurationMs(totalMs),
    secondary: ticketTimeLabel(created),
    prepDurationMs: prepMs,
    waitMs,
    prepMs,
    totalMs,
  };
}
