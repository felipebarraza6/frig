import { apiFetch } from "./client";
import type { ApplyPlanResponse } from "@/lib/api/types/modules";
import type { YggdraSchemas } from "@/lib/api/types";

export type BranchModulePlan = YggdraSchemas["BranchModulePlan"];

/**
 * GET /api/shared/module-plans/
 *
 * Lista los planes de módulos disponibles (solo superadmin).
 */
export async function fetchModulePlans(): Promise<BranchModulePlan[]> {
  const data = await apiFetch<{ results?: BranchModulePlan[] } | BranchModulePlan[]>(
    "/shared/module-plans/",
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

/**
 * POST /api/branches/{branch_id}/apply-plan/
 *
 * Aplica o cambia el plan de una sucursal. Crea/actualiza la suscripción,
 * activa los módulos del plan y sincroniza los tipos de producto.
 * Body real: { plan_id: number, end_date?: "YYYY-MM-DD" } (el schema OpenAPI
 * de esta operación está mal generado; el contrato real es este).
 */
export async function applyBranchPlan(
  branchId: number,
  planId: number,
  endDate?: string,
): Promise<ApplyPlanResponse> {
  return apiFetch<ApplyPlanResponse>(`/branches/${branchId}/apply-plan/`, {
    method: "POST",
    body: { plan_id: planId, end_date: endDate },
  });
}

/**
 * POST /api/branches/{branch_id}/cancel-subscription/
 *
 * Cancela la suscripción activa de una sucursal y desactiva los módulos
 * de extensión.
 */
export async function cancelBranchSubscription(branchId: number): Promise<unknown> {
  return apiFetch<unknown>(`/branches/${branchId}/cancel-subscription/`, {
    method: "POST",
  });
}
