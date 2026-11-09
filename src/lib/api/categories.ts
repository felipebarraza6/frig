import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type YggdraCategory = YggdraSchemas["CategoryProduct"];
export type YggdraCategoryInput = YggdraSchemas["CategoryProductRequest"];
type YggdraPaginated = YggdraSchemas["PaginatedCategoryProductList"];

export type CreateCategoryPayload = YggdraCategoryInput & { branch_id?: number };
export type UpdateCategoryPayload = Partial<YggdraCategoryInput> & { branch_id?: number };

export interface CategoriesFilter {
  search?: string;
  page_size?: number;
  is_active?: boolean;
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
  if (filter.page_size) qs.set("page_size", String(filter.page_size));
  if (filter.is_active !== undefined) qs.set("is_active", filter.is_active ? "true" : "false");
  const q = qs.toString();
  return apiFetch<YggdraPaginated>(`/inventory/categories/${q ? `?${q}` : ""}`);
}

function isValidCategory(item: unknown): item is YggdraCategory {
  return (
    item !== null &&
    typeof item === "object" &&
    "id" in item &&
    (item as Record<string, unknown>).id !== undefined &&
    (item as Record<string, unknown>).id !== null
  );
}

/** Lista simple de categorías para selects (sin paginación). */
/** Todas las categorías activas, no solo la primera página. */
export async function fetchActiveCategories(): Promise<YggdraCategory[]> {
  const all: YggdraCategory[] = [];
  const seen = new Set<string>();
  let next: string | null = null;
  for (let i = 0; i < 50; i++) {
    const page: YggdraPaginated = next
      ? await fetchCategories({ next })
      : await fetchCategories({ page_size: 200, is_active: true });
    all.push(...(page.results ?? []));
    next = page.next ?? null;
    if (!next || seen.has(next)) break;
    seen.add(next);
  }
  return all;
}

export async function fetchCategoryList(): Promise<YggdraCategory[]> {
  const data = await apiFetch<unknown>("/inventory/categories/simple-list/");
  if (Array.isArray(data)) return data.filter(isValidCategory);
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.results)) return record.results.filter(isValidCategory);
    if (isValidCategory(data)) return [data];
  }
  return [];
}

export async function createCategory(payload: CreateCategoryPayload): Promise<YggdraCategory> {
  return apiFetch<YggdraCategory>("/inventory/categories/", {
    method: "POST",
    body: payload,
  });
}

export async function updateCategory(
  id: number,
  payload: UpdateCategoryPayload,
): Promise<YggdraCategory> {
  return apiFetch<YggdraCategory>(`/inventory/categories/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteCategory(id: number): Promise<void> {
  await apiFetch(`/inventory/categories/${id}/`, { method: "DELETE" });
}
