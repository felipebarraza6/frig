"use client";

import { useBranchModulesState } from "@/lib/store/session";
import { getModuleForPath } from "@/lib/modules";

/**
 * Verifica si el módulo asociado a una ruta está habilitado según
 * frontend-config (session.modules). Usa ROUTE_MODULE_MAP como fallback.
 *
 * Devuelve true mientras carga para evitar parpadeo.
 */
export function useIsRouteModuleEnabled(pathname: string): boolean {
  const modules = useBranchModulesState();
  const moduleName = getModuleForPath(pathname);
  if (moduleName === null || moduleName === undefined) return true;
  return modules[moduleName]?.is_enabled ?? false;
}
