"use client";

import { useMemo } from "react";
import { useSessionStore } from "@/lib/store/session";
import { FRIG_MENU_DEF, FRIG_ALWAYS_ON_MODULES } from "@/lib/modules";
import { getIcon, type IconName } from "@/lib/icons";
import type { LucideIcon } from "lucide-react";

/** Item del menú con ícono ya resuelto a componente Lucide. */
export interface FrigNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  module: string;
  badge?: "ordersPending" | "cashOpen" | "kitchenReady";
  description?: string;
}

/** Grupo de navegación con ítems resueltos. */
export interface FrigNavGroup {
  title: string;
  items: FrigNavItem[];
}

/** Módulos que en Frig dependen de que POS esté habilitado. */
const POS_DEPENDENT_MODULES = new Set<string>(["cash_register"]);

/**
 * Genera el menú de Frig filtrado por los módulos habilitados en la sucursal activa.
 *
 * El backend envía `modules.enabled` / `modules.disabled` como lista plana: cada
 * módulo en `enabled` aparece en el menú; los de `disabled` se ocultan. Los
 * módulos always-on de Frig se muestran sin consultar el estado del backend.
 * Para el resto se exige `is_enabled === true` explícito: si no viene del backend,
 * no se muestra (evita el fallback que dejaba ver todo).
 *
 * Además, ítems como Caja dependen de que POS esté activo en Frig.
 */
export function useFrigMenu(): FrigNavGroup[] {
  const modules = useSessionStore((s) => s.modules);

  return useMemo(() => {
    const alwaysOn = new Set<string>(FRIG_ALWAYS_ON_MODULES);

    function isVisible(moduleName: string): boolean {
      if (alwaysOn.has(moduleName)) return true;
      return modules[moduleName]?.is_enabled === true;
    }

    const groups: FrigNavGroup[] = [];
    for (const group of FRIG_MENU_DEF) {
      const items: FrigNavItem[] = [];
      for (const item of group.items) {
        if (!isVisible(item.module)) continue;
        // En Frig, Caja y estaciones POS se ocultan si POS está desactivado.
        if (POS_DEPENDENT_MODULES.has(item.module) && !isVisible("pos")) continue;
        items.push({
          href: item.href,
          label: item.label,
          icon: getIcon(item.icon as IconName),
          module: item.module,
          badge: item.badge,
          description: item.description,
        });
      }
      if (items.length > 0) {
        groups.push({ title: group.title, items });
      }
    }
    return groups;
  }, [modules]);
}
