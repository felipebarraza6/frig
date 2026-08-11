import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type YggdraPaymentMethod = YggdraSchemas["PaymentMethodList"];
export type YggdraPayment = YggdraSchemas["Payment"];
export type YggdraPaymentCreate = YggdraSchemas["PaymentCreateRequest"];

type PaginatedPaymentMethod = YggdraSchemas["PaginatedPaymentMethodListList"];

export async function fetchPaymentMethods(): Promise<YggdraPaymentMethod[]> {
  const data = await apiFetch<PaginatedPaymentMethod>("/finance/payment-methods/");
  return data.results;
}

export async function createPaymentMethod(payload: {
  name: string;
  payment_type: YggdraPaymentMethod["payment_type"];
  is_active?: boolean;
  is_pos_enabled?: boolean;
}): Promise<YggdraPaymentMethod> {
  return apiFetch<YggdraPaymentMethod>("/finance/payment-methods/", {
    method: "POST",
    body: payload,
  });
}

export async function createPayment(
  payload: YggdraPaymentCreate,
): Promise<YggdraPayment> {
  return apiFetch<YggdraPayment>("/finance/payments/", {
    method: "POST",
    body: payload,
  });
}
