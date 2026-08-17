"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBranchModules, type ModuleName } from "@/lib/api/branch-modules";
import { useCurrentBranch } from "@/lib/store/session";
import { getModuleForPath, isModuleEnabled } from "@/lib/modules";

export function useBranchModules() {
  const branch = useCurrentBranch();
  const branchId = branch?.branch_id ? Number(branch.branch_id) : null;

  const { data: configs = [], isLoading, error } = useQuery({
    queryKey: ["branch-modules", branchId],
    queryFn: () => fetchBranchModules(branchId!),
    enabled: !!branchId,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const enabledModules = useMemo(
    () => new Set(configs.filter((c) => c.is_enabled).map((c) => c.module_name)),
    [configs],
  );

  return { configs, enabledModules, isLoading, error, branchId };
}

/** Verifica si un módulo específico está habilitado para la sucursal activa. */
export function useIsModuleEnabled(moduleName: ModuleName | null | undefined): boolean {
  const { enabledModules, isLoading } = useBranchModules();
  if (moduleName === null || moduleName === undefined) return true;
  if (isLoading) return true; // evita parpadeo durante carga
  return enabledModules.has(moduleName);
}

/** Verifica si el módulo asociado a una ruta está habilitado. */
export function useIsRouteModuleEnabled(pathname: string): boolean {
  const { enabledModules, isLoading } = useBranchModules();
  if (isLoading) return true;
  return isModuleEnabled(getModuleForPath(pathname), enabledModules);
}
