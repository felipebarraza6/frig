"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBranchSubscriptions } from "@/lib/api/module-plans";
import {
  branchBypassesPlanModuleLimits,
  normalizePlanModuleList,
} from "@/lib/modules";
import { useCurrentBranch } from "@/lib/store/session";

/**
 * Entitlements de módulos del plan activo de la sucursal.
 *
 * Fuente: `GET /branches/{id}/subscriptions/` → `current_plan.modules`
 * (contrato `BranchCurrentPlan`). Las sucursales demo bypassean el filtro.
 */
export function useBranchPlanModules() {
  const branch = useCurrentBranch();
  const branchId = branch?.branch_id ? Number(branch.branch_id) : null;
  const bypassPlanLimits = branchBypassesPlanModuleLimits(branch);

  const { data, isLoading, isFetched, isError } = useQuery({
    queryKey: ["branch-subscriptions", branchId],
    queryFn: () => fetchBranchSubscriptions(branchId!),
    enabled: !!branchId && !bypassPlanLimits,
    staleTime: 60_000,
    retry: 1,
  });

  const planModules = useMemo((): ReadonlySet<string> | null => {
    if (bypassPlanLimits) return null;
    if (!branchId) return null;
    if (!isFetched && isLoading) return null;
    if (isError && !data) {
      // Sin dato de plan: fail-closed → solo legacy activos (caller).
      return new Set();
    }
    const fromPlan = normalizePlanModuleList(data?.current_plan?.modules);
    // current_plan null o sin lista → ningún módulo instalable por plan.
    return new Set(fromPlan ?? []);
  }, [bypassPlanLimits, branchId, data, isError, isFetched, isLoading]);

  return {
    planModules,
    bypassPlanLimits,
    currentPlan: data?.current_plan ?? null,
    isLoading: !bypassPlanLimits && !!branchId && isLoading,
    isReady: bypassPlanLimits || !branchId || isFetched || isError,
  };
}
