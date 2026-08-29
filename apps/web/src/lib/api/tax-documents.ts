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

export async function fetchTaxDocuments(params?: { status?: string; document_type?: string }): Promise<TaxDocument[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.document_type) qs.set("document_type", params.document_type);
  const query = qs.toString();
  const data = await apiFetch<PaginatedTaxDocumentList>(`/finance/tax-documents/${query ? `?${query}` : ""}`);
  return data.results ?? [];
}

export async function fetchTaxDocument(id: string): Promise<TaxDocument> {
  return apiFetch<TaxDocument>(`/finance/tax-documents/${id}/`);
}

export async function createTaxDocument(payload: TaxDocumentRequest): Promise<TaxDocument> {
  return apiFetch<TaxDocument>("/finance/tax-documents/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function issueTaxDocument(id: string): Promise<TaxDocument> {
  return apiFetch<TaxDocument>(`/finance/tax-documents/${id}/issue/`, { method: "POST" });
}

export async function sendToSii(id: string): Promise<TaxDocument> {
  return apiFetch<TaxDocument>(`/finance/tax-documents/${id}/send_to_sii/`, { method: "POST" });
}

export async function cancelTaxDocument(id: string, reason: string): Promise<TaxDocument> {
  return apiFetch<TaxDocument>(`/finance/tax-documents/${id}/cancel/`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function createCreditNote(id: string, payload?: { reason?: string; items?: Array<{ description: string; quantity: number; unit_price: string }> }): Promise<TaxDocument> {
  return apiFetch<TaxDocument>(`/finance/tax-documents/${id}/create_credit_note/`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export async function fetchTaxDocumentsSummary(): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>("/finance/tax-documents/summary/");
}
