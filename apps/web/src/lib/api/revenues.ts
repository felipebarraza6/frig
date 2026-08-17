import { apiFetch, apiFile, type ApiFileResult } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type Revenue = YggdraSchemas["Revenue"];
export type RevenueRequest = YggdraSchemas["RevenueRequest"];
export type RevenueCategory = YggdraSchemas["RevenueCategory"];
export type RevenueCategoryRequest = YggdraSchemas["RevenueCategoryRequest"];

type PaginatedRevenue = YggdraSchemas["PaginatedRevenueList"];
type PaginatedRevenueCategory = YggdraSchemas["PaginatedRevenueCategoryList"];

export interface RevenuesFilter {
  search?: string;
  category?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  next?: string | null;
  previous?: string | null;
}

export async function fetchRevenues(filter: RevenuesFilter = {}): Promise<PaginatedRevenue> {
  if (filter.next) {
    return apiFetch<PaginatedRevenue>(filter.next);
  }
  if (filter.previous) {
    return apiFetch<PaginatedRevenue>(filter.previous);
  }
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.category) qs.set("category", filter.category);
  if (filter.status) qs.set("status", filter.status);
  if (filter.startDate) qs.set("start_date", filter.startDate);
  if (filter.endDate) qs.set("end_date", filter.endDate);
  const q = qs.toString();
  return apiFetch<PaginatedRevenue>(`/finance/revenues/${q ? `?${q}` : ""}`);
}

export async function fetchRevenueCategories(): Promise<RevenueCategory[]> {
  const data = await apiFetch<PaginatedRevenueCategory>("/finance/revenue-categories/");
  return data.results ?? [];
}

export async function createRevenue(payload: RevenueRequest): Promise<Revenue> {
  return apiFetch<Revenue>("/finance/revenues/", {
    method: "POST",
    body: payload,
  });
}

export async function updateRevenue(
  id: string,
  payload: Partial<RevenueRequest>,
): Promise<Revenue> {
  return apiFetch<Revenue>(`/finance/revenues/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteRevenue(id: string): Promise<void> {
  await apiFetch(`/finance/revenues/${id}/`, { method: "DELETE" });
}

export async function cancelRevenue(id: string): Promise<Revenue> {
  return apiFetch<Revenue>(`/finance/revenues/${id}/cancel/`, { method: "POST" });
}

export async function markRevenueAsReceived(id: string): Promise<Revenue> {
  return apiFetch<Revenue>(`/finance/revenues/${id}/mark_received/`, { method: "POST" });
}

function revenuesQueryString(filter: RevenuesFilter): string {
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.category) qs.set("category", filter.category);
  if (filter.status) qs.set("status", filter.status);
  if (filter.startDate) qs.set("start_date", filter.startDate);
  if (filter.endDate) qs.set("end_date", filter.endDate);
  const q = qs.toString();
  return q ? `?${q}` : "";
}

export async function exportRevenuesExcel(filter: RevenuesFilter): Promise<ApiFileResult> {
  return apiFile(`/finance/revenues/export-excel/${revenuesQueryString(filter)}`);
}

export async function downloadRevenueVoucher(
  id: string,
  format: "thermal" | "a4" = "thermal",
): Promise<ApiFileResult> {
  return apiFile(`/finance/revenues/${id}/download-voucher/?pdf_format=${format}`);
}
