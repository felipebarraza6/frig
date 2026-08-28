"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { ProductModifierGroup } from "@/lib/hooks/useCatalog";
import type { CartItemModifier } from "@/lib/store/cart";
import { cn, formatCLP } from "@/lib/utils";

interface ModifierModalProps {
  productName: string;
  groups: ProductModifierGroup[];
  onConfirm: (modifiers: CartItemModifier[]) => void;
  onCancel: () => void;
}

export default function ModifierModal({ productName, groups, onConfirm, onCancel }: ModifierModalProps) {
  const [selected, setSelected] = useState<Record<number, number[]>>({});

  const availableGroups = useMemo(
    () => groups.filter((g) => g.modifier_group?.options?.length),
    [groups],
  );

  const toggleOption = (groupId: number, optionId: number, maxSelections: number) => {
    setSelected((prev) => {
      const current = prev[groupId] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (maxSelections > 0 && current.length >= maxSelections) {
        return prev;
      }
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  const requiredGroups = availableGroups.filter((g) => g.is_required);
  const canConfirm = requiredGroups.every((g) => {
    const min = g.modifier_group.min_selections ?? 0;
    const count = selected[g.modifier_group.id]?.length ?? 0;
    return count >= min;
  });

  const handleConfirm = () => {
    const modifiers: CartItemModifier[] = [];
    for (const group of availableGroups) {
      const optionIds = selected[group.modifier_group.id] ?? [];
      for (const optionId of optionIds) {
        const option = group.modifier_group.options.find((o) => o.id === optionId);
        if (option) {
          modifiers.push({
            modifierOptionId: option.id,
            name: option.name,
            groupName: group.modifier_group.name,
            surcharge: Math.round(parseFloat(option.surcharge ?? "0") || 0),
          });
        }
      }
    }
    onConfirm(modifiers);
  };

  return (
    <Modal open onClose={onCancel} title="Personalizar" description={productName} size="md">
      <div className="flex flex-col gap-4 py-2">
        {availableGroups.map((group) => {
          const groupData = group.modifier_group;
          const selectedIds = selected[groupData.id] ?? [];
          const min = groupData.min_selections ?? 0;
          const max = groupData.max_selections ?? 0;
          return (
            <div key={groupData.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">{groupData.name}</h3>
                {group.is_required && <span className="text-[10px] text-danger">Requerido</span>}
              </div>
              {min > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Selecciona al menos {min} {max > 0 ? `(máx. ${max})` : ""}
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                {groupData.options.map((option) => {
                  const isSelected = selectedIds.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleOption(groupData.id, option.id, max)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card hover:bg-muted",
                      )}
                    >
                      <span>{option.name}</span>
                      <span className="text-xs tabular-nums">
                        {parseFloat(option.surcharge ?? "0") > 0
                          ? `+${formatCLP(option.surcharge ?? 0)}`
                          : "Incluido"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleConfirm} disabled={!canConfirm}>
          Agregar
        </Button>
      </div>
    </Modal>
  );
}
