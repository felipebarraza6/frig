"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Branch, BranchThemeConfig, User } from "@/lib/types";
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

/** Rol del usuario en la sucursal activa. */
export function useCurrentBranchRole(): string | undefined {
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const user = useSessionStore((s) => s.user);
  if (!currentBranchId || !user) return undefined;
  return user.branch_assignments?.find(
    (a) => String(a.branch_id) === currentBranchId,
  )?.role_code;
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
    ["OWNER", "ADMIN_LOCAL"].includes(a.role_code ?? ""),
  ) ?? false;
}

/** True si el usuario puede gestionar (crear/editar) sucursales (super admin / OWNER). */
export function useCanManageBranches(): boolean {
  const user = useSessionStore((s) => s.user);
  if (!user) return false;
  if (user.is_superuser || user.type_user === "ADM") return true;
  return user.branch_assignments?.some((a) => a.role_code === "OWNER") ?? false;
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