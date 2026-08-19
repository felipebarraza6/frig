import { apiFetch } from "./client";
import type { BranchProductTypesResponse } from "@/lib/api/types/modules";

/**
 * GET /api/branches/module-configs/product-types/?branch_id={branch_id}
 *
 * Devuelve los tipos de producto permitidos para la sucursal según el plan
 * y los módulos activos.
 */
export async function fetchBranchProductTypes(
  branchId: number,
): Promise<BranchProductTypesResponse> {
  const qs = new URLSearchParams();
  qs.set("branch_id", String(branchId));
  return apiFetch<BranchProductTypesResponse>(
    `/branches/module-configs/product-types/?${qs.toString()}`,
  );
}
