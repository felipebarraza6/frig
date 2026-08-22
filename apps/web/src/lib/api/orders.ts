import { apiFetch, apiFile, ApiError, type ApiFileResult } from "@/lib/api/client";
import type { YggdraSchemas } from "@/lib/api/types";
import type { CartItem } from "@/lib/store/cart";

type YggdraOrder = YggdraSchemas["Order"];
type PaginatedOrder = YggdraSchemas["PaginatedOrderList"];

export interface OrdersFilter {
  search?: string;
  order_type?: string;
  status?: string;
  payment_status?: string;
  start_date?: string;
  end_date?: string;
  page_size?: number;
  next?: string | null;
  previous?: string | null;
}

export interface OrderItemModifierInput {
  modifier_option: number;
  surcharge_applied: string;
  notes?: string | null;
}

export interface OrderItemInput {
  product: number;
  quantity: number;
  unit_price: string;
  discount_percentage?: number;
  notes?: string | null;
  modifiers?: OrderItemModifierInput[];
}

export interface CreateOrderInput {
  items: OrderItemInput[];
  observation?: string | null;
  client_id?: number | null;
  table_id?: number | null;
  order_type?: "SALE" | "ORDER" | "AGREEMENT";
}

/**
 * Crear una orden de venta (SALE) con sus líneas en un solo POST.
 * El backend asigna branch/owner automáticamente desde el request
 * (X-Branch-ID + token). La fecha se envía en hora local ISO.
 */
export async function fetchOrders(filter: OrdersFilter = {}): Promise<PaginatedOrder> {
  if (filter.next) {
    return apiFetch<PaginatedOrder>(filter.next);
  }
  if (filter.previous) {
    return apiFetch<PaginatedOrder>(filter.previous);
  }
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.order_type) qs.set("order_type", filter.order_type);
  if (filter.status) qs.set("status", filter.status);
  if (filter.payment_status) qs.set("payment_status", filter.payment_status);
  if (filter.start_date) qs.set("start_date", filter.start_date);
  if (filter.end_date) qs.set("end_date", filter.end_date);
  const q = qs.toString();
  return apiFetch<PaginatedOrder>(`/sales/orders/${q ? `?${q}` : ""}`);
}

export async function fetchOrder(id: string): Promise<YggdraOrder> {
  return apiFetch<YggdraOrder>(`/sales/orders/${id}/`);
}

export async function cancelOrder(id: string): Promise<YggdraOrder> {
  return apiFetch<YggdraOrder>(`/sales/orders/${id}/cancel/`, { method: "POST" });
}

export async function createOrder(input: CreateOrderInput): Promise<YggdraOrder> {
  const data = await apiFetch<YggdraOrder>("/sales/orders/", {
    method: "POST",
    body: {
      order_type: input.order_type ?? "SALE",
      date: new Date().toISOString(),
      observation: input.observation ?? null,
      client_id: input.client_id ?? null,
      table_id: input.table_id ?? null,
      items: input.items,
    },
  });
  return data;
}

/**
 * Agregar ítems a una orden existente.
 * Útil para ampliar pedidos de mesa sin crear órdenes paralelas.
 */
export async function addItemsToOrder(
  orderId: string,
  items: OrderItemInput[],
): Promise<YggdraOrder> {
  const data = await apiFetch<YggdraOrder>(`/sales/orders/${orderId}/add_items/`, {
    method: "POST",
    body: { items },
  });
  return data;
}

/** Convertir el carrito de la UI al payload de items de la API. */
export function cartToOrderItems(items: CartItem[]): OrderItemInput[] {
  return items.map((i) => ({
    product: i.product.id,
    quantity: i.quantity,
    unit_price: i.product.price.toFixed(2),
    discount_percentage: i.discountPercentage,
    notes: i.notes || null,
    modifiers: i.modifiers.map((m) => ({
      modifier_option: m.modifierOptionId,
      surcharge_applied: m.surcharge.toFixed(2),
      notes: null,
    })),
  }));
}

function ordersQueryString(filter: OrdersFilter): string {
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.order_type) qs.set("order_type", filter.order_type);
  if (filter.status) qs.set("status", filter.status);
  if (filter.payment_status) qs.set("payment_status", filter.payment_status);
  if (filter.start_date) qs.set("start_date", filter.start_date);
  if (filter.end_date) qs.set("end_date", filter.end_date);
  if (filter.page_size) qs.set("page_size", String(filter.page_size));
  const q = qs.toString();
  return q ? `?${q}` : "";
}

export async function downloadOrderThermalPdf(id: string): Promise<ApiFileResult> {
  return apiFile(`/sales/orders/${id}/generate-boleta-pdf/`);
}

export async function downloadOrderTicketPdf(id: string): Promise<ApiFileResult> {
  return apiFile(`/sales/orders/${id}/generate-ticket-pdf/`);
}

export async function downloadOrderA4Pdf(id: string): Promise<ApiFileResult> {
  return apiFile(`/sales/orders/${id}/generate-boleta-domiciliaria-pdf/`);
}

export async function exportOrdersExcel(filter: OrdersFilter): Promise<ApiFileResult> {
  return apiFile(`/sales/orders/export/${ordersQueryString(filter)}`);
}

export { ApiError };
