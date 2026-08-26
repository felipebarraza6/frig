import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type BankReconciliation = YggdraSchemas["BankReconciliation"];
export type BankReconciliationRequest = YggdraSchemas["BankReconciliationRequest"];

type PaginatedBankReconciliation = YggdraSchemas["PaginatedBankReconciliationList"];

export interface BankReconciliationsFilter {
  bank_account?: string;
  status?: BankReconciliation["status"];
  reconciled_by?: number;
  page?: number;
  page_size?: number;
}

function buildQueryString(filter: BankReconciliationsFilter): string {
  const qs = new URLSearchParams();
  if (filter.bank_account) qs.set("bank_account", filter.bank_account);
  if (filter.status) qs.set("status", filter.status);
  if (filter.reconciled_by) qs.set("reconciled_by", String(filter.reconciled_by));
  if (filter.page) qs.set("page", String(filter.page));
  if (filter.page_size) qs.set("page_size", String(filter.page_size));
  const q = qs.toString();
  return q ? `?${q}` : "";
}

export async function fetchBankReconciliations(
  filter: BankReconciliationsFilter = {},
): Promise<PaginatedBankReconciliation> {
  return apiFetch<PaginatedBankReconciliation>(
    `/finance/bank-reconciliations/${buildQueryString(filter)}`,
  );
}

export async function fetchBankReconciliation(id: string): Promise<BankReconciliation> {
  return apiFetch<BankReconciliation>(`/finance/bank-reconciliations/${id}/`);
}

export async function createBankReconciliation(
  payload: BankReconciliationRequest,
): Promise<BankReconciliation> {
  return apiFetch<BankReconciliation>("/finance/bank-reconciliations/", {
    method: "POST",
    body: payload,
  });
}

export async function updateBankReconciliation(
  id: string,
  payload: Partial<BankReconciliationRequest>,
): Promise<BankReconciliation> {
  return apiFetch<BankReconciliation>(`/finance/bank-reconciliations/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteBankReconciliation(id: string): Promise<void> {
  await apiFetch(`/finance/bank-reconciliations/${id}/`, { method: "DELETE" });
}

export async function markBankReconciliationBalanced(id: string): Promise<BankReconciliation> {
  return apiFetch<BankReconciliation>(
    `/finance/bank-reconciliations/${id}/mark_as_balanced/`,
    { method: "POST" },
  );
}

export async function markBankReconciliationPending(id: string): Promise<BankReconciliation> {
  return apiFetch<BankReconciliation>(
    `/finance/bank-reconciliations/${id}/mark_as_pending/`,
    { method: "POST" },
  );
}

export async function validateBankReconciliation(id: string): Promise<BankReconciliation> {
  return apiFetch<BankReconciliation>(
    `/finance/bank-reconciliations/${id}/validate_reconciliation/`,
    { method: "POST" },
  );
}
