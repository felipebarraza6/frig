import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type YggdraPaymentMethod = YggdraSchemas["PaymentMethodList"];
export type YggdraPayment = YggdraSchemas["Payment"];
export type YggdraPaymentCreate = YggdraSchemas["PaymentCreateRequest"] & {
  /** ID de la caja abierta a la que se asocia el pago (efectivo). */
  cash_register_id?: number | null;
  /** Si es true, no se exige caja abierta para pagos en efectivo (registro manual desde Ventas). */
  skip_cash_register_validation?: boolean;
};

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
  requires_reference?: boolean;
  processing_fee?: string;
}): Promise<YggdraPaymentMethod> {
  return apiFetch<YggdraPaymentMethod>("/finance/payment-methods/", {
    method: "POST",
    body: payload,
  });
}

export async function updatePaymentMethod(
  id: string,
  payload: Partial<{
    name: string;
    payment_type: YggdraPaymentMethod["payment_type"];
    is_active: boolean;
    is_pos_enabled: boolean;
    requires_reference: boolean;
    processing_fee: string;
  }>,
): Promise<YggdraPaymentMethod> {
  return apiFetch<YggdraPaymentMethod>(`/finance/payment-methods/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deletePaymentMethod(id: string): Promise<void> {
  await apiFetch(`/finance/payment-methods/${id}/`, { method: "DELETE" });
}

export async function createPayment(
  payload: YggdraPaymentCreate,
): Promise<YggdraPayment> {
  return apiFetch<YggdraPayment>("/finance/payments/", {
    method: "POST",
    body: payload,
  });
}
