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
 * Aplica o cambia el plan de una sucursal.
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
