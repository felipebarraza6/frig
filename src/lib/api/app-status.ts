import { apiFetch } from "./client";
import type { AppAccessResponse } from "@/lib/api/types/modules";

/**
 * GET /api/shared/app-status/check-app-access/{app_name}/
 *
 * Doble chequeo de acceso a una app/ruta específica.
 */
export async function checkAppAccess(appName: string): Promise<AppAccessResponse> {
  return apiFetch<AppAccessResponse>(`/shared/app-status/check-app-access/${appName}/`);
}
