/**
 * Suscripción a nivel de sucursal: sin plan activo la app queda bloqueada
 * salvo el perfil/suscripción. Solo el propietario (OWNER) puede cambiar o
 * cancelar el plan.
 */

export type BranchSubscriptionFields = {
  plan?: unknown;
  plan_name?: string | null;
  plan_expiration_date?: string | null;
  subscription_status?: string | null;
};

export type SubscriptionLockReason = "no_plan" | "expired" | "cancelled" | "pending";

/** Rutas permitidas cuando la sucursal no tiene suscripción activa. */
export const SUBSCRIPTION_LOCK_ALLOWED_PATHS = [
  "/profile",
  "/support",
  "/help",
] as const;

export function isSubscriptionLockAllowedPath(pathname: string): boolean {
  return SUBSCRIPTION_LOCK_ALLOWED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** True si la fecha de vencimiento ya pasó (día completo en UTC). */
export function isPlanExpirationPast(iso?: string | null): boolean {
  if (!iso) return false;
  const dateOnly = /^\d{4}-\d{2}-\d{2}/.exec(iso)?.[0];
  let dueTs: number;
  if (dateOnly) {
    const [y, m, d] = dateOnly.split("-").map(Number);
    dueTs = Date.UTC(y, m - 1, d);
  } else {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return false;
    dueTs = t;
  }
  return Math.round((dueTs - Date.now()) / 86_400_000) < 0;
}

/**
 * Suscripción operativa de la sucursal.
 * Sin `plan`, o con status CANCELLED/EXPIRED/PENDING, o con fecha vencida → inactiva.
 */
export function isBranchSubscriptionActive(
  branch: BranchSubscriptionFields | null | undefined,
): boolean {
  if (!branch) return false;
  const status = (branch.subscription_status ?? "").toUpperCase();
  if (status === "CANCELLED" || status === "EXPIRED" || status === "PENDING") {
    return false;
  }
  if (branch.plan == null || branch.plan === "") return false;
  if (isPlanExpirationPast(branch.plan_expiration_date)) return false;
  return true;
}

export function getSubscriptionLockReason(
  branch: BranchSubscriptionFields | null | undefined,
): SubscriptionLockReason | null {
  if (!branch) return "no_plan";
  if (isBranchSubscriptionActive(branch)) return null;
  const status = (branch.subscription_status ?? "").toUpperCase();
  if (status === "CANCELLED") return "cancelled";
  if (status === "PENDING") return "pending";
  if (status === "EXPIRED" || isPlanExpirationPast(branch.plan_expiration_date)) {
    return "expired";
  }
  return "no_plan";
}

export function subscriptionLockTitle(reason: SubscriptionLockReason): string {
  switch (reason) {
    case "expired":
      return "El plan de esta sucursal venció";
    case "cancelled":
      return "La suscripción está cancelada";
    case "pending":
      return "La suscripción está pendiente";
    default:
      return "Esta sucursal no tiene un plan activo";
  }
}
