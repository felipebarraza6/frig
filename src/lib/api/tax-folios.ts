import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type TaxDocumentFolio = YggdraSchemas["TaxDocumentFolio"];
type Paginated = YggdraSchemas["PaginatedTaxDocumentFolioList"];

export async function fetchTaxFolios(branchId: number): Promise<TaxDocumentFolio[]> {
  const qs = new URLSearchParams();
  qs.set("branch", String(branchId));
  qs.set("page_size", "50");
  const data = await apiFetch<Paginated>(`/finance/folios/?${qs.toString()}`);
  return data.results ?? [];
}

export async function fetchFolioAlerts(): Promise<unknown[]> {
  const data = await apiFetch<unknown[] | { results?: unknown[] }>(
    "/finance/folios/check_alerts/",
  );
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "results" in data) {
    return (data as { results?: unknown[] }).results ?? [];
  }
  return [];
}

export async function createTaxFolio(payload: {
  branch: number;
  document_type?: string;
  caf_file: File;
  alert_at?: number;
}): Promise<TaxDocumentFolio> {
  const formData = new FormData();
  formData.append("branch", String(payload.branch));
  if (payload.document_type) formData.append("document_type", payload.document_type);
  formData.append("caf_file", payload.caf_file);
  if (payload.alert_at != null) formData.append("alert_at", String(payload.alert_at));

  return apiFetch<TaxDocumentFolio>("/finance/folios/", {
    method: "POST",
    body: formData,
  });
}

export async function toggleTaxFolioActive(id: number): Promise<TaxDocumentFolio> {
  return apiFetch<TaxDocumentFolio>(`/finance/folios/${id}/toggle_active/`, {
    method: "POST",
  });
}

export async function deleteTaxFolio(id: number): Promise<void> {
  await apiFetch<void>(`/finance/folios/${id}/`, { method: "DELETE" });
}
