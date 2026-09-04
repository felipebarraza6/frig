"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Monitor, Save } from "lucide-react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  createCashRegisterStation,
  updateCashRegisterStation,
  type CashRegisterStation,
} from "@/lib/api/cash-register-stations";
import { useToast } from "@/lib/store/toast";

interface StationFormModalProps {
  open: boolean;
  onClose: () => void;
  /** null → modo crear; objeto → modo editar. */
  station: CashRegisterStation | null;
}

/**
 * Crear / editar una estación de punto de venta (CashRegisterStation).
 * Misma experiencia que Métodos de pago: nombre, código y switch de activo.
 * El backend toma la sucursal del contexto (branch-aware).
 */
export function StationFormModal({ open, onClose, station }: StationFormModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const editing = station !== null;

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(station?.name ?? "");
    setCode(station?.code ?? "");
    setIsActive(station?.is_active ?? true);
  }, [open, station]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        is_active: isActive,
      };
      if (editing) {
        await updateCashRegisterStation(station.id, payload);
      } else {
        await createCashRegisterStation(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-register-stations"] });
      toast.success(editing ? "Estación actualizada" : "Estación creada");
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la estación");
    },
  });

  const canSubmit = name.trim().length > 0 && code.trim().length > 0 && !save.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar estación" : "Nueva estación"}
      description={
        editing
          ? `${station.name}${station.code ? ` · ${station.code}` : ""}`
          : "Crea un punto de venta físico para esta sucursal"
      }
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) save.mutate();
        }}
      >
        <ModalBody className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Monitor className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Punto de venta</p>
            <p className="text-xs text-muted-foreground">
              Aparece como tarjeta en la pantalla de Puntos de venta
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="station-name" className="text-sm font-medium">
            Nombre
          </label>
          <Input
            id="station-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Caja 1, POS Mostrador"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="station-code" className="text-sm font-medium">
            Código
          </label>
          <Input
            id="station-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ej: PRINCIPAL, CAJA2"
            autoComplete="off"
            maxLength={20}
          />
          <p className="text-xs text-muted-foreground">
            Único por sucursal. Se usa para identificar la estación en reportes.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">Estación activa</p>
            <p className="text-xs text-muted-foreground">
              Las estaciones inactivas no se pueden abrir para vender
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} label="Estación activa" />
        </div>
        </ModalBody>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!canSubmit} isLoading={save.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {editing ? "Guardar cambios" : "Crear estación"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
