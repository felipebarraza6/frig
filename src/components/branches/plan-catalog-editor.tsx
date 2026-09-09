"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Plus, Save, Trash2, X } from "lucide-react";
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
  deleteGroupPlan,
  type GroupPlanPayload,
} from "@/lib/api/plan-catalog";
import { FRIG_GROUP_SLUG } from "@/lib/plans";
import { useToast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

/** Draft local editable de un plan. Las características son una lista:
 *  se agregan y quitan líneas en vez de editar un bloque de texto crudo. */
interface PlanDraft {
  display_name: string;
  description: string;
  features: string[];
  priceText: string;
  badge: string;
  sort_order: number;
  highlighted: boolean;
  is_active: boolean;
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
  };
}

const selectCls =
  "h-8 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";

interface FeaturesInputProps {
  value: string[];
  onChange: (features: string[]) => void;
}

/**
 * Editor interactivo de características: cada viñeta es una línea con su
 * propio campo y botón de quitar; "Añadir" (o Enter) agrega una línea nueva.
 */
function FeaturesInput({ value, onChange }: FeaturesInputProps) {
  const rows = value.length > 0 ? value : [""];

  const patchRow = (index: number, text: string) =>
    onChange(rows.map((f, i) => (i === index ? text : f)));
  const removeRow = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const addRow = () => onChange([...rows, ""]);

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((feature, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <span className="select-none text-xs text-muted-foreground" aria-hidden>
            •
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
            placeholder={`Ej: 1 sucursal, 5 usuarios…`}
            className="h-8 flex-1"
            aria-label={`Característica ${index + 1}`}
          />
          <button
            type="button"
            onClick={() => removeRow(index)}
            disabled={rows.length === 1 && feature === ""}
            title="Quitar característica"
            aria-label="Quitar característica"
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
        Añadir característica
      </button>
    </div>
  );
}

/**
 * Editor inline del catálogo de planes de venta (GroupPlan) del grupo del
 * usuario: superadmin elige grupo; el dueño de organización edita el de su
 * org (ligado vía Organization.plan_group en el backend). Los cambios se
 * reflejan de inmediato en la landing y el checkout del grupo.
 */
export function PlanCatalogEditor() {
  const toast = useToast();
  const queryClient = useQueryClient();
  // Slug elegido manualmente; sin elección y con un único grupo, se usa ese.
  const [manualSlug, setManualSlug] = useState<string | null>(null);
  // Ediciones locales sobre el detalle fresco del backend (clave: pk del plan).
  const [edits, setEdits] = useState<Record<number, Partial<PlanDraft>>>({});
  const [newPlanId, setNewPlanId] = useState("");

  // Solo el grupo frig: los demás grupos del catálogo compartido pertenecen
  // a otras apps que consumen este mismo backend.
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["plan-group", selectedSlug] });
    queryClient.invalidateQueries({ queryKey: ["plans"] });
  };

  const save = useMutation({
    mutationFn: ({ pk, payload }: { pk: number; payload: GroupPlanPayload }) =>
      updateGroupPlan(selectedSlug!, pk, payload),
    onSuccess: (_res, vars) => {
      // Suelta las ediciones locales de ese plan: la fuente de verdad es el refetch.
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

  // Eliminación con confirmación en dos pasos (clave: pk del plan a confirmar).
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

  /** Draft efectivo = valores del backend + ediciones locales del usuario. */
  const draftFor = (plan: (typeof plans)[number]): PlanDraft => ({
    ...draftFromPlan(plan),
    ...edits[plan.id],
  });

  const patchDraft = (pk: number, patch: Partial<PlanDraft>) =>
    setEdits((prev) => ({ ...prev, [pk]: { ...prev[pk], ...patch } }));

  if (groupsLoading) {
    return (
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full" />
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No tienes grupos de planes gestionables.
      </p>
    );
  }

  return (
    <div>
      {/* Selector de grupo (solo relevante cuando hay varios) */}
      {groups.length > 1 && (
        <div className="mt-3 flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Grupo</label>
          <select
            value={selectedSlug ?? ""}
            onChange={(e) => {
              setManualSlug(e.target.value || null);
              setEdits({});
            }}
            className={cn(selectCls, "min-w-48")}
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
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      )}

      {selectedSlug && detail && (
        <div className="mt-4 grid items-start gap-3 lg:grid-cols-2">
          {plans.map((plan) => {
            const draft = draftFor(plan);
            const dirty = !!edits[plan.id];
            return (
              <article
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-xl border bg-card p-4 transition-colors",
                  draft.highlighted ? "border-primary" : "border-border",
                  !draft.is_active && "opacity-60",
                )}
              >
                {/* Cabecera: slug + visibilidad inmediata */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-pixel text-xs text-muted-foreground">{plan.plan_id}</span>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Visible
                    <Switch
                      checked={draft.is_active}
                      disabled={save.isPending}
                      onCheckedChange={(v) => {
                        patchDraft(plan.id, { is_active: v });
                        save.mutate({ pk: plan.id, payload: { is_active: v } });
                      }}
                      label={`${draft.is_active ? "Ocultar" : "Mostrar"} ${plan.plan_id}`}
                    />
                  </label>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Nombre del plan" hint="Así se muestra en la landing y el checkout.">
                    <Input
                      value={draft.display_name}
                      onChange={(e) => patchDraft(plan.id, { display_name: e.target.value })}
                      className="h-8"
                      placeholder="Emprendimiento"
                    />
                  </Field>
                  <Field
                    label="Precio mensual (UF)"
                    hint="Déjalo vacío si el precio se cotiza manualmente."
                  >
                    <Input
                      value={draft.priceText}
                      onChange={(e) => patchDraft(plan.id, { priceText: e.target.value })}
                      className="h-8"
                      inputMode="decimal"
                      placeholder="20.00"
                    />
                  </Field>
                  <Field label="Sello" hint="Texto corto que destaca el plan, ej: EL MÁS ELEGIDO.">
                    <Input
                      value={draft.badge}
                      onChange={(e) => patchDraft(plan.id, { badge: e.target.value })}
                      className="h-8"
                      placeholder="EL MÁS ELEGIDO"
                    />
                  </Field>
                  <Field label="Orden" hint="Posición en la que aparece (1 = primero).">
                    <Input
                      type="number"
                      value={draft.sort_order}
                      onChange={(e) =>
                        patchDraft(plan.id, { sort_order: Number(e.target.value) || 0 })
                      }
                      className="h-8 w-20"
                    />
                  </Field>
                  <Field
                    label="Descripción"
                    hint="Una frase que resume a qué negocio va dirigido."
                    className="sm:col-span-2"
                  >
                    <Input
                      value={draft.description}
                      onChange={(e) => patchDraft(plan.id, { description: e.target.value })}
                      className="h-8"
                      placeholder="Kioscos y negocios de barrio"
                    />
                  </Field>
                  <Field
                    label="Características"
                    hint="Viñetas que ve el cliente al contratar. Enter añade una nueva."
                    className="sm:col-span-2"
                  >
                    <FeaturesInput
                      value={draft.features}
                      onChange={(features) => patchDraft(plan.id, { features })}
                    />
                  </Field>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                  {confirmDeletePk === plan.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-danger">¿Eliminar este plan?</span>
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={remove.isPending}
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(plan.id)}
                        className="h-7 border-danger/40 text-danger hover:bg-danger/10"
                      >
                        Sí, eliminar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        disabled={remove.isPending}
                        onClick={() => setConfirmDeletePk(null)}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeletePk(plan.id)}
                      title="Eliminar plan"
                      aria-label="Eliminar plan"
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
                      onClick={() => save.mutate({ pk: plan.id, payload: draftToPayload(draft) })}
                    >
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      Guardar
                    </Button>
                  </div>
                </div>
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

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <CreditCard className="h-3 w-3" />
        Los cambios se reflejan de inmediato en la landing y el checkout del grupo.
      </p>
    </div>
  );
}
