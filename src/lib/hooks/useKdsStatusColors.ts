"use client";

import { useCallback, useEffect, useState } from "react";
import { useCurrentBranch, useSessionStore } from "@/lib/store/session";
import {
  applyKdsStatusColorVars,
  defaultKdsStatusColorsFromTheme,
  loadKdsStatusColors,
  saveKdsStatusColors,
  type KdsStatusColors,
} from "@/lib/kds-status-colors";

/**
 * Colores KDS siempre por estación.
 * Sin guardado: tríada automática desde primary del theme.
 */
export function useKdsStatusColors(stationId?: number | null) {
  const branch = useCurrentBranch();
  const theme = useSessionStore((s) => s.theme ?? s.organizationTheme);
  const themePrimary =
    theme?.primary_color ??
    branch?.theme_config?.primary_color ??
    null;
  const branchId = branch?.branch_id ?? branch?.id ?? null;
  const [colors, setColors] = useState<KdsStatusColors>(() =>
    defaultKdsStatusColorsFromTheme(themePrimary),
  );

  useEffect(() => {
    const next = loadKdsStatusColors(branchId, stationId, themePrimary);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync intencional al montar/cambiar deps (código 3D/KDS recuperado)
    setColors(next);
    applyKdsStatusColorVars(next);
  }, [branchId, stationId, themePrimary]);

  useEffect(() => {
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { branchId?: string; stationId?: string; colors?: KdsStatusColors }
        | undefined;
      if (!detail?.colors) return;
      if (branchId != null && detail.branchId && String(detail.branchId) !== String(branchId)) {
        return;
      }
      if (
        stationId != null &&
        detail.stationId &&
        String(detail.stationId) !== String(stationId)
      ) {
        return;
      }
      if (stationId == null && detail.stationId) return;
      setColors(detail.colors);
      applyKdsStatusColorVars(detail.colors);
    };
    const onStorage = (e: StorageEvent) => {
      if (!branchId || stationId == null || !e.key) return;
      if (e.key !== `frig.kds.statusColors.${branchId}.${stationId}`) return;
      const next = loadKdsStatusColors(branchId, stationId, themePrimary);
      setColors(next);
      applyKdsStatusColorVars(next);
    };
    const onTheme = () => {
      const next = loadKdsStatusColors(branchId, stationId, themePrimary);
      setColors(next);
      applyKdsStatusColorVars(next);
    };
    window.addEventListener("frig:kds-status-colors", onCustom);
    window.addEventListener("storage", onStorage);
    window.addEventListener("frig:theme-changed", onTheme);
    return () => {
      window.removeEventListener("frig:kds-status-colors", onCustom);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("frig:theme-changed", onTheme);
    };
  }, [branchId, stationId, themePrimary]);

  const save = useCallback(
    (next: KdsStatusColors, forStationId?: number | null) => {
      const targetStation = forStationId ?? stationId;
      if (branchId == null || targetStation == null) {
        setColors(next);
        applyKdsStatusColorVars(next);
        return;
      }
      saveKdsStatusColors(branchId, targetStation, next, themePrimary);
      if (stationId == null || String(stationId) === String(targetStation)) {
        setColors(next);
      }
    },
    [branchId, stationId, themePrimary],
  );

  const reset = useCallback(
    (forStationId?: number | null) => {
      save(defaultKdsStatusColorsFromTheme(themePrimary), forStationId ?? stationId);
    },
    [save, stationId, themePrimary],
  );

  const themeDefaults = defaultKdsStatusColorsFromTheme(themePrimary);

  return {
    colors,
    save,
    reset,
    branchId,
    stationId: stationId ?? null,
    themeDefaults,
    themePrimary,
  };
}
