import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type OrderSplit = YggdraSchemas["OrderSplit"];
export type OrderSplitRequest = YggdraSchemas["OrderSplitRequest"];
type PaginatedOrderSplitList = YggdraSchemas["PaginatedOrderSplitList"];

export async function fetchOrderSplits(orderId?: string): Promise<OrderSplit[]> {
  const qs = orderId ? `?order=${encodeURIComponent(orderId)}` : "";
  const data = await apiFetch<PaginatedOrderSplitList>(`/sales/order-splits/${qs}`);
  return data.results ?? [];
}

export async function createOrderSplit(payload: OrderSplitRequest): Promise<OrderSplit> {
  return apiFetch<OrderSplit>("/sales/order-splits/", {
    method: "POST",
    body: payload,
  });
}

export async function payOrderSplit(id: number, payload?: { payment_method?: string | null; payment_method_id?: string | null }): Promise<OrderSplit> {
  return apiFetch<OrderSplit>(`/sales/order-splits/${id}/pay/`, {
    method: "POST",
    body: { payment_method: payload?.payment_method ?? payload?.payment_method_id ?? null },
  });
}

export async function cancelOrderSplit(id: number): Promise<OrderSplit> {
  return apiFetch<OrderSplit>(`/sales/order-splits/${id}/cancel/`, {
    method: "POST",
  });
}
