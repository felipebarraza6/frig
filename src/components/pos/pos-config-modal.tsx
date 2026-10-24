"use client";

import { useMemo, useState } from "react";
import { Settings2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  usePosConfig,
  POS_CONFIG_MODULE_REQUIREMENTS,
  type PosConfig,
} from "@/lib/store/pos-config";
import { useBranchModules } from "@/lib/hooks/useBranchModules";
import { fetchCashRegisterStations } from "@/lib/api/cash-register-stations";
import { CASH_KEYS } from "@/lib/api/keys";
import {
  ensureBranchPosConfig,
  fetchBranchPosConfig,
  updateBranchPosConfig,
} from "@/lib/api/branches";
import {
  createDeliveryZone,
  deleteDeliveryZone,
  fetchDeliveryZones,
  formatDeliveryZoneError,
  updateDeliveryZone,
  type BranchDeliveryZone,
} from "@/lib/api/delivery-zones";
import { useToast } from "@/lib/store/toast";
import { cn, formatCLP } from "@/lib/utils";

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
      {
        key: "purchase_order_payments",
        label: "Pago de órdenes de proveedor",
        description:
          "Permite pagar órdenes de compra pendientes desde el terminal: Órdenes → Proveedor → Pagar.",
      },
    ],
  },
  {
    title: "Inventario",
    items: [
      {
        key: "inventory_movements",
        label: "Inventario y mermas",
        description:
          "Muestra el inventario actual en el terminal y permite registrar movimientos manuales (mermas, daños, entradas).",
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
      {
        key: "quotes",
        label: "Cotizaciones",
        description:
          "Permite buscar cotizaciones del cliente desde el terminal y cargarlas para cobrar en caja.",
      },
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
  const queryClient = useQueryClient();
  const toast = useToast();
  const [deliveryFeeDraft, setDeliveryFeeDraft] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState("");
  const [zonePrice, setZonePrice] = useState("");
  const [zoneError, setZoneError] = useState<string | null>(null);

  const { data: branchPosConfig } = useQuery({
    queryKey: ["branch-pos-config"],
    queryFn: fetchBranchPosConfig,
    staleTime: 60_000,
    enabled: open,
  });

  const { data: deliveryZones = [] } = useQuery({
    queryKey: ["delivery-zones", "config"],
    queryFn: () => fetchDeliveryZones(),
    staleTime: 30_000,
    enabled: open,
  });

  const remoteDeliveryFee = Number(branchPosConfig?.default_delivery_fee ?? 0);
  const deliveryFee =
    deliveryFeeDraft ?? (remoteDeliveryFee > 0 ? String(Math.round(remoteDeliveryFee)) : "0");

  const saveDeliveryFee = useMutation({
    mutationFn: async () => {
      const cfg = branchPosConfig?.id
        ? branchPosConfig
        : await ensureBranchPosConfig();
      return updateBranchPosConfig(cfg.id, {
        default_delivery_fee: deliveryFee || "0",
      });
    },
    onSuccess: () => {
      setDeliveryFeeDraft(null);
      queryClient.invalidateQueries({ queryKey: ["branch-pos-config"] });
      toast.success("Costo de despacho de la sucursal guardado.");
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo guardar el costo de despacho."),
  });

  const saveZone = useMutation({
    mutationFn: async () => {
      const name = zoneName.trim();
      if (!name) throw new Error("Indica el nombre de la zona.");
      return createDeliveryZone({ name, price: zonePrice || "0" });
    },
    onSuccess: () => {
      setZoneName("");
      setZonePrice("");
      setZoneError(null);
      queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
      toast.success("Zona de despacho creada.");
    },
    onError: (err: Error) => {
      const message = formatDeliveryZoneError(err, "No se pudo crear la zona.");
      setZoneError(message);
      queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
      toast.error(message);
    },
  });

  const toggleZone = useMutation({
    mutationFn: (zone: BranchDeliveryZone) =>
      updateDeliveryZone(zone.id, { is_active: !zone.is_active }),
    onSuccess: () => {
      setZoneError(null);
      queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
    },
    onError: (err: Error) => {
      const message = formatDeliveryZoneError(err, "No se pudo actualizar la zona.");
      setZoneError(message);
      queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
      toast.error(message);
    },
  });

  const removeZone = useMutation({
    mutationFn: (id: number) => deleteDeliveryZone(id),
    onSuccess: () => {
      setZoneError(null);
      queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
      toast.success("Zona desactivada.");
    },
    onError: (err: Error) => {
      const message = formatDeliveryZoneError(err, "No se pudo desactivar la zona.");
      setZoneError(message);
      queryClient.invalidateQueries({ queryKey: ["delivery-zones"] });
      toast.error(message);
    },
  });

  const { data: stations = [] } = useQuery({
    queryKey: CASH_KEYS.stations,
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
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Despacho
          </h3>
          <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-3">
            <p className="text-sm font-medium text-foreground">Costo de despacho por defecto</p>
            <p className="text-xs text-muted-foreground">
              Se aplica a ventas y pedidos con dirección de entrega. Editable en el carrito antes de cobrar. 0 en local y retiro.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                step="1"
                value={deliveryFee}
                onChange={(e) => setDeliveryFeeDraft(e.target.value)}
                className="h-9 w-32"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => saveDeliveryFee.mutate()}
                disabled={saveDeliveryFee.isPending}
                isLoading={saveDeliveryFee.isPending}
              >
                Guardar
              </Button>
            </div>
            <div className="mt-4 border-t border-border/50 pt-3">
              <p className="text-sm font-medium text-foreground">Zonas</p>
              <p className="text-xs text-muted-foreground">
                Precio por comuna o barrio. En el carrito Delivery se elige una zona y se puede editar el monto antes de cobrar. Si no hay zona, se usa el default.
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {deliveryZones.map((zone) => (
                  <div
                    key={zone.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-2 py-1.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className={cn("font-medium", zone.is_active === false && "text-muted-foreground line-through")}>
                        {zone.name}
                      </p>
                      <p className="text-muted-foreground">{formatCLP(zone.price)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleZone.mutate(zone)}
                        disabled={toggleZone.isPending}
                      >
                        {zone.is_active === false ? "Activar" : "Pausar"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeZone.mutate(zone.id)}
                        disabled={removeZone.isPending}
                      >
                        Quitar
                      </Button>
                    </div>
                  </div>
                ))}
                {deliveryZones.length === 0 && (
                  <p className="text-xs text-muted-foreground">Todavía no hay zonas. El carrito usará el default.</p>
                )}
                {zoneError && (
                  <p className="text-xs font-medium text-destructive" role="alert">
                    {zoneError}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={zoneName}
                    onChange={(e) => {
                      setZoneName(e.target.value);
                      if (zoneError) setZoneError(null);
                    }}
                    placeholder="Nombre (p.ej. Las Condes)"
                    className="h-8 min-w-[10rem] flex-1 text-xs"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={zonePrice}
                    onChange={(e) => setZonePrice(e.target.value)}
                    placeholder="Precio"
                    className="h-8 w-24 text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => saveZone.mutate()}
                    disabled={saveZone.isPending}
                    isLoading={saveZone.isPending}
                  >
                    Agregar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
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
