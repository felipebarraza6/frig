import { apiFetch, apiFile } from "./client";
import type { ApiFileResult } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type Supplier = YggdraSchemas["Supplier"];
export type SupplierList = YggdraSchemas["SupplierList"];
export type SupplierRequest = YggdraSchemas["SupplierRequest"];
export type SupplierProduct = YggdraSchemas["SupplierProduct"];
export type SupplierProductRequest = YggdraSchemas["SupplierProductRequest"];
export type PurchaseOrder = YggdraSchemas["PurchaseOrder"];
export type PurchaseOrderList = YggdraSchemas["PurchaseOrderList"];
export type PurchaseOrderCreate = YggdraSchemas["PurchaseOrderCreate"];
export type PurchaseOrderItemRequest = YggdraSchemas["PurchaseOrderItemRequest"];
export type PurchaseOrderRequest = YggdraSchemas["PurchaseOrderRequest"];

export interface PurchaseOrderCreatePayload extends Omit<PurchaseOrderCreate, "items"> {
  items: PurchaseOrderItemRequest[];
}

/** Payload mínimo para registrar un pago en pay_order (sin reenviar la orden completa). */
export interface PayPurchaseOrderPayload {
  amount: string;
  payment_method_id: string;
  cash_register_id?: number | string | null;
  notes?: string | null;
  reference?: string | null;
}

/** Entrada individual del historial de pagos de una orden de compra. */
export interface PurchaseOrderPaymentEntry {
  id?: string | number;
  amount?: string;
  paid_amount?: string;
  payment_method?: string | number | null;
  payment_method_name?: string | null;
  date?: string | null;
  payment_date?: string | null;
  created?: string | null;
  notes?: string | null;
  reference?: string | null;
}

/** Resumen de pagos de una OC (GET pay_order/payment_summary). */
export interface PurchaseOrderPaymentSummary {
  total_amount?: string;
  paid_amount?: string;
  remaining_amount?: string;
  payment_status?: string;
  payments?: PurchaseOrderPaymentEntry[];
}

export type PaginatedSupplier = YggdraSchemas["PaginatedSupplierListList"];
export type PaginatedSupplierProduct = YggdraSchemas["PaginatedSupplierProductList"];
export type PaginatedPurchaseOrder = YggdraSchemas["PaginatedPurchaseOrderListList"];

export interface SuppliersFilter {
  search?: string;
  status?: string;
  next?: string | null;
  previous?: string | null;
}

export async function fetchSuppliers(filter: SuppliersFilter = {}): Promise<PaginatedSupplier> {
  if (filter.next) {
    return apiFetch<PaginatedSupplier>(filter.next);
  }
  if (filter.previous) {
    return apiFetch<PaginatedSupplier>(filter.previous);
  }
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.status) qs.set("status", filter.status);
  const q = qs.toString();
  return apiFetch<PaginatedSupplier>(`/suppliers/suppliers/${q ? `?${q}` : ""}`);
}

export async function fetchSupplier(id: string): Promise<Supplier> {
  return apiFetch<Supplier>(`/suppliers/suppliers/${id}/`);
}

export async function createSupplier(payload: SupplierRequest): Promise<Supplier> {
  return apiFetch<Supplier>("/suppliers/suppliers/", {
    method: "POST",
    body: payload,
  });
}

