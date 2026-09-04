import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type Combo = YggdraSchemas["Combo"];
export type ComboList = YggdraSchemas["ComboList"];
/** El backend no acepta `branch` en el write de combos (no está en el serializer). */
export type ComboWriteRequest = YggdraSchemas["ComboWriteRequest"];

export type PaginatedComboList = YggdraSchemas["PaginatedComboListList"];

export async function fetchCombos(): Promise<ComboList[]> {
  const data = await apiFetch<PaginatedComboList>("/inventory/combos/?is_active=true");
  return data.results;
}

export async function fetchAllCombos(): Promise<ComboList[]> {
  const data = await apiFetch<PaginatedComboList>("/inventory/combos/");
  return data.results;
}

export async function fetchCombosPage(
  search?: string,
  page?: string | null,
): Promise<PaginatedComboList> {
  if (page) return apiFetch<PaginatedComboList>(page);
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  const q = qs.toString();
  return apiFetch<PaginatedComboList>(`/inventory/combos/${q ? `?${q}` : ""}`);
}

export async function fetchCombo(id: number): Promise<Combo> {
  return apiFetch<Combo>(`/inventory/combos/${id}/`);
}

export async function createCombo(payload: ComboWriteRequest): Promise<Combo> {
  return apiFetch<Combo>("/inventory/combos/", {
    method: "POST",
    body: payload,
  });
}

export async function updateCombo(id: number, payload: Partial<ComboWriteRequest>): Promise<Combo> {
  return apiFetch<Combo>(`/inventory/combos/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteCombo(id: number): Promise<void> {
  await apiFetch(`/inventory/combos/${id}/`, { method: "DELETE" });
}
