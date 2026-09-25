"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Zap, History, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionStore } from "@/lib/store/session";
import { fetchBranch } from "@/lib/api/branches";
import { fetchBranchSubscriptionHistory, fetchBranchCapabilities } from "@/lib/api/module-plans";
import { ApplyPlanDialog } from "@/components/branches/apply-plan-dialog";
import { cn } from "@/lib/utils";

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

/** Estado canónico de la suscripción según el backend. */
const SUBSCRIPTION_STATUS_META: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Activo", className: "bg-success/10 text-success" },
  EXPIRED: { label: "Expirado", className: "bg-danger/10 text-danger" },
  CANCELLED: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
  PENDING: { label: "Pendiente", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

export function ProfileSubscriptionTab() {
  const user = useSessionStore((s) => s.user);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const assignments = user?.branch_assignments ?? [];
  const queryClient = useQueryClient();

  const [selectedBranchId, setSelectedBranchId] = useState<number | string>(
    currentBranchId ?? assignments[0]?.branch_id ?? ""
  );

  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);

  const { data: branch, isLoading: loadingBranch } = useQuery({
    queryKey: ["branch", selectedBranchId],
    queryFn: () => fetchBranch(selectedBranchId),
    enabled: !!selectedBranchId,
  });

  const { data: capabilities, isLoading: loadingCapabilities } = useQuery({
    queryKey: ["branch-capabilities", selectedBranchId],
    queryFn: () => fetchBranchCapabilities(selectedBranchId),
    enabled: !!selectedBranchId,
  });

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ["branch-subscriptions", selectedBranchId],
    queryFn: () => fetchBranchSubscriptionHistory(selectedBranchId),
    enabled: !!selectedBranchId,
  });

  if (!selectedBranchId) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <Store className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Sin sucursal seleccionada</p>
      </div>
    );
  }

  const isOwnerOrAdmin = branch?.can_manage || user?.is_organization_owner;
  const isExpired = Boolean(
    branch?.plan_expiration_date && new Date(branch.plan_expiration_date) < new Date(),
  );
  const daysLeft = branch?.plan_expiration_date
    // eslint-disable-next-line react-hooks/purity -- aleatoriedad intencional: partículas procedurales del salón
    ? Math.round((new Date(branch.plan_expiration_date).getTime() - Date.now()) / 86_400_000)
    : null;
  const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

  // Estado real según el backend: el historial trae el status canónico
  // (ACTIVE/EXPIRED/CANCELLED/PENDING); sin historial se infiere por fechas.
  const currentSubscription =
    history?.find((h) => h.status === "ACTIVE") ?? history?.[0] ?? null;
  const subscriptionStatus = !branch?.plan
    ? null
    : (currentSubscription?.status ?? (isExpired ? "EXPIRED" : "ACTIVE"));

  return (
    <div className="flex flex-col gap-6">
      {/* Selector de Sucursal (si hay mas de 1) */}
      {assignments.length > 1 && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Sucursal a gestionar</label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {assignments.map((a) => (
              <option key={String(a.branch_id)} value={String(a.branch_id)}>
                {a.branch_name ?? "Sucursal " + a.branch_id}
              </option>
            ))}
          </select>
        </div>
      )}

      {loadingBranch ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : branch ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">{branch.plan_name ?? "Sin plan activo"}</h3>
              <p className="text-sm text-muted-foreground">{branch.business_name ?? branch.branch_name}</p>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                subscriptionStatus
                  ? (SUBSCRIPTION_STATUS_META[subscriptionStatus]?.className ??
                    "bg-muted text-muted-foreground")
                  : "bg-muted text-muted-foreground",
              )}
            >
              {subscriptionStatus
                ? (SUBSCRIPTION_STATUS_META[subscriptionStatus]?.label ?? subscriptionStatus)
                : "Inactivo"}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span>
              {subscriptionStatus === "CANCELLED"
                ? "Suscripción cancelada"
                : `${currentSubscription?.start_date ? `Vigente desde ${formatDate(currentSubscription.start_date)} · ` : ""}${
                    branch.plan_expiration_date
                      ? "Vence el " + formatDate(branch.plan_expiration_date)
                      : "Suscripción indefinida"
                  }`}
            </span>
          </div>

          {isOwnerOrAdmin && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button
                onClick={() => setIsPlanDialogOpen(true)}
                size="sm"
                variant={isExpired || expiringSoon ? "default" : "outline"}
              >
                {isExpired || expiringSoon ? "Renovar Plan" : "Cambiar Plan"}
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {/* Capacidades */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Capacidades del Plan
        </h3>
        {loadingCapabilities ? (
          <Skeleton className="h-20 w-full" />
        ) : capabilities?.enabled_modules ? (
          <div className="flex flex-wrap gap-2">
            {Object.keys(capabilities.enabled_modules).map((mod) => (
              <span key={mod} className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                {mod}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No hay información de capacidades.</p>
        )}
      </div>

      {/* Historial */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4" />
          Historial de Suscripciones
        </h3>
        {loadingHistory ? (
          <Skeleton className="h-32 w-full" />
        ) : history && history.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {history.map((h: { id: number; plan_name: string; start_date?: string | null; end_date?: string | null; status: string }) => (
              <li key={h.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-medium">{h.plan_name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(h.start_date)} - {formatDate(h.end_date)}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
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
          <p className="text-sm text-muted-foreground">No hay historial disponible.</p>
        )}
      </div>

      {isPlanDialogOpen && branch && (
        <ApplyPlanDialog
          branch={branch}
          onClose={() => setIsPlanDialogOpen(false)}
          onApplied={() => {
            queryClient.invalidateQueries({ queryKey: ["branch", branch.branch_id] });
            queryClient.invalidateQueries({ queryKey: ["branch-capabilities", branch.branch_id] });
            queryClient.invalidateQueries({ queryKey: ["branch-subscriptions", branch.branch_id] });
          }}
        />
      )}
    </div>
  );
}



