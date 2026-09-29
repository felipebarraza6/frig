/**
 * Filtro único de rutas de menú por rol operativo.
 * Usado por sidebar, bottom nav y mobile sheet para evitar drift.
 */

export function isPathAllowed(href: string, allowedPaths: string[]): boolean {
  return allowedPaths.some((p) => href === p || href.startsWith(`${p}/`));
}

export interface NavRoleFilter {
  isCashier: boolean;
  isWaiter: boolean;
  isCook: boolean;
  cashierAllowedPaths: string[];
  waiterAllowedPaths: string[];
  cookAllowedPaths: string[];
}

/** True si el href es visible para el rol actual. */
export function isNavHrefAllowed(href: string, role: NavRoleFilter): boolean {
  if (role.isCashier) return isPathAllowed(href, role.cashierAllowedPaths);
  if (role.isWaiter) {
    // Mesero: el hub /pos redirige al terminal; se deja visible en menú.
    if (href === "/pos") return true;
    return isPathAllowed(href, role.waiterAllowedPaths);
  }
  if (role.isCook) return isPathAllowed(href, role.cookAllowedPaths);
  return true;
}

export function filterNavItemsByRole<T extends { href: string }>(
  items: T[],
  role: NavRoleFilter,
): T[] {
  return items.filter((item) => isNavHrefAllowed(item.href, role));
}

/** Slots del dock inferior (sin contar el botón Menú). */
export const BOTTOM_NAV_SLOTS = 4;

/**
 * Orden preferido de tabs por rol cuando el usuario aún no pinneó favoritos.
 * Se intersecta después con el menú visible/permitido.
 */
export function defaultBottomNavHrefs(role: {
  isCashier: boolean;
  isWaiter: boolean;
  isCook: boolean;
}): string[] {
  if (role.isCashier) {
    return ["/pos", "/cash-register", "/sales", "/profile"];
  }
  if (role.isWaiter) {
    return ["/tables", "/pos", "/customers", "/profile"];
  }
  if (role.isCook) {
    return ["/kds", "/profile"];
  }
  return ["/dashboard", "/sales", "/pos", "/cash-register", "/tables", "/customers"];
}
