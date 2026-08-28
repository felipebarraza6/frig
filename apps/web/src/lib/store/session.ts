"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useMemo } from "react";
import type { Branch, BranchAssignment, BranchThemeConfig, User } from "@/lib/types";
import { setBranchId, clearBranchId } from "@/lib/api/session-storage";
import type {
  FrontendConfigResponse,
  FrontendMenuGroup,
  FrontendModuleState,
} from "@/lib/api/types/modules";

export interface SessionPermissions {
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
  menu: FrontendMenuGroup[];
  modules: Record<string, FrontendModuleState>;
  dashboard: string | null;
  featureFlags: Record<string, boolean>;
  hasHydrated: boolean;
  setSession: (user: User, branches: Branch[], permissions?: SessionPermissions | null) => void;
  setFrontendConfig: (config: FrontendConfigResponse, branchId?: ID_STR) => void;
  setUser: (user: User) => void;
  setCurrentBranch: (branchId: ID_STR) => void;
  setTheme: (theme: BranchThemeConfig | null) => void;
  setPermissions: (permissions: SessionPermissions | null) => void;
  /** Actualiza el estado de un módulo tras un toggle, para que el menú y los gates reaccionen al instante. */
  setModuleState: (moduleName: string, state: FrontendModuleState) => void;
  clearSession: () => void;
  setHasHydrated: (v: boolean) => void;
}

type ID_STR = string;

/**
 * Normaliza la ruta de inicio devuelta por frontend-config. El backend puede
 * enviarla como string o como objeto con la ruta en alguna de estas claves;
 * si no se puede resolver a un string, devuelve null para usar el fallback.
 */
export function normalizeDashboardRoute(value: unknown): string | null {
  if (typeof value === "string") {
    return value || null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["pathname", "path", "route", "href", "url", "slug"]) {
      const v = record[key];
      if (typeof v === "string" && v) return v;
    }
  }
  return null;
}

/**
 * Filtra grupos de menú sin `items` válido que el backend pueda enviar
 * (por ejemplo grupos solo con título). Mantiene el contrato de
 * FrontendMenuGroup: grupos con un array de items.
 */
export function sanitizeMenu(menu: unknown): FrontendMenuGroup[] {
  if (!Array.isArray(menu)) return [];
  const groups = menu.filter(
    (g): g is FrontendMenuGroup =>
      !!g && typeof g === "object" && Array.isArray(g.items),
  );
  return groups.map((g) => ({ title: g.title ?? "", items: g.items }));
}

/**
 * Normaliza el campo `modules` de frontend-config a un mapa
 * `{ [module_name]: { is_enabled, submodule_config } }`.
 *
 * El backend puede enviarlo en cualquiera de estas formas:
 * 1. `{ enabled: [...], disabled: [...], permissions: {...} }`  ← forma real actual
 * 2. `{ [module_name]: { is_enabled, submodule_config } }`       ← contrato tipado
 * 3. Array de BranchModuleConfiguration con `module_name`
 */
