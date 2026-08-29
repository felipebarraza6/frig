import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type FixedExpense = YggdraSchemas["FixedExpense"];
type PaginatedFixedExpenseList = YggdraSchemas["PaginatedFixedExpenseList"];

export interface FixedExpenseRequest {
  name: string;
  description?: string;
  branch?: number;
  category: string;
  amount: string;
  frequency?: string;
  start_date: string;
  end_date?: string | null;
  due_date?: number;
  status?: string;
}

export async function fetchFixedExpenses(params?: { status?: string; category?: string }): Promise<FixedExpense[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.category) qs.set("category", params.category);
  const query = qs.toString();
  const data = await apiFetch<PaginatedFixedExpenseList>(`/finance/fixed-expenses/${query ? `?${query}` : ""}`);
  return data.results ?? [];
}

export async function fetchFixedExpense(id: string): Promise<FixedExpense> {
  return apiFetch<FixedExpense>(`/finance/fixed-expenses/${id}/`);
}

export async function createFixedExpense(payload: FixedExpenseRequest): Promise<FixedExpense> {
  return apiFetch<FixedExpense>("/finance/fixed-expenses/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateFixedExpense(id: string, payload: Partial<FixedExpenseRequest>): Promise<FixedExpense> {
  return apiFetch<FixedExpense>(`/finance/fixed-expenses/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteFixedExpense(id: string): Promise<void> {
  await apiFetch(`/finance/fixed-expenses/${id}/`, { method: "DELETE" });
}
