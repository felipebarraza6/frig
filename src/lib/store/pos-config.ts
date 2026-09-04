"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchBranchModules,
  toggleBranchModule,
  updateBranchModuleConfiguration,
  parseConfigurationData,
  type BranchModuleConfiguration,
  type ModuleName,
} from "@/lib/api/branch-modules";
import { useBranchModules } from "@/lib/hooks/useBranchModules";
import { useToast } from "@/lib/store/toast";

export interface PosConfig {
  sales: boolean;
  self_service: boolean;
  expenses: boolean;
  cash_movements: boolean;
  tables: boolean;
  delivery: boolean;
  pickup: boolean;
  quotes: boolean;
  order_history: boolean;
  customer_search: boolean;
}

export const DEFAULT_POS_CONFIG: PosConfig = {
  sales: true,
  self_service: false,
  expenses: true,
  cash_movements: true,
  tables: true,
  delivery: true,
  pickup: true,
  quotes: true,
  order_history: true,
  customer_search: true,
};

/**
 * Módulo que debe estar activado para que cada opción esté disponible.
 * `null` significa que la opción es propia del POS y no depende de módulos.
 */
export const POS_CONFIG_MODULE_REQUIREMENTS: Record<keyof PosConfig, ModuleName | null> = {
  sales: null,
  self_service: null,
  expenses: "finance",
  cash_movements: "cash_register",
  tables: "tables",
  delivery: "deliveries",
  pickup: "deliveries",
  quotes: "sales",
  order_history: "sales",
  customer_search: "customers",
};

/** Configuración por estación persistida en configuration_data del módulo pos. */
const POS_STATIONS_KEY = "pos_stations";

/** Key localStorage legacy (configuración local previa a la persistencia en DB). */
const LEGACY_STORAGE_KEY = "frig.pos-config";

type PosStationsMap = Record<string, PosConfig>;

function isPosConfig(value: unknown): value is PosConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(DEFAULT_POS_CONFIG).every(
    (k) => typeof (value as Record<string, unknown>)[k] === "boolean",
  );
}

function parsePosStations(configurationData: unknown): PosStationsMap {
  const raw = parseConfigurationData(configurationData)[POS_STATIONS_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const stations: PosStationsMap = {};
  for (const [id, cfg] of Object.entries(raw as Record<string, unknown>)) {
    if (isPosConfig(cfg)) stations[id] = cfg;
  }
  return stations;
}

/** Lee y elimina la configuración legacy de localStorage (migración one-shot a DB). */
function drainLegacyStations(): PosStationsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { state?: { stations?: unknown } } | null;
    const stations = parsed?.state?.stations;
    if (!stations || typeof stations !== "object") return {};
    const result: PosStationsMap = {};
    for (const [id, cfg] of Object.entries(stations)) {
      if (isPosConfig(cfg)) result[id] = cfg;
    }
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return result;
  } catch {
    return {};
  }
}

interface SaveStationConfigInput {
  stationId: string | number;
  /** Parcial a aplicar sobre la config existente. Mutuamente excluyente con `reset`. */
  partial?: Partial<PosConfig>;
  /** Si es true, elimina la config de la estación (vuelve a los valores por defecto). */
  reset?: boolean;
  /** Mapa completo a fusionar (migración one-shot desde localStorage). */
  migrate?: PosStationsMap;
}

/**
 * Configuración del terminal POS por estación de caja.
 *
 * Fuente de verdad: `configuration_data` del módulo `pos` de la sucursal
 * (persistido en DB). Las opciones cuyo módulo relacionado no esté activado
 * se fuerzan a `false` en la config efectiva.
 */
