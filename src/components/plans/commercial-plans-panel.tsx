"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { fetchPlans, type GroupPlanPublic } from "@/lib/api/checkout";
import { useApp } from "@/lib/app-context";
import { formatPlanPriceUf, matchCommercialPlan } from "@/lib/plans";
import { CheckoutModal } from "@/components/landing/checkout-modal";
import type { LandingPlan } from "@/content/landing";
import { cn } from "@/lib/utils";

export interface CommercialPlansPanelProps {
  /** Nombre del plan de módulos activo en la sucursal (para marcar la tarjeta). */
  currentPlanName?: string | null;
  /** Texto bajo la parrilla. */
  footerNote?: string;
  /**
   * `subscribe`: el dueño puede contratar (abre el mismo checkout de la landing).
   * `readonly`: solo muestra precios (equipo / no propietario).
   */
  mode?: "readonly" | "subscribe";
  /** Prefill del checkout (negocio / correo del dueño logueado). */
  checkoutPrefill?: {
    business_name?: string;
    contact_name?: string;
    email?: string;
    website?: string;
  };
  /** Sucursal actual: checkout autenticado (no crea org nueva). */
  existingBranchId?: number | string | null;
  currentPlanId?: string | null;
  onCheckoutPaid?: () => void;
  className?: string;
}

function toLandingPlan(plan: GroupPlanPublic): LandingPlan {
  const features = Array.isArray(plan.features)
    ? plan.features.filter((f): f is string => typeof f === "string")
    : [];
  return {
    id: plan.plan_id,
    name: plan.display_name,
    tagline: plan.description || "",
    priceUf: plan.price_uf,
    resources: features,
    highlighted: plan.highlighted,
    badge: plan.badge,
  };
}

/**
 * Parrilla del catálogo comercial público (mismos planes que la landing).
 * En modo subscribe, "Contratar" abre el checkout de pago: el plan se activa
 * al comprar, no con apply-plan de superadmin.
 */
export function CommercialPlansPanel({
  currentPlanName,
  footerNote,
  mode = "readonly",
  checkoutPrefill,
  existingBranchId,
  currentPlanId,
  onCheckoutPaid,
  className,
}: CommercialPlansPanelProps) {
  const { checkoutGroup } = useApp();
  const [selected, setSelected] = useState<LandingPlan | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-plans", checkoutGroup],
    queryFn: () => fetchPlans(checkoutGroup),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const plans = useMemo(
    () =>
      (data?.plans ?? [])
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [data?.plans],
  );

  const current = matchCommercialPlan(plans, currentPlanName, currentPlanId);
  const integrationUf = data?.integration_uf ?? 0;

  const defaultFooter =
    mode === "subscribe"
      ? "Al contratar se abre el pago. El plan se activa cuando el pago se confirma."
      : "La suscripción es a nivel de sucursal. Solo el propietario puede contratar.";

  if (isLoading) {
    return (
      <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError || plans.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border px-4 py-8 text-center",
          className,
        )}
      >
        <CreditCard className="mx-auto h-7 w-7 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">No pudimos cargar los planes</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Revisa tu conexión o vuelve a intentar en unos minutos.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((plan) => (
          <CommercialPlanCard
            key={plan.plan_id}
            plan={plan}
            isCurrent={current?.plan_id === plan.plan_id}
            canSubscribe={mode === "subscribe"}
            onSubscribe={() => setSelected(toLandingPlan(plan))}
          />
        ))}
      </div>
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{footerNote ?? defaultFooter}</span>
      </p>

      {selected && (
        <CheckoutModal
          plan={selected}
          integrationUf={
            typeof integrationUf === "number" ? integrationUf : Number(integrationUf) || 0
          }
          initialValues={checkoutPrefill}
          existingBranchId={existingBranchId ?? undefined}
          onPaid={onCheckoutPaid}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function CommercialPlanCard({
  plan,
  isCurrent,
  canSubscribe,
  onSubscribe,
}: {
  plan: GroupPlanPublic;
  isCurrent: boolean;
  canSubscribe: boolean;
  onSubscribe: () => void;
}) {
  const priceLabel = formatPlanPriceUf(plan.price_uf);
  const canPay = plan.price_uf != null;

  return (
    <article
      className={cn(
        "relative flex flex-col rounded-xl border p-4 transition-colors",
        isCurrent
          ? "border-primary bg-primary/5"
          : plan.highlighted
            ? "border-primary/40 bg-card"
            : "border-border bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold">{plan.display_name}</h4>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {isCurrent && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Actual
            </span>
          )}
          {plan.badge && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {plan.badge}
            </span>
          )}
        </div>
      </div>
      <p className="mt-3 text-lg font-bold tabular-nums">{priceLabel}</p>
      {canSubscribe && (
        <div className="mt-4 pt-1">
          {isCurrent ? (
            <p className="text-center text-[11px] font-medium text-muted-foreground">
              Este es tu plan actual
            </p>
          ) : canPay ? (
            <Button type="button" size="sm" className="w-full" onClick={onSubscribe}>
              Contratar
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" className="w-full" onClick={onSubscribe}>
              Solicitar
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
