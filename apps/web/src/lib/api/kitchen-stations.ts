import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type YggdraCategory = YggdraSchemas["CategoryProduct"];

export interface KitchenStation {
  id: number;
  branch: number;
  branch_name: string;
  name: string;
  categories: YggdraCategory[];
  category_ids?: number[];
  is_active: boolean;
  created: string;
  modified: string;
}

export interface KitchenStationInput {
  name: string;
  category_ids: number[];
  is_active?: boolean;
}

export async function fetchKitchenStations(): Promise<KitchenStation[]> {
  // El backend filtra por la sucursal activa del request (X-Branch-ID / middleware).
  const data = await apiFetch<{ results: KitchenStation[] }>("/sales/kitchen-stations/");
  return data.results;
}

export async function createKitchenStation(payload: KitchenStationInput): Promise<KitchenStation> {
  return apiFetch<KitchenStation>("/sales/kitchen-stations/", {
    method: "POST",
    body: payload,
  });
}

export async function updateKitchenStation(id: number, payload: Partial<KitchenStationInput>): Promise<KitchenStation> {
  return apiFetch<KitchenStation>(`/sales/kitchen-stations/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteKitchenStation(id: number): Promise<void> {
  await apiFetch(`/sales/kitchen-stations/${id}/`, { method: "DELETE" });
}
