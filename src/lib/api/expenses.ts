import { apiFetch, apiFile, type ApiFileResult } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type FixedExpense = YggdraSchemas["FixedExpense"];
export type FixedExpenseRequest = YggdraSchemas["FixedExpenseRequest"] & {
  /** Orden de compra libre a vincular (write-only en el backend). */
  purchase_order?: string | null;
};
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
  page_size?: number;
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
  if (filter.page_size) qs.set("page_size", String(filter.page_size));
  const q = qs.toString();
  return apiFetch<PaginatedFixedExpense>(`/finance/fixed-expenses/${q ? `?${q}` : ""}`);
}

export async function fetchExpenseCategories(): Promise<ExpenseCategory[]> {
  // show_inactive=true: el gestor permite reactivar las inactivas
  // (p. ej. la categoría que usan las órdenes de compra).
  // page_size=100: el endpoint pagina por defecto a 10 y cortaría la lista.
  const data = await apiFetch<PaginatedExpenseCategory>(
    "/finance/expense-categories/?show_inactive=true&page_size=100",
  );
  return data.results ?? [];
}

export async function fetchExpenseCategoriesByName(
  search: string,
): Promise<ExpenseCategory[]> {
  const data = await apiFetch<PaginatedExpenseCategory>(
    `/finance/expense-categories/?search=${encodeURIComponent(search)}&page_size=100`,
  );
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

export interface PayExpensePayload {
  payment_method_id: string;
  amount: string;
  cash_register_id?: number | string | null;
  notes?: string | null;
  reference?: string | null;
}

export async function payExpense(id: string, payload: PayExpensePayload): Promise<FixedExpense> {
  return apiFetch<FixedExpense>(`/finance/fixed-expenses/${id}/pay/`, {
    method: "POST",
    body: payload,
  });
}

export async function createExpenseCategory(payload: ExpenseCategoryRequest): Promise<ExpenseCategory> {
  return apiFetch<ExpenseCategory>("/finance/expense-categories/", {
    method: "POST",
    body: payload,
  });
}

export async function updateExpenseCategory(
  id: string,
  payload: Partial<ExpenseCategoryRequest>,
): Promise<ExpenseCategory> {
  return apiFetch<ExpenseCategory>(`/finance/expense-categories/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  await apiFetch(`/finance/expense-categories/${id}/`, { method: "DELETE" });
}

export async function toggleExpenseCategoryActive(id: string): Promise<ExpenseCategory> {
  return apiFetch<ExpenseCategory>(`/finance/expense-categories/${id}/toggle_active/`, { method: "POST" });
}

export interface ExpenseSummary {
  total_amount?: string | number;
  active_amount?: string | number;
  pending_amount?: string | number;
  cancelled_amount?: string | number;
  count?: number;
  /** Backwards-compatible/raw backend fields */
  total?: string | number;
  active?: string | number;
  pending?: string | number;
  cancelled?: string | number;
  [key: string]: unknown;
}

export async function fetchExpenseSummary(filter: Omit<ExpensesFilter, "next" | "previous"> = {}): Promise<ExpenseSummary> {
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.category) qs.set("category", filter.category);
  if (filter.status) qs.set("status", filter.status);
  if (filter.startDate) qs.set("start_date", filter.startDate);
  if (filter.endDate) qs.set("end_date", filter.endDate);
  const q = qs.toString();
  return apiFetch<ExpenseSummary>(`/finance/fixed-expenses/summary/${q ? `?${q}` : ""}`);
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
