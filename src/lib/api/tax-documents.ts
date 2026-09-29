import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type TaxDocument = YggdraSchemas["TaxDocument"];
type PaginatedTaxDocumentList = YggdraSchemas["PaginatedTaxDocumentList"];

export interface TaxDocumentRequest {
  branch: number;
  order?: string;
  document_type: string;
  customer_rut: string;
  customer_name: string;
  customer_address?: string;
  customer_commune?: string;
  customer_city?: string;
  net_amount: string;
  due_date?: string;
  notes?: string;
  items?: Array<{ description: string; quantity: number; unit_price: string }>;
}

export interface TaxDocumentItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: string;
  line_total: string;
  [key: string]: unknown;
}

export interface TaxDocumentSummary {
  total_documents: number;
  total_boletas: number;
  total_facturas: number;
  total_credit_notes: number;
  total_amount: number | string;
  total_net_amount: number | string;
  total_tax_amount: number | string;
  by_status: Record<string, number>;
  by_document_type: Record<string, number>;
}

function unwrapTaxDocument(data: unknown): TaxDocument {
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    if (rec.document && typeof rec.document === "object") {
      return rec.document as TaxDocument;
    }
    if (rec.credit_note && typeof rec.credit_note === "object") {
      return rec.credit_note as TaxDocument;
    }
    if (typeof rec.id === "string") {
      return data as TaxDocument;
    }
  }
  throw new Error("La API no devolvió un documento tributario válido.");
}

export async function fetchTaxDocuments(params?: {
  status?: string;
  document_type?: string;
  customer_rut?: string;
  date_from?: string;
  date_to?: string;
  page_size?: number;
}): Promise<TaxDocument[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.document_type) qs.set("document_type", params.document_type);
  if (params?.customer_rut) qs.set("customer_rut", params.customer_rut);
  if (params?.date_from) qs.set("date_from", params.date_from);
  if (params?.date_to) qs.set("date_to", params.date_to);
  qs.set("page_size", String(params?.page_size ?? 50));
  const query = qs.toString();
  const data = await apiFetch<PaginatedTaxDocumentList>(
    `/finance/tax-documents/${query ? `?${query}` : ""}`,
  );
  return data.results ?? [];
}

export async function generateTaxDocumentFromOrder(payload: {
  order_id: string;
  document_type: string;
  customer_rut: string;
  customer_name: string;
  customer_address?: string;
  customer_commune?: string;
  customer_city?: string;
  notes?: string;
}): Promise<TaxDocument> {
  const data = await apiFetch<unknown>("/finance/tax-documents/generate_from_order/", {
    method: "POST",
    body: payload,
  });
  return unwrapTaxDocument(data);
}

export async function fetchTaxDocument(id: string): Promise<TaxDocument> {
  return apiFetch<TaxDocument>(`/finance/tax-documents/${id}/`);
}

export async function createTaxDocument(payload: TaxDocumentRequest): Promise<TaxDocument> {
  return apiFetch<TaxDocument>("/finance/tax-documents/", {
    method: "POST",
    body: payload,
  });
}

export async function issueTaxDocument(id: string): Promise<TaxDocument> {
  const data = await apiFetch<unknown>(`/finance/tax-documents/${id}/issue/`, {
    method: "POST",
  });
  return unwrapTaxDocument(data);
}

export async function sendToSii(id: string): Promise<TaxDocument> {
  const data = await apiFetch<unknown>(`/finance/tax-documents/${id}/send_to_sii/`, {
    method: "POST",
  });
  return unwrapTaxDocument(data);
}

/** Anula un borrador (POST cancel/). Un DTE ya emitido se anula con nota de crédito. */
export async function cancelTaxDocument(id: string): Promise<TaxDocument> {
  const data = await apiFetch<unknown>(`/finance/tax-documents/${id}/cancel/`, {
    method: "POST",
  });
  return unwrapTaxDocument(data);
}

export async function deleteTaxDocument(id: string): Promise<void> {
  await apiFetch<void>(`/finance/tax-documents/${id}/`, { method: "DELETE" });
}

export async function createCreditNote(
  id: string,
  payload: { reason: string; amount?: number; items?: Array<{ description: string; quantity: number; unit_price: string }> },
): Promise<TaxDocument> {
  const data = await apiFetch<unknown>(`/finance/tax-documents/${id}/create_credit_note/`, {
    method: "POST",
    body: payload,
  });
  return unwrapTaxDocument(data);
}

export async function fetchTaxDocumentsSummary(params?: {
  date_from?: string;
  date_to?: string;
}): Promise<TaxDocumentSummary> {
  const qs = new URLSearchParams();
  if (params?.date_from) qs.set("date_from", params.date_from);
  if (params?.date_to) qs.set("date_to", params.date_to);
  const query = qs.toString();
  return apiFetch<TaxDocumentSummary>(
    `/finance/tax-documents/summary/${query ? `?${query}` : ""}`,
  );
}

export async function fetchPendingSiiDocuments(): Promise<TaxDocument[]> {
  const data = await apiFetch<TaxDocument[] | PaginatedTaxDocumentList>(
    "/finance/tax-documents/pending_sii/",
  );
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "results" in data) {
    return (data as PaginatedTaxDocumentList).results ?? [];
  }
  return [];
}
