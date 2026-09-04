import { apiFetch } from "./client";
import type { ModuleCatalogResponse } from "@/lib/api/types/modules";

/**
 * GET /api/shared/module-permissions/module-catalog/
 *
 * Catálogo centralizado de módulos. Incluye metadata (label, icono, categoría,
 * si es extensión), módulos compuestos y extensiones.
 */
export async function fetchModuleCatalog(): Promise<ModuleCatalogResponse> {
  return apiFetch<ModuleCatalogResponse>("/shared/module-permissions/module-catalog/");
}
