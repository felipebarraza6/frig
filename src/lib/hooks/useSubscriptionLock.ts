"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchBranch } from "@/lib/api/branches";
import {
  useCurrentBranch,
  useCurrentBranchRole,
  useIsSuperAdmin,
  useSessionStore,
} from "@/lib/store/session";
import {
  getSubscriptionLockReason,
  isBranchSubscriptionActive,
  type SubscriptionLockReason,
} from "@/lib/subscription";
import type { Branch } from "@/lib/types";

export interface SubscriptionLockState {
  /** True cuando la sucursal activa no tiene plan operativo (superadmin exento). */
  locked: boolean;
  /** Cargando el detalle de la sucursal para decidir el candado. */
  isLoading: boolean;
  reason: SubscriptionLockReason | null;
  /** OWNER (o superadmin) puede cambiar/cancelar el plan de la sucursal. */
  canManageSubscription: boolean;
  branch: Branch | null;
}

/**
 * Candado de suscripción a nivel de sucursal.
 * Mientras no hay respuesta del detalle, no bloquea (evita flash al entrar).
 */
export function useSubscriptionLock(): SubscriptionLockState {
  const isSuperAdmin = useIsSuperAdmin();
  const role = useCurrentBranchRole();
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const sessionBranch = useCurrentBranch();

  const { data: branch, isLoading, isFetched, isError } = useQuery({
    queryKey: ["branch", currentBranchId],
    queryFn: () => fetchBranch(currentBranchId!),
    enabled: Boolean(currentBranchId) && !isSuperAdmin,
    staleTime: 60_000,
    // Sin retries: un 500 de Postgres no debe triplicar ruido ni conexiones.
    retry: false,
  });

  const effective = (branch ?? sessionBranch) as Branch | null;
  // Solo el propietario de la sucursal (o superadmin) gestiona la suscripción.
  // can_manage también lo tiene ADMIN_LOCAL; no alcanza para cambiar el plan.
  const canManageSubscription = isSuperAdmin || role === "OWNER";

  if (isSuperAdmin || !currentBranchId) {
    return {
      locked: false,
      isLoading: false,
      reason: null,
      canManageSubscription,
      branch: effective,
    };
  }

  // Esperamos el fetch autoritativo (plan / subscription_status vienen del detalle).
  if (!isFetched || isLoading) {
    return {
      locked: false,
      isLoading: true,
      reason: null,
      canManageSubscription,
      branch: effective,
    };
  }

  // Si el detalle falla (API caída / Postgres sin cupo), NO bloqueamos la app:
  // eso generaba ruido (candado falso + redirect a /profile) encima del 500.
  if (isError && !branch) {
    return {
      locked: false,
      isLoading: false,
      reason: null,
      canManageSubscription,
      branch: effective,
    };
  }

  const active = isBranchSubscriptionActive(effective);
  return {
    locked: !active,
    isLoading: false,
    reason: active ? null : getSubscriptionLockReason(effective),
    canManageSubscription,
    branch: effective,
  };
}
