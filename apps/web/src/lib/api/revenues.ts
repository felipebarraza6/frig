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
  page_size?: number;
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
  if (filter.page_size) qs.set("page_size", String(filter.page_size));
  const q = qs.toString();
  return apiFetch<PaginatedRevenue>(`/finance/revenues/${q ? `?${q}` : ""}`);
}

export async function fetchRevenueCategories(): Promise<RevenueCategory[]> {
  // page_size=100: el endpoint pagina por defecto a 10 y cortaría la lista.
  const data = await apiFetch<PaginatedRevenueCategory>(
    "/finance/revenue-categories/?page_size=100",
  );
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

export interface RevenueSummary {
  total_amount?: string | number;
  received_amount?: string | number;
  pending_amount?: string | number;
  cancelled_amount?: string | number;
  refunded_amount?: string | number;
  count?: number;
  /** Backwards-compatible/raw backend fields */
  total?: string | number;
  received?: string | number;
  pending?: string | number;
  cancelled?: string | number;
  refunded?: string | number;
  [key: string]: unknown;
}

export async function fetchRevenueSummary(filter: Omit<RevenuesFilter, "next" | "previous"> = {}): Promise<RevenueSummary> {
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.category) qs.set("category", filter.category);
  if (filter.status) qs.set("status", filter.status);
  if (filter.startDate) qs.set("start_date", filter.startDate);
  if (filter.endDate) qs.set("end_date", filter.endDate);
  const q = qs.toString();
  return apiFetch<RevenueSummary>(`/finance/revenues/summary/${q ? `?${q}` : ""}`);
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

export async function createRevenueCategory(payload: RevenueCategoryRequest): Promise<RevenueCategory> {
  return apiFetch<RevenueCategory>("/finance/revenue-categories/", {
    method: "POST",
    body: payload,
  });
}

export async function updateRevenueCategory(
  id: string,
  payload: Partial<RevenueCategoryRequest>,
): Promise<RevenueCategory> {
  return apiFetch<RevenueCategory>(`/finance/revenue-categories/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteRevenueCategory(id: string): Promise<void> {
  await apiFetch(`/finance/revenue-categories/${id}/`, { method: "DELETE" });
}

export async function toggleRevenueCategoryActive(id: string): Promise<RevenueCategory> {
  return apiFetch<RevenueCategory>(`/finance/revenue-categories/${id}/toggle_active/`, { method: "POST" });
}
