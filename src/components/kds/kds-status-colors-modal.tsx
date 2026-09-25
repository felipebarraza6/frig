"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fetchKitchenStations } from "@/lib/api/kitchen-stations";
import { useCurrentBranch, useSessionStore } from "@/lib/store/session";
import { useKdsStatusColors } from "@/lib/hooks/useKdsStatusColors";
import {
  KDS_STATUS_LABELS,
  defaultKdsStatusColorsFromTheme,
  kdsReadableForeground,
  loadKdsStatusColors,
  type KdsStatusColors,
  type KdsStatusKey,
} from "@/lib/kds-status-colors";
import { useToast } from "@/lib/store/toast";

const KEYS: KdsStatusKey[] = ["pending", "preparing", "ready"];

export function KdsStatusColorsModal({
  open,
  onClose,
  initialStationId,
}: {
  open: boolean;
  onClose: () => void;
  /** Prefill estación (p. ej. desde la tarjeta). */
  initialStationId?: number | null;
}) {
  const toast = useToast();
  const branch = useCurrentBranch();
  const theme = useSessionStore((s) => s.theme ?? s.organizationTheme);
  const themePrimary =
    theme?.primary_color ?? branch?.theme_config?.primary_color ?? null;
  const branchId = branch?.branch_id ?? branch?.id ?? null;

  const { data: stations = [], isLoading: stationsLoading } = useQuery({
    queryKey: ["kitchen-stations"],
    queryFn: fetchKitchenStations,
    enabled: open && !!branchId,
  });

  const [stationId, setStationId] = useState<number | null>(initialStationId ?? null);
  const { save, reset } = useKdsStatusColors(stationId);
  const [draft, setDraft] = useState<KdsStatusColors>(() =>
    defaultKdsStatusColorsFromTheme(themePrimary),
  );

  useEffect(() => {
    if (!open) return;
    const first = initialStationId ?? stations[0]?.id ?? null;
    setStationId(first);
  }, [open, initialStationId, stations]);

  useEffect(() => {
    if (!open || stationId == null) {
      setDraft(defaultKdsStatusColorsFromTheme(themePrimary));
      return;
    }
    setDraft(loadKdsStatusColors(branchId, stationId, themePrimary));
  }, [open, branchId, stationId, themePrimary]);

  const patch = (key: KdsStatusKey, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const stationName = stations.find((s) => s.id === stationId)?.name;

  const handleSave = () => {
    if (stationId == null) {
      toast.error("Elige una estación");
      return;
    }
    save(draft, stationId);
    toast.success(
      stationName
        ? `Colores guardados para ${stationName}`
        : "Colores de la estación guardados",
    );
    onClose();
  };

  return (
    <AnimatedOverlay
      open={open}
      onClose={onClose}
      className="bg-black/50"
      zIndex="z-[70]"
      panelClassName="flex items-end justify-center sm:items-center sm:p-4"
    >
      <div className="flex w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Colores por estación</h2>
            <p className="text-xs text-muted-foreground">
              Siempre por estación. Sin cambios, se usa una combinación automática
              del color del theme.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Estación</label>
            {stationsLoading ? (
              <p className="text-xs text-muted-foreground">Cargando estaciones…</p>
            ) : stations.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Crea una estación antes de configurar colores.
              </p>
            ) : (
              <Select
                value={stationId ?? ""}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : null;
                  setStationId(v);
                }}
              >
                <option value="" disabled>
                  Elegir estación…
                </option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {KEYS.map((key) => (
            <div key={key} className="space-y-2">
              <label className="text-sm font-medium">{KDS_STATUS_LABELS[key]}</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={draft[key]}
                  onChange={(e) => patch(key, e.target.value)}
                  disabled={stationId == null}
                  className="h-10 w-12 cursor-pointer rounded-md border border-border bg-transparent p-0.5 disabled:opacity-40"
                  aria-label={`Color ${KDS_STATUS_LABELS[key]}`}
                />
                <Input
                  value={draft[key]}
                  onChange={(e) => patch(key, e.target.value)}
                  className="font-mono text-sm uppercase"
                  maxLength={7}
                  disabled={stationId == null}
                />
                <div
                  className="flex h-10 min-w-[5.5rem] items-center justify-center rounded-lg px-3 text-xs font-semibold"
                  style={{
                    backgroundColor: draft[key],
                    color: kdsReadableForeground(draft[key]),
                  }}
                >
                  Vista
                </div>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-3 gap-2 pt-1">
            {KEYS.map((key) => (
              <div
                key={`preview-${key}`}
                className="rounded-xl px-2 py-3 text-center text-[11px] font-semibold"
                style={{
                  backgroundColor: draft[key],
                  color: kdsReadableForeground(draft[key]),
                }}
              >
                {KDS_STATUS_LABELS[key]}
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Restablecer vuelve a la tríada automática del theme. Los cambios se
            guardan por estación en este navegador.
          </p>
        </div>

        <div className="flex flex-wrap justify-between gap-2 border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={stationId == null}
            onClick={() => {
              const auto = defaultKdsStatusColorsFromTheme(themePrimary);
              setDraft(auto);
              reset(stationId);
              toast.success("Colores adaptados al theme");
            }}
          >
            Usar theme
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={stationId == null}
            >
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </AnimatedOverlay>
  );
}
