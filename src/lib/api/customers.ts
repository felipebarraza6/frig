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
  // dos listados: activos e inactivos.
  if (filter.status === "" && !filter.next && !filter.previous) {
    const base: CustomersFilter = { ...filter, status: undefined, page_size: 1000 };
    const [activeData, inactiveData] = await Promise.all([
      apiFetch<PaginatedClientList>(buildCustomersUrl({ ...base, status: "active" })),
      apiFetch<PaginatedClientList>(buildCustomersUrl({ ...base, status: "inactive" })),
    ]);
    return {
      count: (activeData.count ?? 0) + (inactiveData.count ?? 0),
      next: null,
      previous: null,
      results: [...(activeData.results ?? []), ...(inactiveData.results ?? [])],
    };
  }
  return apiFetch<PaginatedClientList>(buildCustomersUrl(filter));
}

export async function searchCustomers(query: string, branchId?: number): Promise<Client[]> {
  const qs = new URLSearchParams();
  qs.set("search", query);
  qs.set("page_size", "20");
  if (branchId) qs.set("branch", String(branchId));
  const data = await apiFetch<PaginatedClientList>(
    `/customers/clients/search/?${qs.toString()}`,
  );
  return data.results;
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

export async function deleteCustomer(id: number): Promise<void> {
  await apiFetch(`/customers/clients/${id}/`, { method: "DELETE" });
}

export async function fetchCustomerTags(): Promise<string[]> {
  const data = await apiFetch<PaginatedClientList>("/customers/clients/?page_size=1000");
  const tags = new Set<string>();
  for (const client of data.results) {
    const clientTags = (client as unknown as { tags?: string[] }).tags ?? [];
    for (const tag of clientTags) {
      if (tag.trim()) tags.add(tag.trim());
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
