import { apiFetch, apiFile, type ApiFileResult } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type PromotionDiscount = YggdraSchemas["PromotionDiscount"];
export type PromotionDiscountList = YggdraSchemas["PromotionDiscountList"];
export type PromotionDiscountApplication = YggdraSchemas["PromotionDiscountApplication"];
export type PromotionDiscountValidation = YggdraSchemas["PromotionDiscountValidation"];
export type PromotionDiscountUsage = YggdraSchemas["PromotionDiscountUsage"];

export type DiscountDashboard = {
  summary: {
    total_discounts: number;
    active_discounts: number;
    expired_discounts: number;
    scheduled_discounts: number;
    total_usage: number;
    total_discount_amount: number;
    average_usage_per_discount: number;
    average_discount_amount: number;
  };
  active_promotions: Array<{
    id: string;
    name: string;
    code: string;
    discount_type: string;
    discount_type_display: string;
    discount_value: number;
    apply_to: string;
    apply_to_display: string;
    minimum_amount: number;
    maximum_discount: number | null;
    start_date: string;
    end_date: string;
    current_uses: number;
    max_uses: number | null;
    usage_percentage: number | null;
    is_stackable: boolean;
    is_first_time_only: boolean;
    days_remaining: number;
  }>;
  promotions_by_type: Array<{
    type: string;
    count: number;
    active_count: number;
    total_usage: number;
    total_discount_amount: number;
  }>;
  performance_metrics: {
    average_usage_rate: number;
    average_effectiveness: number;
    conversion_rate: number;
    roi_metrics: Record<string, unknown>;
  };
  recent_usage: Array<{
    discount_name: string;
    discount_code: string;
    order_id: string;
    user_name: string;
    original_amount: number;
    discount_amount: number;
    final_amount: number;
    usage_date: string;
  }>;
  expiring_soon: Array<{
    id: string;
    name: string;
    code: string;
    end_date: string;
    days_remaining: number;
    current_uses: number;
    max_uses: number | null;
    usage_percentage: number | null;
  }>;
  top_performing: Array<{
    id: string;
    name: string;
    code: string;
    discount_type: string;
    total_usage: number;
    total_discount_amount: number;
    average_discount_per_use: number;
  }>;
};

export type DiscountAnalytics = {
  summary: {
    total_discounts: number;
    total_usage: number;
    total_discount_amount: number;
  };
  performance_trends: Array<{
    month: string | null;
    usage_count: number;
    total_discount: number;
  }>;
  discount_type_analysis: Array<{
    type: string;
    count: number;
    active_count: number;
    total_usage: number;
    total_discount_amount: number;
  }>;
  branch_comparison: Array<{
    branch: string;
    discount_count: number;
    total_usage: number;
    total_discount_amount: number;
  }>;
};

export type DiscountFormPayload = {
  branch?: number;
  name: string;
  code: string;
  description?: string | null;
  discount_type: YggdraSchemas["PromotionDiscount"]["discount_type"];
  apply_to: YggdraSchemas["PromotionDiscount"]["apply_to"];
  status?: YggdraSchemas["PromotionDiscount"]["status"];
  discount_value: string;
  minimum_amount?: string | null;
  maximum_discount?: string | null;
  buy_quantity?: number | null;
  get_quantity?: number | null;
  bulk_threshold?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  max_uses?: number | null;
  products?: number[];
  categories?: number[];
  is_stackable?: boolean;
  is_first_time_only?: boolean;
};

type PaginatedPromotionDiscountList = YggdraSchemas["PaginatedPromotionDiscountListList"];

export async function fetchDiscounts(status?: string): Promise<PromotionDiscountList[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await apiFetch<PaginatedPromotionDiscountList>(`/promotions/discounts/${qs}`);
  return data.results;
}

export async function fetchAllDiscounts(): Promise<PromotionDiscountList[]> {
  const data = await apiFetch<PaginatedPromotionDiscountList>("/promotions/discounts/");
  return data.results;
}

export async function fetchDiscount(id: string): Promise<PromotionDiscount> {
  return apiFetch<PromotionDiscount>(`/promotions/discounts/${id}/`);
}

export async function fetchAvailableDiscounts(
  orderTotal?: number,
  branchId?: number | string | null,
): Promise<PromotionDiscountList[]> {
  const qs = new URLSearchParams();
  if (orderTotal !== undefined) qs.set("order_total", orderTotal.toFixed(2));
  if (branchId) qs.set("branch_id", String(branchId));
  const params = qs.toString() ? `?${qs.toString()}` : "";
  const data = await apiFetch<{ results: PromotionDiscountList[] }>(`/promotions/discounts/available/${params}`);
  return data.results;
}

