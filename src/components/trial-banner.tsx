"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { fetchBillingStatus } from "@/lib/api/billing-status";
import { useIsSuperAdmin, useSessionStore } from "@/lib/store/session";
import { useSubscriptionLock } from "@/lib/hooks/useSubscriptionLock";

/**
 * Aviso discreto cuando la sucursal está en trial con días restantes.
 * Fuente: GET /plan-checkout/billing-status/ (contrato Yggdra).
 */
export function TrialBanner() {
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const isSuperAdmin = useIsSuperAdmin();
  const { locked } = useSubscriptionLock();

  const { data } = useQuery({
    queryKey: ["billing-status", currentBranchId],
    queryFn: fetchBillingStatus,
    enabled: Boolean(currentBranchId) && !isSuperAdmin && !locked,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!data?.is_trial) return null;
  const days = data.days_remaining;
  if (days == null || days < 0) return null;

  const label =
    days === 0
      ? "Tu prueba termina hoy"
      : days === 1
        ? "Queda 1 día de prueba"
        : `Quedan ${days} días de prueba`;

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-foreground"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Clock className="h-4 w-4 shrink-0 text-warning" aria-hidden />
        <span className="truncate">
          {label}
          {data.end_date ? ` · hasta ${data.end_date}` : ""}.
        </span>
      </span>
      <Link
        href="/profile"
        className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
      >
        Ver suscripción
      </Link>
    </div>
  );
}
