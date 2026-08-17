"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useMemo } from "react";
import type { Branch, BranchAssignment, BranchThemeConfig, User } from "@/lib/types";
import { setBranchId, clearBranchId } from "@/lib/api/session-storage";

interface SessionPermissions {
  user_role?: string;
  enabled_apps?: string[];
  read_only_apps?: string[];
  disabled_apps?: string[];
}

interface SessionState {
  user: User | null;
  branches: Branch[];
  currentBranchId: ID_STR | null;
  theme: BranchThemeConfig | null;
  permissions: SessionPermissions | null;
  hasHydrated: boolean;
  setSession: (user: User, branches: Branch[], permissions?: SessionPermissions | null) => void;
  setUser: (user: User) => void;
  setCurrentBranch: (branchId: ID_STR) => void;
  setTheme: (theme: BranchThemeConfig | null) => void;
  setPermissions: (permissions: SessionPermissions | null) => void;
  setEnabledApps: (apps: string[]) => void;
  clearSession: () => void;
  setHasHydrated: (v: boolean) => void;
}

type ID_STR = string;

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      branches: [],
      currentBranchId: null,
      theme: null,
      permissions: null,
      hasHydrated: false,
      setSession: (user, branches, permissions = null) =>
        set({ user, branches, currentBranchId: null, permissions }),
      setUser: (user) => set({ user }),
      setCurrentBranch: (branchId) => {
        setBranchId(branchId);
        set({ currentBranchId: branchId });
      },
      setTheme: (theme) => set({ theme }),
      setPermissions: (permissions) => set({ permissions }),
      setEnabledApps: (apps) =>
        set((state) => ({
          permissions: {
            ...(state.permissions ?? {}),
            enabled_apps: apps,
          },
        })),
      clearSession: () => {
        clearBranchId();
        set({
          user: null,
          branches: [],
          currentBranchId: null,
          theme: null,
          permissions: null,
        });
      },
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: "frig.session",
      partialize: (s) => ({
        user: s.user,
        branches: s.branches,
        currentBranchId: s.currentBranchId,
        theme: s.theme,
        permissions: s.permissions,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true);
      },
    },
  ),
);

/** Sucursal activa como objeto Branch, o null si no hay sesión/branch. */
export function useCurrentBranch(): Branch | null {
  const branches = useSessionStore((s) => s.branches);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  if (!currentBranchId) return null;
  return branches.find((b) => String(b.branch_id) === currentBranchId) ?? null;
}

function normalizeRole(role?: string | null): string | undefined {
  return role?.trim().toUpperCase() || undefined;
}

/** Rol del usuario en la sucursal activa. */
export function useCurrentBranchRole(): string | undefined {
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const user = useSessionStore((s) => s.user);
  if (!currentBranchId || !user) return undefined;
  const assignment = user.branch_assignments?.find(
    (a) => String(a.branch_id) === currentBranchId,
  );
  return normalizeRole(assignment?.role_code);
}

/** True si el usuario puede gestionar usuarios en la sucursal activa. */
export function useCanManageUsers(): boolean {
  const user = useSessionStore((s) => s.user);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const currentRole = useCurrentBranchRole();
  if (!user || !currentBranchId) return false;
  if (user.is_superuser || user.type_user === "ADM") return true;
  return ["OWNER", "ADMIN_LOCAL", "MANAGER"].includes(currentRole ?? "");
}

/** True si el usuario puede ver la gestión de sucursales (super admin / OWNER / ADMIN_LOCAL). */
export function useCanViewBranches(): boolean {
  const user = useSessionStore((s) => s.user);
  if (!user) return false;
  if (user.is_superuser || user.type_user === "ADM") return true;
  return user.branch_assignments?.some((a) =>
    ["OWNER", "ADMIN_LOCAL"].includes(normalizeRole(a.role_code) ?? ""),
  ) ?? false;
}

/** True si el usuario puede gestionar (crear/editar) sucursales (super admin / OWNER). */
export function useCanManageBranches(): boolean {
  const user = useSessionStore((s) => s.user);
  if (!user) return false;
  if (user.is_superuser || user.type_user === "ADM") return true;
  return user.branch_assignments?.some((a) => normalizeRole(a.role_code) === "OWNER") ?? false;
}

/** True si el usuario puede gestionar inventario, productos y categorías. */
export function useCanManageInventory(): boolean {
  const user = useSessionStore((s) => s.user);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const currentRole = useCurrentBranchRole();
  if (!user || !currentBranchId) return false;
  if (user.is_superuser || user.type_user === "ADM") return true;
  return ["OWNER", "ADMIN_LOCAL", "MANAGER"].includes(currentRole ?? "");
}

/** True si el usuario puede gestionar clientes (CRM). */
export function useCanManageCustomers(): boolean {
  const user = useSessionStore((s) => s.user);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const currentRole = useCurrentBranchRole();
  if (!user || !currentBranchId) return false;
  if (user.is_superuser || user.type_user === "ADM") return true;
  return ["OWNER", "ADMIN_LOCAL", "MANAGER"].includes(currentRole ?? "");
}

