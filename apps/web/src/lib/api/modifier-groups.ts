import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type ModifierGroup = YggdraSchemas["ModifierGroup"];
export type ModifierOption = YggdraSchemas["ModifierOption"];
export type ProductModifierGroup = YggdraSchemas["ProductModifierGroup"];

type PaginatedProductModifierGroup = YggdraSchemas["PaginatedProductModifierGroupList"];

export async function fetchProductModifierGroups(productId?: number): Promise<ProductModifierGroup[]> {
  const params = productId !== undefined ? `?product=${productId}` : "";
  const data = await apiFetch<PaginatedProductModifierGroup>(`/inventory/product-modifier-groups/${params}`);
  return data.results;
}
