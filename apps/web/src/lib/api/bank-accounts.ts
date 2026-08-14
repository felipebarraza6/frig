import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type BankAccountSummary = YggdraSchemas["BankAccountSummary"];
export type BankAccount = YggdraSchemas["BankAccount"];
export type BankAccountRequest = YggdraSchemas["BankAccountRequest"];
export type Bank = YggdraSchemas["Bank"];

type PaginatedBankAccountSummary = YggdraSchemas["PaginatedBankAccountSummaryList"];
type PaginatedBank = YggdraSchemas["PaginatedBankList"];

export async function fetchBankAccounts(): Promise<BankAccountSummary[]> {
  const data = await apiFetch<PaginatedBankAccountSummary>("/finance/bank-accounts/");
  return data.results ?? [];
}

export async function fetchBankAccount(id: string): Promise<BankAccount> {
  return apiFetch<BankAccount>(`/finance/bank-accounts/${id}/`);
}

export async function fetchBanks(): Promise<Bank[]> {
  const data = await apiFetch<PaginatedBank>("/finance/banks/");
  return data.results ?? [];
}

export async function createBankAccount(payload: BankAccountRequest): Promise<BankAccountSummary> {
  return apiFetch<BankAccountSummary>("/finance/bank-accounts/", {
    method: "POST",
    body: payload,
  });
}

export async function updateBankAccount(
  id: string,
  payload: Partial<BankAccountRequest>,
): Promise<BankAccountSummary> {
  return apiFetch<BankAccountSummary>(`/finance/bank-accounts/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteBankAccount(id: string): Promise<void> {
  await apiFetch(`/finance/bank-accounts/${id}/`, { method: "DELETE" });
}

export async function setBankAccountAsDefault(id: string): Promise<BankAccountSummary> {
  return apiFetch<BankAccountSummary>(`/finance/bank-accounts/${id}/set_as_default/`, { method: "POST" });
}
