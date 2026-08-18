import type { ModuleName, SubmoduleConfig } from "@/lib/api/branch-modules";

/**
 * Mapeo de rutas de Frig al módulo de Yggdra que las controla.
 * `null` significa que la ruta no depende de ningún módulo (siempre visible).
 * Las rutas no listadas se consideran no mapeadas y se permiten por defecto.
 */
export const ROUTE_MODULE_MAP: Record<string, ModuleName | null> = {
  "/dashboard": "dashboard",
  "/pos": "pos",
  "/pos/terminal": "pos",
  "/sales": "sales",
  "/cash-register": "cash_register",
  "/cash-register/stations": "cash_register",
  "/kds": "pos",
  "/kds/monitor": "pos",
  "/kds/terminal": "pos",
  "/products": "products",
  "/products/combos": "products",
  "/products/menus": "public_catalog",
  "/products/nutrition": "nutrition",
  "/categories": "products",
  "/warehouses": "warehouse_management",
  "/inventory": "inventory",
  "/tables": "tables",
  "/tables/map": "tables",
  "/customers": "customers",
  "/promotions/discounts": "promotions",
  "/payment-methods": "payment_methods",
  "/bank-accounts": "bank_accounts",
  "/revenues": "finance",
  "/expenses": "finance",
  "/suppliers": "suppliers",
  "/purchase-orders": "suppliers",
  "/users": "config",
  "/branches": "config",
  "/settings/modules": "config",
  "/profile": null,
};

/** Módulos que el backend trata como compuestos (tienen submódulos opcionales). */
export const COMPOSITE_MODULES: ModuleName[] = ["customers", "inventory", "nutrition"];

/** Submódulos opcionales soportados por cada módulo compuesto. */
export const COMPOSITE_SUBMODULES: Partial<Record<ModuleName, ModuleName[]>> = {
  customers: ["clients"],
  inventory: ["warehouse_management", "products", "stock_control", "product_catalog", "suppliers"],
  nutrition: ["recipes", "ingredients"],
};

export function isCompositeModule(moduleName: ModuleName): boolean {
  return COMPOSITE_MODULES.includes(moduleName);
}

export function getCompositeSubmodules(moduleName: ModuleName): ModuleName[] {
  return COMPOSITE_SUBMODULES[moduleName] ?? [];
}

/** Todos los submódulos conocidos, útil para evitar mostrarlos también como módulos independientes. */
export const ALL_COMPOSITE_SUBMODULES: ModuleName[] = Object.values(COMPOSITE_SUBMODULES).flat();

/** Verifica si un submódulo específico está habilitado dentro de su compuesto. */
export function isSubmoduleEnabled(
  compositeName: ModuleName,
  submoduleName: ModuleName,
  submoduleConfig: SubmoduleConfig,
): boolean {
  if (!isCompositeModule(compositeName)) return false;
  const submodules = getCompositeSubmodules(compositeName);
  if (!submodules.includes(submoduleName)) return false;
  return submoduleConfig[submoduleName] ?? false;
}

const ROUTE_KEYS = Object.keys(ROUTE_MODULE_MAP);

/**
 * Resuelve el módulo asociado a una ruta.
 *
 * - Match exacto primero.
 * - Luego prefix de mayor longitud (ej. /kds/station/123 → /kds/station no existe → /kds).
 * - Si no hay mapeo, devuelve `undefined` (se permite por defecto).
 */
export function getModuleForPath(pathname: string): ModuleName | null | undefined {
  const normalized = pathname.replace(/\/$/, "") || "/";

  if (normalized in ROUTE_MODULE_MAP) {
    return ROUTE_MODULE_MAP[normalized];
  }

  const prefixes = ROUTE_KEYS
    .filter((key) => key !== "/" && normalized.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length);

  if (prefixes.length > 0) {
    return ROUTE_MODULE_MAP[prefixes[0]];
  }

  return undefined;
}

/**
 * Verifica si un módulo está dentro de un set de módulos habilitados.
 * `null` siempre está habilitado (rutas libres de módulo).
 */
export function isModuleEnabled(
  moduleName: ModuleName | null | undefined,
  enabledModules: Set<ModuleName>,
): boolean {
  if (moduleName === null || moduleName === undefined) return true;
  return enabledModules.has(moduleName);
}

/**
 * Módulos que el frontend considera core para Frig y que no deberían poder
 * deshabilitarse desde la UI de configuración.
 */
export const CORE_UI_MODULES: ModuleName[] = [
  "dashboard",
  "config",
  "sales",
  "pos",
  "products",
  "finance",
  "customers",
  "inventory",
  "suppliers",
];
