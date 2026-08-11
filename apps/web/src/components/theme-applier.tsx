"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/lib/store/session";
import { applyThemeConfig } from "@/lib/api/branches";

/**
 * Aplica el tema multi-tenant persistido (BranchThemeConfig) al `:root`.
 * Debe montarse una única vez, alto en el árbol, para evitar parpadeo de color.
 */
export function ThemeApplier() {
  const theme = useSessionStore((s) => s.theme);
  const hasHydrated = useSessionStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    applyThemeConfig(theme);
  }, [theme, hasHydrated]);

  return null;
}