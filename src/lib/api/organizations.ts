import { apiFetch } from "./client";
import type { YggdraSchemas } from "./types";

/** Organización reseller según el schema de Yggdra. */
export type OrganizationDetail = YggdraSchemas["Organization"];

/** Payload para crear/actualizar una organización. */
export interface OrganizationPayload {
  name: string;
  business_name?: string;
  dni?: string;
  max_branches?: number | null;
  is_active?: boolean;
  owner?: number;
  plan_group?: string | null;
}

/**
 * GET /api/branches/organizations/
 *
 * Lista las organizaciones visibles para el usuario autenticado (owner de la
 * org, OWNER de alguna de sus tiendas, o superuser/staff). La org es
 * supra-sucursal: el endpoint no filtra por X-Branch-ID.
 */
export async function fetchOrganizations(): Promise<OrganizationDetail[]> {
  const data = await apiFetch<
    { results?: OrganizationDetail[] } | OrganizationDetail[]
  >("/branches/organizations/");
  return Array.isArray(data) ? data : (data.results ?? []);
}

/** POST /api/branches/organizations/ — solo superadmin. */
export async function createOrganization(
  payload: OrganizationPayload,
): Promise<OrganizationDetail> {
  return apiFetch<OrganizationDetail>("/branches/organizations/", {
    method: "POST",
    body: payload,
  });
}

/** PATCH /api/branches/organizations/{id}/ — owner o superadmin. */
export async function updateOrganization(
  id: number | string,
  payload: OrganizationPayload,
): Promise<OrganizationDetail> {
  return apiFetch<OrganizationDetail>(`/branches/organizations/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

/** DELETE /api/branches/organizations/{id}/ — solo superadmin. */
export async function deleteOrganization(id: number | string): Promise<void> {
  await apiFetch<void>(`/branches/organizations/${id}/`, {
    method: "DELETE",
  });
}
