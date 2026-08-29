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
  "/kds": "production",
  "/kds/monitor": "production",
  "/kds/terminal": "production",
  "/products": "product_catalog",
  "/products/combos": "product_catalog",
  "/products/menus": "public_catalog",
  "/products/nutrition": "nutrition",
  "/categories": "product_catalog",
  "/warehouses": "inventory",
  "/inventory": "inventory",
  "/tables": "tables",
  "/tables/map": "tables",
  "/customers": "customers",
  "/promotions/discounts": "promotions",
  "/payment-methods": "payment_methods",
  "/bank-accounts": "bank_accounts",
  "/reconciliations": "bank_accounts",
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
export const COMPOSITE_MODULES: ModuleName[] = [
  "employees",
  "finance",
  "sales",
  "customers",
  "suppliers",
  "inventory",
  "logistics",
  "services",
  "water_management",
  "nutrition",
  "waste_management",
];

/** Submódulos opcionales soportados por cada módulo compuesto (alineado al backend). */
export const COMPOSITE_SUBMODULES: Partial<Record<ModuleName, ModuleName[]>> = {
  employees: ["payroll"],
  finance: ["payment_methods", "bank_accounts", "cash_register"],
  sales: ["tables"],
  customers: ["promotions", "scheduling"],
  inventory: ["product_gallery", "raw_materials", "certificates", "tariffs", "equipment"],
  logistics: ["deliveries"],
  services: ["memberships", "subscriptions"],
  water_management: ["tariffs", "certificates", "agreements"],
  nutrition: ["recipes", "ingredients"],
  waste_management: ["waste_tariffs", "waste_certificates", "waste_agreements"],
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
 * Nombre del plan fijo de FRIG. Se busca insensible a mayúsculas/minúsculas
 * entre los planes disponibles y se aplica automáticamente al crear una
 * sucursal. Las demás apps (Smart Hydro, etc.) usan otros frontends.
 */
export const FRIG_PLAN_NAME = "Gestión gastronómica/comercial";

/**
 * Módulos que en Frig siempre están activos: no aparecen en /settings/modules
 * y el menú las muestra sin consultar el estado del backend.
 */
export const FRIG_ALWAYS_ON_MODULES: ModuleName[] = [
  "dashboard",
  "config",
  "sales",
  "product_catalog",
  "customers",
  "finance",
  "payment_methods",
  "bank_accounts",
  "suppliers",
  "recipes",
];

/**
 * Módulos que sí aparecen como cards en /settings/modules para activar/desactivar.
 * Todo lo demás se oculta de esa vista.
 */
export const FRIG_SETTINGS_MODULES: ModuleName[] = [
  "pos",
  "tables",
  "production",
  "inventory",
  "nutrition",
  "public_catalog",
];

// ── Definición del menú de Frig ───────────────────────────────────────────────

export interface FrigMenuItem {
  href: string;
  label: string;
  /** Nombre del icono Lucide (para getMenuIcon). */
  icon: string;
  /** Módulo que controla este ítem. Si está en FRIG_ALWAYS_ON_MODULES se muestra
   *  siempre; de lo contrario requiere `is_enabled === true` en el backend. */
  module: ModuleName;
  /** Badge opcional (pedidos pendientes, caja abierta, etc.). */
  badge?: "ordersPending" | "cashOpen" | "kitchenReady";
  /** Descripción corta para tooltip o subtítulo en el menú. */
  description?: string;
}

export interface FrigMenuGroup {
  title: string;
  items: FrigMenuItem[];
}

/**
 * Estructura completa del menú de Frig.
 * Cada grupo agrupa rutas funcionales; cada ítem declara el módulo del que depende.
 */
export const FRIG_MENU_DEF: FrigMenuGroup[] = [
  {
    title: "Operaciones",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", module: "dashboard" },
      { href: "/pos", label: "Punto de Venta (POS)", icon: "Receipt", module: "pos" },
      { href: "/cash-register", label: "Caja", icon: "Banknote", module: "cash_register" },
      { href: "/sales", label: "Ventas", icon: "ShoppingBag", module: "sales", description: "Historial de ventas y cuentas abiertas" },
      { href: "/reports", label: "Informes", icon: "FileText", module: "recipes" },
      { href: "/kds", label: "Cocina", icon: "ChefHat", module: "production", badge: "kitchenReady" },
    ],
  },
  {
    title: "Sala",
    items: [
      { href: "/tables", label: "Mesas", icon: "Table", module: "tables" },
      { href: "/tables/map", label: "Mapa de mesas", icon: "Table", module: "tables" },
    ],
  },
  {
    title: "Productos",
    items: [
      { href: "/products", label: "Productos", icon: "Package", module: "product_catalog" },
      { href: "/products/combos", label: "Combos", icon: "Boxes", module: "product_catalog" },
      { href: "/categories", label: "Categorías", icon: "Tags", module: "product_catalog" },
      { href: "/products/nutrition", label: "Etiquetado nutricional", icon: "Apple", module: "nutrition" },
      { href: "/products/menus", label: "Menús digitales", icon: "QrCode", module: "public_catalog" },
    ],
  },
  {
    title: "Inventario",
    items: [
      { href: "/warehouses", label: "Bodegas", icon: "Warehouse", module: "inventory" },
      { href: "/inventory", label: "Inventario", icon: "ClipboardList", module: "inventory" },
    ],
  },
  {
    title: "Clientes",
    items: [
      { href: "/customers", label: "Clientes", icon: "UserCircle", module: "customers" },
      { href: "/promotions/discounts", label: "Promociones", icon: "Percent", module: "promotions" },
    ],
  },
  {
    title: "Compras",
    items: [
      { href: "/suppliers", label: "Proveedores", icon: "Truck", module: "suppliers" },
      { href: "/purchase-orders", label: "Órdenes de compra", icon: "ShoppingCart", module: "suppliers" },
    ],
  },
  {
    title: "Finanzas",
    items: [
      { href: "/cash-register/stations", label: "Estaciones POS", icon: "Monitor", module: "cash_register" },
      { href: "/payment-methods", label: "Métodos de pago", icon: "CreditCard", module: "payment_methods" },
      { href: "/bank-accounts", label: "Cuentas bancarias", icon: "Landmark", module: "bank_accounts" },
      { href: "/reconciliations", label: "Conciliaciones", icon: "Scale", module: "bank_accounts" },
      { href: "/revenues", label: "Ingresos", icon: "ArrowDownLeft", module: "finance" },
      { href: "/expenses", label: "Egresos", icon: "ArrowUpRight", module: "finance" },
    ],
  },
  {
    title: "Configuración",
    items: [
      { href: "/users", label: "Usuarios", icon: "UserIcon", module: "config" },
      { href: "/branches", label: "Sucursales", icon: "Store", module: "config" },
      { href: "/settings/modules", label: "Módulos", icon: "Settings", module: "config" },
    ],
  },
];

