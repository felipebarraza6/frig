"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

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

interface PosConfigState {
  stations: Record<string, PosConfig>;
  getStationConfig: (stationId: string | number | null | undefined) => PosConfig;
  setStationConfig: (
    stationId: string | number | null | undefined,
    config: Partial<PosConfig>,
  ) => void;
  resetStationConfig: (stationId: string | number | null | undefined) => void;
}

export const usePosConfigStore = create<PosConfigState>()(
  persist(
    (set, get) => ({
      stations: {},
      getStationConfig: (stationId) => {
        if (!stationId) return DEFAULT_POS_CONFIG;
        return (
          get().stations[String(stationId)] ?? DEFAULT_POS_CONFIG
        );
      },
      setStationConfig: (stationId, config) => {
        if (!stationId) return;
        const key = String(stationId);
        set((s) => ({
          stations: {
            ...s.stations,
            [key]: {
              ...DEFAULT_POS_CONFIG,
              ...s.stations[key],
              ...config,
            },
          },
        }));
      },
      resetStationConfig: (stationId) => {
        if (!stationId) return;
        const key = String(stationId);
        set((s) => {
          const next = { ...s.stations };
          delete next[key];
          return { stations: next };
        });
      },
    }),
    {
      name: "frig.pos-config",
      partialize: (s) => ({ stations: s.stations }),
    },
  ),
);

export function usePosConfig(stationId?: string | number | null) {
  const config = usePosConfigStore((s) => s.getStationConfig(stationId));
  const setConfig = usePosConfigStore((s) => s.setStationConfig);
  const resetConfig = usePosConfigStore((s) => s.resetStationConfig);
  return { config, setConfig, resetConfig };
}
