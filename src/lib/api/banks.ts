import { apiFetch } from "./client";
import { fetchAllPages } from "./pagination";
import type { YggdraSchemas } from "@/lib/api/types";

export type Bank = YggdraSchemas["Bank"];

export interface BankRequest {
  name: string;
  code: string;
  swift_code?: string;
  country?: string;
  is_active?: boolean;
}

export async function fetchBanks(): Promise<Bank[]> {
  return fetchAllPages<Bank>("/finance/banks/");
}

export async function fetchBank(id: string): Promise<Bank> {
  return apiFetch<Bank>(`/finance/banks/${id}/`);
}

export async function createBank(payload: BankRequest): Promise<Bank> {
  return apiFetch<Bank>("/finance/banks/", {
    method: "POST",
    body: payload,
  });
}

export async function updateBank(id: string, payload: Partial<BankRequest>): Promise<Bank> {
  return apiFetch<Bank>(`/finance/banks/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteBank(id: string): Promise<void> {
  await apiFetch(`/finance/banks/${id}/`, { method: "DELETE" });
}
