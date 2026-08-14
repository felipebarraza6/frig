import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

type InventoryHistory = YggdraSchemas["InventoryHistory"];
type InventoryHistoryRequest = YggdraSchemas["InventoryHistoryRequest"];
type ProductInventorySummary = YggdraSchemas["ProductInventorySummary"];
type PaginatedInventoryHistory = YggdraSchemas["PaginatedInventoryHistoryList"];

export interface MovementsFilter {
  search?: string;
  movement_type?: string;
  product?: number;
  warehouse?: number;
  next?: string | null;
  previous?: string | null;
}

export async function fetchInventoryMovements(filter: MovementsFilter = {}): Promise<PaginatedInventoryHistory> {
  if (filter.next) {
    return apiFetch<PaginatedInventoryHistory>(filter.next);
  }
  if (filter.previous) {
    return apiFetch<PaginatedInventoryHistory>(filter.previous);
  }
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.movement_type) qs.set("movement_type", filter.movement_type);
  if (filter.product) qs.set("product", String(filter.product));
  if (filter.warehouse) qs.set("warehouse", String(filter.warehouse));
  const q = qs.toString();
  return apiFetch<PaginatedInventoryHistory>(`/inventory/inventory-history/${q ? `?${q}` : ""}`);
}

export async function createInventoryMovement(payload: InventoryHistoryRequest): Promise<InventoryHistory> {
  return apiFetch<InventoryHistory>("/inventory/inventory-history/create_movement/", {
    method: "POST",
    body: payload,
  });
}

export async function fetchLowStock(): Promise<ProductInventorySummary[]> {
  const data = await apiFetch<{ results?: ProductInventorySummary[] }>("/inventory/product-inventory/low_stock/");
  return data.results ?? [];
}

export async function fetchOutOfStock(): Promise<ProductInventorySummary[]> {
  const data = await apiFetch<{ results?: ProductInventorySummary[] }>("/inventory/product-inventory/out_of_stock/");
  return data.results ?? [];
}