export async function updateSupplier(
  id: string,
  payload: Partial<SupplierRequest>,
): Promise<Supplier> {
  return apiFetch<Supplier>(`/suppliers/suppliers/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteSupplier(id: string): Promise<void> {
  await apiFetch(`/suppliers/suppliers/${id}/`, { method: "DELETE" });
}

export async function fetchSupplierProducts(supplierId: string): Promise<SupplierProduct[]> {
  return fetchAllSupplierProducts(`/suppliers/supplier-products/?supplier=${supplierId}`);
}

export async function fetchSupplierProductsByProduct(productId: number): Promise<SupplierProduct[]> {
  const data = await apiFetch<PaginatedSupplierProduct>(`/suppliers/supplier-products/?product=${productId}`);
  return data.results ?? [];
}

async function fetchAllSupplierProducts(url: string): Promise<SupplierProduct[]> {
  const data = await apiFetch<PaginatedSupplierProduct>(url);
  const next = data.next ? await fetchAllSupplierProducts(data.next) : [];
  return [...(data.results ?? []), ...next];
}

export async function fetchSupplierProductsByBranch(branchId: number): Promise<SupplierProduct[]> {
  return fetchAllSupplierProducts(`/suppliers/supplier-products/?branch=${branchId}`);
}

export async function createSupplierProduct(payload: SupplierProductRequest): Promise<SupplierProduct> {
  return apiFetch<SupplierProduct>("/suppliers/supplier-products/", {
    method: "POST",
    body: payload,
  });
}

export async function updateSupplierProduct(
  id: number,
  payload: Partial<SupplierProductRequest>,
): Promise<SupplierProduct> {
  return apiFetch<SupplierProduct>(`/suppliers/supplier-products/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export interface PurchaseOrdersFilter {
  search?: string;
  supplier?: string;
  status?: string;
  payment_status?: string;
  payment_status__in?: string[];
  start_date?: string;
  end_date?: string;
  page_size?: number;
  next?: string | null;
  previous?: string | null;
}

export async function fetchPurchaseOrders(
  filter: PurchaseOrdersFilter = {},
): Promise<PaginatedPurchaseOrder> {
  if (filter.next) {
    return apiFetch<PaginatedPurchaseOrder>(filter.next);
  }
  if (filter.previous) {
    return apiFetch<PaginatedPurchaseOrder>(filter.previous);
  }
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.supplier) qs.set("supplier", filter.supplier);
  if (filter.status) qs.set("status", filter.status);
  if (filter.payment_status) qs.set("payment_status", filter.payment_status);
  if (filter.payment_status__in && filter.payment_status__in.length > 0) {
    qs.set("payment_status__in", filter.payment_status__in.join(","));
  }
  if (filter.start_date) qs.set("start_date", filter.start_date);
  if (filter.end_date) qs.set("end_date", filter.end_date);
  if (filter.page_size) qs.set("page_size", String(filter.page_size));
  const q = qs.toString();
  return apiFetch<PaginatedPurchaseOrder>(`/suppliers/purchase-orders/${q ? `?${q}` : ""}`);
}

export async function createPurchaseOrder(payload: PurchaseOrderCreatePayload): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>("/suppliers/purchase-orders/", {
    method: "POST",
    body: payload as unknown as PurchaseOrderCreate,
  });
}

export async function fetchPurchaseOrder(id: string): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/suppliers/purchase-orders/${id}/`);
}

export async function cancelPurchaseOrder(id: string): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/suppliers/purchase-orders/${id}/cancel_order/`, {
    method: "POST",
  });
}

export async function markPurchaseOrderCompleted(id: string): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/suppliers/purchase-orders/${id}/mark_completed/`, {
    method: "POST",
  });
}

export async function payPurchaseOrder(
  id: string,
  payload: PayPurchaseOrderPayload,
): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/suppliers/purchase-orders/${id}/pay_order/`, {
    method: "POST",
    body: payload as unknown as PurchaseOrderRequest,
  });
}

export async function fetchPurchaseOrderPaymentSummary(
  id: string,
): Promise<PurchaseOrderPaymentSummary> {
  return apiFetch<PurchaseOrderPaymentSummary>(`/suppliers/purchase-orders/${id}/payment_summary/`);
}

export async function downloadPurchaseOrderPdf(id: string): Promise<ApiFileResult> {
  return apiFile(`/suppliers/purchase-orders/${id}/generate_pdf/`);
}

export async function downloadPurchaseOrderVoucher(id: string): Promise<ApiFileResult> {
  return apiFile(`/suppliers/purchase-orders/${id}/download-voucher/`);
}
