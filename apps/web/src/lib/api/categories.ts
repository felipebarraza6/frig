import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type YggdraCategory = YggdraSchemas["CategoryProduct"];
export type YggdraCategoryInput = YggdraSchemas["CategoryProductRequest"];
type YggdraPaginated = YggdraSchemas["PaginatedCategoryProductList"];

export interface CategoriesFilter {
  search?: string;
  next?: string | null;
  previous?: string | null;
}

export async function fetchCategories(filter: CategoriesFilter = {}): Promise<YggdraPaginated> {
  if (filter.next) {
    return apiFetch<YggdraPaginated>(filter.next);
  }
  if (filter.previous) {
    return apiFetch<YggdraPaginated>(filter.previous);
  }
  const qs = new URLSearchParams();
  if (filter.search) qs.set("name__icontains", filter.search);
  const q = qs.toString();
  return apiFetch<YggdraPaginated>(`/inventory/categories/${q ? `?${q}` : ""}`);
}

/** Lista simple de categorías para selects (sin paginación). */
export async function fetchCategoryList(): Promise<YggdraCategory[]> {
  const data = await apiFetch<unknown>("/inventory/categories/simple-list/");
  if (Array.isArray(data)) return data as YggdraCategory[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.results)) return record.results as YggdraCategory[];
    return [data as YggdraCategory];
  }
  return [];
}

export async function createCategory(payload: YggdraCategoryInput): Promise<YggdraCategory> {
  return apiFetch<YggdraCategory>("/inventory/categories/", {
    method: "POST",
    body: payload,
  });
}

export async function updateCategory(
  id: number,
  payload: Partial<YggdraCategoryInput>,
): Promise<YggdraCategory> {
  return apiFetch<YggdraCategory>(`/inventory/categories/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteCategory(id: number): Promise<void> {
  await apiFetch(`/inventory/categories/${id}/`, { method: "DELETE" });
}