export function usePosConfig(stationId?: string | number | null) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { configByName, enabledModules, isLoading, branchId } = useBranchModules();
  const key = stationId !== null && stationId !== undefined ? String(stationId) : null;

  const posModule = configByName.get("pos");
  const serverStations = useMemo(
    () => parsePosStations(posModule?.configuration_data),
    [posModule],
  );

  const config = useMemo<PosConfig>(() => {
    const base: PosConfig = { ...DEFAULT_POS_CONFIG, ...(key ? serverStations[key] : undefined) };
    // Mientras cargan los módulos no se oculta nada (evita parpadeo).
    if (isLoading) return base;
    const masked = { ...base };
    for (const [option, requirement] of Object.entries(POS_CONFIG_MODULE_REQUIREMENTS) as [
      keyof PosConfig,
      ModuleName | null,
    ][]) {
      if (requirement && !enabledModules.has(requirement)) masked[option] = false;
    }
    return masked;
  }, [key, serverStations, isLoading, enabledModules]);

  const saveMutation = useMutation({
    mutationFn: async ({ stationId: sid, partial, reset, migrate }: SaveStationConfigInput) => {
      if (!branchId) throw new Error("No se pudo determinar la sucursal");
      // Releer para trabajar sobre el estado fresco (id de fila + JSON previo).
      const configs = await fetchBranchModules(branchId);
      let pos = configs.find((c) => c.module_name === "pos");
      // Si el módulo aún no tiene fila en BD, el toggle la crea sin cambiar
      // el estado (POS ya debe estar habilitado para usar esta pantalla).
      if (!pos?.id) {
        pos = await toggleBranchModule({ branchId, moduleName: "pos", isEnabled: true });
      }
      const existing = parseConfigurationData(pos.configuration_data);
      const stations = parsePosStations(existing);
      if (migrate) {
        Object.assign(stations, migrate);
      } else {
        const stationKey = String(sid);
        if (reset) {
          delete stations[stationKey];
        } else {
          stations[stationKey] = { ...DEFAULT_POS_CONFIG, ...stations[stationKey], ...partial };
        }
      }
      return updateBranchModuleConfiguration({
        moduleConfigId: pos.id,
        configurationData: { ...existing, [POS_STATIONS_KEY]: stations },
      });
    },
    onMutate: (input) => {
      // Optimistic update sobre la query de módulos de la sucursal.
      const queryKey = ["branch-modules", branchId] as const;
      const previous = queryClient.getQueryData<BranchModuleConfiguration[]>(queryKey);
      queryClient.setQueryData<BranchModuleConfiguration[]>(queryKey, (old) =>
        (old ?? []).map((c) => {
          if (c.module_name !== "pos") return c;
          const existing = parseConfigurationData(c.configuration_data);
          const stations = parsePosStations(existing);
          if (input.migrate) {
            Object.assign(stations, input.migrate);
          } else {
            const stationKey = String(input.stationId);
            if (input.reset) {
              delete stations[stationKey];
            } else {
              stations[stationKey] = { ...DEFAULT_POS_CONFIG, ...stations[stationKey], ...input.partial };
            }
          }
          return { ...c, configuration_data: { ...existing, [POS_STATIONS_KEY]: stations } };
        }),
      );
      return { previous };
    },
    onError: (err: Error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["branch-modules", branchId], context.previous);
      }
      toast.error(err.message || "No se pudo guardar la configuración de la estación");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-modules", branchId] });
    },
  });

  // Migración one-shot: la config que existía en localStorage se sube a la DB
  // la primera vez que se carga la config del servidor.
  const migratedRef = useRef(false);
  useEffect(() => {
    if (migratedRef.current || isLoading || !branchId) return;
    migratedRef.current = true;
    const legacy = drainLegacyStations();
    if (Object.keys(legacy).length === 0) return;
    if (Object.keys(serverStations).length > 0) return;
    saveMutation.mutate({ stationId: "__migration__", migrate: legacy });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, branchId, serverStations]);

  function setConfig(
    targetStationId: string | number | null | undefined,
    partial: Partial<PosConfig>,
  ) {
    if (targetStationId === null || targetStationId === undefined) return;
    saveMutation.mutate({ stationId: targetStationId, partial });
  }

  function resetConfig(targetStationId: string | number | null | undefined) {
    if (targetStationId === null || targetStationId === undefined) return;
    saveMutation.mutate({ stationId: targetStationId, reset: true });
  }

  return { config, setConfig, resetConfig, isSaving: saveMutation.isPending };
}
