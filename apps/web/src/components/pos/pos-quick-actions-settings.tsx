"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, ChevronUp, ChevronDown, Check, X } from "lucide-react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import {
  type BranchPOSConfig,
  type POSQuickAction,
  type POSQuickActionType,
  DEFAULT_POS_QUICK_ACTIONS,
  updateBranchPOSConfig,
  createBranchPOSConfig,
} from "@/lib/api/branches";

interface PosQuickActionsSettingsProps {
  open: boolean;
  config: BranchPOSConfig | null | undefined;
  branchId?: number | string | null;
  onClose: () => void;
}

const COLORS = [
  { value: "blue", label: "Azul" },
  { value: "amber", label: "Ámbar" },
  { value: "emerald", label: "Esmeralda" },
  { value: "purple", label: "Púrpura" },
  { value: "rose", label: "Rosa" },
  { value: "slate", label: "Gris" },
];

const TYPE_LABELS: Record<POSQuickActionType, string> = {
  pay_account: "Cuentas",
  pay_order: "Órdenes",
  collect: "Cobrar por cliente",
  pay_purchase_order: "Órdenes de compra",
  pay_expense: "Gastos",
};

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
      {label && <span className="sr-only">{label}</span>}
    </button>
  );
}

export default function PosQuickActionsSettings({
  open,
  config,
  branchId,
  onClose,
}: PosQuickActionsSettingsProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [enableQuickActions, setEnableQuickActions] = useState(true);
  const [actions, setActions] = useState<POSQuickAction[]>(DEFAULT_POS_QUICK_ACTIONS);

  useEffect(() => {
    if (!open) return;
    setEnableQuickActions(config?.enable_quick_actions ?? true);
    const source = config?.quick_actions?.length ? config.quick_actions : DEFAULT_POS_QUICK_ACTIONS;
    setActions(
      source.map((a) => ({
        ...a,
        label: TYPE_LABELS[a.type] ?? a.label,
      })),
    );
  }, [open, config]);

  const hasChanges = useMemo(() => {
    const originalEnabled = config?.enable_quick_actions ?? true;
    const originalActions = config?.quick_actions?.length
      ? config.quick_actions
      : DEFAULT_POS_QUICK_ACTIONS;
    if (enableQuickActions !== originalEnabled) return true;
    if (actions.length !== originalActions.length) return true;
    return actions.some((a, i) => {
      const b = originalActions[i];
      return (
        !b ||
        a.id !== b.id ||
        a.enabled !== b.enabled ||
        a.color !== b.color ||
        a.label !== b.label
      );
    });
  }, [actions, enableQuickActions, config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        enable_quick_actions: enableQuickActions,
        quick_actions: actions,
      };
      if (config?.id) {
        return updateBranchPOSConfig(config.id, payload);
      }
      if (!branchId) throw new Error("No se pudo determinar la sucursal");
      return createBranchPOSConfig({
        branch: branchId,
        ...payload,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-pos-config"] });
      toast.success("Configuración guardada");
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo guardar la configuración");
    },
  });

  function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= actions.length) return;
    const copy = [...actions];
    const [moved] = copy.splice(index, 1);
    copy.splice(nextIndex, 0, moved);
    setActions(copy);
  }

  function updateAction(id: string, patch: Partial<POSQuickAction>) {
    setActions((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  return (
    <Modal open={open} onClose={onClose} title="Acciones rápidas del POS" size="md">
      <ModalBody>
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Habilitar acciones rápidas</span>
              <span className="text-xs text-muted-foreground">
                Muestra u oculta la barra de acciones en el terminal.
              </span>
            </div>
            <Toggle
              checked={enableQuickActions}
              onChange={setEnableQuickActions}
              label="Habilitar acciones rápidas"
            />
          </div>

          {enableQuickActions && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                Ordena y activa las acciones que necesites.
              </p>
              <div className="flex flex-col gap-2">
                {actions.map((action, index) => (
                  <div
                    key={action.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 transition-opacity",
                      !action.enabled && "opacity-60",
                    )}
                  >
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                        aria-label="Subir"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === actions.length - 1}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                        aria-label="Bajar"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{TYPE_LABELS[action.type]}</p>
                      <p className="text-xs text-muted-foreground">Acción rápida</p>
                    </div>

                    <div className="w-28 shrink-0">
                      <Select
                        value={action.color ?? "blue"}
                        onChange={(e) => updateAction(action.id, { color: e.target.value })}
                        options={COLORS}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => updateAction(action.id, { enabled: !action.enabled })}
                      className={cn(
                        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                        action.enabled
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground",
                      )}
                      aria-label={action.enabled ? "Desactivar" : "Activar"}
                      title={action.enabled ? "Desactivar" : "Activar"}
                    >
                      {action.enabled ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={(!config?.id && !branchId) || !hasChanges || saveMutation.isPending}
          isLoading={saveMutation.isPending}
        >
          Guardar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
