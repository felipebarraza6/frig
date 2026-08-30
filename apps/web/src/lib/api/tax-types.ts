import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type TaxType = YggdraSchemas["TaxType"];

export interface CreateTaxTypeInput {
  branch: number;
  name: string;
  code?: string;
  description?: string;
  tax_calc: "PERCENTAGE" | "FIXED";
  rate: number;
  applies_to?: string;
  is_included_in_price?: boolean;
  is_active?: boolean;
  is_default?: boolean;
  priority?: number;
}

export interface UpdateTaxTypeInput extends Partial<CreateTaxTypeInput> {}

export async function fetchTaxTypes(params?: { branch?: number; is_active?: boolean }): Promise<TaxType[]> {
  const qs = new URLSearchParams();
  if (params?.branch) qs.set("branch", String(params.branch));
  if (params?.is_active !== undefined) qs.set("is_active", String(params.is_active));
  const query = qs.toString();
  const data = await apiFetch<{ results: TaxType[] }>(`/finance/tax-types/${query ? `?${query}` : ""}`);
  return data.results ?? [];
}

export async function createTaxType(payload: CreateTaxTypeInput): Promise<TaxType> {
  return apiFetch<TaxType>("/finance/tax-types/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTaxType(id: string, payload: UpdateTaxTypeInput): Promise<TaxType> {
  return apiFetch<TaxType>(`/finance/tax-types/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteTaxType(id: string): Promise<void> {
  await apiFetch(`/finance/tax-types/${id}/`, { method: "DELETE" });
}
