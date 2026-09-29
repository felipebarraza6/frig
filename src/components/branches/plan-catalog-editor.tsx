"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Plus, Save, Trash2, X, GripVertical, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchManageableGroups,
  fetchGroupDetail,
  createGroupPlan,
  updateGroupPlan,
  updateGroup,
  deleteGroupPlan,
  type GroupPlanPayload,
  type PlanGroupDetail,
  type PlanGroupUpdatePayload,
} from "@/lib/api/plan-catalog";
import { fetchModulePlans } from "@/lib/api/module-plans";
import { FRIG_GROUP_SLUG, selectModulePlansForFrig } from "@/lib/plans";
import { useToast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

interface PlanDraft {
  display_name: string;
  description: string;
  features: string[];
  priceText: string;
  badge: string;
  sort_order: number;
  highlighted: boolean;
  is_active: boolean;
  branch_module_plan: number | null;
}

function draftFromPlan(plan: {
  display_name: string;
  description: string;
  features: string[];
  price_uf: string | number | null;
  badge: string | null;
  sort_order: number;
  highlighted: boolean;
  is_active: boolean;
  branch_module_plan: number | null;
}): PlanDraft {
  return {
    display_name: plan.display_name,
    description: plan.description,
    features: [...(plan.features ?? [])],
    priceText: plan.price_uf == null ? "" : String(plan.price_uf),
    badge: plan.badge ?? "",
    sort_order: plan.sort_order,
    highlighted: plan.highlighted,
    is_active: plan.is_active,
    branch_module_plan: plan.branch_module_plan ?? null,
  };
}

function draftToPayload(draft: PlanDraft): GroupPlanPayload {
  return {
    display_name: draft.display_name,
    description: draft.description,
    features: draft.features.map((f) => f.trim()).filter(Boolean),
    price_uf: draft.priceText.trim() === "" ? null : draft.priceText,
    badge: draft.badge.trim() === "" ? null : draft.badge.trim(),
    sort_order: Number(draft.sort_order) || 0,
    highlighted: draft.highlighted,
    is_active: draft.is_active,
    branch_module_plan: draft.branch_module_plan,
  };
}

function FeaturesInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (features: string[]) => void;
}) {
  const rows = value.length > 0 ? value : [""];

  const patchRow = (index: number, text: string) =>
    onChange(rows.map((f, i) => (i === index ? text : f)));
  const removeRow = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const addRow = () => onChange([...rows, ""]);

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((feature, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <span className="select-none text-primary" aria-hidden>
            ✓
          </span>
          <Input
            value={feature}
            onChange={(e) => patchRow(index, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRow();
              }
            }}
            placeholder="Ej: 1 sucursal, 5 usuarios…"
            className="h-8 flex-1"
            aria-label={`Característica ${index + 1}`}
          />
          <button
            type="button"
            onClick={() => removeRow(index)}
            disabled={rows.length === 1 && feature === ""}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-danger disabled:opacity-30"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
      >
        <Plus className="h-3.5 w-3.5" />
        Añadir
      </button>
    </div>
  );
}

