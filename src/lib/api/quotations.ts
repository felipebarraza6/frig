import { apiFetch, apiFile, type ApiFileResult } from "@/lib/api/client";
import type { YggdraSchemas } from "@/lib/api/types";

type YggdraOrder = YggdraSchemas["Order"];
type PaginatedOrder = YggdraSchemas["PaginatedOrderList"];

export interface QuotationsFilter {
  search?: string;
  status?: string;
  order_type?: string;
  start_date?: string;
  end_date?: string;
  next?: string | null;
  previous?: string | null;
}

export type Quotation = YggdraOrder & { order_number?: string | null };

export async function fetchQuotations(filter: QuotationsFilter = {}): Promise<PaginatedOrder> {
  if (filter.next) {
    return apiFetch<PaginatedOrder>(filter.next);
  }
  if (filter.previous) {
    return apiFetch<PaginatedOrder>(filter.previous);
  }
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.status) qs.set("status", filter.status);
  if (filter.order_type) qs.set("order_type", filter.order_type);
  if (filter.start_date) qs.set("start_date", filter.start_date);
  if (filter.end_date) qs.set("end_date", filter.end_date);
  const q = qs.toString();
  return apiFetch<PaginatedOrder>(`/sales/quotations/${q ? `?${q}` : ""}`);
}

export async function exportQuotationsExcel(filter: QuotationsFilter = {}): Promise<ApiFileResult> {
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.status) qs.set("status", filter.status);
  if (filter.order_type) qs.set("order_type", filter.order_type);
  if (filter.start_date) qs.set("start_date", filter.start_date);
  if (filter.end_date) qs.set("end_date", filter.end_date);
  const q = qs.toString();
  return apiFile(`/sales/quotations/export/${q ? `?${q}` : ""}`);
}
