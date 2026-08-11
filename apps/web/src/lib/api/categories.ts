import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type YggdraCategory = YggdraSchemas["CategoryProduct"];
export type YggdraCategoryInput = YggdraSchemas["CategoryProductRequest"];
type YggdraPaginated = YggdraSchemas["PaginatedCategoryProductList"];

export async function fetchCategories(): Promise<YggdraCategory[]> {
  const data = await apiFetch<YggdraPaginated>("/inventory/categories/");
  return data.results;
}

export async function createCategory(payload: YggdraCategoryInput): Promise<YggdraCategory> {
  return apiFetch<YggdraCategory>("/inventory/categories/", {
    method: "POST",
    body: payload,
  });
}
