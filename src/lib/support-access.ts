/**
 * Soporte / feedback siempre visible para cualquier usuario autenticado.
 *
 * No depende de módulos (config/support), plan ni frontend-config: el canal
 * de ayuda del producto debe existir aunque el resto de la app esté
 * restringida (p. ej. suscripción bloqueada).
 */

export const SUPPORT_PATH = "/support";
export const SUPPORT_NAV_LABEL = "Soporte";
export const SUPPORT_FEEDBACK_LABEL = "Soporte / Enviar feedback";

/** Rutas del canal de soporte (hub + ayuda relacionada). */
export const SUPPORT_ALWAYS_ON_PATHS = ["/support", "/help"] as const;

export function isSupportPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return SUPPORT_ALWAYS_ON_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * True si el ítem de menú es el hub de soporte (crear tickets / feedback).
 * Usado para pinearlo fuera de acordeones y para tests de visibilidad.
 */
export function isSupportNavItem(item: { href: string }): boolean {
  return item.href === SUPPORT_PATH || item.href.startsWith(`${SUPPORT_PATH}/`);
}

/**
 * Garantiza que `/support` esté en la lista de navegación aunque el menú
 * filtrado por módulos/roles lo haya omitido (no debería, module:null).
 */
export function ensureSupportNavHref(hrefs: string[]): string[] {
  if (hrefs.some((h) => h === SUPPORT_PATH || h.startsWith(`${SUPPORT_PATH}/`))) {
    return hrefs;
  }
  return [...hrefs, SUPPORT_PATH];
}

export interface SupportNavSeedItem {
  href: string;
  label: string;
  module: string | null;
  description?: string;
}

/** Ítem canónico de Soporte para inyectar en menús. */
export const SUPPORT_NAV_SEED: SupportNavSeedItem = {
  href: SUPPORT_PATH,
  label: SUPPORT_NAV_LABEL,
  module: null,
  description: "Dudas, incidencias, reclamos y feedback al equipo",
};

/**
 * Inserta Soporte en un grupo "Ayuda" o lo crea al final.
 * Idempotente: no duplica si ya está. Preserva campos extra (icon, etc.).
 */
export function ensureSupportInMenuGroups<TGroup extends { title: string; items: Array<{ href: string }> }>(
  groups: TGroup[],
  supportItem: TGroup["items"][number],
  createHelpGroup: (item: TGroup["items"][number]) => TGroup,
): TGroup[] {
  const hasSupport = groups.some((g) => g.items.some((i) => isSupportNavItem(i)));
  if (hasSupport) return groups;

  const helpIdx = groups.findIndex((g) => g.title.toLowerCase() === "ayuda");
  if (helpIdx >= 0) {
    const help = groups[helpIdx]!;
    return groups.map((g, i) =>
      i === helpIdx
        ? ({ ...help, items: [...help.items, supportItem] } as TGroup)
        : g,
    );
  }

  return [...groups, createHelpGroup(supportItem)];
}

/**
 * Acceso a crear tickets: cualquier usuario con sesión activa.
 * No exige OWNER, ni módulo support/config, ni plan.
 */
export function canAccessSupportCreate(session: {
  hasUser: boolean;
}): boolean {
  return session.hasUser;
}

/**
 * Defaults del dock inferior: incluye Soporte para roles no operativos
 * (OWNER/ADMIN/MANAGER) para que no quede solo en el sheet.
 */
export function supportAwareBottomNavHrefs(role: {
  isCashier: boolean;
  isWaiter: boolean;
  isCook: boolean;
}): string[] {
  if (role.isCashier) {
    return ensureSupportNavHref(["/pos", "/cash-register", "/sales", "/profile"]);
  }
  if (role.isWaiter) {
    return ensureSupportNavHref(["/tables", "/pos", "/help", "/profile"]);
  }
  if (role.isCook) {
    return ensureSupportNavHref(["/kds", "/profile"]);
  }
  return ensureSupportNavHref([
    "/dashboard",
    "/sales",
    "/pos",
    "/support",
  ]);
}
