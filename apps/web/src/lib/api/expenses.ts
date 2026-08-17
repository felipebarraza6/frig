import { apiFetch, apiFile, type ApiFileResult } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type FixedExpense = YggdraSchemas["FixedExpense"];
export type FixedExpenseRequest = YggdraSchemas["FixedExpenseRequest"];
export type ExpenseCategory = YggdraSchemas["ExpenseCategory"];
export type ExpenseCategoryRequest = YggdraSchemas["ExpenseCategoryRequest"];

type PaginatedFixedExpense = YggdraSchemas["PaginatedFixedExpenseList"];
type PaginatedExpenseCategory = YggdraSchemas["PaginatedExpenseCategoryList"];

export interface ExpensesFilter {
  search?: string;
  category?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  next?: string | null;
  previous?: string | null;
}

export async function fetchExpenses(filter: ExpensesFilter = {}): Promise<PaginatedFixedExpense> {
  if (filter.next) {
    return apiFetch<PaginatedFixedExpense>(filter.next);
  }
  if (filter.previous) {
    return apiFetch<PaginatedFixedExpense>(filter.previous);
  }
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.category) qs.set("category", filter.category);
  if (filter.status) qs.set("status", filter.status);
  if (filter.startDate) qs.set("start_date", filter.startDate);
  if (filter.endDate) qs.set("end_date", filter.endDate);
  const q = qs.toString();
  return apiFetch<PaginatedFixedExpense>(`/finance/fixed-expenses/${q ? `?${q}` : ""}`);
}

export async function fetchExpenseCategories(): Promise<ExpenseCategory[]> {
  const data = await apiFetch<PaginatedExpenseCategory>("/finance/expense-categories/");
  return data.results ?? [];
}

export async function createExpense(payload: FixedExpenseRequest): Promise<FixedExpense> {
  return apiFetch<FixedExpense>("/finance/fixed-expenses/", {
    method: "POST",
    body: payload,
  });
}

export async function updateExpense(
  id: string,
  payload: Partial<FixedExpenseRequest>,
): Promise<FixedExpense> {
  return apiFetch<FixedExpense>(`/finance/fixed-expenses/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteExpense(id: string): Promise<void> {
  await apiFetch(`/finance/fixed-expenses/${id}/`, { method: "DELETE" });
}

export async function cancelExpense(id: string): Promise<FixedExpense> {
  return apiFetch<FixedExpense>(`/finance/fixed-expenses/${id}/cancel/`, { method: "POST" });
}

export async function createExpenseCategory(payload: ExpenseCategoryRequest): Promise<ExpenseCategory> {
  return apiFetch<ExpenseCategory>("/finance/expense-categories/", {
    method: "POST",
    body: payload,
  });
}

function expensesQueryString(filter: ExpensesFilter): string {
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.category) qs.set("category", filter.category);
  if (filter.status) qs.set("status", filter.status);
  if (filter.startDate) qs.set("start_date", filter.startDate);
  if (filter.endDate) qs.set("end_date", filter.endDate);
  const q = qs.toString();
  return q ? `?${q}` : "";
}

export async function exportExpensesExcel(filter: ExpensesFilter): Promise<ApiFileResult> {
  return apiFile(`/finance/fixed-expenses/export-excel/${expensesQueryString(filter)}`);
}

export async function downloadExpenseVoucher(id: string): Promise<ApiFileResult> {
  return apiFile(`/finance/fixed-expenses/${id}/download-voucher/`);
}
