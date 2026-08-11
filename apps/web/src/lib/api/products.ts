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
    | "price"
    | "sale_price"
    | "cost_price"
    | "minimum_stock"
    | "quantity"
  >
> & { category?: number | null };

export async function fetchProducts(params?: {
  page?: number;
  name__icontains?: string;
  category?: number;
}): Promise<YggdraPaginated> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.name__icontains) qs.set("name__icontains", params.name__icontains);
  if (params?.category) qs.set("category", String(params.category));
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
