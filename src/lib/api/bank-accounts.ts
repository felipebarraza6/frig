import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type BankAccountSummary = YggdraSchemas["BankAccountSummary"];
export type BankAccount = YggdraSchemas["BankAccount"];
export type BankAccountRequest = YggdraSchemas["BankAccountRequest"];
export type Bank = YggdraSchemas["Bank"];

export interface BankAccountTransaction {
  id: string;
  amount: string;
  payment_date: string;
  payment_direction: "INCOME" | "EXPENSE";
  payment_source?: string;
  status?: string;
  description?: string | null;
  reference?: string | null;
  payment_method_name?: string;
  payment_method?: {
    id?: string;
    name?: string;
    payment_type?: string;
    payment_type_display?: string;
  } | null;
  order?: {
    id?: string;
    order_number?: string;
    order_type?: "SALE" | "ORDER" | string;
  } | null;
  [key: string]: unknown;
}

export interface BankAccountBalanceSummary {
  current_balance?: string;
  total_income?: string;
  total_expenses?: string;
  transaction_count?: number;
  [key: string]: unknown;
}

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

export interface BankAccountTransactionsFilter {
  /** Fecha inicial (YYYY-MM-DD). Filtra por `payment_date__gte`. */
  startDate?: string;
  /** Fecha final (YYYY-MM-DD). Filtra por `payment_date__lte`. */
  endDate?: string;
  /** Limita a un único sentido (INCOME/EXPENSE). */
  direction?: "INCOME" | "EXPENSE";
}

export async function fetchBankAccountTransactions(
  id: string,
  filter: BankAccountTransactionsFilter = {},
): Promise<BankAccountTransaction[]> {
  const qs = new URLSearchParams();
  if (filter.startDate) qs.set("start_date", filter.startDate);
  if (filter.endDate) qs.set("end_date", filter.endDate);
  if (filter.direction) qs.set("direction", filter.direction);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const data = await apiFetch<unknown>(`/finance/bank-accounts/${id}/transactions/${suffix}`);
  if (Array.isArray(data)) return data as BankAccountTransaction[];
  if (data && typeof data === "object") {
    const payload = data as { results?: unknown; transactions?: unknown };
    return ((payload.transactions ?? payload.results) as BankAccountTransaction[]) ?? [];
  }
  return [];
}

export async function fetchBankAccountBalanceSummary(
  id: string,
  filter: BankAccountTransactionsFilter = {},
): Promise<BankAccountBalanceSummary> {
  const qs = new URLSearchParams();
  if (filter.startDate) qs.set("start_date", filter.startDate);
  if (filter.endDate) qs.set("end_date", filter.endDate);
  if (filter.direction) qs.set("direction", filter.direction);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<BankAccountBalanceSummary>(
    `/finance/bank-accounts/${id}/balance_summary/${suffix}`,
  );
}
