import { apiFetch } from "./client";
import type { YggdraSchemas } from "./types";

/** Organización reseller según el schema de Yggdra. */
export type OrganizationDetail = YggdraSchemas["Organization"];

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
