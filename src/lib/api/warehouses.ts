import { apiFetch, apiFile } from "./client";
import type { ApiFileResult } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type Warehouse = YggdraSchemas["Warehouse"];
export type WarehouseProduct = YggdraSchemas["WarehouseProduct"];
type WarehouseRequest = YggdraSchemas["WarehouseRequest"];
type WarehouseProductRequest = YggdraSchemas["WarehouseProductRequest"];
type PatchedWarehouseProductRequest = YggdraSchemas["PatchedWarehouseProductRequest"];
type PaginatedWarehouse = YggdraSchemas["PaginatedWarehouseList"];
type PaginatedWarehouseProduct = YggdraSchemas["PaginatedWarehouseProductList"];

export interface WarehousesFilter {
  search?: string;
  warehouse_type?: string;
  is_default?: boolean;
  page_size?: number;
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
  if (filter.is_default !== undefined) qs.set("is_default", String(filter.is_default));
  if (filter.page_size) qs.set("page_size", String(filter.page_size));
  const q = qs.toString();
  return apiFetch<PaginatedWarehouse>(`/inventory/warehouses/${q ? `?${q}` : ""}`);
}

export interface WarehouseTypeOption {
  value: string;
  label: string;
}

export async function fetchWarehouseTypes(): Promise<WarehouseTypeOption[]> {
  const data = await apiFetch<unknown>("/inventory/warehouses/types/");
  if (Array.isArray(data)) {
    return data.filter(
      (item): item is WarehouseTypeOption =>
        Boolean(item) &&
        typeof item === "object" &&
        "value" in item &&
        "label" in item &&
        typeof (item as WarehouseTypeOption).value === "string",
    );
  }
  return [];
}

export interface WarehouseMetrics {
  warehouse: Warehouse;
  total_products: number;
  total_quantity: number;
  total_value: number | string;
  total_sale_value: number | string;
  low_stock_products: number;
  out_of_stock_products: number;
  utilization_percentage: number;
}

export async function fetchWarehouseMetrics(id: number): Promise<WarehouseMetrics> {
  return apiFetch<WarehouseMetrics>(`/inventory/warehouses/${id}/metrics/`);
}

export interface BranchWarehouseSummary {
  total_warehouses: number;
  total_products: number;
  total_quantity: number;
  total_value: number | string;
  total_sale_value?: number | string;
  warehouses: WarehouseMetrics[];
}

export async function fetchWarehouseBranchSummary(
  branchId: number,
): Promise<BranchWarehouseSummary> {
  return apiFetch<BranchWarehouseSummary>(
    `/inventory/warehouses/branch_summary/?branch_id=${branchId}`,
  );
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

export interface WarehouseProductsFilter {
  search?: string;
  ordering?: string;
  page_size?: number;
  low_stock?: boolean;
  out_of_stock?: boolean;
  next?: string | null;
  previous?: string | null;
}

export async function fetchWarehouseProducts(
  warehouseId: number,
  filter: WarehouseProductsFilter = {},
): Promise<PaginatedWarehouseProduct> {
  if (filter.next) {
    return apiFetch<PaginatedWarehouseProduct>(filter.next);
  }
  if (filter.previous) {
    return apiFetch<PaginatedWarehouseProduct>(filter.previous);
  }
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.ordering) qs.set("ordering", filter.ordering);
  if (filter.page_size) qs.set("page_size", String(filter.page_size));
  if (filter.low_stock) qs.set("low_stock", "true");
  if (filter.out_of_stock) qs.set("out_of_stock", "true");
  const q = qs.toString();
  return apiFetch<PaginatedWarehouseProduct>(`/inventory/warehouses/${warehouseId}/products/${q ? `?${q}` : ""}`);
}

/**
 * Vínculos producto↔bodega para un producto.
 *
 * El listado `GET /inventory/warehouse-products/` no expone filtro `product` en
 * schema (`?product=` se ignora). Pagina y filtra en cliente por FK `product`.
 */
export async function fetchProductWarehouses(
  productId: number,
  opts?: { productName?: string },
): Promise<WarehouseProduct[]> {
  const qs = new URLSearchParams({ page_size: "100" });
  const name = opts?.productName?.trim();
  if (name) qs.set("search", name);

  const page = await fetchAllWarehouseProducts(`/inventory/warehouse-products/?${qs.toString()}`);
  const matched = page.filter((wp) => Number(wp.product) === Number(productId));
  if (matched.length > 0 || !name) return matched;

  const all = await fetchAllWarehouseProducts("/inventory/warehouse-products/?page_size=100");
  return all.filter((wp) => Number(wp.product) === Number(productId));
}

async function fetchAllWarehouseProducts(url: string): Promise<WarehouseProduct[]> {
  const data = await apiFetch<PaginatedWarehouseProduct>(url);
  const next = data.next ? await fetchAllWarehouseProducts(data.next) : [];
  return [...(data.results ?? []), ...next];
}

export interface BranchWarehouseProductsFilter {
  search?: string;
  page_size?: number;
  product__in?: number[];
  next?: string | null;
  previous?: string | null;
}

export async function fetchBranchWarehouseProducts(
  filter: BranchWarehouseProductsFilter = {},
): Promise<PaginatedWarehouseProduct> {
  if (filter.next) {
    return apiFetch<PaginatedWarehouseProduct>(filter.next);
  }
  if (filter.previous) {
    return apiFetch<PaginatedWarehouseProduct>(filter.previous);
  }
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.page_size) qs.set("page_size", String(filter.page_size));
  if (filter.product__in && filter.product__in.length > 0) {
    qs.set("product__in", filter.product__in.join(","));
  }
  const q = qs.toString();
  return apiFetch<PaginatedWarehouseProduct>(`/inventory/warehouse-products/${q ? `?${q}` : ""}`);
}

export async function addProductToWarehouse(
  payload: Partial<WarehouseProductRequest> & { warehouse_id: number; product_id: number },
): Promise<WarehouseProduct> {
  return apiFetch<WarehouseProduct>("/inventory/warehouse-products/", {
    method: "POST",
    body: payload,
  });
}

/** El action de Yggdra lee `quantity` (stock absoluto) y `notes`. */
export async function updateWarehouseProductQuantity(
  id: number,
  payload: { quantity: number; notes?: string },
): Promise<WarehouseProduct> {
  return apiFetch<WarehouseProduct>(`/inventory/warehouse-products/${id}/update_quantity/`, {
    method: "POST",
    body: payload,
  });
}

export async function updateWarehouseProduct(
  id: number,
  payload: Partial<PatchedWarehouseProductRequest>,
): Promise<WarehouseProduct> {
  return apiFetch<WarehouseProduct>(`/inventory/warehouse-products/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteWarehouseProduct(id: number): Promise<void> {
  await apiFetch(`/inventory/warehouse-products/${id}/`, { method: "DELETE" });
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

export interface TransferStockResult {
  message: string;
  transferred_products: { product_name: string; quantity: number }[];
}

export async function transferStock(payload: TransferStockPayload): Promise<TransferStockResult> {
  return apiFetch<TransferStockResult>("/inventory/warehouses/transfer/", {
    method: "POST",
    body: payload,
  });
}

export function exportWarehouses(filter: WarehousesFilter, format: "excel" | "pdf"): Promise<ApiFileResult> {
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.warehouse_type) qs.set("warehouse_type", filter.warehouse_type);
  const q = qs.toString();
  return apiFile(`/inventory/warehouses/export-${format}/${q ? `?${q}` : ""}`);
}
