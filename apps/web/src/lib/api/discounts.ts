import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type PromotionDiscount = YggdraSchemas["PromotionDiscount"];
export type PromotionDiscountList = YggdraSchemas["PromotionDiscountList"];
export type PromotionDiscountApplication = YggdraSchemas["PromotionDiscountApplication"];
export type PromotionDiscountValidation = YggdraSchemas["PromotionDiscountValidation"];

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
