import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

type YggdraProduct = YggdraSchemas["ProductList"];
type YggdraPaginated = YggdraSchemas["PaginatedProductListList"];

export type ProductPayload = Partial<
  Pick<
    YggdraProduct,
    | "name"
    | "code"
    | "description"
    | "product_type"
    | "measurement_unit"
    | "is_active"
    | "is_for_sale"
    | "is_for_internal_use"
    | "price"
    | "sale_price"
    | "price_internal"
    | "wholesale_price"
    | "cost_price"
    | "minimum_stock"
    | "quantity"
  >
> & { category?: number | null };

export interface ProductsFilter {
  search?: string;
  category?: number;
  product_type?: string;
  is_for_sale?: boolean;
  is_active?: boolean;
  next?: string | null;
  previous?: string | null;
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
  if (filter.product_type) qs.set("product_type", filter.product_type);
  if (filter.is_for_sale !== undefined) qs.set("is_for_sale", String(filter.is_for_sale));
  if (filter.is_active !== undefined) qs.set("is_active", String(filter.is_active));
  const q = qs.toString();
  return apiFetch<YggdraPaginated>(`/inventory/products/${q ? `?${q}` : ""}`);
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
