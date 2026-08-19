"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchModulePlans, applyBranchPlan } from "@/lib/api/module-plans";
import { useToast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";
import type { Branch } from "@/lib/types";

interface ApplyPlanDialogProps {
  branch: Branch;
  onClose: () => void;
  onApplied?: () => void;
}

export function ApplyPlanDialog({ branch, onClose, onApplied }: ApplyPlanDialogProps) {
  const toast = useToast();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [endDate, setEndDate] = useState<string>("");

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["module-plans"],
    queryFn: fetchModulePlans,
  });

  const apply = useMutation({
    mutationFn: () => applyBranchPlan(Number(branch.id), selectedPlanId!, endDate || undefined),
    onSuccess: (res) => {
      toast.success(`Plan ${res.plan_name} aplicado a ${branch.branch_name ?? branch.business_name}`);
      onApplied?.();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Aplicar plan</h2>
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
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : plans.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay planes disponibles.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <label className="text-sm font-medium">Plan</label>
            <div className="flex flex-col gap-2">
              {plans.map((plan) => (
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
                  <span className="text-sm font-medium">{plan.name}</span>
                  {plan.description && (
                    <span className="text-xs text-muted-foreground">{plan.description}</span>
                  )}
                </button>
              ))}
            </div>

            <label className="mt-2 text-sm font-medium">Fecha de término (opcional)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />

            {selectedPlan && (
              <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                <p><strong>Módulos:</strong> {String(selectedPlan.modules_count)}</p>
                <p><strong>Tipos de producto:</strong> {String(selectedPlan.product_types_count)}</p>
              </div>
            )}

            <div className="mt-2 flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                onClick={() => apply.mutate()}
                disabled={!selectedPlanId || apply.isPending}
              >
                {apply.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Aplicar plan
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
