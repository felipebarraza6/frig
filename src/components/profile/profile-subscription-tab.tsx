"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  History,
  Store,
  Settings2,
  CreditCard,
  ShieldAlert,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionStore, useIsSuperAdmin } from "@/lib/store/session";
import { fetchBranch } from "@/lib/api/branches";
import {
  cancelBranchSubscription,
  fetchBranchSubscriptionHistory,
  type BranchSubscriptionHistoryItem,
} from "@/lib/api/module-plans";
import { useToast } from "@/lib/store/toast";
import { ApplyPlanDialog } from "@/components/branches/apply-plan-dialog";
import { CommercialPlansPanel } from "@/components/plans/commercial-plans-panel";
import { useSubscriptionLock } from "@/lib/hooks/useSubscriptionLock";
import {
  isBranchSubscriptionActive,
  isPlanExpirationPast,
  subscriptionLockTitle,
} from "@/lib/subscription";
import type { Branch } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}/.exec(iso)?.[0] ?? iso;
  const t = new Date(dateOnly).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 86_400_000);
}

/** Texto de vigencia: evita “indefinida” cuando el plan está activo sin término. */
function subscriptionPeriodLabel(
  branch: Branch,
  current: BranchSubscriptionHistoryItem | null,
  status: string | null,
): string {
  if (status === "CANCELLED") return "Suscripción cancelada";
  if (!branch.plan && !current) return "Sin plan contratado";

  const start = current?.start_date;
  const end = branch.plan_expiration_date || current?.end_date || null;
  const parts: string[] = [];
  if (start) parts.push(`Vigente desde ${formatDate(start)}`);
  if (end) {
    parts.push(`Vence el ${formatDate(end)}`);
  } else if (status === "ACTIVE" || branch.plan) {
    parts.push(start ? "sin fecha de término" : "Plan activo");
  }
  return parts.length > 0 ? parts.join(" · ") : "Plan activo";
}

const SUBSCRIPTION_STATUS_META: Record<
  string,
  { label: string; className: string; ring: string }
> = {
  ACTIVE: {
    label: "Activo",
    className: "bg-success/10 text-success",
    ring: "ring-success/30",
  },
  EXPIRED: {
    label: "Expirado",
    className: "bg-danger/10 text-danger",
    ring: "ring-danger/30",
  },
  CANCELLED: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground",
    ring: "ring-border",
  },
  PENDING: {
    label: "Pendiente",
    className: "bg-warning/10 text-warning",
    ring: "ring-warning/30",
  },
};

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl bg-background/50 px-3 py-2.5 text-center">
      <p className="truncate text-sm font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

