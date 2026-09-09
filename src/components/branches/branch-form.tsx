"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, Check, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { useSessionStore } from "@/lib/store/session";
import { createBranch, updateBranch } from "@/lib/api/branches";
import { fetchModulePlans, applyBranchPlan } from "@/lib/api/module-plans";
import { FRIG_PLAN_NAME } from "@/lib/modules";
import { isFrigPlanName } from "@/lib/plans";
import { branchName } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Branch, BranchPayload } from "@/lib/types";

interface BranchFormProps {
  branch?: Branch;
  onClose: () => void;
  onSuccess: () => void;
}

/** Duraciones rápidas de etapa de prueba (en días, desde hoy). */
const TRIAL_DAYS = [7, 14, 30];

function trialDate(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

export function BranchForm({ branch, onClose, onSuccess }: BranchFormProps) {
  const user = useSessionStore((s) => s.user);
  const isSuperAdmin = Boolean(user?.is_superuser || user?.type_user === "ADM");
  const isEditing = Boolean(branch);

  const [businessName, setBusinessName] = useState(branch?.business_name ?? "");
  const [fantasyName, setFantasyName] = useState(branch?.fantasy_name ?? "");
  const [commercialBusiness, setCommercialBusiness] = useState(branch?.commercial_business ?? "");
  const [phone, setPhone] = useState(branch?.phone ?? "");
  const [email, setEmail] = useState(branch?.email ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");
  const [region, setRegion] = useState(branch?.region ?? "");
  const [province, setProvince] = useState(branch?.province ?? "");
  const [commune, setCommune] = useState(branch?.commune ?? "");
  const [dni, setDni] = useState(branch?.dni ?? "");
  const [ownerId, setOwnerId] = useState<string>(branch?.owner_id ? String(branch.owner_id) : "");
  const [planId, setPlanId] = useState<string>(branch?.plan ? String(branch.plan) : "");
  // Etapa de prueba: aplica el plan con fecha de término (suscripción finita).
  const [trial, setTrial] = useState(Boolean(branch?.plan_expiration_date));
  const [endDate, setEndDate] = useState((branch?.plan_expiration_date ?? "").slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const { data: plans = [] } = useQuery({
    queryKey: ["module-plans"],
    queryFn: fetchModulePlans,
  });

  // Catálogo compartido: aquí solo se ofrecen los planes frig (prefijo
  // "frig-"); los demás son de otras apps del mismo backend.
  const frigPlans = plans.filter((p) => isFrigPlanName(p.name));

  // Plan sugerido al crear: el plan FRIG de gestión gastronómica/comercial.
  const frigPlan = frigPlans.find(
    (p) => p.name.toLowerCase().includes(FRIG_PLAN_NAME.toLowerCase()),
  );
  const effectivePlanId = planId || (frigPlan ? String(frigPlan.id) : "");
  // Al editar, si la sucursal tiene un plan no-frig, se muestra igual para
  // que no quede una selección vacía con un valor invisible.
  const currentPlanMissing =
    isEditing && effectivePlanId !== "" && !frigPlans.some((p) => String(p.id) === effectivePlanId);

  const save = useMutation({
    mutationFn: async () => {
      // Se crea siempre activa; la baja se hace desde la lista (activar/desactivar).
      const payload: BranchPayload = {
        business_name: businessName,
        fantasy_name: fantasyName || undefined,
        commercial_business: commercialBusiness || undefined,
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        region: region || undefined,
        province: province || undefined,
        commune: commune || undefined,
        dni: dni || undefined,
        is_active: branch?.is_active ?? true,
      };
      if (isSuperAdmin && ownerId) {
        payload.owner_id = Number(ownerId);
      }

      if (isEditing && branch) {
        payload.plan = effectivePlanId ? Number(effectivePlanId) : null;
        const res = await updateBranch(branch.branch_id, payload);
        // Si cambió el plan o se definió una etapa de prueba, se re-aplica con
        // su fecha de término (crea/renueva la suscripción).
        const planChanged = effectivePlanId !== (branch.plan ? String(branch.plan) : "");
        if (effectivePlanId && (planChanged || (trial && endDate))) {
          await applyBranchPlan(
            Number(branch.branch_id),
            Number(effectivePlanId),
            trial ? endDate || undefined : undefined,
          );
        }
        return res;
      }

      const created = await createBranch(payload);
      // Se aplica el plan elegido (por defecto el plan FRIG); con etapa de
      // prueba queda con fecha de término.
      if (effectivePlanId) {
        await applyBranchPlan(
          Number(created.branch_id),
          Number(effectivePlanId),
          trial ? endDate || undefined : undefined,
        );
      }
      return created;
    },
    onSuccess: () => onSuccess(),
    onError: (err: Error) => setError(err.message || "No se pudo guardar la sucursal."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!businessName.trim()) {
      setError("El nombre de la sucursal es obligatorio.");
      return;
    }
    save.mutate();
  };

  return (
    <AnimatedOverlay
      open={true}
      onClose={onClose}
      panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
    >
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-xl md:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">
            {isEditing ? `Editar ${branchName(branch!)}` : "Nueva sucursal"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          id="branch-form"
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {/* Identificación */}
            <div className="space-y-3">
              <SectionLabel>Identificación</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nombre de la sucursal" className="sm:col-span-2">
                  <Input
                    id="business_name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Nombre de fantasía" hint="El nombre comercial que ven los clientes.">
                  <Input
                    id="fantasy_name"
                    value={fantasyName}
                    onChange={(e) => setFantasyName(e.target.value)}
                  />
                </Field>
                <Field label="Giro comercial">
                  <Input
                    id="commercial_business"
                    value={commercialBusiness}
                    onChange={(e) => setCommercialBusiness(e.target.value)}
                    required
                  />
                </Field>
                <Field label="RUT">
                  <Input
                    id="dni"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    placeholder="12.345.678-9"
                  />
                </Field>
                {isSuperAdmin && (
                  <Field label="ID propietario" hint="Dueño de la sucursal. Opcional.">
                    <Input
                      id="owner_id"
                      type="number"
                      value={ownerId}
                      onChange={(e) => setOwnerId(e.target.value)}
                      placeholder="Opcional"
                    />
                  </Field>
                )}
              </div>
            </div>

            {/* Contacto y ubicación */}
            <div className="space-y-3">
              <SectionLabel>Contacto y ubicación</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Teléfono">
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                <Field label="Email">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field label="Dirección" className="sm:col-span-2">
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Región">
                  <Input
                    id="region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Provincia">
                  <Input
                    id="province"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Comuna">
                  <Input
                    id="commune"
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                    required
                  />
                </Field>
              </div>
            </div>

            {/* Plan */}
            <div className="space-y-3">
              <SectionLabel>Plan</SectionLabel>
              <div role="radiogroup" aria-label="Plan de la sucursal" className="grid gap-2 sm:grid-cols-2">
                {currentPlanMissing && (
                  <div
                    role="radio"
                    aria-checked={true}
                    className="rounded-xl border border-dashed border-border p-3 text-left"
                  >
                    <span className="text-sm font-semibold">
                      {branch?.plan_name ?? "Plan actual"} (no frig)
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Plan actual de la sucursal, de otra app.
                    </p>
                  </div>
                )}
                {frigPlans.map((p) => {
                  const selected = effectivePlanId === String(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPlanId(String(p.id))}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{p.name}</span>
                        {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </div>
                      {p.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                      )}
                    </button>
                  );
                })}
                {frigPlans.length === 0 && !currentPlanMissing && (
                  <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                    Cargando planes…
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border p-3">
                <label className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Gift className="h-4 w-4 text-primary" />
                    Etapa de prueba
                  </span>
                  <Switch
                    checked={trial}
                    onCheckedChange={(v) => {
                      setTrial(v);
                      if (v && !endDate) setEndDate(trialDate(14));
                    }}
                    label={trial ? "Con etapa de prueba" : "Sin etapa de prueba"}
                  />
                </label>
                {trial && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-8 w-40"
                      aria-label="Fecha de término de la prueba"
                    />
                    {TRIAL_DAYS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setEndDate(trialDate(d))}
                        className={cn(
                          "rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
                          endDate === trialDate(d)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50",
                        )}
                      >
                        {d} días
                      </button>
                    ))}
                    <p className="w-full text-xs text-muted-foreground">
                      El plan vence en esa fecha; después se puede renovar desde la acción “Plan”.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
            )}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={save.isPending}>
              {isEditing ? "Guardar cambios" : "Crear sucursal"}
            </Button>
          </div>
        </form>
      </div>
    </AnimatedOverlay>
  );
}
