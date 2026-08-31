import { apiFetch, apiFile } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type YggdraPaymentMethod = YggdraSchemas["PaymentMethodList"];
export type YggdraPayment = YggdraSchemas["Payment"];
export type YggdraPaymentList = YggdraSchemas["PaymentList"];
export type YggdraPaymentCreate = YggdraSchemas["PaymentCreateRequest"] & {
  /** ID de la caja abierta a la que se asocia el pago (efectivo). */
  cash_register_id?: number | null;
  /** Si es true, no se exige caja abierta para pagos en efectivo (registro manual desde Ventas). */
  skip_cash_register_validation?: boolean;
};

export interface PaymentsFilter {
  payment_direction?: "INCOME" | "EXPENSE";
  payment_source?: YggdraPayment["payment_source"];
  payment_date__gte?: string;
  payment_date__lte?: string;
  page?: number;
  page_size?: number;
  next?: string | null;
  previous?: string | null;
}

export interface PaymentStats {
  total_income?: string | number;
  total_expense?: string | number;
  count?: number;
  [key: string]: unknown;
}

export interface PaymentDirectionSummary {
  INCOME?: string | number;
  EXPENSE?: string | number;
  [key: string]: unknown;
}

type PaginatedPaymentMethod = YggdraSchemas["PaginatedPaymentMethodListList"];
type PaginatedPayment = YggdraSchemas["PaginatedPaymentListList"];

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

function paymentsQueryString(filter: PaymentsFilter): string {
  const qs = new URLSearchParams();
  if (filter.payment_direction) qs.set("payment_direction", filter.payment_direction);
  if (filter.payment_source) qs.set("payment_source", filter.payment_source);
  if (filter.payment_date__gte) qs.set("payment_date__gte", filter.payment_date__gte);
  if (filter.payment_date__lte) qs.set("payment_date__lte", filter.payment_date__lte);
  if (filter.page) qs.set("page", String(filter.page));
  if (filter.page_size) qs.set("page_size", String(filter.page_size));
  const q = qs.toString();
  return q ? `?${q}` : "";
}

export async function fetchPayments(filter: PaymentsFilter = {}): Promise<PaginatedPayment> {
  if (filter.next) {
    return apiFetch<PaginatedPayment>(filter.next);
  }
  if (filter.previous) {
    return apiFetch<PaginatedPayment>(filter.previous);
  }
  return apiFetch<PaginatedPayment>(`/finance/payments/${paymentsQueryString(filter)}`);
}

export function getPaymentMethodName(p?: YggdraPaymentList | YggdraPayment): string {
  if (!p) return "—";
  if ("payment_method_name" in p && p.payment_method_name) return p.payment_method_name;
  if ("payment_method" in p && p.payment_method && typeof p.payment_method === "object" && "name" in p.payment_method) {
    return (p.payment_method as { name?: string }).name ?? "—";
  }
  return "—";
}

export async function fetchPaymentStats(): Promise<PaymentStats> {
  const data = await apiFetch<PaymentStats>("/finance/payments/stats/");
  return data;
}

export async function fetchPaymentsByDirection(): Promise<PaymentDirectionSummary> {
  return apiFetch<PaymentDirectionSummary>("/finance/payments/by_direction/");
}

export async function downloadPaymentVoucher(
  id: string,
  format: "thermal" | "a4" = "thermal",
): Promise<Blob> {
  const res = await apiFile(`/finance/payments/${id}/download-voucher/?pdf_format=${format}`);
  return res.blob;
}
