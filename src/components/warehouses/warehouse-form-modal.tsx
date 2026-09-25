"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  FALLBACK_WAREHOUSE_TYPES,
  warehouseTypeAccent,
  warehouseTypeIcon,
} from "@/lib/warehouses-ui";
import type { Warehouse, WarehouseTypeOption } from "@/lib/api/warehouses";

export type WarehouseFormValues = {
  name: string;
  warehouse_type: string;
  description: string;
  location: string;
  capacity: string;
  is_default: boolean;
};

export function warehouseToForm(warehouse?: Warehouse | null): WarehouseFormValues {
  if (!warehouse) {
    return {
      name: "",
      warehouse_type: "GENERAL",
      description: "",
      location: "",
      capacity: "",
      is_default: false,
    };
  }
  return {
    name: warehouse.name,
    warehouse_type: warehouse.warehouse_type ?? "GENERAL",
    description: warehouse.description ?? "",
    location: warehouse.location ?? "",
    capacity: warehouse.capacity?.toString() ?? "",
    is_default: warehouse.is_default ?? false,
  };
}

export function WarehouseFormModal({
  open,
  editing,
  types,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: Warehouse | null;
  types: WarehouseTypeOption[];
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: WarehouseFormValues) => void;
}) {
  const [form, setForm] = useState<WarehouseFormValues>(warehouseToForm(editing));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync intencional al montar/cambiar deps (código 3D/KDS recuperado)
    if (open) setForm(warehouseToForm(editing));
  }, [open, editing]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (form.name.trim()) onSubmit(form);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, form, onSubmit]);

  const typeOptions = types.length > 0 ? types : [...FALLBACK_WAREHOUSE_TYPES];

  return (
    <AnimatedOverlay
      open={open}
      onClose={onClose}
      panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
    >
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-background shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-xl md:border">
        <div className="glass-strong flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">{editing ? "Editar recinto" : "Nuevo recinto"}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          className="flex flex-1 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
        >
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <Field label="Nombre" htmlFor="warehouse-name" required>
              <Input
                id="warehouse-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
                required
                placeholder="Cámara fría, despensa…"
              />
            </Field>

            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">Tipo</p>
              <div className="grid grid-cols-2 gap-2">
                {typeOptions.map((t) => {
                  const Icon = warehouseTypeIcon(t.value);
                  const active = form.warehouse_type === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setForm({ ...form, warehouse_type: t.value })}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                        active
                          ? cn(
                              "ring-2 ring-primary/50 shadow-sm",
                              warehouseTypeAccent(t.value),
                            )
                          : "border-border/70 bg-background text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                          warehouseTypeAccent(t.value),
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className={cn("truncate font-medium", active && "text-foreground")}>
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Ubicación" htmlFor="warehouse-location" hint="Lugar físico en el local">
                <Input
                  id="warehouse-location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Patio, cocina…"
                />
              </Field>
              <Field label="Capacidad" htmlFor="warehouse-capacity" hint="Unidades máximas, opcional">
                <Input
                  id="warehouse-capacity"
                  type="number"
                  min="0"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  placeholder="—"
                />
              </Field>
            </div>

            <Field label="Descripción" htmlFor="warehouse-description">
              <Input
                id="warehouse-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Opcional"
              />
            </Field>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="warehouse-default" className="text-sm font-medium">
                  Bodega principal
                </label>
                <Switch
                  id="warehouse-default"
                  checked={form.is_default}
                  onCheckedChange={(v) => setForm({ ...form, is_default: v })}
                  label="Bodega principal"
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Pasa a ser la bodega por defecto de ventas y ajustes. La sucursal solo tiene una principal.
              </p>
            </div>

            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={saving} disabled={!form.name.trim()}>
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </AnimatedOverlay>
  );
}
