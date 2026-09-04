"use client";

import { useMemo } from "react";
import { Settings2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  usePosConfig,
  POS_CONFIG_MODULE_REQUIREMENTS,
  type PosConfig,
} from "@/lib/store/pos-config";
import { useBranchModules } from "@/lib/hooks/useBranchModules";
import { fetchCashRegisterStations } from "@/lib/api/cash-register-stations";
import { cn } from "@/lib/utils";

interface PosConfigModalProps {
  open: boolean;
  onClose: () => void;
  stationId: number | null;
}

const SECTIONS: {
  title: string;
  items: { key: keyof PosConfig; label: string; description: string }[];
}[] = [
  {
    title: "Modo de operación",
    items: [
      {
        key: "sales",
        label: "Ventas",
        description: "Permite registrar ventas al contado en el terminal.",
      },
      {
        key: "self_service",
        label: "Autoatención",
        description:
          "Modo kiosco: oculta paneles administrativos y deja solo ventas.",
      },
    ],
  },
  {
    title: "Finanzas y pagos",
    items: [
      {
        key: "cash_movements",
        label: "Ingresos/retiros de caja",
        description:
          "Muestra la pestaña de movimientos en el modal de caja.",
      },
    ],
  },
  {
    title: "Servicio",
    items: [
      {
        key: "tables",
        label: "Mesas",
        description: "Habilita selección de mesas y el mapa de salón.",
      },
      {
        key: "delivery",
        label: "Delivery",
        description:
          "Muestra el panel de órdenes con despacho a domicilio.",
      },
      {
        key: "pickup",
        label: "Retiro en local",
        description:
          "Muestra órdenes configuradas para retiro en tienda.",
      },
    ],
  },
  {
    title: "Órdenes",
    items: [
      // Nota: el toggle "quotes" no se ofrece hasta que el terminal implemente
      // el flujo de cotizaciones (hoy la clave existe en PosConfig pero nadie
      // la consume fuera del mask de self_service).
      {
        key: "order_history",
        label: "Historial de órdenes",
        description: "Muestra cuentas abiertas y órdenes.",
      },
      {
        key: "customer_search",
        label: "Búsqueda de clientes",
        description:
          "Permite buscar y seleccionar clientes desde el POS.",
      },
    ],
  },
];

export function PosConfigModal({
  open,
  onClose,
  stationId,
}: PosConfigModalProps) {
  const { config, setConfig, resetConfig, isSaving } = usePosConfig(stationId ?? undefined);
  const { enabledModules, isLoading: modulesLoading } = useBranchModules();

  const { data: stations = [] } = useQuery({
    queryKey: ["cash-register-stations", "pos-config-modal"],
    queryFn: fetchCashRegisterStations,
    staleTime: 60_000,
  });

  /** Una opción está disponible si el módulo que la respalda está activado.
   *  Mientras cargan los módulos se muestran todas (evita parpadeo). */
  function isOptionAvailable(key: keyof PosConfig): boolean {
    const requirement = POS_CONFIG_MODULE_REQUIREMENTS[key];
    if (!requirement) return true;
    if (modulesLoading) return true;
    return enabledModules.has(requirement);
  }

  // Se ocultan las opciones cuyo módulo no está activado en la sucursal
  // (mientras cargan los módulos se muestran todas, para evitar parpadeo).
  const visibleSections = useMemo(
    () =>
      SECTIONS.map((section) => ({
        ...section,
        items: modulesLoading
          ? section.items
          : section.items.filter((item) => isOptionAvailable(item.key)),
      })).filter((section) => section.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modulesLoading, enabledModules],
  );

  const station = useMemo(() => {
    if (!stationId) return null;
    return stations.find((s) => s.id === stationId) ?? null;
  }, [stations, stationId]);

  function update(key: keyof PosConfig, value: boolean) {
    if (!stationId) return;
    setConfig(stationId, { [key]: value });
  }

  function handleReset() {
    if (!stationId) return;
    resetConfig(stationId);
  }

  const title = station ? `Configurar estación` : "Configurar estación";
  const description = station
    ? `${station.name}${station.code ? ` · ${station.code}` : ""}`
    : "Selecciona una estación para configurar sus funciones.";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          <span>{title}</span>
        </div>
      }
      description={description}
      size="md"
    >
      <ModalBody className="space-y-6">
        {!stationId && (
          <p className="rounded-xl border border-amber-200/60 bg-amber-500/5 p-3 text-sm text-amber-700">
            No se ha seleccionado una estación. Cierra este diálogo y elige una estación para configurar.
          </p>
        )}
        {visibleSections.map((section) => (
          <div key={section.title}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.title}
            </h3>
            <div className="flex flex-col gap-3">
              {section.items.map((item) => {
                const checked = config[item.key];
                return (
                  <div
                    key={item.key}
                    className={cn(
                      "flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-muted/20 p-3",
                      item.key === "sales" && !checked && "border-amber-200/60 bg-amber-500/5",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                      {item.key === "sales" && !checked && (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          Si desactivas las ventas el terminal no podrá registrar
                          operaciones de venta.
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={checked}
                      onCheckedChange={(v) => update(item.key, v)}
                      disabled={!stationId || isSaving}
                      aria-label={item.label}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </ModalBody>
      <ModalFooter>
        <span className="mr-auto text-xs text-muted-foreground">
          {isSaving ? "Guardando…" : "Los cambios se guardan automáticamente."}
        </span>
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={!stationId || isSaving}
        >
          Restablecer valores
        </Button>
        <Button type="button" onClick={onClose}>
          Cerrar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
