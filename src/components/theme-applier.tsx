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
 * Resuelve el tema efectivo siguiendo la jerarquía:
 * 1. Tema de la organización (si existe)
 * 2. Tema de la sucursal (si existe)
 * 3. Default (null → Frig default)
 */
function resolveEffectiveTheme(
  orgTheme: BranchThemeConfig | null,
  branchTheme: BranchThemeConfig | null,
): BranchThemeConfig | null {
  // Prioridad: org theme > branch theme > default
  return orgTheme ?? branchTheme ?? null;
}

/**
 * Aplica el tema multi-tenant persistido al `:root`.
 * Jerarquía: organización → sucursal → default Frig.
 *
 * Debe montarse una única vez, alto en el árbol, para evitar parpadeo de color.
 */
export function ThemeApplier() {
  const theme = useSessionStore((s) => s.theme);
  const orgTheme = useSessionStore((s) => s.organizationTheme);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const setTheme = useSessionStore((s) => s.setTheme);

  // Evita pedir el tema indefinidamente si el backend responde null/errores
  // para la sucursal activa. Se resetea cuando cambia la sucursal.
  const attemptedBranchIdRef = useRef<string | null>(null);
  // Evita requests simultáneos si el efecto se dispara varias veces seguidas.
  const loadingRef = useRef(false);

  // Tema efectivo: org → branch → default
  const effectiveTheme = resolveEffectiveTheme(orgTheme, theme);

  useEffect(() => {
    if (!hasHydrated) return;

    // Aplicar el tema efectivo (org o branch)
    applyThemeConfig(effectiveTheme);

    // Si ya tenemos el tema de la sucursal activa, solo lo aplicamos.
    if (themeMatchesBranch(theme, currentBranchId)) {
      return;
    }

    // Sin sesión o sin sucursal activa: tema por defecto.
    if (!currentBranchId || !getToken()) {
      attemptedBranchIdRef.current = null;
      return;
    }

    // Ya intentamos cargar el tema de esta sucursal y no hay: usamos default.
    if (theme === null && attemptedBranchIdRef.current === currentBranchId) {
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
        } else {
          setTheme(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTheme(null);
        }
      })
      .finally(() => {
        if (!cancelled) loadingRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [theme, orgTheme, effectiveTheme, currentBranchId, hasHydrated, setTheme]);

  return null;
}
