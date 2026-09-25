import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type Combo = YggdraSchemas["Combo"];
export type ComboList = YggdraSchemas["ComboList"];
/** El backend no acepta `branch` en el write de combos (no está en el serializer). */
export type ComboWriteRequest = YggdraSchemas["ComboWriteRequest"];

export type PaginatedComboList = YggdraSchemas["PaginatedComboListList"];

export function comboItemsCount(
  combo: Pick<ComboList, "items_count"> & { items?: readonly unknown[] | null },
): number {
  if (combo.items_count != null) return Number(combo.items_count) || 0;
  if (Array.isArray(combo.items)) return combo.items.length;
  return 0;
}

/** ¿El combo está vigente hoy? (fechas opcionales; vacío = sin límite). */
export function isComboCurrentlyValid(
  combo: Pick<ComboList, "is_active" | "start_date" | "end_date" | "items_count"> & {
    items?: readonly unknown[] | null;
  },
  today = new Date(),
): boolean {
  if (combo.is_active === false) return false;
  if (comboItemsCount(combo) <= 0) return false;

  const day = new Date(today);
  day.setHours(0, 0, 0, 0);

  if (combo.start_date) {
    const start = new Date(combo.start_date);
    start.setHours(0, 0, 0, 0);
    if (day < start) return false;
  }
  if (combo.end_date) {
    const end = new Date(combo.end_date);
    end.setHours(0, 0, 0, 0);
    if (day > end) return false;
  }
  return true;
}

/** Ahorro mostrado: nunca negativo (si el combo es más caro, 0). */
export function comboSavingsDisplay(
  regularPrice: number | string | null | undefined,
  comboPrice: number | string | null | undefined,
): number {
  const regular = Number(regularPrice) || 0;
  const combo = Number(comboPrice) || 0;
  return Math.max(0, Math.round(regular - combo));
}

/** Combos activos y vigentes para POS/venta (filtro backend + safety client). */
export async function fetchCombos(): Promise<ComboList[]> {
  const data = await apiFetch<PaginatedComboList>(
    "/inventory/combos/?currently_valid=true&page_size=200",
  );
  return (data.results ?? []).filter((c) => isComboCurrentlyValid(c));
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
