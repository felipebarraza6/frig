import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type Lead = YggdraSchemas["Lead"];
export type LeadList = YggdraSchemas["LeadList"];
export type LeadSource = YggdraSchemas["LeadSource"];

type Paginated<T> = { count?: number; next?: string | null; results?: T[] };

function asList<T>(data: T[] | Paginated<T> | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "CONVERTED"
  | "LOST"
  | "ARCHIVED";

export function leadStatusLabel(status?: string | null): string {
  switch (status) {
    case "NEW":
      return "Nuevo";
    case "CONTACTED":
      return "Contactado";
    case "QUALIFIED":
      return "Calificado";
    case "CONVERTED":
      return "Convertido";
    case "LOST":
      return "Perdido";
    case "ARCHIVED":
      return "Archivado";
    default:
      return status || "—";
  }
}

export async function fetchLeads(filter: {
  status?: string;
  source?: string;
  search?: string;
  page_size?: number;
} = {}): Promise<Paginated<LeadList>> {
  const qs = new URLSearchParams();
  if (filter.status) qs.set("status", filter.status);
  if (filter.source) qs.set("source", filter.source);
  if (filter.search) qs.set("search", filter.search);
  qs.set("page_size", String(filter.page_size ?? 50));
  return apiFetch(`/crm/leads/?${qs.toString()}`);
}

export async function fetchLead(id: string): Promise<Lead> {
  return apiFetch(`/crm/leads/${id}/`);
}

export async function createLead(payload: {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  source_detail?: string;
  status?: LeadStatus;
  source?: string | null;
}): Promise<Lead> {
  return apiFetch("/crm/leads/", { method: "POST", body: payload });
}

export async function updateLead(
  id: string,
  payload: Partial<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    company: string;
    notes: string;
    source_detail: string;
    status: LeadStatus;
    score: number;
    source: string | null;
  }>,
): Promise<Lead> {
  return apiFetch(`/crm/leads/${id}/`, { method: "PATCH", body: payload });
}

export async function deleteLead(id: string): Promise<void> {
  await apiFetch(`/crm/leads/${id}/`, { method: "DELETE" });
}

/** Solo CONTACTED o QUALIFIED. Devuelve el lead con converted_to_client. */
export async function convertLead(id: string): Promise<Lead> {
  return apiFetch(`/crm/leads/${id}/convert/`, { method: "POST", body: {} });
}

export async function fetchLeadSources(opts: {
  includeInactive?: boolean;
} = {}): Promise<LeadSource[]> {
  const qs = new URLSearchParams();
  qs.set("page_size", "50");
  if (opts.includeInactive) qs.set("show_inactive", "true");
  const data = await apiFetch<LeadSource[] | Paginated<LeadSource>>(
    `/crm/lead-sources/?${qs.toString()}`,
  );
  const list = asList(data);
  if (opts.includeInactive) return list;
  return list.filter((s) => s.is_active !== false);
}

export async function createLeadSource(payload: {
  name: string;
  description?: string;
  color?: string;
}): Promise<LeadSource> {
  return apiFetch("/crm/lead-sources/", {
    method: "POST",
    body: {
      color: "#1890ff",
      ...payload,
    },
  });
}

export async function updateLeadSource(
  id: string,
  payload: Partial<{
    name: string;
    description: string;
    color: string;
    is_active: boolean;
  }>,
): Promise<LeadSource> {
  return apiFetch(`/crm/lead-sources/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function ensureDefaultLeadSource(): Promise<LeadSource | null> {
  const existing = await fetchLeadSources();
  if (existing.length > 0) return existing[0];
  try {
    return await createLeadSource({ name: "General", color: "#1890ff" });
  } catch {
    return null;
  }
}