export interface ValidatedDiscount {
  valid: boolean;
  message?: string;
  discount?: {
    name: string;
    code: string;
    discount_type: string;
    apply_to: string;
    discount_value: string;
    minimum_amount: string;
    maximum_discount?: string | null;
    products?: number[];
    categories?: number[];
    description?: string | null;
  };
}

export async function validateDiscountCode(
  code: string,
  branchId?: number | string | null,
  orderTotal?: number,
): Promise<ValidatedDiscount> {
  return apiFetch<ValidatedDiscount>("/promotions/discounts/validate_code/", {
    method: "POST",
    body: {
      code,
      branch_id: branchId ? Number(branchId) : undefined,
      order_total: orderTotal !== undefined ? Number(orderTotal.toFixed(2)) : undefined,
    },
  });
}

export async function applyDiscountToOrder(
  orderId: string,
  code: string,
  branchId?: number | string | null,
): Promise<PromotionDiscountApplication> {
  return apiFetch<PromotionDiscountApplication>("/promotions/discounts/apply_discount/", {
    method: "POST",
    body: {
      order_id: orderId,
      discount_code: code,
      branch_id: branchId ? Number(branchId) : undefined,
    },
  });
}

export async function createDiscount(payload: DiscountFormPayload): Promise<PromotionDiscount> {
  return apiFetch<PromotionDiscount>("/promotions/discounts/", {
    method: "POST",
    body: payload,
  });
}

export async function updateDiscount(
  id: string,
  payload: Partial<DiscountFormPayload>,
): Promise<PromotionDiscount> {
  return apiFetch<PromotionDiscount>(`/promotions/discounts/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteDiscount(id: string): Promise<void> {
  await apiFetch(`/promotions/discounts/${id}/`, { method: "DELETE" });
}

export async function fetchDiscountDashboard(
  branchId?: number | string | null,
): Promise<DiscountDashboard> {
  const qs = new URLSearchParams();
  if (branchId) qs.set("branch_id", String(branchId));
  const params = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<DiscountDashboard>(`/promotions/discounts/dashboard/${params}`);
}

export async function fetchDiscountAnalytics(
  startDate?: string,
  endDate?: string,
  branchId?: number | string | null,
): Promise<DiscountAnalytics> {
  const qs = new URLSearchParams();
  if (startDate) qs.set("start_date", startDate);
  if (endDate) qs.set("end_date", endDate);
  if (branchId) qs.set("branch_id", String(branchId));
  const params = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<DiscountAnalytics>(`/promotions/discounts/analytics/${params}`);
}

export async function exportDiscountsExcel(
  filters: { status?: string; discount_type?: string } = {},
): Promise<ApiFileResult> {
  const qs = new URLSearchParams();
  if (filters.status) qs.set("status", filters.status);
  if (filters.discount_type) qs.set("discount_type", filters.discount_type);
  const params = qs.toString() ? `?${qs.toString()}` : "";
  return apiFile(`/promotions/discounts/export/${params}`);
}

export interface DiscountUsageReportFilters {
  discount_id?: string;
  start_date?: string;
  end_date?: string;
  next?: string | null;
  previous?: string | null;
}

export type PaginatedPromotionDiscountUsageList =
  YggdraSchemas["PaginatedPromotionDiscountUsageList"];

export async function fetchDiscountUsageReport(
  filters: DiscountUsageReportFilters = {},
): Promise<PaginatedPromotionDiscountUsageList> {
  if (filters.next) {
    return apiFetch<PaginatedPromotionDiscountUsageList>(filters.next);
  }
  if (filters.previous) {
    return apiFetch<PaginatedPromotionDiscountUsageList>(filters.previous);
  }
  const qs = new URLSearchParams();
  if (filters.discount_id) qs.set("discount_id", filters.discount_id);
  if (filters.start_date) qs.set("start_date", filters.start_date);
  if (filters.end_date) qs.set("end_date", filters.end_date);
  const params = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<PaginatedPromotionDiscountUsageList>(
    `/promotions/discounts/usage-report/${params}`,
  );
}

export type DiscountDetailReport = {
  discount_info: Record<string, unknown>;
  usage_statistics: Record<string, unknown>;
  affected_products: Array<Record<string, unknown>>;
  usage_history: Array<Record<string, unknown>>;
  performance_analysis: Record<string, unknown>;
  effectiveness_metrics: Record<string, unknown>;
};

export async function fetchDiscountDetailReport(
  id: string,
): Promise<DiscountDetailReport> {
  return apiFetch<DiscountDetailReport>(`/promotions/discounts/${id}/detail-report/`);
}