/** Card de preview de cómo se verá el plan en la landing. */
function PlanPreview({ draft }: { draft: PlanDraft }) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border p-4 transition-all",
        draft.highlighted
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-background",
        !draft.is_active && "opacity-50",
      )}
    >
      {draft.badge && (
        <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
          {draft.badge}
        </span>
      )}
      <h4 className="text-sm font-bold">{draft.display_name || "Sin nombre"}</h4>
      {draft.description && (
        <p className="mt-1 text-xs text-muted-foreground">{draft.description}</p>
      )}
      <div className="mt-3 flex items-baseline gap-1">
        {draft.priceText ? (
          <>
            <span className="text-2xl font-bold tabular-nums">{draft.priceText}</span>
            <span className="text-xs text-muted-foreground">UF/mes</span>
          </>
        ) : (
          <span className="text-sm italic text-muted-foreground">Precio a consultar</span>
        )}
      </div>
      {draft.features.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {draft.features.filter(Boolean).map((f, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs">
              <span className="mt-0.5 text-primary">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlanCatalogEditor() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [manualSlug, setManualSlug] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<number, Partial<PlanDraft>>>({});
  const [newPlanId, setNewPlanId] = useState("");
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null);

  const { data: allGroups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["plan-groups", "manage"],
    queryFn: fetchManageableGroups,
  });
  const groups = useMemo(
    () => allGroups.filter((g) => g.name === FRIG_GROUP_SLUG),
    [allGroups],
  );

  const selectedSlug = manualSlug ?? (groups.length === 1 ? groups[0].name : null);

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["plan-group", selectedSlug],
    queryFn: () => fetchGroupDetail(selectedSlug!),
    enabled: !!selectedSlug,
  });

  const { data: modulePlans = [] } = useQuery({
    queryKey: ["module-plans"],
    queryFn: () => fetchModulePlans(),
    retry: false,
  });
  const modulePlanOptions = useMemo(
    () => selectModulePlansForFrig(modulePlans),
    [modulePlans],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["plan-group", selectedSlug] });
    queryClient.invalidateQueries({ queryKey: ["plans"] });
    queryClient.invalidateQueries({ queryKey: ["public-plans"] });
    queryClient.invalidateQueries({ queryKey: ["landing-config"] });
  };

  const save = useMutation({
    mutationFn: ({ pk, payload }: { pk: number; payload: GroupPlanPayload }) =>
      updateGroupPlan(selectedSlug!, pk, payload),
    onSuccess: (_res, vars) => {
      setEdits((prev) => {
        const next = { ...prev };
        delete next[vars.pk];
        return next;
      });
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const create = useMutation({
    mutationFn: (planId: string) =>
      createGroupPlan(selectedSlug!, {
        plan_id: planId,
        display_name: planId,
        sort_order: (detail?.plans.length ?? 0) + 1,
      }),
    onSuccess: () => {
      setNewPlanId("");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [confirmDeletePk, setConfirmDeletePk] = useState<number | null>(null);
  const remove = useMutation({
    mutationFn: (pk: number) => deleteGroupPlan(selectedSlug!, pk),
    onSuccess: (_res, pk) => {
      setConfirmDeletePk(null);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[pk];
        return next;
      });
      invalidate();
    },
    onError: (err: Error) => {
      setConfirmDeletePk(null);
      toast.error(err.message);
    },
  });

  const plans = useMemo(
    () => detail?.plans.slice().sort((a, b) => a.sort_order - b.sort_order) ?? [],
    [detail],
  );

  const draftFor = (plan: (typeof plans)[number]): PlanDraft => ({
    ...draftFromPlan(plan),
    ...edits[plan.id],
  });

  const patchDraft = (pk: number, patch: Partial<PlanDraft>) =>
    setEdits((prev) => ({ ...prev, [pk]: { ...prev[pk], ...patch } }));

  if (groupsLoading) {
    return (
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
        <CreditCard className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          No tienes grupos de planes gestionables.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {groups.length > 1 && (
        <div className="mb-4 flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Grupo</label>
          <select
            value={selectedSlug ?? ""}
            onChange={(e) => {
              setManualSlug(e.target.value || null);
              setEdits({});
            }}
            className="h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            <option value="" disabled>
              Selecciona un grupo…
            </option>
            {groups.map((g) => (
              <option key={g.name} value={g.name}>
                {g.display_name || g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedSlug && detailLoading && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      )}

      {selectedSlug && detail && (
        <div className="grid gap-4 lg:grid-cols-2">
          <GroupCopyEditor
            key={`${detail.display_name}|${detail.integration_uf}|${detail.hero_headline}|${detail.pricing_note}`}
            slug={selectedSlug}
            detail={detail}
            onSaved={invalidate}
          />

          {plans.map((plan) => {
            const draft = draftFor(plan);
            const dirty = !!edits[plan.id];
            const isExpanded = expandedPlan === plan.id;

            return (
              <article
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-xl border transition-all",
                  draft.highlighted ? "border-primary/60 shadow-sm" : "border-border",
                  !draft.is_active && "opacity-60",
                )}
              >
                {/* Preview siempre visible */}
                <div className="p-4">
                  <PlanPreview draft={draft} />
                </div>

                {/* Toggle expandir/colapsar editor */}
                <button
                  type="button"
                  onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                  className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                >
                  <span className="flex items-center gap-2">
                    <GripVertical className="h-3.5 w-3.5" />
                    <span className="font-mono">{plan.plan_id}</span>
                    {dirty && (
                      <span className="rounded-full bg-warning/20 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                        Sin guardar
                      </span>
                    )}
                  </span>
                  <span>{isExpanded ? "Ocultar editor" : "Editar plan"}</span>
                </button>

                {/* Editor expandible */}
                {isExpanded && (
                  <div className="flex flex-col gap-3 border-t border-border bg-muted/20 p-4">
                    {/* Visibilidad */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        {draft.is_active ? (
                          <Eye className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                        {draft.is_active ? "Visible en landing" : "Oculto"}
                      </label>
                      <Switch
                        checked={draft.is_active}
                        disabled={save.isPending}
                        onCheckedChange={(v) => {
                          patchDraft(plan.id, { is_active: v });
                          save.mutate({ pk: plan.id, payload: { is_active: v } });
                        }}
                        label="Visibilidad del plan"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Nombre">
                        <Input
                          value={draft.display_name}
                          onChange={(e) => patchDraft(plan.id, { display_name: e.target.value })}
                          className="h-8"
                          placeholder="Emprendimiento"
                        />
                      </Field>
                      <Field label="Precio (UF/mes)">
                        <Input
                          value={draft.priceText}
                          onChange={(e) => patchDraft(plan.id, { priceText: e.target.value })}
                          className="h-8"
                          inputMode="decimal"
                          placeholder="20.00"
                        />
                      </Field>
                      <Field label="Sello" hint="Badge destacado">
                        <Input
                          value={draft.badge}
                          onChange={(e) => patchDraft(plan.id, { badge: e.target.value })}
                          className="h-8"
                          placeholder="MÁS POPULAR"
                        />
                      </Field>
                      <Field label="Orden">
                        <Input
                          type="number"
                          value={draft.sort_order}
                          onChange={(e) =>
                            patchDraft(plan.id, { sort_order: Number(e.target.value) || 0 })
                          }
                          className="h-8 w-20"
                        />
                      </Field>
                      <Field label="Descripción" className="sm:col-span-2">
                        <Input
                          value={draft.description}
                          onChange={(e) => patchDraft(plan.id, { description: e.target.value })}
                          className="h-8"
                          placeholder="Para kioscos y negocios de barrio"
                        />
                      </Field>
                      <Field label="Características" className="sm:col-span-2">
                        <FeaturesInput
                          value={draft.features}
                          onChange={(features) => patchDraft(plan.id, { features })}
                        />
                      </Field>
                      <Field
                        label="Plan de módulos"
                        hint="Se aplica a la sucursal al contratar"
                        className="sm:col-span-2"
                      >
                        <select
                          value={draft.branch_module_plan ?? ""}
                          onChange={(e) =>
                            patchDraft(plan.id, {
                              branch_module_plan: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        >
                          <option value="">Sin vincular</option>
                          {modulePlanOptions.map((mp) => (
                            <option key={mp.id} value={mp.id}>
                              {mp.name}
                            </option>
                          ))}
                          {draft.branch_module_plan != null &&
                            !modulePlanOptions.some((mp) => mp.id === draft.branch_module_plan) && (
                              <option value={draft.branch_module_plan}>
                                Plan #{draft.branch_module_plan} (actual)
                              </option>
                            )}
                        </select>
                      </Field>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      {confirmDeletePk === plan.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-danger">¿Eliminar?</span>
                          <Button
                            size="sm"
                            variant="outline"
                            isLoading={remove.isPending}
                            onClick={() => remove.mutate(plan.id)}
                            className="h-7 border-danger/40 text-danger hover:bg-danger/10"
                          >
                            Sí, eliminar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            onClick={() => setConfirmDeletePk(null)}
                          >
                            No
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePk(plan.id)}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Switch
                            checked={draft.highlighted}
                            onCheckedChange={(v) => patchDraft(plan.id, { highlighted: v })}
                            label="Destacar plan"
                          />
                          Destacado
                        </label>
                        <Button
                          size="sm"
                          isLoading={save.isPending}
                          disabled={!dirty && !save.isPending}
                          onClick={() =>
                            save.mutate({ pk: plan.id, payload: draftToPayload(draft) })
                          }
                        >
                          <Save className="mr-1.5 h-3.5 w-3.5" />
                          Guardar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}

          {/* Crear plan */}
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-border p-4 lg:col-span-2">
            <Input
              value={newPlanId}
              onChange={(e) => setNewPlanId(e.target.value)}
              placeholder="slug del nuevo plan (ej: local-2)"
              className="h-8 sm:max-w-56"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!newPlanId.trim()}
              isLoading={create.isPending}
              onClick={() => create.mutate(newPlanId.trim())}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Añadir plan
            </Button>
          </div>
        </div>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <CreditCard className="h-3 w-3" />
        Los cambios se reflejan de inmediato en la landing y el checkout del grupo.
      </p>
    </div>
  );
}

function GroupCopyEditor({
  slug,
  detail,
  onSaved,
}: {
  slug: string;
  detail: PlanGroupDetail;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [displayName, setDisplayName] = useState(detail.display_name);
  const [contactEmail, setContactEmail] = useState(detail.contact_email);
  const [pricingNote, setPricingNote] = useState(detail.pricing_note);
  const [heroHeadline, setHeroHeadline] = useState(detail.hero_headline);
  const [heroSubhead, setHeroSubhead] = useState(detail.hero_subhead);
  const [heroCta, setHeroCta] = useState(detail.hero_cta_label);
  const [integrationUf, setIntegrationUf] = useState(String(detail.integration_uf ?? ""));

  const dirty =
    displayName !== detail.display_name ||
    contactEmail !== detail.contact_email ||
    pricingNote !== detail.pricing_note ||
    heroHeadline !== detail.hero_headline ||
    heroSubhead !== detail.hero_subhead ||
    heroCta !== detail.hero_cta_label ||
    integrationUf !== String(detail.integration_uf ?? "");

  const save = useMutation({
    mutationFn: () => {
      const payload: PlanGroupUpdatePayload = {
        display_name: displayName,
        contact_email: contactEmail,
        pricing_note: pricingNote,
        hero_headline: heroHeadline,
        hero_subhead: heroSubhead,
        hero_cta_label: heroCta,
        integration_uf:
          integrationUf.trim() === "" ? undefined : Number(integrationUf),
      };
      return updateGroup(slug, payload);
    },
    onSuccess: () => {
      toast.success("Copy del grupo guardado");
      onSaved();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <section className="rounded-xl border border-border bg-muted/20 p-4 lg:col-span-2">
      <h3 className="text-sm font-semibold">Copy del grupo ({slug})</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Hero, UF de integración y contacto que consume la landing.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Nombre visible">
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="h-8"
          />
        </Field>
        <Field label="UF de integración">
          <Input
            value={integrationUf}
            onChange={(e) => setIntegrationUf(e.target.value)}
            className="h-8"
            inputMode="decimal"
            placeholder="0"
          />
        </Field>
        <Field label="Email de contacto">
          <Input
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="h-8"
            type="email"
          />
        </Field>
        <Field label="Nota de pricing">
          <Input
            value={pricingNote}
            onChange={(e) => setPricingNote(e.target.value)}
            className="h-8"
          />
        </Field>
        <Field label="Hero — titular" className="sm:col-span-2">
          <Input
            value={heroHeadline}
            onChange={(e) => setHeroHeadline(e.target.value)}
            className="h-8"
          />
        </Field>
        <Field label="Hero — bajada" className="sm:col-span-2">
          <Input
            value={heroSubhead}
            onChange={(e) => setHeroSubhead(e.target.value)}
            className="h-8"
          />
        </Field>
        <Field label="Hero — CTA">
          <Input
            value={heroCta}
            onChange={(e) => setHeroCta(e.target.value)}
            className="h-8"
          />
        </Field>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          disabled={!dirty}
          isLoading={save.isPending}
          onClick={() => save.mutate()}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          Guardar copy
        </Button>
      </div>
    </section>
  );
}
