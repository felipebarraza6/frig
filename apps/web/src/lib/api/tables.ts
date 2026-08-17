import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

type Table = YggdraSchemas["Table"];
type TableCreateRequest = YggdraSchemas["TableCreateRequest"];
type TableUpdateRequest = YggdraSchemas["TableUpdateRequest"];
type PaginatedTableList = YggdraSchemas["PaginatedTableList"];

export type TableStatus = "FREE" | "OCCUPIED" | "RESERVED" | "CLEANING" | "OUT_OF_SERVICE";

export interface TablesFilter {
  search?: string;
  status?: TableStatus;
  area?: string;
  capacity_min?: number;
  capacity_max?: number;
  is_active?: boolean;
  page_size?: number;
  next?: string | null;
  previous?: string | null;
}

export interface TableStatusSummary {
  status_counts: { status: TableStatus; count: number }[];
  area_counts: { area: string; count: number }[];
  overdue_tables: {
    id: number;
    number: string;
    occupation_time: number;
    estimated_duration?: number | null;
  }[];
  total_tables: number;
  available_tables: number;
}

export interface TableOccupationPayload {
  action: "occupy" | "free" | "reserve" | "clean";
  order_id?: string | null;
  estimated_duration?: number | null;
}

export async function fetchTables(filter: TablesFilter = {}): Promise<PaginatedTableList> {
  if (filter.next) {
    return apiFetch<PaginatedTableList>(filter.next);
  }
  if (filter.previous) {
    return apiFetch<PaginatedTableList>(filter.previous);
  }
  const qs = new URLSearchParams();
  if (filter.search) qs.set("number__icontains", filter.search);
  if (filter.status) qs.set("status", filter.status);
  if (filter.area) qs.set("area__icontains", filter.area);
  if (filter.capacity_min !== undefined) qs.set("capacity_min", String(filter.capacity_min));
  if (filter.capacity_max !== undefined) qs.set("capacity_max", String(filter.capacity_max));
  if (filter.is_active !== undefined) qs.set("is_active", String(filter.is_active));
  if (filter.page_size !== undefined) qs.set("page_size", String(filter.page_size));
  const q = qs.toString();
  return apiFetch<PaginatedTableList>(`/tables/tables/${q ? `?${q}` : ""}`);
}

export async function fetchTable(id: number): Promise<Table> {
  return apiFetch<Table>(`/tables/tables/${id}/`);
}

export async function createTable(payload: TableCreateRequest): Promise<Table> {
  return apiFetch<Table>("/tables/tables/", {
    method: "POST",
    body: payload,
  });
}

export async function updateTable(id: number, payload: Partial<TableUpdateRequest>): Promise<Table> {
  return apiFetch<Table>(`/tables/tables/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteTable(id: number): Promise<void> {
  await apiFetch(`/tables/tables/${id}/`, { method: "DELETE" });
}

export async function occupyTable(
  id: number,
  payload: TableOccupationPayload,
): Promise<{ message: string; table: Table }> {
  return apiFetch<{ message: string; table: Table }>(`/tables/tables/${id}/occupy/`, {
    method: "POST",
    body: payload,
  });
}

export async function freeTable(id: number): Promise<{ message: string; table: Table }> {
  return occupyTable(id, { action: "free" });
}

export async function reserveTable(id: number): Promise<{ message: string; table: Table }> {
  return occupyTable(id, { action: "reserve" });
}

export async function cleanTable(id: number): Promise<{ message: string; table: Table }> {
  return occupyTable(id, { action: "clean" });
}

export async function fetchAvailableTables(capacity?: number): Promise<Table[]> {
  const qs = new URLSearchParams();
  qs.set("is_available", "true");
  if (capacity !== undefined) qs.set("capacity", String(capacity));
  const q = qs.toString();
  return apiFetch<Table[]>(`/tables/tables/available/${q ? `?${q}` : ""}`);
}

export async function fetchTableStatusSummary(): Promise<TableStatusSummary> {
  return apiFetch<TableStatusSummary>("/tables/tables/status_summary/");
}

export async function bulkUpdateTableStatus(
  tableIds: number[],
  status: TableStatus,
): Promise<{ message: string; updated_count: number }> {
  return apiFetch<{ message: string; updated_count: number }>(
    "/tables/tables/bulk_update_status/",
    {
      method: "POST",
      body: { table_ids: tableIds, status },
    },
  );
}

export async function assignWaiter(
  tableId: number,
  assignedWaiter: number | null,
): Promise<{ message: string; table: Table }> {
  return apiFetch<{ message: string; table: Table }>(
    `/tables/tables/${tableId}/assign_waiter/`,
    {
      method: "POST",
      body: { assigned_waiter: assignedWaiter },
    },
  );
}
