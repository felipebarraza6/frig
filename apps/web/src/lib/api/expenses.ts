import { apiFetch } from "./client";
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
