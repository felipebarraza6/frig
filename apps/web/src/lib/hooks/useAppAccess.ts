"use client";

import { useQuery } from "@tanstack/react-query";
import { checkAppAccess } from "@/lib/api/app-status";

/**
 * Hook para verificar acceso a una app/ruta específica via
 * GET /api/shared/app-status/check-app-access/{app_name}/
 *
 * Útil como doble chequeo antes de renderizar una funcionalidad puntual.
 */
export function useAppAccess(appName: string, options?: { enabled?: boolean }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["app-access", appName],
    queryFn: () => checkAppAccess(appName),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
  });

  return {
    allowed: data?.allowed ?? false,
    reason: data?.reason,
    isLoading,
    error,
  };
}
