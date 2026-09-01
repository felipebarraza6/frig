import { apiFetch, apiFile, ApiError, type ApiFileResult } from "@/lib/api/client";
import type { YggdraSchemas } from "@/lib/api/types";
import type { CartItem } from "@/lib/store/cart";
import {
  orderTypeLabel,
  orderStatusLabel,
  paymentStatusLabel,
  formatCLP,
} from "@/lib/utils";

type YggdraOrder = YggdraSchemas["Order"];
type PaginatedOrder = YggdraSchemas["PaginatedOrderList"];

export interface OrdersFilter {
  search?: string;
  order_type?: string | string[];
  status?: string | string[];
  payment_status?: string | string[];
  delivery_status?: string | string[];
  client__in?: string | string[];
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
  delivery_address?: string | null;
  delivery_date?: string | null;
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
  id?: string | number;
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

/** Parámetros comunes del listado de órdenes (usados por fetchOrders y exports). */
function buildOrdersQueryString(filter: OrdersFilter): string {
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);

  // El backend expone filtros `__in` para múltiples valores separados por comas.
  // Usar repetidos de la misma clave no funciona de forma confiable en DRF/django-filter.
  function setMulti(key: string, value: string | string[] | undefined) {
    if (value === undefined || value === null) return;
    const values = Array.isArray(value) ? value : [value];
    if (values.length === 0) return;
    // Solo agregamos el sufijo __in cuando la clave aún no lo tiene y hay varios valores.
    // Si la clave ya termina en __in, se usa tal cual para evitar client__in__in.
    const suffix = values.length > 1 && !key.endsWith("__in") ? "__in" : "";
    qs.set(`${key}${suffix}`, values.join(","));
  }

  setMulti("order_type", filter.order_type);
  setMulti("status", filter.status);
  setMulti("payment_status", filter.payment_status);
  setMulti("delivery_status", filter.delivery_status);
  setMulti("client__in", filter.client__in);

  if (filter.start_date) qs.set("start_date", filter.start_date);
  if (filter.end_date) qs.set("end_date", filter.end_date);
  if (filter.page_size) qs.set("page_size", String(filter.page_size));
  return qs.toString();
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
  const q = buildOrdersQueryString(filter);
  return apiFetch<PaginatedOrder>(`/sales/orders/${q ? `?${q}` : ""}`);
}

export interface PayOrderPayload {
  payment_method_id: string;
  amount: string;
  cash_register_id?: number | string | null;
  notes?: string | null;
  reference?: string | null;
}

export async function payOrder(id: string, payload: PayOrderPayload): Promise<YggdraOrder> {
  return apiFetch<YggdraOrder>(`/sales/orders/${id}/pay/`, {
    method: "POST",
    body: payload,
  });
}

export async function fetchPendingOrdersByClient(clientId: string): Promise<YggdraOrder[]> {
  const data = await apiFetch<{ results?: YggdraOrder[] } | YggdraOrder[]>(
    `/sales/orders/pending_by_client/?client=${encodeURIComponent(clientId)}`,
  );
  if (Array.isArray(data)) return data;
  return data.results ?? [];
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
      delivery_address: input.delivery_address ?? null,
      delivery_date: input.delivery_date ?? null,
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

export async function downloadOrderThermalPdf(id: string): Promise<ApiFileResult> {
  return apiFile(`/sales/orders/${id}/generate-boleta-pdf/`);
}

export async function downloadOrderTicketPdf(id: string): Promise<ApiFileResult> {
  return apiFile(`/sales/orders/${id}/generate-ticket-pdf/`);
}

export async function downloadOrderA4Pdf(id: string): Promise<ApiFileResult> {
  return apiFile(`/sales/orders/${id}/generate-boleta-domiciliaria-pdf/`);
}

function formatOrderDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Normaliza un color HEX a 8 dígitos ARGB (con alfa FF) mayúsculas sin `#`,
 * formato que xlsx-js-style aplica de forma confiable en `fgColor.rgb`.
 * Soporta 3, 6 y 8 dígitos, con o sin alfa, y devuelve un fallback si el
 * formato no es válido.
 */
function normalizeHexForXlsx(color: string, fallback = "FF2F6B3C"): string {
  const hex = color.replace("#", "").trim().toUpperCase();
  // 3 dígitos → 6 dígitos.
  if (/^[0-9A-F]{3}$/.test(hex)) {
    const expanded = hex
      .split("")
      .map((c) => c + c)
      .join("");
    return `FF${expanded}`;
  }
  // 6 dígitos: agregar alfa FF.
  if (/^[0-9A-F]{6}$/.test(hex)) return `FF${hex}`;
  // 8 dígitos (ARGB): ya está listo.
  if (/^[0-9A-F]{8}$/.test(hex)) return hex;
  return fallback;
}

/**
 * Genera un archivo Excel de órdenes en el navegador, traduciendo estados y
 * tipos al español y aplicando el color primario de la marca en el encabezado.
 * El color debe estar en formato HEX (ej: #2f6b3c).
 *
 * Se usa `aoa_to_sheet` en lugar de `json_to_sheet` para garantizar que las
 * celdas del encabezado existan y acepten estilos de forma confiable.
 *
 * `xlsx-js-style` se importa de forma dinámica para mantenerla fuera del
 * bundle inicial (orders.ts es importado por el terminal POS y cart-panel).
 */
export async function generateOrdersExcel(
  orders: YggdraOrder[],
  primaryColor = "#2f6b3c",
): Promise<Blob> {
  const XLSX = await import("xlsx-js-style");
  const headers = [
    "ID",
    "Tipo",
    "Estado",
    "Pago",
    "Fecha",
    "Cliente",
    "Sucursal",
    "Monto Total",
    "Costo Total",
    "Observaciones",
    "Creado",
  ];

  const rows = orders.map((o) => [
    o.id,
    orderTypeLabel(o.order_type),
    orderStatusLabel(o.status),
    paymentStatusLabel(o.payment_status),
    formatOrderDate(o.date),
    o.client?.name ?? "Sin cliente",
    o.branch?.business_name ?? "—",
    o.total_amount ? formatCLP(o.total_amount) : "$0",
    o.total_cost ? formatCLP(o.total_cost) : "$0",
    o.observation ?? "",
    formatOrderDate(o.created),
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Aplicar color de marca al encabezado.
  const fill = {
    patternType: "solid",
    fgColor: { rgb: normalizeHexForXlsx(primaryColor) },
  };
  const font = { bold: true, color: { rgb: "FFFFFF" } };
  for (let c = 0; c < headers.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellRef]) {
      ws[cellRef] = { t: "s", v: headers[c] };
    }
    ws[cellRef].s = { fill, font };
  }

  // Auto-ajustar anchos de columna aproximados.
  ws["!cols"] = headers.map((key) => ({
    wch: Math.max(key.length, 12),
  }));

  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export { ApiError };
