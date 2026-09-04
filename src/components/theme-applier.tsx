"use client";

import { useEffect, useRef } from "react";
import { useSessionStore } from "@/lib/store/session";
import { applyThemeConfig, fetchBranchTheme } from "@/lib/api/branches";
import { getToken } from "@/lib/api/session-storage";
import type { BranchThemeConfig } from "@/lib/types";

function normalizeThemeBranch(
  theme: BranchThemeConfig | null,
  branchId: string,
): BranchThemeConfig | null {
  if (!theme) return null;
  if (theme.branch == null) return { ...theme, branch: branchId };
  return theme;
}

function themeMatchesBranch(theme: BranchThemeConfig | null, branchId: string | null): boolean {
  if (!theme || !branchId) return false;
  return String(theme.branch) === String(branchId);
}

/**
 * Aplica el tema multi-tenant persistido (BranchThemeConfig) al `:root`.
 * Debe montarse una única vez, alto en el árbol, para evitar parpadeo de color.
 *
 * También se encarga de recargar el tema cuando cambia la sucursal activa o
 * cuando no hay tema en el store (por ejemplo tras un login directo o un
 * cambio de sucursal que no cargó el theme).
 */
export function ThemeApplier() {
  const theme = useSessionStore((s) => s.theme);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const setTheme = useSessionStore((s) => s.setTheme);

  // Evita pedir el tema indefinidamente si el backend responde null/errores
  // para la sucursal activa. Se resetea cuando cambia la sucursal.
  const attemptedBranchIdRef = useRef<string | null>(null);
  // Evita requests simultáneos si el efecto se dispara varias veces seguidas.
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated) return;

    // Si ya tenemos el tema de la sucursal activa, solo lo aplicamos.
    if (themeMatchesBranch(theme, currentBranchId)) {
      applyThemeConfig(theme);
      return;
    }

    // Sin sesión o sin sucursal activa: tema por defecto.
    if (!currentBranchId || !getToken()) {
      applyThemeConfig(null);
      attemptedBranchIdRef.current = null;
      return;
    }

    // Ya intentamos cargar el tema de esta sucursal y no hay: usamos default.
    if (theme === null && attemptedBranchIdRef.current === currentBranchId) {
      applyThemeConfig(null);
      return;
    }

    // Sucursal activa sin tema cargado: lo pedimos al backend.
    if (loadingRef.current) return;
    attemptedBranchIdRef.current = currentBranchId;
    loadingRef.current = true;

    let cancelled = false;
    fetchBranchTheme(currentBranchId)
      .then((next) => {
        if (cancelled) return;
        const normalized = next ? normalizeThemeBranch(next, currentBranchId) : null;
        if (normalized && themeMatchesBranch(normalized, currentBranchId)) {
          setTheme(normalized);
          applyThemeConfig(normalized);
        } else {
          setTheme(null);
          applyThemeConfig(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTheme(null);
          applyThemeConfig(null);
        }
      })
      .finally(() => {
        if (!cancelled) loadingRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [theme, currentBranchId, hasHydrated, setTheme]);

  return null;
}
