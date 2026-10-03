"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useSessionStore } from "@/lib/store/session";
import { fetchFrontendConfig } from "@/lib/api/frontend-config";
import { fetchBranchTheme, applyThemeConfig } from "@/lib/api/branches";
import { getBranchId, setBranchId, clearBranchId } from "@/lib/api/session-storage";
import { setBranchApiScope } from "@/lib/api/branch-scope";
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

/** IDs de sucursal (branch_id, no el id del BranchUser) a las que el usuario tiene acceso. */
export function accessibleBranchIds(user: User | null, branches: Branch[]): Set<string> {
  const ids = new Set<string>();
  for (const a of user?.branch_assignments ?? []) {
    if (a.branch_id != null && a.is_active !== false) ids.add(String(a.branch_id));
  }
  for (const b of branches ?? []) {
    if (b.branch_id != null) ids.add(String(b.branch_id));
  }
  return ids;
}

/**
 * Antes de pedir frontend-config tras un login: descarta la sucursal guardada
 * en localStorage (`frig.branch_id`) si no pertenece al usuario recién
 * autenticado (p. ej. quedó de otra demo/sesión) y fija la sucursal objetivo.
 *
 * Sin esto, todas las requests salían con un X-Branch-ID ajeno y el backend
 * respondía 403 en cada módulo ("sin suscripción activa"/"sin acceso a la
 * sucursal") aunque el usuario tuviera acceso completo a su propia sucursal.
 */
export function reconcileStoredBranch(
  user: User | null,
  branches: Branch[],
  target: string | null,
): void {
  setBranchApiScope(null);
  const isSuperAdmin = !!user && (user.is_superuser === true || user.type_user === "ADM");
  const allowed = accessibleBranchIds(user, branches);
  const stored = getBranchId();
  // Superadmin accede a todas las sucursales: su selección previa es válida.
  if (stored && !isSuperAdmin && !allowed.has(stored)) clearBranchId();
  if (target) setBranchId(target);
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
  // Super admin: black puro — nunca aplica el tema de la sucursal activada.
  const user = useSessionStore.getState().user;
  if (user?.is_superuser || user?.type_user === "ADM") {
    useSessionStore.getState().setTheme(null);
  } else {
    try {
      const theme = await fetchBranchTheme(branchId);
      if (theme) {
        useSessionStore.getState().setTheme(theme);
        applyThemeConfig(theme);
      }
    } catch {
      // tema no crítico
    }
  }
  if (queryClient) await queryClient.invalidateQueries();
}
