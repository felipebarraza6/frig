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
  "/reports": "nutrition",
  "/cash-register": "cash_register",
  "/cash-register/stations": "cash_register",
  "/kds": "production",
  "/kds/monitor": "production",
  "/kds/terminal": "production",
  "/products": "product_catalog",
  "/products/combos": "product_catalog",
  "/products/modifiers": "product_catalog",
  "/products/menus": "public_catalog",
  "/products/nutrition": "nutrition",
  "/categories": "product_catalog",
  "/warehouses": "inventory",
  "/inventory": "inventory",
  "/tables": "tables",
  "/tables/map": "tables",
  "/customers": "customers",
  "/promotions/discounts": "promotions",
  "/payments": "payment_methods",
  "/payment-methods": "payment_methods",
  "/tax-documents": "invoices",
  "/quotations": "sales",
  "/banks": "bank_accounts",
  "/bank-accounts": "bank_accounts",
  "/reconciliations": "bank_accounts",
  "/revenues": "finance",
  "/expenses": "finance",
  "/finance": "finance",
  "/fixed-expenses": "finance",
  "/finance/settings": "finance",
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
 *
 * Cada módulo usado por la app debe estar aquí o en FRIG_ALWAYS_ON_MODULES:
 * si falta de ambas listas, la ruta/menú que lo consume queda bloqueada
 * (fail-closed) sin forma de activarlo desde la UI.
 */
export const FRIG_SETTINGS_MODULES: ModuleName[] = [
  "pos",
  "cash_register",
  "tables",
  "deliveries",
  "production",
  "inventory",
  "nutrition",
  "public_catalog",
  "invoices",
  "promotions",
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
  /** Nombre del icono Lucide del grupo (para getIcon). */
  icon: string;
  items: FrigMenuItem[];
}

/**
 * Estructura completa del menú de Frig.
 * Cada grupo agrupa rutas funcionales; cada ítem declara el módulo del que depende.
 */
export const FRIG_MENU_DEF: FrigMenuGroup[] = [
  {
    title: "Operaciones",
    icon: "LayoutDashboard",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", module: "dashboard", description: "Resumen general del negocio en tiempo real" },
      { href: "/pos", label: "Punto de Venta (POS)", icon: "Receipt", module: "pos", description: "Terminal de venta, cuentas abiertas y cobros" },
      { href: "/cash-register", label: "Caja", icon: "Banknote", module: "cash_register", description: "Apertura, cierre y movimientos de caja" },
      { href: "/sales", label: "Ventas", icon: "ShoppingBag", module: "sales", description: "Historial de ventas y cuentas abiertas" },
      { href: "/kds", label: "Cocina", icon: "ChefHat", module: "production", badge: "kitchenReady", description: "Pantalla de cocina (KDS) y estaciones" },
    ],
  },
  {
    title: "Sala",
    icon: "Table",
    items: [
      { href: "/tables", label: "Mesas", icon: "Table", module: "tables", description: "Estado y cuentas de las mesas" },
      { href: "/tables/map", label: "Mapa de mesas", icon: "Table", module: "tables", description: "Vista en plano para asignar mesas" },
    ],
  },
  {
    title: "Productos",
    icon: "Package",
    items: [
      { href: "/products", label: "Productos", icon: "Package", module: "product_catalog", description: "Catálogo, precios y disponibilidad" },
      { href: "/products/combos", label: "Combos", icon: "Boxes", module: "product_catalog", description: "Agrupa productos con precio especial" },
      { href: "/products/modifiers", label: "Modificadores", icon: "ListChecks", module: "product_catalog", description: "Opciones y agregados por producto" },
      { href: "/categories", label: "Categorías", icon: "Tags", module: "product_catalog", description: "Organiza el catálogo por categorías" },
      { href: "/products/nutrition", label: "Etiquetado nutricional", icon: "Apple", module: "nutrition", description: "Tablas nutricionales por producto" },
      { href: "/reports", label: "Informe nutricional", icon: "FileText", module: "nutrition", description: "Productos más vendidos e insumos consumidos" },
      { href: "/products/menus", label: "Menús digitales", icon: "QrCode", module: "public_catalog", description: "Cartas QR públicas por estación" },
    ],
  },
  {
    title: "Inventario",
    icon: "Warehouse",
    items: [
      { href: "/warehouses", label: "Bodegas", icon: "Warehouse", module: "inventory", description: "Bodegas y sus responsables" },
      { href: "/inventory", label: "Inventario", icon: "ClipboardList", module: "inventory", description: "Stock por bodega y movimientos" },
    ],
  },
  {
    title: "Clientes",
    icon: "Users",
    items: [
      { href: "/customers", label: "Clientes", icon: "UserCircle", module: "customers", description: "Base de clientes y su historial" },
      { href: "/promotions/discounts", label: "Promociones", icon: "Percent", module: "promotions", description: "Descuentos y códigos promocionales" },
    ],
  },
  {
    title: "Compras",
    icon: "ShoppingCart",
    items: [
      { href: "/suppliers", label: "Proveedores", icon: "Truck", module: "suppliers", description: "Directorio de proveedores" },
      { href: "/purchase-orders", label: "Órdenes de compra", icon: "ShoppingCart", module: "suppliers", description: "Pedidos a proveedores y su recepción" },
      { href: "/fixed-expenses", label: "Gastos", icon: "TrendingDown", module: "finance", description: "Gastos fijos y programados" },
    ],
  },
  {
    title: "Pagos",
    icon: "CreditCard",
    items: [
      { href: "/payments", label: "Pagos", icon: "Banknote", module: "payment_methods", description: "Ingresos, egresos y transacciones unificadas" },
      { href: "/payment-methods", label: "Métodos de pago", icon: "CreditCard", module: "payment_methods", description: "Configura medios de pago de la sucursal" },
    ],
  },
  {
    title: "Finanzas",
    icon: "Landmark",
    items: [
      { href: "/revenues", label: "Ingresos", icon: "ArrowDownLeft", module: "finance", description: "Registro de ingresos del negocio" },
      { href: "/expenses", label: "Egresos", icon: "ArrowUpRight", module: "finance", description: "Registro de egresos del negocio" },
      { href: "/tax-documents", label: "Documentos tributarios", icon: "FileText", module: "invoices", description: "Boletas, facturas y SII" },
      { href: "/finance/settings", label: "Config. financiera", icon: "Settings", module: "finance", description: "Impuestos y configuración financiera" },
    ],
  },
  {
    title: "Billeteras",
    icon: "Wallet",
    items: [
      { href: "/bank-accounts", label: "Cuentas bancarias", icon: "Wallet", module: "bank_accounts", description: "Cuentas y saldos bancarios" },
      { href: "/reconciliations", label: "Conciliaciones", icon: "ArrowLeftRight", module: "bank_accounts", description: "Cuadra movimientos con el banco" },
    ],
  },
  {
    title: "Configuración",
    icon: "Settings",
    items: [
      { href: "/users", label: "Usuarios", icon: "UserIcon", module: "config", description: "Usuarios y sus roles por sucursal" },
      { href: "/branches", label: "Sucursales", icon: "Store", module: "config", description: "Sucursales del negocio y su equipo" },
      { href: "/settings/modules", label: "Módulos", icon: "Settings", module: "config", description: "Activa o desactiva módulos por sucursal" },
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