export function normalizeModules(raw: unknown): Record<string, FrontendModuleState> {
  const out: Record<string, FrontendModuleState> = {};
  if (!raw || typeof raw !== "object") return out;

  const toState = (rec: Record<string, unknown>): FrontendModuleState => {
    const sub = rec.submodule_config;
    return {
      is_enabled: rec.is_enabled === true,
      ...(sub && typeof sub === "object" && !Array.isArray(sub)
        ? { submodule_config: sub as Record<string, boolean> }
        : {}),
    };
  };

  // Forma 1: { enabled: [...], disabled: [...], permissions: {...} }
  // Nota: `permissions` trae read/write/delete por módulo, no configuración de
  // submódulos; se ignora para no contaminar `submodule_config` (antes se
  // guardaba como tal, lo que hacía ilegibles los checks de submódulos).
  if (Array.isArray((raw as { enabled?: unknown }).enabled)) {
    const r = raw as { enabled?: string[]; disabled?: string[] };
    for (const mod of r.enabled ?? []) {
      out[mod] = { is_enabled: true };
    }
    for (const mod of r.disabled ?? []) {
      out[mod] = { is_enabled: false };
    }
    return out;
  }

  // Forma 3: array de BranchModuleConfiguration
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const name =
        typeof rec.module_name === "string"
          ? rec.module_name
          : typeof rec.name === "string"
            ? rec.name
            : undefined;
      if (!name) continue;
      out[name] = toState(rec);
    }
    return out;
  }

  // Forma 2: objeto { [module_name]: { is_enabled, ... } }
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object") continue;
    out[key] = toState(value as Record<string, unknown>);
  }
  return out;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      branches: [],
      currentBranchId: null,
      theme: null,
      permissions: null,
      menu: [],
      modules: {},
      dashboard: null,
      featureFlags: {},
      hasHydrated: false,
      setSession: (user, branches, permissions = null) =>
        set({ user, branches, currentBranchId: null, permissions }),
      setFrontendConfig: (config, branchId) => {
        if (branchId) {
          setBranchId(branchId);
        }
        set({
          user: config.user,
          branches: config.branches,
          currentBranchId: branchId ?? String(config.current_branch?.branch_id ?? config.branches[0]?.branch_id ?? ""),
          permissions: config.permissions ?? null,
          menu: sanitizeMenu(config.menu),
          modules: normalizeModules(config.modules),
          dashboard: normalizeDashboardRoute(config.dashboard),
          featureFlags: config.feature_flags ?? {},
        });
      },
      setUser: (user) => set({ user }),
      setCurrentBranch: (branchId) => {
        setBranchId(branchId);
        set({ currentBranchId: branchId });
      },
      setTheme: (theme) => set({ theme }),
      setPermissions: (permissions) => set({ permissions }),
      setModuleState: (moduleName, state) =>
        set((s) => ({ modules: { ...s.modules, [moduleName]: state } })),
      clearSession: () => {
        clearBranchId();
        if (typeof window !== "undefined") {
          localStorage.removeItem("frig.session");
        }
        set({
          user: null,
          branches: [],
          currentBranchId: null,
          theme: null,
          permissions: null,
          menu: [],
          modules: {},
          dashboard: null,
          featureFlags: {},
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
        menu: s.menu,
        modules: s.modules,
        dashboard: s.dashboard,
        featureFlags: s.featureFlags,
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

/** Comprueba si el usuario tiene privilegios de administrador global o superusuario. */
export function isUserAdminOrSuperuser(user: User | null): boolean {
  return Boolean(user && (user.is_superuser || user.type_user === "ADM"));
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
  if (isUserAdminOrSuperuser(user)) return true;
  return ["OWNER", "ADMIN_LOCAL", "MANAGER"].includes(currentRole ?? "");
}

/** True si el usuario puede ver la gestión de sucursales (super admin / OWNER / ADMIN_LOCAL). */
export function useCanViewBranches(): boolean {
  const user = useSessionStore((s) => s.user);
  if (!user) return false;
  if (isUserAdminOrSuperuser(user)) return true;
  return user.branch_assignments?.some((a) =>
    ["OWNER", "ADMIN_LOCAL"].includes(normalizeRole(a.role_code) ?? ""),
  ) ?? false;
}

/** True si el usuario puede gestionar (crear/editar) sucursales (super admin / OWNER). */
export function useCanManageBranches(): boolean {
  const user = useSessionStore((s) => s.user);
  if (!user) return false;
  if (isUserAdminOrSuperuser(user)) return true;
  return user.branch_assignments?.some((a) => normalizeRole(a.role_code) === "OWNER") ?? false;
}

/** True si el usuario puede gestionar inventario, productos y categorías. */
export function useCanManageInventory(): boolean {
  const user = useSessionStore((s) => s.user);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const currentRole = useCurrentBranchRole();
  if (!user || !currentBranchId) return false;
  if (isUserAdminOrSuperuser(user)) return true;
  return ["OWNER", "ADMIN_LOCAL", "MANAGER"].includes(currentRole ?? "");
}

/** True si el usuario puede gestionar clientes (CRM). */
export function useCanManageCustomers(): boolean {
  const user = useSessionStore((s) => s.user);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const currentRole = useCurrentBranchRole();
  if (!user || !currentBranchId) return false;
  if (isUserAdminOrSuperuser(user)) return true;
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
  if (isUserAdminOrSuperuser(user)) return false;
  return ["ADMIN_LOCAL", "CAJERO", "WAITER"].includes(currentRole ?? "");
}

/** True si el usuario es superadmin (is_superuser o type_user === "ADM"). */
export function useIsSuperAdmin(): boolean {
  const user = useSessionStore((s) => s.user);
  return isUserAdminOrSuperuser(user);
}

/** True si el rol activo es OWNER. */
export function useIsOwner(): boolean {
  return useCurrentBranchRole() === "OWNER";
}

/** True si el usuario tiene más de una sucursal asignada (o es superadmin). */
export function useCanSwitchBranch(): boolean {
  const user = useSessionStore((s) => s.user);
  if (!user) return false;
  if (isUserAdminOrSuperuser(user)) return true;
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

/** True si el usuario puede ver el histórico completo de cajas (administradores). */
export function useCanViewCashRegisterHistory(): boolean {
  const user = useSessionStore((s) => s.user);
  const currentRole = useCurrentBranchRole();
  if (!user) return false;
  if (isUserAdminOrSuperuser(user)) return true;
  return ["OWNER", "ADMIN_LOCAL", "MANAGER"].includes(currentRole ?? "");
}

/** True si el usuario puede registrar ingresos/retiros de caja (OWNER o super admin). */
export function useCanManageCashMovements(): boolean {
  const user = useSessionStore((s) => s.user);
  const currentRole = useCurrentBranchRole();
  if (!user) return false;
  if (isUserAdminOrSuperuser(user)) return true;
  return currentRole === "OWNER";
}

/**
 * True si el cajero debe estar restringido a su estación asignada
 * en el histórico de cajas.
 */
export function useCashierStationOnly(): boolean {
  const user = useSessionStore((s) => s.user);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const currentRole = useCurrentBranchRole();
  if (!user || !currentBranchId) return false;
  if (isUserAdminOrSuperuser(user)) return false;
  if (currentRole !== "CAJERO") return false;
  const assignment = user.branch_assignments?.find(
    (a) => String(a.branch_id) === currentBranchId,
  );
  return !!assignment?.station_id;
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
  if (isUserAdminOrSuperuser(user)) return true;
  return ["OWNER", "ADMIN_LOCAL", "MANAGER"].includes(currentRole ?? "");
}

/** True si el usuario puede ver mesas (y usarlas en POS). */
export function useCanViewTables(): boolean {
  const user = useSessionStore((s) => s.user);
  const currentRole = useCurrentBranchRole();
  if (!user) return false;
  if (isUserAdminOrSuperuser(user)) return true;
  return ["OWNER", "ADMIN_LOCAL", "MANAGER", "WAITER", "CAJERO"].includes(currentRole ?? "");
}

/** Menú filtrado devuelto por frontend-config. */
export function useMenu(): FrontendMenuGroup[] {
  return useSessionStore((s) => s.menu);
}

/** Módulos y submódulos habilitados devueltos por frontend-config. */
export function useBranchModulesState(): Record<string, FrontendModuleState> {
  return useSessionStore((s) => s.modules);
}

/** Estado de un módulo específico según frontend-config. */
export function useBranchModuleState(moduleName: string | null | undefined): FrontendModuleState | undefined {
  return useSessionStore((s) => (moduleName ? s.modules[moduleName] : undefined));
}

/** True si un módulo está habilitado según frontend-config. */
export function useIsModuleEnabledFromConfig(moduleName: string | null | undefined): boolean {
  return useSessionStore((s) => {
    if (!moduleName) return true;
    return s.modules[moduleName]?.is_enabled ?? false;
  });
}

/**
 * True si un submódulo está habilitado dentro de un módulo compuesto.
 * Requiere que el módulo padre esté activo y que el submódulo aparezca como
 * `true` en `submodule_config`.
 */
export function useIsSubmoduleEnabledFromConfig(
  moduleName: string | null | undefined,
  submoduleName: string | null | undefined,
): boolean {
  return useSessionStore((s) => {
    if (!moduleName || !submoduleName) return false;
    const mod = s.modules[moduleName];
    if (!mod?.is_enabled) return false;
    return mod.submodule_config?.[submoduleName] === true;
  });
}

/**
 * True si el módulo/submódulo de recetas está habilitado.
 * Recipes es un módulo core en Frig: siempre está disponible.
 */
export function useIsRecipesEnabled(): boolean {
  // Recipes es un módulo core en Frig: siempre está disponible.
  return true;
}


/**
 * True si el módulo de nutrición está habilitado.
 * El etiquetado nutricional y la página `/products/nutrition` dependen de este
 * módulo. Recetas e ingredientes están siempre disponibles.
 *
 * Importante: si bien el módulo compuesto `nutrition` puede estar activo,
 * los submódulos `recipes` e `ingredients` también deben estar habilitados
 * para que la página funcione. Devuelve `false` si falta alguno de los
 * dos, alineando el chequeo con el que usa el backend.
 */
export function useIsNutritionEnabled(): boolean {
  return useSessionStore((s) => {
    const mod = s.modules["nutrition"];
    if (!mod?.is_enabled) return false;
    const subs = mod.submodule_config ?? {};
    return subs["recipes"] !== false && subs["ingredients"] !== false;
  });
}

/** Feature flags devueltos por frontend-config. */
export function useFeatureFlag(flag: string): boolean {
  return useSessionStore((s) => s.featureFlags[flag] ?? false);
}

/** Ruta de inicio configurada por el backend. */
export function useDashboardRoute(): string {
  return useSessionStore((s) => s.dashboard ?? "/dashboard");
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
  if (isUserAdminOrSuperuser(user)) return true;
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
  "/pos",
  "/pos/terminal",
  "/cash-register",
  "/kds",
  "/sales",
  "/profile",
];

const WAITER_ALLOWED_PATHS = [
  "/pos",
  "/pos/terminal",
  "/cash-register",
  "/sales",
  "/products",
  "/products/combos",
  "/categories",
  "/warehouses",
  "/inventory",
  "/tables",
  "/tables/map",
  "/customers",
  "/suppliers",
  "/purchase-orders",
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