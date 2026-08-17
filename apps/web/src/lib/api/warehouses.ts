import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

type Warehouse = YggdraSchemas["Warehouse"];
type WarehouseProduct = YggdraSchemas["WarehouseProduct"];
type WarehouseRequest = YggdraSchemas["WarehouseRequest"];
type WarehouseProductRequest = YggdraSchemas["WarehouseProductRequest"];
type PaginatedWarehouse = YggdraSchemas["PaginatedWarehouseList"];
type PaginatedWarehouseProduct = YggdraSchemas["PaginatedWarehouseProductList"];

export interface WarehousesFilter {
  search?: string;
  warehouse_type?: string;
  next?: string | null;
  previous?: string | null;
}

export async function fetchWarehouses(filter: WarehousesFilter = {}): Promise<PaginatedWarehouse> {
  if (filter.next) {
    return apiFetch<PaginatedWarehouse>(filter.next);
  }
  if (filter.previous) {
    return apiFetch<PaginatedWarehouse>(filter.previous);
  }
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.warehouse_type) qs.set("warehouse_type", filter.warehouse_type);
  const q = qs.toString();
  return apiFetch<PaginatedWarehouse>(`/inventory/warehouses/${q ? `?${q}` : ""}`);
}

export async function fetchWarehouse(id: number): Promise<Warehouse> {
  return apiFetch<Warehouse>(`/inventory/warehouses/${id}/`);
}

export async function createWarehouse(payload: WarehouseRequest): Promise<Warehouse> {
  return apiFetch<Warehouse>("/inventory/warehouses/", {
    method: "POST",
    body: payload,
  });
}

export async function updateWarehouse(id: number, payload: Partial<WarehouseRequest>): Promise<Warehouse> {
  return apiFetch<Warehouse>(`/inventory/warehouses/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteWarehouse(id: number): Promise<void> {
  await apiFetch(`/inventory/warehouses/${id}/`, { method: "DELETE" });
}

export async function fetchWarehouseProducts(warehouseId: number): Promise<WarehouseProduct[]> {
  const data = await apiFetch<PaginatedWarehouseProduct>(`/inventory/warehouses/${warehouseId}/products/`);
  return data.results ?? [];
}

export async function fetchProductWarehouses(productId: number): Promise<WarehouseProduct[]> {
  const data = await apiFetch<PaginatedWarehouseProduct>(`/inventory/warehouse-products/?product=${productId}`);
  return data.results ?? [];
}

export async function addProductToWarehouse(
  payload: Partial<WarehouseProductRequest> & { warehouse_id: number; product_id: number },
): Promise<WarehouseProduct> {
  return apiFetch<WarehouseProduct>("/inventory/warehouse-products/", {
    method: "POST",
    body: payload,
  });
}

export async function updateWarehouseProductQuantity(
  id: number,
  payload: Partial<WarehouseProductRequest>,
): Promise<WarehouseProduct> {
  return apiFetch<WarehouseProduct>(`/inventory/warehouse-products/${id}/update_quantity/`, {
    method: "POST",
    body: payload,
  });
}

export interface TransferStockItem {
  product_id: number;
  quantity: number;
}

export interface TransferStockPayload {
  source_warehouse_id: number;
  target_warehouse_id: number;
  products: TransferStockItem[];
  notes?: string;
}

export async function transferStock(payload: TransferStockPayload): Promise<Warehouse> {
  return apiFetch<Warehouse>("/inventory/warehouses/transfer/", {
    method: "POST",
    body: payload,
  });
}
