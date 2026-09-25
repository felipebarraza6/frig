import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type KitchenTicketItem = YggdraSchemas["KitchenTicketItem"] & {
  station?: number | null;
  station_name?: string | null;
};
/** Extras opcionales si el backend enriquece el serializer (order_number, mesa, cliente). */
export type KitchenTicket = Omit<YggdraSchemas["KitchenTicket"], "items"> & {
  items: KitchenTicketItem[];
  order_number?: string | null;
  table_name?: string | null;
  table_number?: string | number | null;
  client_name?: string | null;
};
type PaginatedKitchenTicket = YggdraSchemas["PaginatedKitchenTicketList"] & {
  results: KitchenTicket[];
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Código visible: correlativo / número de orden, nunca el UUID. */
export function kitchenTicketCode(ticket: {
  id: number;
  order?: string;
  order_number?: string | null;
}) {
  const n = ticket.order_number?.trim();
  if (n && !UUID_RE.test(n.replace(/^#/, ""))) {
    return n.startsWith("#") ? n : `#${n}`;
  }
  return `#${ticket.id}`;
}

export async function fetchKitchenTickets(
  status?: KitchenTicket["status"],
  stationId?: number | null,
  branch?: string | number | null,
): Promise<KitchenTicket[]> {
  const search = new URLSearchParams();
  if (status) search.set("status", status);
  if (stationId) search.set("station_id", String(stationId));
  if (branch !== undefined && branch !== null && branch !== "") search.set("branch", String(branch));
  const params = search.toString() ? `?${search.toString()}` : "";
  const data = await apiFetch<PaginatedKitchenTicket>(`/sales/kitchen-tickets/${params}`);
  return data.results;
}

export async function startKitchenTicket(id: number): Promise<KitchenTicket> {
  return apiFetch<KitchenTicket>(`/sales/kitchen-tickets/${id}/start/`, { method: "POST" });
}

export async function readyKitchenTicket(id: number): Promise<KitchenTicket> {
  return apiFetch<KitchenTicket>(`/sales/kitchen-tickets/${id}/ready/`, { method: "POST" });
}

export async function deliverKitchenTicket(id: number): Promise<KitchenTicket> {
  return apiFetch<KitchenTicket>(`/sales/kitchen-tickets/${id}/deliver/`, { method: "POST" });
}

export async function cancelKitchenTicket(id: number): Promise<KitchenTicket> {
  return apiFetch<KitchenTicket>(`/sales/kitchen-tickets/${id}/cancel/`, { method: "POST" });
}
