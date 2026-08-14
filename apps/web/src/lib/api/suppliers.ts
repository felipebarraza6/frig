import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type Supplier = YggdraSchemas["Supplier"];
export type SupplierList = YggdraSchemas["SupplierList"];
export type SupplierRequest = YggdraSchemas["SupplierRequest"];
export type SupplierProduct = YggdraSchemas["SupplierProduct"];
export type PurchaseOrder = YggdraSchemas["PurchaseOrder"];
export type PurchaseOrderList = YggdraSchemas["PurchaseOrderList"];
export type PurchaseOrderCreate = YggdraSchemas["PurchaseOrderCreate"];
export type PurchaseOrderItemRequest = YggdraSchemas["PurchaseOrderItemRequest"];

export interface PurchaseOrderCreatePayload extends Omit<PurchaseOrderCreate, "items"> {
  items: PurchaseOrderItemRequest[];
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
  const data = await apiFetch<PaginatedSupplierProduct>(`/suppliers/supplier-products/?supplier=${supplierId}`);
  return data.results ?? [];
}

export interface PurchaseOrdersFilter {
  search?: string;
  supplier?: string;
  status?: string;
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
