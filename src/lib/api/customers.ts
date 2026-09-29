import { apiFetch, apiFile, type ApiFileResult } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

type Client = YggdraSchemas["Client"];
type ClientRequest = YggdraSchemas["ClientRequest"];
type PaginatedClientList = YggdraSchemas["PaginatedClientDepthList"];

export type CustomerStatusFilter = "" | "active" | "inactive";

export interface CustomersFilter {
  search?: string;
  dni?: string;
  phone?: string;
  startDate?: string;
  endDate?: string;
  status?: CustomerStatusFilter;
  page_size?: number;
  next?: string | null;
  previous?: string | null;
}

function buildCustomersQueryString(filter: CustomersFilter): URLSearchParams {
  const qs = new URLSearchParams();
  if (filter.search) qs.set("name__icontains", filter.search);
  if (filter.dni) qs.set("dni__icontains", filter.dni);
  if (filter.phone) qs.set("phone_number__icontains", filter.phone);
  if (filter.startDate) qs.set("created__gte", filter.startDate);
  if (filter.endDate) qs.set("created__lte", filter.endDate);
  if (filter.status === "active") {
    qs.set("is_active", "true");
  } else if (filter.status === "inactive") {
    qs.set("is_active", "false");
  }
  if (filter.page_size) qs.set("page_size", String(filter.page_size));
  return qs;
}

function buildCustomersUrl(filter: CustomersFilter): string {
  if (filter.next) return filter.next;
  if (filter.previous) return filter.previous;
  const qs = buildCustomersQueryString(filter);
  const q = qs.toString();
  return `/customers/clients/${q ? `?${q}` : ""}`;
}

export async function fetchCustomers(filter: CustomersFilter = {}): Promise<PaginatedClientList> {
  // El backend filtra por activos por defecto. Para mostrar todos, combinamos
  // dos listados: activos e inactivos. Si el backend ignora el filtro de
  // estado (como ya pasó con branches), los activos vendrían en ambas listas:
  // se deduplica por id conservando la primera aparición.
  if (filter.status === "" && !filter.next && !filter.previous) {
    const base: CustomersFilter = { ...filter, status: undefined, page_size: 1000 };
    const [activeData, inactiveData] = await Promise.all([
      apiFetch<PaginatedClientList>(buildCustomersUrl({ ...base, status: "active" })),
      apiFetch<PaginatedClientList>(buildCustomersUrl({ ...base, status: "inactive" })),
    ]);
    const all = [...(activeData.results ?? []), ...(inactiveData.results ?? [])];
    const byId = new Map<string, (typeof all)[number]>();
    for (const c of all) {
      const key = String(c.id);
      if (!byId.has(key)) byId.set(key, c);
    }
    const results = Array.from(byId.values());
    return {
      count: results.length,
      next: null,
      previous: null,
      results,
    };
  }
  return apiFetch<PaginatedClientList>(buildCustomersUrl(filter));
}

export async function searchCustomers(query: string, branchId?: number): Promise<Client[]> {
  const qs = new URLSearchParams();
  const q = query.trim();
  if (q) qs.set("search", q);
  qs.set("page_size", "20");
  if (branchId) qs.set("branch", String(branchId));
  const data = await apiFetch<unknown>(`/customers/clients/search/?${qs.toString()}`);
  if (Array.isArray(data)) return data as Client[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.results)) return record.results as Client[];
  }
  return [];
}

export interface CustomerPayload {
  name: string;
  dni?: string | null;
  phone_number?: string | null;
  email?: string | null;
  commercial_business?: string | null;
  address?: string | null;
  receiver_type?: "PERSONA_NATURAL" | "EMPRESA" | null;
  default_document_type?: "BOLETA" | "FACTURA" | null;
  tags?: string[];
  is_active?: boolean;
}

function getStoredBranchId(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem("frig.branch_id");
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isNaN(n) || n <= 0 ? undefined : n;
}

function toApiPayload(payload: CustomerPayload): ClientRequest {
  return {
    ...payload,
    auto_create_meter: false,
    branch: getStoredBranchId(),
  } as ClientRequest;
}

export async function createCustomer(payload: CustomerPayload): Promise<Client> {
  return apiFetch<Client>("/customers/clients/", {
    method: "POST",
    body: toApiPayload(payload),
  });
}

export async function updateCustomer(
  id: number,
  payload: Partial<CustomerPayload>,
): Promise<Client> {
  return apiFetch<Client>(`/customers/clients/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

/** RUT chileno compacto (12.345.678-9). Otros identificadores se muestran tal cual. */
export function formatRut(raw?: string | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const clean = trimmed.replace(/[.\s-]/g, "").toUpperCase();
  if (!/^\d{7,8}[\dK]$/.test(clean)) return trimmed;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const dotted = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${dotted}-${dv}`;
}

export async function uploadCustomerPhoto(id: number, file: File): Promise<Client> {
  const body = new FormData();
  body.append("photo", file);
  return apiFetch<Client>(`/customers/clients/${id}/`, {
    method: "PATCH",
    body,
  });
}

export async function clearCustomerPhoto(id: number): Promise<Client> {
  return apiFetch<Client>(`/customers/clients/${id}/`, {
    method: "PATCH",
    body: { photo: null },
  });
}

export async function deleteCustomer(id: number): Promise<void> {
  await apiFetch(`/customers/clients/${id}/`, { method: "DELETE" });
}

export async function fetchCustomer(id: number): Promise<Client> {
  return apiFetch<Client>(`/customers/clients/${id}/`);
}

/** Respuesta real de GET /customers/clients/stats/ (OpenAPI tipa mal ClientDepth). */
export interface CustomerStats {
  total_clients: number;
  active_clients: number;
  total_contacts: number;
}

export async function fetchCustomerStats(): Promise<CustomerStats> {
  return apiFetch<CustomerStats>("/customers/clients/stats/");
}

export interface ClientWithPendingRevenue {
  id: string;
  name: string;
  email?: string | null;
  dni?: string | null;
  phone_number?: string | null;
  pending_amount: number;
  pending_revenues_count: number;
}

export interface ClientsWithPendingRevenues {
  results: ClientWithPendingRevenue[];
  count: number;
  total_pending_amount: number;
}

export async function fetchClientsWithPendingRevenues(
  search?: string,
): Promise<ClientsWithPendingRevenues> {
  const qs = new URLSearchParams();
  if (search?.trim()) qs.set("search", search.trim());
  const q = qs.toString();
  return apiFetch<ClientsWithPendingRevenues>(
    `/customers/clients/with-pending-revenues/${q ? `?${q}` : ""}`,
  );
}

export function getCustomerTags(customer: { tags?: unknown }): string[] {
  const raw = customer.tags;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean);
}

export async function fetchCustomerTags(): Promise<string[]> {
  const data = await apiFetch<PaginatedClientList>("/customers/clients/?page_size=1000");
  const tags = new Set<string>();
  for (const client of data.results) {
    for (const tag of getCustomerTags(client)) {
      tags.add(tag);
    }
  }
  return Array.from(tags).sort();
}

function buildCustomersExportQuery(filter: CustomersFilter): string {
  const qs = buildCustomersQueryString(filter);
  const q = qs.toString();
  return q ? `?${q}` : "";
}

export async function exportCustomersExcel(filter: CustomersFilter): Promise<ApiFileResult> {
  return apiFile(`/customers/clients/__xlsx/${buildCustomersExportQuery(filter)}`);
}

export async function exportCustomersPdf(filter: CustomersFilter): Promise<ApiFileResult> {
  return apiFile(`/customers/clients/__pdf/${buildCustomersExportQuery(filter)}`);
}
