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

export async function convertQuotationToOrder(id: string): Promise<YggdraOrder> {
  return apiFetch<YggdraOrder>(`/sales/quotations/${id}/convert_to_order/`, {
    method: "POST",
  });
}

export interface CreateQuotationItemInput {
  product: number;
  quantity: number;
  unit_price: string;
  notes?: string | null;
}

export interface CreateQuotationInput {
  items: CreateQuotationItemInput[];
  observation?: string | null;
  client_id?: number | null;
}

export async function createQuotation(input: CreateQuotationInput): Promise<YggdraOrder> {
  return apiFetch<YggdraOrder>("/sales/quotations/", {
    method: "POST",
    body: {
      order_type: "ORDER",
      date: new Date().toISOString(),
      observation: input.observation ?? null,
      client_id: input.client_id ?? null,
      items: input.items,
    },
  });
}
