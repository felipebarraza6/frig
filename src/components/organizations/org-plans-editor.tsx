"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Save,
  Trash2,
  X,
  Package,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import {
  fetchModulePlans,
  createModulePlan,
  updateModulePlan,
  deleteModulePlan,
  type ModulePlan,
  type ModulePlanPayload,
} from "@/lib/api/module-plans";
import { useToast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";

/**
 * Módulos disponibles para togglear en un plan de Frig (gastronomía).
 * Solo módulos relevantes para el vertical gastronómico, no todos los del backend.
 */
const FRIG_MODULES = [
  { key: "pos", label: "POS / Punto de venta" },
  { key: "cash_register", label: "Caja registradora" },
  { key: "tables", label: "Mesas" },
  { key: "inventory", label: "Inventario" },
  { key: "customers", label: "Clientes" },
  { key: "suppliers", label: "Proveedores" },
  { key: "finance", label: "Finanzas" },
  { key: "sales", label: "Ventas" },
  { key: "production", label: "Producción / Cocina" },
  { key: "recipes", label: "Recetas" },
  { key: "ingredients", label: "Ingredientes" },
  { key: "nutrition", label: "Nutrición" },
  { key: "deliveries", label: "Despachos / Delivery" },
  { key: "invoices", label: "Facturación" },
  { key: "promotions", label: "Promociones" },
  { key: "public_catalog", label: "Catálogo público / Menú digital" },
  { key: "memberships", label: "Membresías" },
  { key: "subscriptions", label: "Suscripciones" },
];

interface OrgPlansEditorProps {
  organizationId: number | string;
  organizationName: string;
}

export function OrgPlansEditor({ organizationId, organizationName }: OrgPlansEditorProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<ModulePlan | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ModulePlan | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["module-plans", organizationId],
    queryFn: () => fetchModulePlans(organizationId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["module-plans", organizationId] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteModulePlan(id),
    onSuccess: () => {
      toast.success("Plan eliminado");
      setConfirmDelete(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sortedPlans = useMemo(
    () => (plans ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [plans],
  );

  if (isLoading) {
    return (
      <div className="mt-4 grid gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4">
      {/* Lista de planes */}
      {sortedPlans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {organizationName} no tiene planes configurados aún.
          </p>
          <Button size="sm" className="mt-3" onClick={() => setShowCreate(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Crear primer plan
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sortedPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onEdit={() => setEditingPlan(plan)}
              onDelete={() => setConfirmDelete(plan)}
            />
          ))}
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nuevo plan
          </Button>
        </div>
      )}

      {/* Modal crear/editar */}
      {(showCreate || editingPlan) && (
        <PlanFormModal
          open
          plan={editingPlan}
          organizationId={typeof organizationId === "string" ? Number(organizationId) : organizationId}
          onClose={() => {
            setShowCreate(false);
            setEditingPlan(null);
          }}
          onSaved={() => {
            setShowCreate(false);
            setEditingPlan(null);
            invalidate();
          }}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(null)} size="sm">
          <ModalBody>
            <p className="text-sm">
              ¿Eliminar el plan <strong>{confirmDelete.name}</strong>?
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Las sucursales suscritas a este plan quedarán sin plan activo.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button
              isLoading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(confirmDelete.id)}
              className="bg-danger text-danger-foreground hover:bg-danger/90"
            >
              Eliminar
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  onEdit,
  onDelete,
}: {
  plan: ModulePlan;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className={cn(
        "rounded-xl border transition-all",
        plan.is_active ? "border-border" : "border-border/50 opacity-60",
      )}
    >
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Package className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{plan.name}</h3>
            {!plan.is_active && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Inactivo
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{plan.modules_count} módulos</span>
            <span>{plan.max_branches} sucursales máx.</span>
            {plan.max_agents > 0 && <span>{plan.max_agents} agentes IA</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-danger"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/20 p-4">
          {plan.description && (
            <p className="mb-3 text-xs text-muted-foreground">{plan.description}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {FRIG_MODULES.filter((m) => plan.modules.includes(m.key)).map((m) => (
              <span
                key={m.key}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
              >
                <Check className="h-3 w-3" />
                {m.label}
              </span>
            ))}
            {plan.modules.length === 0 && (
              <span className="text-xs italic text-muted-foreground">Sin módulos</span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function PlanFormModal({
  open,
  plan,
  organizationId,
  onClose,
  onSaved,
}: {
  open: boolean;
  plan: ModulePlan | null;
  organizationId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEditing = !!plan;

  const [form, setForm] = useState<ModulePlanPayload>(() => ({
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    modules: plan?.modules ?? [],
    product_types: plan?.product_types ?? ["DIRECT_SALE"],
    submodule_config: plan?.submodule_config ?? {},
    allow_additional_branches: plan?.allow_additional_branches ?? true,
    max_branches: plan?.max_branches ?? 5,
    max_agents: plan?.max_agents ?? 0,
    max_channels: plan?.max_channels ?? 0,
    max_llm_providers: plan?.max_llm_providers ?? 0,
    max_ai_functions: plan?.max_ai_functions ?? 0,
    max_knowledge_documents: plan?.max_knowledge_documents ?? 0,
    is_active: plan?.is_active ?? true,
  }));

  const patch = (p: Partial<ModulePlanPayload>) => setForm((prev) => ({ ...prev, ...p }));

  const toggleModule = (key: string) => {
    const current = form.modules ?? [];
    patch({
      modules: current.includes(key) ? current.filter((m) => m !== key) : [...current, key],
    });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      isEditing
        ? updateModulePlan(plan!.id, form)
        : createModulePlan({ ...form, organization: organizationId }),
    onSuccess: () => {
      toast.success(isEditing ? "Plan actualizado" : "Plan creado");
      onSaved();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return;
    saveMutation.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit}>
        <ModalBody className="flex flex-col gap-5">
          {/* Nombre y descripción */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre del plan" required>
              <Input
                value={form.name ?? ""}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Ej: Restaurante Full"
                required
              />
            </Field>
            <Field label="Máx. sucursales">
              <Input
                type="number"
                value={form.max_branches ?? 5}
                onChange={(e) => patch({ max_branches: Number(e.target.value) || 1 })}
                className="w-24"
                min={1}
              />
            </Field>
          </div>
          <Field label="Descripción">
            <Input
              value={form.description ?? ""}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Qué incluye este plan…"
            />
          </Field>

          {/* Módulos */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
              <Zap className="h-3.5 w-3.5 text-primary" />
              Módulos habilitados
            </label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {FRIG_MODULES.map((mod) => {
                const active = (form.modules ?? []).includes(mod.key);
                return (
                  <button
                    key={mod.key}
                    type="button"
                    onClick={() => toggleModule(mod.key)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-all",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {active ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-current" />
                    )}
                    {mod.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activo */}
          <div className="flex items-center gap-3">
            <Switch
              checked={form.is_active !== false}
              onCheckedChange={(v) => patch({ is_active: v })}
              label="Plan activo"
            />
            <span className="text-sm text-muted-foreground">Activo</span>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saveMutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={saveMutation.isPending} disabled={!form.name?.trim()}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {isEditing ? "Guardar" : "Crear plan"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
