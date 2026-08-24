import { apiFetch, apiFile, ApiError, type ApiFileResult } from "@/lib/api/client";
import type { YggdraSchemas } from "@/lib/api/types";
import type { CartItem } from "@/lib/store/cart";

type YggdraOrder = YggdraSchemas["Order"];
type PaginatedOrder = YggdraSchemas["PaginatedOrderList"];

export interface OrdersFilter {
  search?: string;
  order_type?: string;
  status?: string | string[];
  payment_status?: string | string[];
  delivery_status?: string | string[];
  client?: string | string[];
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

export interface EditOrderInput {
  client_id?: number | null;
  table_id?: number | null;
  observation?: string | null;
  delivery_address?: string | null;
  delivery_date?: string | null;
  items?: EditOrderItemInput[];
}

export interface EditOrderItemInput {
  id?: string;
  product?: number;
  quantity?: number;
  unit_price?: string;
  unit_cost?: string;
  discount_percentage?: number;
  notes?: string | null;
  is_active?: boolean;
}

export interface InstallmentInput {
  amount: string;
  due_date?: string | null;
  notes?: string | null;
}

export interface InstallmentPayInput {
  payment_method_id: string;
  amount: string;
  reference?: string | null;
  notes?: string | null;
  cash_register_id?: number | null;
}

export interface PaymentInstallment {
  id: string;
  order?: string;
  amount: string;
  paid_amount?: string | null;
  due_date?: string | null;
  payment_date?: string | null;
  notes?: string | null;
  status?: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED" | string;
  created?: string;
  modified?: string;
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
  if (filter.status) {
    const values = Array.isArray(filter.status) ? filter.status : [filter.status];
    values.forEach((v) => qs.append("status", v));
  }
  if (filter.payment_status) {
    const values = Array.isArray(filter.payment_status) ? filter.payment_status : [filter.payment_status];
    values.forEach((v) => qs.append("payment_status", v));
  }
  if (filter.delivery_status) {
    const values = Array.isArray(filter.delivery_status) ? filter.delivery_status : [filter.delivery_status];
    values.forEach((v) => qs.append("delivery_status", v));
  }
  if (filter.client) {
    const values = Array.isArray(filter.client) ? filter.client : [filter.client];
    values.forEach((v) => qs.append("client", v));
  }
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

export interface DeliverItemInput {
  order_product_id: string;
  actual_quantity: number;
}

export async function deliverOrder(
  id: string,
  items?: DeliverItemInput[],
): Promise<YggdraOrder> {
  return apiFetch<YggdraOrder>(`/sales/orders/${id}/deliver/`, {
    method: "POST",
    body: items && items.length > 0 ? { items } : undefined,
  });
}

export async function editOrder(
  id: string,
  input: EditOrderInput,
): Promise<YggdraOrder> {
  return apiFetch<YggdraOrder>(`/sales/orders/${id}/edit_order/`, {
    method: "POST",
    body: {
      client_id: input.client_id ?? null,
      table_id: input.table_id ?? null,
      observation: input.observation ?? null,
      delivery_address: input.delivery_address ?? null,
      delivery_date: input.delivery_date ?? null,
      items: input.items ?? [],
    },
  });
}

export async function fetchInstallments(
  id: string,
): Promise<PaymentInstallment[]> {
  return apiFetch<PaymentInstallment[]>(`/sales/orders/${id}/installments/`);
}

export async function createInstallments(
  id: string,
  installments: InstallmentInput[],
): Promise<PaymentInstallment[]> {
  return apiFetch<PaymentInstallment[]>(
    `/sales/orders/${id}/create_installments/`,
    {
      method: "POST",
      body: installments,
    },
  );
}

export async function payInstallment(
  id: string,
  installmentId: string,
  input: InstallmentPayInput,
): Promise<{ installment: PaymentInstallment; payment_id: string }> {
  return apiFetch(`/sales/orders/${id}/installments/${installmentId}/pay/`, {
    method: "POST",
    body: {
      payment_method_id: input.payment_method_id,
      amount: input.amount,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      cash_register_id: input.cash_register_id ?? null,
    },
  });
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
  if (filter.status) {
    const values = Array.isArray(filter.status) ? filter.status : [filter.status];
    values.forEach((v) => qs.append("status", v));
  }
  if (filter.payment_status) {
    const values = Array.isArray(filter.payment_status) ? filter.payment_status : [filter.payment_status];
    values.forEach((v) => qs.append("payment_status", v));
  }
  if (filter.delivery_status) {
    const values = Array.isArray(filter.delivery_status) ? filter.delivery_status : [filter.delivery_status];
    values.forEach((v) => qs.append("delivery_status", v));
  }
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
