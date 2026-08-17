import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

type Client = YggdraSchemas["Client"];
type ClientRequest = YggdraSchemas["ClientRequest"];
type PaginatedClientList = YggdraSchemas["PaginatedClientDepthList"];

export interface CustomersFilter {
  search?: string;
  dni?: string;
  phone?: string;
  next?: string | null;
  previous?: string | null;
}

function buildCustomersUrl(filter: CustomersFilter): string {
  if (filter.next) return filter.next;
  if (filter.previous) return filter.previous;
  const qs = new URLSearchParams();
  if (filter.search) qs.set("name__icontains", filter.search);
  if (filter.dni) qs.set("dni__icontains", filter.dni);
  if (filter.phone) qs.set("phone_number__icontains", filter.phone);
  const q = qs.toString();
  return `/customers/clients/${q ? `?${q}` : ""}`;
}

export async function fetchCustomers(filter: CustomersFilter = {}): Promise<PaginatedClientList> {
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
