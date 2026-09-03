"use client";

import { useBranchModulesState } from "@/lib/store/session";
import type { FrontendModuleState } from "@/lib/api/types/modules";
import { getModuleForPath, FRIG_ALWAYS_ON_MODULES } from "@/lib/modules";

/** Módulos de ruta que en Frig dependen de que POS esté habilitado. */
const POS_DEPENDENT_ROUTE_MODULES = new Set<string>(["cash_register"]);

/**
 * Verifica si una ruta está permitida según el estado de módulos dado.
 * Versión pura de `useIsRouteModuleEnabled` para usar sobre listas
 * (ej. filtrar temas de ayuda sin invocar un hook por ítem).
 *
 * - Rutas no mapeadas: siempre permitidas.
 * - Módulos always-on de Frig: siempre permitidos (ignoran el estado del backend).
 * - Resto: requiere `is_enabled === true` explícito. Si no viene del
 *   backend, se bloquea (evita el fallback permisivo).
 * - En Frig, Caja/Estaciones POS requieren que POS esté habilitado.
 */
export function isPathModuleEnabled(
  pathname: string,
  modules: Record<string, FrontendModuleState | undefined>,
): boolean {
  const moduleName = getModuleForPath(pathname);
  if (moduleName === null || moduleName === undefined) return true;
  if (FRIG_ALWAYS_ON_MODULES.includes(moduleName)) return true;
  if (modules[moduleName]?.is_enabled !== true) return false;
  if (POS_DEPENDENT_ROUTE_MODULES.has(moduleName) && modules["pos"]?.is_enabled !== true) return false;
  return true;
}

/**
 * Verifica si el módulo asociado a una ruta está habilitado según
 * frontend-config (session.modules). Usa ROUTE_MODULE_MAP como fallback.
 *
 * Devuelve true mientras carga para evitar parpadeo (session.modules
 * empieza vacío hasta que llega frontend-config).
 */
export function useIsRouteModuleEnabled(pathname: string): boolean {
  const modules = useBranchModulesState();
  return isPathModuleEnabled(pathname, modules);
}