/** True si el usuario debe llegar al POS primero (ADMIN_LOCAL / CAJERO / WAITER).
 * OWNER y superadmin entran al dashboard por defecto, pero pueden navegar a POS.
 */
export function useIsPosFirstRole(): boolean {
  const user = useSessionStore((s) => s.user);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const currentRole = useCurrentBranchRole();
  if (!user || !currentBranchId) return false;
  if (user.is_superuser || user.type_user === "ADM") return false;
  return ["ADMIN_LOCAL", "CAJERO", "WAITER"].includes(currentRole ?? "");
}

/** True si el usuario es superadmin (is_superuser o type_user === "ADM"). */
export function useIsSuperAdmin(): boolean {
  const user = useSessionStore((s) => s.user);
  return !!user && (user.is_superuser || user.type_user === "ADM");
}

/** True si el rol activo es OWNER. */
export function useIsOwner(): boolean {
  return useCurrentBranchRole() === "OWNER";
}

/** True si el usuario tiene más de una sucursal asignada (o es superadmin). */
export function useCanSwitchBranch(): boolean {
  const user = useSessionStore((s) => s.user);
  if (!user) return false;
  if (user.is_superuser || user.type_user === "ADM") return true;
  return (user.branch_assignments?.length ?? 0) > 1;
}

/** True si el rol activo es ADMIN_LOCAL. */
export function useIsAdminLocal(): boolean {
  return useCurrentBranchRole() === "ADMIN_LOCAL";
}

/** True si el rol activo es CAJERO. */
export function useIsCashier(): boolean {
  return useCurrentBranchRole() === "CAJERO";
}

/** True si el rol activo es MESERO (WAITER). */
export function useIsWaiter(): boolean {
  return useCurrentBranchRole() === "WAITER";
}

/** True si el usuario puede gestionar mesas (crear/editar/eliminar). */
export function useCanManageTables(): boolean {
  const user = useSessionStore((s) => s.user);
  const currentRole = useCurrentBranchRole();
  if (!user) return false;
  if (user.is_superuser || user.type_user === "ADM") return true;
  return ["OWNER", "ADMIN_LOCAL", "MANAGER"].includes(currentRole ?? "");
}

/** True si el usuario puede ver mesas (y usarlas en POS). */
export function useCanViewTables(): boolean {
  const user = useSessionStore((s) => s.user);
  const currentRole = useCurrentBranchRole();
  if (!user) return false;
  if (user.is_superuser || user.type_user === "ADM") return true;
  return ["OWNER", "ADMIN_LOCAL", "MANAGER", "WAITER", "CAJERO"].includes(currentRole ?? "");
}

/** Verifica si una app está habilitada para la sucursal activa según permisos del backend. */
export function useIsAppEnabled(appName: string): boolean {
  const role = useCurrentBranchRole();
  const user = useSessionStore((s) => s.user);
  const permissions = useSessionStore((s) => s.permissions);
  if (!user) return false;
  if (user.is_superuser || user.type_user === "ADM") return true;
  const enabled = permissions?.enabled_apps ?? [];
  if (enabled.length > 0) {
    return enabled.includes(appName);
  }
  // Fallback si no hay permisos de apps: dejar pasar a roles de gestión.
  return ["OWNER", "ADMIN_LOCAL", "MANAGER"].includes(role ?? "");
}

/** Estación de caja asignada al usuario en la sucursal activa. */
export function useCurrentBranchStation(): BranchAssignment | null {
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const user = useSessionStore((s) => s.user);
  if (!currentBranchId || !user) return null;
  return (
    user.branch_assignments?.find(
      (a) => String(a.branch_id) === currentBranchId,
    ) ?? null
  );
}

/** True si el usuario puede anular una orden específica. Función pura, no hook. */
export function canCancelOrder(
  user: User | null,
  currentRole: string | undefined,
  orderOwnerId?: string | number,
): boolean {
  if (!user) return false;
  if (user.is_superuser || user.type_user === "ADM") return true;
  const role = normalizeRole(currentRole);
  if (["OWNER", "ADMIN_LOCAL"].includes(role ?? "")) return true;
  if (role === "CAJERO") {
    return orderOwnerId !== undefined && String(orderOwnerId) === String(user.id);
  }
  return false;
}

/** Hook: true si el usuario puede anular una orden específica. */
export function useCanCancelOrder(orderOwnerId?: string | number): boolean {
  const user = useSessionStore((s) => s.user);
  const currentRole = useCurrentBranchRole();
  return canCancelOrder(user, currentRole, orderOwnerId);
}

const CASHIER_ALLOWED_PATHS = [
  "/pos/terminal",
  "/cash-register",
  "/kds",
  "/sales",
  "/profile",
];

const WAITER_ALLOWED_PATHS = [
  "/pos/terminal",
  "/tables/map",
  "/sales",
  "/profile",
];

/** Rutas a las que un cajero puede navegar libremente. */
export function useCashierAllowedPaths(): string[] {
  return useMemo(() => CASHIER_ALLOWED_PATHS, []);
}

/** Rutas a las que un mesero puede navegar libremente. */
export function useWaiterAllowedPaths(): string[] {
  return useMemo(() => WAITER_ALLOWED_PATHS, []);
}