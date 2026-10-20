import { apiFetch } from "./client";
import type { BranchProductTypesResponse } from "@/lib/api/types/modules";

/**
 * GET /api/branches/modules/product-types/?branch_id={branch_id}
 *
 * Tipos según plan/módulos. Para el selector de alta usar
 * {@link fetchBranchEnabledProductTypes} (config real de la sucursal).
 */
export async function fetchBranchProductTypes(
  branchId: number,
): Promise<BranchProductTypesResponse> {
  const qs = new URLSearchParams();
  qs.set("branch_id", String(branchId));
  return apiFetch<BranchProductTypesResponse>(
    `/branches/modules/product-types/?${qs.toString()}`,
  );
}

export type BranchEnabledProductTypesResponse = {
  enabled_types: string[];
  warning?: string;
};

/**
 * GET /api/branches/product-types/enabled-types/{branch_id}/
 *
 * Tipos realmente habilitados en BranchProductTypeConfig.
 */
export async function fetchBranchEnabledProductTypes(
  branchId: number,
): Promise<BranchEnabledProductTypesResponse> {
  return apiFetch<BranchEnabledProductTypesResponse>(
    `/branches/product-types/enabled-types/${branchId}/`,
  );
}