/**
 * Todos los módulos que aparecen en el menú de Frig.
 * Útil para saber qué módulos son relevantes para esta app.
 */
export const FRIG_MODULE_NAMES = Array.from(
  new Set(FRIG_MENU_DEF.flatMap((g) => g.items.map((i) => i.module))),
) as ModuleName[];

// ── Guards de redirección ─────────────────────────────────────────────────────

/** Módulos de ruta que en Frig dependen de que POS esté habilitado. */
const POS_DEPENDENT_ROUTE_MODULES = new Set<string>(["cash_register"]);

/**
 * Dado un conjunto de paths permitidos (p. ej. `CASHIER_ALLOWED_PATHS`) y
 * los módulos habilitados en la sucursal, devuelve el primer path cuyo
 * módulo asociado esté activo. Si ninguno calza, devuelve `null` y el caller
 * puede caer a una ruta neutra (p. ej. `/dashboard`).
 *
 * - Rutas no mapeadas en `ROUTE_MODULE_MAP` se consideran libres de módulo.
 * - Módulos always-on de Frig siempre califican.
 * - Rutas con módulo POS-dependiente (`cash_register`) exigen además que
 *   `pos` esté habilitado.
 *
 * Usado por el layout para evitar el loop: si el cajero está en
 * `/pos/terminal` y `pos` se desactiva, no queremos redirigirlo a
 * `/dashboard` (que también está bloqueada para cajero) ni a otra ruta
 * POS-dependiente caída.
 */
export function firstEnabledAllowedPath(
  allowedPaths: readonly string[],
  enabledModuleNames: ReadonlySet<string>,
): string | null {
  for (const path of allowedPaths) {
    const moduleName = getModuleForPath(path);
    if (moduleName === null || moduleName === undefined) return path;
    if (FRIG_ALWAYS_ON_MODULES.includes(moduleName)) return path;
    if (!enabledModuleNames.has(moduleName)) continue;
    if (
      POS_DEPENDENT_ROUTE_MODULES.has(moduleName) &&
      !enabledModuleNames.has("pos")
    ) {
      continue;
    }
    return path;
  }
  return null;
}

/**
 * Set de módulos habilitados construido a partir del estado del session
 * store (frontend-config). Útil para los guards que necesitan la respuesta
 * rápida del store (sin esperar a la query `branch-modules`).
 */
export function enabledModuleSet(
  modules: Record<string, { is_enabled?: boolean } | undefined>,
): Set<string> {
  const set = new Set<string>();
  for (const [name, state] of Object.entries(modules)) {
    if (state?.is_enabled === true) set.add(name);
  }
  return set;
}
