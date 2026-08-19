import { apiFetch } from "./client";
import type { FrontendConfigResponse } from "@/lib/api/types/modules";

/**
 * GET /api/shared/frontend-config/
 *
 * Punto de entrada único para inicializar el frontend. Devuelve usuario,
 * sucursales, rol, menú ya filtrado, módulos habilitados, dashboard y
 * feature flags.
 */
export async function fetchFrontendConfig(branchId?: number): Promise<FrontendConfigResponse> {
  const qs = new URLSearchParams();
  if (branchId) qs.set("branch_id", String(branchId));
  const query = qs.toString();
  return apiFetch<FrontendConfigResponse>(
    `/shared/frontend-config/${query ? `?${query}` : ""}`,
  );
}
