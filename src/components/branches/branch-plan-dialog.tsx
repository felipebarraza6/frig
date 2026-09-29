"use client";

import { useState } from "react";
import { CreditCard, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { CommercialPlansPanel } from "@/components/plans/commercial-plans-panel";
import { ApplyPlanDialog } from "@/components/branches/apply-plan-dialog";
import { useIsOwner, useIsSuperAdmin, useSessionStore } from "@/lib/store/session";
import type { Branch } from "@/lib/types";

interface BranchPlanDialogProps {
  branch: Branch;
  onClose: () => void;
  onApplied?: () => void;
}

/**
 * Plan de la sucursal: el propietario contrata con el checkout (pago).
 * Apply-plan de módulos queda solo para superadmin.
 */
export function BranchPlanDialog({ branch, onClose, onApplied }: BranchPlanDialogProps) {
  const isSuperAdmin = useIsSuperAdmin();
  const isOwner = useIsOwner();
  const user = useSessionStore((s) => s.user);
  const canSubscribe = isSuperAdmin || isOwner;
  const [adminApplyOpen, setAdminApplyOpen] = useState(false);

  if (adminApplyOpen && isSuperAdmin) {
    return (
      <ApplyPlanDialog
        branch={branch}
        onClose={() => setAdminApplyOpen(false)}
        onApplied={() => {
          setAdminApplyOpen(false);
          onApplied?.();
          onClose();
        }}
      />
    );
  }

  const checkoutPrefill = {
    business_name: branch.business_name ?? branch.branch_name ?? "",
    contact_name:
      [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
      user?.username ||
      "",
    email: user?.email ?? branch.email ?? "",
  };

  return (
    <AnimatedOverlay
      open={true}
      onClose={onClose}
      className="bg-black/50"
      panelClassName="flex items-center justify-center p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-start gap-2">
            <CreditCard className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Plan de la sucursal</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {branch.branch_name ?? branch.business_name}
                {branch.plan_name ? (
                  <>
                    {" "}
                    · actual: <strong>{branch.plan_name}</strong>
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {canSubscribe ? (
            <CommercialPlansPanel
              mode="subscribe"
              currentPlanName={
                branch.commercial_plan?.display_name ?? branch.plan_name
              }
              currentPlanId={branch.commercial_plan?.plan_id}
              existingBranchId={branch.id}
              checkoutPrefill={checkoutPrefill}
              onCheckoutPaid={onApplied}
            />
          ) : (
            <>
              <CommercialPlansPanel
                mode="readonly"
                currentPlanName={
                  branch.commercial_plan?.display_name ?? branch.plan_name
                }
                currentPlanId={branch.commercial_plan?.plan_id}
              />
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Solo el propietario puede contratar o cancelar el plan. Contacta a tu
                administrador.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          {isSuperAdmin ? (
            <Button variant="outline" size="sm" onClick={() => setAdminApplyOpen(true)}>
              <Settings2 className="mr-1.5 h-3.5 w-3.5" />
              Aplicar plan (admin)
            </Button>
          ) : (
            <span />
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </AnimatedOverlay>
  );
}
