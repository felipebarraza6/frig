import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type KitchenTicketItem = YggdraSchemas["KitchenTicketItem"] & {
  station?: number | null;
  station_name?: string | null;
};
export type KitchenTicket = Omit<YggdraSchemas["KitchenTicket"], "items"> & {
  items: KitchenTicketItem[];
};
type PaginatedKitchenTicket = YggdraSchemas["PaginatedKitchenTicketList"] & {
  results: KitchenTicket[];
};

export async function fetchKitchenTickets(
  status?: KitchenTicket["status"],
  stationId?: number | null
): Promise<KitchenTicket[]> {
  const search = new URLSearchParams();
  if (status) search.set("status", status);
  if (stationId) search.set("station_id", String(stationId));
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
