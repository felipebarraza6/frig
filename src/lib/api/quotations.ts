import { apiFetch, apiFile, type ApiFileResult } from "@/lib/api/client";
import type { YggdraSchemas } from "@/lib/api/types";
import { appendMulti } from "@/lib/api/query-params";

type YggdraOrder = YggdraSchemas["Order"];
type PaginatedOrder = YggdraSchemas["PaginatedOrderList"];

export interface QuotationsFilter {
  search?: string;
  status?: string | string[];
  order_type?: string | string[];
  client__in?: string | number | Array<string | number>;
  start_date?: string;
  end_date?: string;
  ordering?: string;
  page_size?: number;
  next?: string | null;
  previous?: string | null;
}

export interface QuotationStats {
  total: number;
  pending: number;
  approved: number;
  pending_amount: number;
}

export type Quotation = YggdraOrder & {
  order_number?: string | null;
  /**
   * Fecha de vencimiento de la cotización. El backend la usa en otros
   * contextos del modelo Order; si el serializer no la expone, DRF ignora
   * el campo al enviarlo (no rompe la petición).
   */
  expiration_date?: string | null;
};

/** Detalle completo de una cotización (con ítems inline). */
export async function fetchQuotation(id: string): Promise<Quotation> {
  return apiFetch<Quotation>(`/sales/quotations/${id}/`);
}

/** Activar una cotización borrador: pasa de DRAFT a PENDING. */
export async function activateQuotation(id: string): Promise<Quotation> {
  return apiFetch<Quotation>(`/sales/quotations/${id}/`, {
    method: "PATCH",
    body: { status: "PENDING" },
  });
}

/** Rechazar/cancelar una cotización. */
export async function cancelQuotation(id: string): Promise<Quotation> {
  return apiFetch<Quotation>(`/sales/quotations/${id}/`, {
    method: "PATCH",
    body: { status: "CANCELLED" },
  });
}

export async function downloadQuotationPdf(id: string): Promise<ApiFileResult> {
  return apiFile(`/sales/quotations/${id}/generate-pdf/`);
}

function appendQuotationsFilter(qs: URLSearchParams, filter: QuotationsFilter) {
  if (filter.search) qs.set("search", filter.search);
  appendMulti(qs, "status", filter.status);
  appendMulti(qs, "order_type", filter.order_type);
  appendMulti(qs, "client__in", filter.client__in);
  if (filter.start_date) qs.set("start_date", filter.start_date);
  if (filter.end_date) qs.set("end_date", filter.end_date);
  if (filter.ordering) qs.set("ordering", filter.ordering);
  if (filter.page_size) qs.set("page_size", String(filter.page_size));
}

export async function fetchQuotations(filter: QuotationsFilter = {}): Promise<PaginatedOrder> {
  if (filter.next) {
    return apiFetch<PaginatedOrder>(filter.next);
  }
  if (filter.previous) {
    return apiFetch<PaginatedOrder>(filter.previous);
  }
  const qs = new URLSearchParams();
  appendQuotationsFilter(qs, filter);
  const q = qs.toString();
  return apiFetch<PaginatedOrder>(`/sales/quotations/${q ? `?${q}` : ""}`);
}

export async function exportQuotationsExcel(filter: QuotationsFilter = {}): Promise<ApiFileResult> {
  const qs = new URLSearchParams();
  appendQuotationsFilter(qs, filter);
  const q = qs.toString();
  return apiFile(`/sales/quotations/export/${q ? `?${q}` : ""}`);
}

export async function fetchQuotationStats(): Promise<QuotationStats> {
  const data = await apiFetch<Record<string, unknown>>("/sales/quotations/stats/");
  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
    return Number.isFinite(n) ? n : 0;
  };
  return {
    total: num(data.total ?? data.total_quotations ?? data.count),
    pending: num(data.pending ?? data.pending_count ?? data.open),
    approved: num(data.approved ?? data.approved_count ?? data.completed ?? data.converted),
    pending_amount: num(
      data.pending_amount ?? data.pending_total ?? data.open_amount ?? data.total_pending,
    ),
  };
}

/**
 * Aprobar una cotización: la convierte en orden de venta (ORDER) o venta
 * directa (SALE). El schema del backend declara body OrderRequest (order_type
 * y date), así que se envían ambos; si el backend los ignora, comportamiento
 * idéntico al POST sin body.
 */
export async function convertQuotationToOrder(
  id: string,
  orderType: "ORDER" | "SALE" = "ORDER",
): Promise<YggdraOrder> {
  return apiFetch<YggdraOrder>(`/sales/quotations/${id}/convert_to_order/`, {
    method: "POST",
    body: {
      order_type: orderType,
      date: new Date().toISOString(),
    },
  });
}

export interface CreateQuotationItemInput {
  product: number;
  quantity: number;
  unit_price: string;
  notes?: string | null;
}

export interface CreateQuotationInput {
  items: CreateQuotationItemInput[];
  observation?: string | null;
  client_id?: number | null;
  /** Fecha de vencimiento (yyyy-mm-dd). Null = sin vencimiento. */
  expiration_date?: string | null;
}

export async function createQuotation(input: CreateQuotationInput): Promise<YggdraOrder> {
  return apiFetch<YggdraOrder>("/sales/quotations/", {
    method: "POST",
    body: {
      order_type: "ORDER",
      status: "PENDING",
      date: new Date().toISOString(),
      observation: input.observation ?? null,
      client_id: input.client_id ?? null,
      items: input.items,
      expiration_date: input.expiration_date ?? null,
    },
  });
}

/**
 * Editar una cotización (PATCH parcial): cliente, observación, vencimiento
 * e ítems. El backend reemplaza los ítems con los enviados (mismo contrato
 * que el POST).
 */
export async function updateQuotation(
  id: string,
  input: CreateQuotationInput,
): Promise<YggdraOrder> {
  return apiFetch<YggdraOrder>(`/sales/quotations/${id}/`, {
    method: "PATCH",
    body: {
      observation: input.observation ?? null,
      client_id: input.client_id ?? null,
      items: input.items,
      expiration_date: input.expiration_date ?? null,
    },
  });
}
