"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, CreditCard, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import {
  fetchModulePlans,
  applyBranchPlan,
  cancelBranchSubscription,
} from "@/lib/api/module-plans";
import type { ApplyPlanResponse } from "@/lib/api/types/modules";
import { isFrigPlanName } from "@/lib/plans";
import { useToast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";
import type { Branch } from "@/lib/types";

interface PlanOption {
  id: number;
  name: string;
  description?: string;
}

interface ApplyPlanDialogProps {
  branch: Branch;
  onClose: () => void;
  /** Recibe la respuesta del apply (vacío cuando fue una cancelación). */
  onApplied?: (res?: ApplyPlanResponse) => void;
}

/**
 * Cambia el plan de una sucursal, renueva su vencimiento o cancela la
 * suscripción. El catálogo de planes de módulos es superadmin; si el usuario
 * actual no puede listarlo, se ofrece al menos la renovación/edición de
 * vencimiento del plan actual de la sucursal.
 */
export function ApplyPlanDialog({ branch, onClose, onApplied }: ApplyPlanDialogProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [endDate, setEndDate] = useState<string>(
    (branch.plan_expiration_date ?? "").slice(0, 10),
  );
  const [confirmCancel, setConfirmCancel] = useState(false);

  const currentPlanId = branch.plan != null ? Number(branch.plan) : null;

  const { data: plans = [], isLoading, isError } = useQuery({
    queryKey: ["module-plans"],
    queryFn: fetchModulePlans,
    retry: false,
  });

  const options = useMemo<PlanOption[]>(() => {
    // Catálogo compartido: solo se ofrecen los planes frig; los demás son de
    // otras apps del mismo backend.
    const frigPlans = plans.filter((p) => isFrigPlanName(p.name));
    if (frigPlans.length > 0) {
      return frigPlans.map((p) => ({ id: p.id, name: p.name, description: p.description ?? undefined }));
    }
    // Fallback: solo el plan actual (permite renovar / editar vencimiento).
    if (currentPlanId != null && !Number.isNaN(currentPlanId)) {
      return [
        {
          id: currentPlanId,
          name: branch.plan_name ?? "Plan actual",
          description: "Plan actual de la sucursal",
        },
      ];
    }
    return [];
  }, [plans, currentPlanId, branch.plan_name]);

  const apply = useMutation({
    mutationFn: () => applyBranchPlan(Number(branch.branch_id), selectedPlanId!, endDate || undefined),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["module-plans"] });
      onApplied?.(res);
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancel = useMutation({
    mutationFn: () => cancelBranchSubscription(Number(branch.branch_id)),
    onSuccess: () => {
      onApplied?.();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const catalogUnavailable = !isLoading && (isError || plans.length === 0);

  return (
    <AnimatedOverlay
      open={true}
      onClose={onClose}
      className="bg-black/50"
      panelClassName="flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Editar plan</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          Sucursal: <strong>{branch.branch_name ?? branch.business_name}</strong>
          {branch.plan_name && (
            <>
              {" "}— plan actual: <strong>{branch.plan_name}</strong>
            </>
          )}
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
        ) : options.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay planes disponibles para esta sucursal.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <label className="text-sm font-medium">Plan</label>
            <div className="flex flex-col gap-2">
              {options.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={cn(
                    "flex flex-col rounded-lg border px-3 py-2 text-left transition-colors",
                    selectedPlanId === plan.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  )}
                >
                  <span className="text-sm font-medium">
                    {plan.name}
                    {plan.id === currentPlanId && (
                      <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        actual
                      </span>
                    )}
                  </span>
                  {plan.description && (
                    <span className="text-xs text-muted-foreground">{plan.description}</span>
                  )}
                </button>
              ))}
            </div>
            {catalogUnavailable && (
              <p className="text-[11px] text-muted-foreground">
                Catálogo no disponible para tu usuario: solo puedes renovar o ajustar el
                vencimiento del plan actual.
              </p>
            )}

            <label className="mt-2 text-sm font-medium">Fecha de término (opcional)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />

            <div className="mt-2 flex items-center justify-between gap-2">
              {currentPlanId != null ? (
                confirmCancel ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">¿Cancelar suscripción?</span>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => cancel.mutate()}
                      isLoading={cancel.isPending}
                    >
                      Sí, cancelar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>
                      No
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    onClick={() => setConfirmCancel(true)}
                  >
                    <Ban className="mr-1 h-3.5 w-3.5" />
                    Cancelar suscripción
                  </Button>
                )
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cerrar
                </Button>
                <Button
                  onClick={() => apply.mutate()}
                  disabled={!selectedPlanId}
                  isLoading={apply.isPending}
                >
                  {selectedPlanId === currentPlanId ? "Guardar" : "Aplicar plan"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatedOverlay>
  );
}