export function ProfileSubscriptionTab() {
  const user = useSessionStore((s) => s.user);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const assignments = user?.branch_assignments ?? [];
  const isSuperAdmin = useIsSuperAdmin();
  const { locked, reason: lockReason, canManageSubscription } = useSubscriptionLock();
  const queryClient = useQueryClient();

  const [selectedBranchId, setSelectedBranchId] = useState<number | string>(
    currentBranchId ?? assignments[0]?.branch_id ?? "",
  );
  const [adminApplyOpen, setAdminApplyOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const toast = useToast();

  const cancelMutation = useMutation({
    mutationFn: () => cancelBranchSubscription(Number(selectedBranchId)),
    onSuccess: () => {
      toast.success("Suscripción cancelada");
      setConfirmCancel(false);
      queryClient.invalidateQueries({ queryKey: ["branch", selectedBranchId] });
      queryClient.invalidateQueries({
        queryKey: ["branch-subscriptions", selectedBranchId],
      });
    },
    onError: (err: Error) =>
      toast.error(err.message || "No se pudo cancelar la suscripción"),
  });

  const { data: branch, isLoading: loadingBranch } = useQuery({
    queryKey: ["branch", selectedBranchId],
    queryFn: () => fetchBranch(selectedBranchId),
    enabled: !!selectedBranchId,
  });

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ["branch-subscriptions", selectedBranchId],
    queryFn: () => fetchBranchSubscriptionHistory(selectedBranchId),
    enabled: !!selectedBranchId && canManageSubscription,
  });

  if (!selectedBranchId) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <Store className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Sin sucursal seleccionada</p>
      </div>
    );
  }

  const apiStatus = (branch?.subscription_status ?? "").toUpperCase() || null;
  const currentSubscription =
    history?.find((h) => (h.status ?? "").toUpperCase() === "ACTIVE") ?? null;
  const endDate =
    branch?.plan_expiration_date || currentSubscription?.end_date || null;
  const startDate = currentSubscription?.start_date || null;
  const isExpired = isPlanExpirationPast(endDate);
  const daysLeft = daysUntil(endDate);
  const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

  const subscriptionStatus = !isBranchSubscriptionActive({
    plan: branch?.plan,
    plan_expiration_date: endDate,
    subscription_status: branch?.subscription_status,
  })
    ? apiStatus && apiStatus !== "ACTIVE"
      ? apiStatus
      : isExpired
        ? "EXPIRED"
        : null
    : (currentSubscription?.status ?? apiStatus ?? "ACTIVE").toUpperCase();

  const statusMeta = subscriptionStatus
    ? SUBSCRIPTION_STATUS_META[subscriptionStatus]
    : null;
  const planTitle =
    branch?.commercial_plan?.display_name ??
    branch?.plan_name ??
    "Sin plan activo";
  const priceUf = branch?.commercial_plan?.price_uf;
  const branchTitle =
    branch?.business_name ?? branch?.fantasy_name ?? branch?.branch_name ?? "Sucursal";

  const vigenciaStat = endDate
    ? daysLeft !== null && daysLeft >= 0
      ? `${daysLeft}d`
      : formatDateShort(endDate)
    : subscriptionStatus === "ACTIVE"
      ? "Vigente"
      : "—";

  return (
    <div className="flex flex-col gap-5">
      {assignments.length > 1 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">Sucursal a gestionar</p>
          <div className="flex flex-wrap gap-1.5">
            {assignments.map((a) => {
              if (a.branch_id == null) return null;
              const id = String(a.branch_id);
              const selected = String(selectedBranchId) === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedBranchId(a.branch_id as number | string)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {a.branch_name ?? `Sucursal ${a.branch_id}`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loadingBranch ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : branch ? (
        <article
          className={cn(
            "relative overflow-hidden rounded-2xl border border-border/70 p-5",
            statusMeta?.ring ? `ring-1 ${statusMeta.ring}` : "",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Plan de la sucursal
              </p>
              <h3 className="mt-1 truncate text-xl font-semibold tracking-tight">
                {planTitle}
              </h3>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {branchTitle}
                {priceUf != null ? ` · ${priceUf} UF` : ""}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                statusMeta?.className ?? "bg-muted text-muted-foreground",
              )}
            >
              {statusMeta?.label ?? (subscriptionStatus || "Inactivo")}
            </span>
          </div>

          <div className="mt-4 flex gap-2">
            <MiniStat
              label="Inicio"
              value={startDate ? formatDateShort(startDate) : "—"}
            />
            <MiniStat label="Vigencia" value={vigenciaStat} />
            <MiniStat
              label="Precio"
              value={priceUf != null ? `${priceUf} UF` : "—"}
            />
          </div>

          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {subscriptionPeriodLabel(branch, currentSubscription, subscriptionStatus)}
            </span>
          </p>

          {(locked || isExpired || expiringSoon) && (
            <p
              className={cn(
                "mt-3 rounded-xl px-3 py-2 text-xs font-medium",
                locked || isExpired
                  ? "bg-danger/10 text-danger"
                  : "bg-warning/10 text-warning",
              )}
            >
              {locked && lockReason
                ? `${subscriptionLockTitle(lockReason)}. Elige un plan abajo y contrátalo: se activa al confirmar el pago.`
                : isExpired
                  ? "El plan de esta sucursal venció. Contrata de nuevo abajo."
                  : `El plan vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"}.`}
            </p>
          )}

          {canManageSubscription &&
            (branch.plan || subscriptionStatus === "ACTIVE") && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                {confirmCancel ? (
                  <>
                    <p className="w-full text-xs text-muted-foreground">
                      Se desactivan los módulos de extensión. La sucursal queda
                      bloqueada hasta un nuevo plan.
                    </p>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate()}
                    >
                      Confirmar cancelación
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmCancel(false)}
                    >
                      Volver
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmCancel(true)}
                  >
                    <Ban className="mr-1.5 h-3.5 w-3.5" />
                    Cancelar suscripción
                  </Button>
                )}
                {isSuperAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAdminApplyOpen(true)}
                  >
                    <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                    Aplicar plan (admin)
                  </Button>
                )}
              </div>
            )}
        </article>
      ) : null}

      {!canManageSubscription ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-8 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Contacta a tu administrador</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              La suscripción es a nivel de sucursal. Solo el propietario puede
              contratar el plan.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <CreditCard className="h-4 w-4" />
                Planes
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Nombre, precio y contratar. El plan se activa al confirmar el pago.
              </p>
            </div>
            <CommercialPlansPanel
              mode="subscribe"
              currentPlanName={
                branch?.commercial_plan?.display_name ?? branch?.plan_name
              }
              currentPlanId={branch?.commercial_plan?.plan_id}
              existingBranchId={selectedBranchId}
              onCheckoutPaid={() => {
                queryClient.invalidateQueries({
                  queryKey: ["branch", selectedBranchId],
                });
                queryClient.invalidateQueries({
                  queryKey: ["branch-subscriptions", selectedBranchId],
                });
              }}
              checkoutPrefill={{
                business_name:
                  branch?.business_name ||
                  branch?.fantasy_name ||
                  branch?.branch_name ||
                  undefined,
                contact_name:
                  [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
                  undefined,
                email:
                  (typeof user?.email === "string" && user.email) || undefined,
              }}
              footerNote="Contrata con el botón Contratar. El plan se activa al confirmar el pago."
            />
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4" />
              Historial
            </h3>
            {loadingHistory ? (
              <Skeleton className="h-32 w-full rounded-2xl" />
            ) : history && history.length > 0 ? (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{h.plan_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateShort(h.start_date)} – {formatDateShort(h.end_date)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        SUBSCRIPTION_STATUS_META[h.status]?.className ??
                          "bg-muted text-muted-foreground",
                      )}
                    >
                      {SUBSCRIPTION_STATUS_META[h.status]?.label ?? h.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No hay historial disponible.
              </p>
            )}
          </div>
        </>
      )}

      {adminApplyOpen && branch && isSuperAdmin && (
        <ApplyPlanDialog
          branch={branch}
          onClose={() => setAdminApplyOpen(false)}
          onApplied={() => {
            setAdminApplyOpen(false);
            queryClient.invalidateQueries({ queryKey: ["branch", selectedBranchId] });
            queryClient.invalidateQueries({
              queryKey: ["branch-subscriptions", selectedBranchId],
            });
          }}
        />
      )}
    </div>
  );
}
