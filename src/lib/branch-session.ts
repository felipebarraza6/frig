"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useSessionStore } from "@/lib/store/session";
import { fetchFrontendConfig } from "@/lib/api/frontend-config";
import { fetchBranchTheme, applyThemeConfig } from "@/lib/api/branches";
import type { Branch, User } from "@/lib/types";

/**
 * Sucursal con la que entrar a la app: la asignada por defecto (activa),
 * la primera activa, o la primera disponible. Null si no hay ninguna.
 */
export function pickDefaultBranchId(user: User | null, branches: Branch[]): string | null {
  const assignments = user?.branch_assignments ?? [];
  const chosen =
    assignments.find((a) => a.is_default && a.is_active) ??
    assignments.find((a) => a.is_active) ??
    assignments[0];
  if (chosen?.branch_id != null) return String(chosen.branch_id);
  const first = branches?.[0];
  return first ? String(first.branch_id ?? first.id) : null;
}

/**
 * Activa una sucursal para TODA la app: repite frontend-config (módulos, menú,
 * rol activo), reaplica el tema de marca y, si se pasa queryClient, marca todas
 * las queries de React Query como stale para que repitan fetch con el nuevo
 * header X-Branch-ID. El header se lee en cada request desde localStorage
 * (ver src/lib/api/client.ts), así que cualquier request posterior —incluidos
 * los POST— sale ya con la sucursal nueva.
 */
export async function activateBranch(branchId: string, queryClient?: QueryClient): Promise<void> {
  const config = await fetchFrontendConfig(Number(branchId));
  useSessionStore.getState().setFrontendConfig(config, branchId);
  try {
    const theme = await fetchBranchTheme(branchId);
    if (theme) {
      useSessionStore.getState().setTheme(theme);
      applyThemeConfig(theme);
    }
  } catch {
    // tema no crítico
  }
  if (queryClient) await queryClient.invalidateQueries();
}
