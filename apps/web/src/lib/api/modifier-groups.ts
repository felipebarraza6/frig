import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type ModifierGroup = YggdraSchemas["ModifierGroup"];
export type ModifierGroupList = YggdraSchemas["ModifierGroupList"];
export type ModifierGroupWrite = YggdraSchemas["ModifierGroupWrite"];
export type ModifierGroupWriteRequest = YggdraSchemas["ModifierGroupWriteRequest"];
export type ModifierOption = YggdraSchemas["ModifierOption"];
export type ModifierOptionWrite = YggdraSchemas["ModifierOptionWrite"];
export type ModifierOptionWriteRequest = YggdraSchemas["ModifierOptionWriteRequest"];
export type ProductModifierGroup = YggdraSchemas["ProductModifierGroup"];
export type ProductModifierGroupWrite = YggdraSchemas["ProductModifierGroupWrite"];
export type ProductModifierGroupWriteRequest = YggdraSchemas["ProductModifierGroupWriteRequest"];

type PaginatedModifierGroupList = YggdraSchemas["PaginatedModifierGroupListList"];
type PaginatedModifierOption = YggdraSchemas["PaginatedModifierOptionList"];
type PaginatedProductModifierGroup = YggdraSchemas["PaginatedProductModifierGroupList"];

export async function fetchModifierGroups(): Promise<ModifierGroupList[]> {
  const groups: ModifierGroupList[] = [];
  let url: string = "/inventory/modifier-groups/?page_size=500";
  for (;;) {
    const data = await apiFetch<PaginatedModifierGroupList>(url);
    groups.push(...data.results);
    if (!data.next) break;
    const nextUrl = new URL(data.next, window.location.origin);
    url = `${nextUrl.pathname}${nextUrl.search}`;
  }
  return groups;
}

export async function fetchModifierGroup(id: number): Promise<ModifierGroup> {
  return apiFetch<ModifierGroup>(`/inventory/modifier-groups/${id}/`);
}

export async function createModifierGroup(
  payload: ModifierGroupWriteRequest,
): Promise<ModifierGroup> {
  return apiFetch<ModifierGroup>("/inventory/modifier-groups/", {
    method: "POST",
    body: payload,
  });
}

export async function updateModifierGroup(
  id: number,
  payload: Partial<ModifierGroupWriteRequest>,
): Promise<ModifierGroup> {
  return apiFetch<ModifierGroup>(`/inventory/modifier-groups/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteModifierGroup(id: number): Promise<void> {
  return apiFetch<void>(`/inventory/modifier-groups/${id}/`, { method: "DELETE" });
}

export async function fetchModifierOptions(groupId?: number): Promise<ModifierOption[]> {
  const params = groupId !== undefined ? `?group=${groupId}` : "";
  const data = await apiFetch<PaginatedModifierOption>(`/inventory/modifier-options/${params}`);
  return data.results;
}

export async function createModifierOption(
  payload: ModifierOptionWriteRequest,
): Promise<ModifierOption> {
  return apiFetch<ModifierOption>("/inventory/modifier-options/", {
    method: "POST",
    body: payload,
  });
}

export async function updateModifierOption(
  id: number,
  payload: Partial<ModifierOptionWriteRequest>,
): Promise<ModifierOption> {
  return apiFetch<ModifierOption>(`/inventory/modifier-options/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteModifierOption(id: number): Promise<void> {
  return apiFetch<void>(`/inventory/modifier-options/${id}/`, { method: "DELETE" });
}

export async function fetchProductModifierGroups(
  productId?: number,
): Promise<ProductModifierGroup[]> {
  const params = productId !== undefined ? `?product=${productId}` : "";
  const data = await apiFetch<PaginatedProductModifierGroup>(
    `/inventory/product-modifier-groups/${params}`,
  );
  return data.results;
}

export async function assignModifierGroupToProduct(
  payload: ProductModifierGroupWriteRequest,
): Promise<ProductModifierGroup> {
  return apiFetch<ProductModifierGroup>("/inventory/product-modifier-groups/", {
    method: "POST",
    body: payload,
  });
}

export async function updateProductModifierGroup(
  id: number,
  payload: Partial<ProductModifierGroupWriteRequest>,
): Promise<ProductModifierGroup> {
  return apiFetch<ProductModifierGroup>(`/inventory/product-modifier-groups/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function removeProductModifierGroup(id: number): Promise<void> {
  return apiFetch<void>(`/inventory/product-modifier-groups/${id}/`, { method: "DELETE" });
}

export interface ModifierGroupPayload {
  name: string;
  description?: string | null;
  min_selections?: number;
  max_selections?: number;
  is_required?: boolean;
  order?: number;
  is_active?: boolean;
}

export interface ModifierOptionPayload {
  group: number;
  name: string;
  surcharge?: string;
  is_default?: boolean;
  order?: number;
  is_active?: boolean;
}
