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
export type PurchaseOrderItem = YggdraSchemas["PurchaseOrderItem"];
export type PatchedPurchaseOrderRequest = YggdraSchemas["PatchedPurchaseOrderRequest"];
export type PatchedPurchaseOrderItemRequest = YggdraSchemas["PatchedPurchaseOrderItemRequest"];

export interface PurchaseOrderCreatePayload extends Omit<PurchaseOrderCreate, "items"> {
  items: PurchaseOrderItemRequest[];
}

/**
 * Body de POST /suppliers/purchase-order-items/: el tipo generado
 * (PurchaseOrderItemRequest) omite el campo purchase_order que el
 * serializer exige para asociar el ítem a su orden.
 */
export interface PurchaseOrderItemCreatePayload extends PurchaseOrderItemRequest {
  purchase_order: string;
}

/** Payload mínimo para registrar un pago en pay_order (sin reenviar la orden completa). */
export interface PayPurchaseOrderPayload {
  amount: string;
  payment_method_id: string;
  cash_register_id?: number | string | null;
  notes?: string | null;
  reference?: string | null;
}

/**
 * Respuesta real de POST /suppliers/purchase-orders/{id}/pay_order/.
 * NO es un PurchaseOrder: el viewset devuelve el resultado del servicio
 * de pagos con la orden anidada en "purchase_order".
 */
export interface PayPurchaseOrderResult {
  success: boolean;
  expense_payment: {
    id: string;
    amount: number;
    payment_date: string;
    payment_method: string;
    reference: string | null;
  };
  purchase_order: {
    id: string;
    order_number: string;
    status: PurchaseOrderList["status"];
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    is_fully_paid: boolean;
  };
  message: string;
  movement_id?: string;
}

/** Entrada individual del historial de pagos de una orden de compra. */
export interface PurchaseOrderPaymentEntry {
  id: string;
  amount: number;
  payment_date: string | null;
  /** Nombre del método de pago (viene resuelto desde el backend). */
  payment_method: string | null;
  reference: string | null;
  status: string;
  paid_by: string | null;
}

/** Resumen de pagos de una OC (GET /suppliers/purchase-orders/{id}/payment_summary/). */
export interface PurchaseOrderPaymentSummary {
  purchase_order: {
    id: string;
    order_number: string;
    total_amount: number;
    subtotal: number;
    tax_amount: number;
    discount_amount: number;
    status: string;
    status_display: string;
  };
  items: unknown[];
  payments: PurchaseOrderPaymentEntry[];
  summary: {
    total_paid: number;
    remaining: number;
    is_fully_paid: boolean;
    payment_count: number;
    items_count: number;
  };
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

/** ID de la sucursal activa (persistida en localStorage por el store de auth). */
function getStoredBranchId(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem("frig.branch_id");
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isNaN(n) || n <= 0 ? undefined : n;
}

export async function fetchSuppliers(filter: SuppliersFilter = {}): Promise<PaginatedSupplier> {
  if (filter.next) {
    return apiFetch<PaginatedSupplier>(filter.next);
  }
  if (filter.previous) {
    return apiFetch<PaginatedSupplier>(filter.previous);
  }
  const qs = new URLSearchParams();
  // El backend pagina de 10 en 10 por defecto (PAGE_SIZE=10, MAX_PAGE_SIZE=200):
  // se pide el máximo para no cortar la lista en páginas mínimas.
  qs.set("page_size", "200");
  if (filter.search) qs.set("search", filter.search);
  if (filter.status) qs.set("status", filter.status);
  const q = qs.toString();
  return apiFetch<PaginatedSupplier>(`/suppliers/suppliers/${q ? `?${q}` : ""}`);
}

export async function fetchSupplier(id: string): Promise<Supplier> {
  return apiFetch<Supplier>(`/suppliers/suppliers/${id}/`);
}

/** Contadores del módulo (total, activos, con contacto). */
export interface SupplierStats {
  total_suppliers: number;
  active_suppliers: number;
  total_contacts: number;
}

export async function fetchSupplierStats(): Promise<SupplierStats> {
  return apiFetch<SupplierStats>("/suppliers/suppliers/stats/");
}

export async function createSupplier(payload: SupplierRequest): Promise<Supplier> {
  // El backend valida `branch`/`branches` desde request.data en perform_create
  // (no basta el header X-Branch-ID): sin sucursal en el body rechaza con 400.
  const body = { ...payload, branch: getStoredBranchId() } as SupplierRequest;
  return apiFetch<Supplier>("/suppliers/suppliers/", {
    method: "POST",
    body,
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
  has_expense?: boolean;
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
  if (filter.has_expense !== undefined) {
    qs.set("has_expense", filter.has_expense ? "true" : "false");
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

/** PATCH del encabezado de una OC. Los ítems se sincronizan por separado. */
export async function updatePurchaseOrder(
  id: string,
  payload: PatchedPurchaseOrderRequest,
): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/suppliers/purchase-orders/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function createPurchaseOrderItem(
  payload: PurchaseOrderItemCreatePayload,
): Promise<PurchaseOrderItem> {
  return apiFetch<PurchaseOrderItem>("/suppliers/purchase-order-items/", {
    method: "POST",
    body: payload,
  });
}

export async function updatePurchaseOrderItem(
  id: number,
  payload: PatchedPurchaseOrderItemRequest,
): Promise<PurchaseOrderItem> {
  return apiFetch<PurchaseOrderItem>(`/suppliers/purchase-order-items/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deletePurchaseOrderItem(id: number): Promise<void> {
  await apiFetch(`/suppliers/purchase-order-items/${id}/`, { method: "DELETE" });
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

export async function updatePurchaseOrderReceivedQuantities(
  id: string,
  itemUpdates: Record<string, number>,
): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/suppliers/purchase-orders/${id}/update_received_quantities/`, {
    method: "POST",
    body: { item_updates: itemUpdates },
  });
}

export async function payPurchaseOrder(
  id: string,
  payload: PayPurchaseOrderPayload,
): Promise<PayPurchaseOrderResult> {
  return apiFetch<PayPurchaseOrderResult>(`/suppliers/purchase-orders/${id}/pay_order/`, {
    method: "POST",
    body: payload,
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
