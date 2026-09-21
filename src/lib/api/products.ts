import { apiFetch, apiFile } from "./client";
import type { ApiFileResult } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";
import { appendMulti } from "@/lib/api/query-params";

type YggdraProduct = YggdraSchemas["ProductList"];
type YggdraPaginated = YggdraSchemas["PaginatedProductListList"];
type ProductWrite = YggdraSchemas["Product"];

export type ProductPayload = Partial<
  Pick<
    ProductWrite,
    | "name"
    | "code"
    | "description"
    | "product_type"
    | "measurement_unit"
    | "is_active"
    | "is_for_sale"
    | "is_for_internal_use"
    | "is_public"
    | "price"
    | "sale_price"
    | "price_internal"
    | "wholesale_price"
    | "cost_price"
    | "minimum_stock"
    | "quantity"
    | "tracks_inventory"
    | "is_nutritional_ingredient"
    | "energy_kcal"
    | "proteins_g"
    | "total_fats_g"
    | "saturated_fats_g"
    | "monounsaturated_fats_g"
    | "polyunsaturated_fats_g"
    | "trans_fats_g"
    | "cholesterol_mg"
    | "carbohydrates_g"
    | "total_sugars_g"
    | "sodium_mg"
  >
> & { category?: number | null };

export interface ProductsFilter {
  search?: string;
  category?: number;
  product_type?: string | string[];
  is_for_sale?: boolean;
  is_active?: boolean;
  page_size?: number;
  next?: string | null;
  previous?: string | null;
  ids?: number[];
}

export async function fetchProducts(filter: ProductsFilter = {}): Promise<YggdraPaginated> {
  if (filter.next) {
    return apiFetch<YggdraPaginated>(filter.next);
  }
  if (filter.previous) {
    return apiFetch<YggdraPaginated>(filter.previous);
  }
  const qs = new URLSearchParams();
  if (filter.search) qs.set("name__icontains", filter.search);
  if (filter.category) qs.set("category", String(filter.category));
  appendMulti(qs, "product_type", filter.product_type);
  if (filter.is_for_sale !== undefined) qs.set("is_for_sale", String(filter.is_for_sale));
  if (filter.is_active !== undefined) qs.set("is_active", String(filter.is_active));
  if (filter.page_size) qs.set("page_size", String(filter.page_size));
  if (filter.ids?.length) qs.set("id__in", filter.ids.join(","));
  const q = qs.toString();
  return apiFetch<YggdraPaginated>(`/inventory/products/${q ? `?${q}` : ""}`);
}

/**
 * Listado de gestión: si no se pide is_active, el backend (soft-delete) solo
 * entrega activos. Para ver todos, pedimos activos + inactivos y unimos.
 */
export async function fetchProductsForManage(
  filter: ProductsFilter = {},
): Promise<YggdraPaginated> {
  if (filter.next || filter.previous) {
    return fetchProducts(filter);
  }
  if (filter.is_active !== undefined) {
    return fetchProducts(filter);
  }
  const pageSize = Math.min(filter.page_size ?? 100, 100);
  const base = { ...filter, page_size: pageSize };
  const [activePage, inactivePage] = await Promise.all([
    fetchProducts({ ...base, is_active: true }),
    fetchProducts({ ...base, is_active: false }),
  ]);
  const byId = new Map<number, YggdraProduct>();
  for (const p of [...(activePage.results ?? []), ...(inactivePage.results ?? [])]) {
    byId.set(p.id, p);
  }
  const results = Array.from(byId.values()).sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", "es", { sensitivity: "base" }),
  );
  return {
    count: (activePage.count ?? 0) + (inactivePage.count ?? 0),
    next: null,
    previous: null,
    results,
  };
}

export type ProductForSale = YggdraSchemas["ProductForSale"];

export interface ProductsForSaleFilter {
  search?: string;
  category_id?: number;
  branch_id?: number;
  in_stock_only?: boolean;
}

function normalizeProductList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.results)) return record.results as T[];
    if ("id" in record) return [data as T];
  }
  return [];
}

/** Pickers de venta: `search` matchea nombre o código. Solo con query ≥ 2 chars. */
export async function searchProductsForSale(
  filter: ProductsForSaleFilter = {},
): Promise<ProductForSale[]> {
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.category_id) qs.set("category_id", String(filter.category_id));
  if (filter.branch_id) qs.set("branch_id", String(filter.branch_id));
  if (filter.in_stock_only !== undefined) qs.set("in_stock_only", String(filter.in_stock_only));
  const q = qs.toString();
  const data = await apiFetch<unknown>(`/inventory/products/for-sale/${q ? `?${q}` : ""}`);
  return normalizeProductList<ProductForSale>(data);
}

export interface ProductsByTypeFilter {
  product_type: string;
  search?: string;
  branch?: number;
}

export async function searchProductsByType(
  filter: ProductsByTypeFilter,
): Promise<YggdraProduct[]> {
  const qs = new URLSearchParams();
  qs.set("product_type", filter.product_type);
  if (filter.search) qs.set("search", filter.search);
  if (filter.branch) qs.set("branch", String(filter.branch));
  const data = await apiFetch<unknown>(`/inventory/products/by-type/?${qs.toString()}`);
  return normalizeProductList<YggdraProduct>(data);
}

/**
 * Obtiene el detalle completo de un producto. El listado (`ProductList`) no
 * expone `is_public` ni los campos nutricionales, así que al editar hay que
 * usar el retrieve o se pierden esos datos al re-guardar.
 */
export async function fetchProduct(id: number): Promise<YggdraSchemas["Product"]> {
  return apiFetch<YggdraSchemas["Product"]>(`/inventory/products/${id}/`);
}

export async function createProduct(payload: ProductPayload): Promise<YggdraProduct> {
  return apiFetch<YggdraProduct>("/inventory/products/", {
    method: "POST",
    body: payload,
  });
}

export async function updateProduct(
  id: number,
  payload: ProductPayload,
): Promise<YggdraProduct> {
  return apiFetch<YggdraProduct>(`/inventory/products/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteProduct(id: number): Promise<void> {
  await apiFetch(`/inventory/products/${id}/`, { method: "DELETE" });
}

export async function setProductActive(id: number, isActive: boolean): Promise<YggdraProduct> {
  return updateProduct(id, { is_active: isActive });
}

export function exportProducts(filter: ProductsFilter, format: "excel" | "pdf"): Promise<ApiFileResult> {
  const qs = new URLSearchParams();
  if (filter.search) qs.set("name__icontains", filter.search);
  if (filter.category) qs.set("category", String(filter.category));
  appendMulti(qs, "product_type", filter.product_type);
  if (filter.is_for_sale !== undefined) qs.set("is_for_sale", String(filter.is_for_sale));
  if (filter.is_active !== undefined) qs.set("is_active", String(filter.is_active));
  const q = qs.toString();
  return apiFile(`/inventory/products/export-${format}/${q ? `?${q}` : ""}`);
}
