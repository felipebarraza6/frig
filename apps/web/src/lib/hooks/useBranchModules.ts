"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBranchModules, parseSubmoduleConfig, type ModuleName, type SubmoduleConfig } from "@/lib/api/branch-modules";
import { useCurrentBranch } from "@/lib/store/session";
import { getModuleForPath, isModuleEnabled, isSubmoduleEnabled } from "@/lib/modules";

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

  const configByName = useMemo(() => {
    const map = new Map<ModuleName, (typeof configs)[number]>();
    configs.forEach((c) => map.set(c.module_name, c));
    return map;
  }, [configs]);

  const submoduleConfigs = useMemo(() => {
    const map = new Map<ModuleName, SubmoduleConfig>();
    configs.forEach((c) => {
      map.set(c.module_name, parseSubmoduleConfig(c.submodule_config));
    });
    return map;
  }, [configs]);

  return { configs, enabledModules, configByName, submoduleConfigs, isLoading, error, branchId };
}

/** Verifica si un módulo específico está habilitado para la sucursal activa. */
export function useIsModuleEnabled(moduleName: ModuleName | null | undefined): boolean {
  const { enabledModules, isLoading } = useBranchModules();
  if (moduleName === null || moduleName === undefined) return true;
  if (isLoading) return true; // evita parpadeo durante carga
  return enabledModules.has(moduleName);
}

/** Verifica si un submódulo específico está habilitado dentro de un módulo compuesto. */
export function useIsSubmoduleEnabled(
  compositeName: ModuleName | null | undefined,
  submoduleName: ModuleName | null | undefined,
): boolean {
  const { submoduleConfigs, isLoading } = useBranchModules();
  if (compositeName === null || compositeName === undefined) return true;
  if (submoduleName === null || submoduleName === undefined) return true;
  if (isLoading) return true;
  return isSubmoduleEnabled(compositeName, submoduleName, submoduleConfigs.get(compositeName) ?? {});
}

/** Verifica si el módulo asociado a una ruta está habilitado. */
export function useIsRouteModuleEnabled(pathname: string): boolean {
  const { enabledModules, isLoading } = useBranchModules();
  if (isLoading) return true;
  return isModuleEnabled(getModuleForPath(pathname), enabledModules);
}
