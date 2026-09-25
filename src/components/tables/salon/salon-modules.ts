"use client";

import { useMemo } from "react";
import type { ModuleName } from "@/lib/api/branch-modules";
import { FRIG_ALWAYS_ON_MODULES } from "@/lib/modules";
import { useBranchModulesState } from "@/lib/store/session";
import type { SalonOverlayKind } from "./venue-screens";

/**
 * Qué módulo(s) de la sucursal encienden cada zona del salón virtual.
 * Si hay varios, basta con que uno esté activo.
 *
 * Oficina sin cocina → sin KDS; local gastronómico con production → cocina;
 * inventario → monitor de stock (base para bodegas); etc.
 */
export const SALON_HOTSPOT_MODULES: Record<
  SalonOverlayKind,
  ModuleName | ModuleName[]
> = {
  kitchen: "production",
  inventory: "inventory",
  orders: "sales",
  catalog: ["product_catalog", "public_catalog"],
  /** Despacho / ventanilla: cocina o módulo de entregas. */
  deliveries: ["production", "deliveries"],
  cash: "cash_register",
};

function moduleOn(
  modules: Record<string, { is_enabled?: boolean } | undefined>,
  name: ModuleName,
): boolean {
  if ((FRIG_ALWAYS_ON_MODULES as string[]).includes(name)) return true;
  return modules[name]?.is_enabled === true;
}

export function isSalonHotspotEnabled(
  kind: SalonOverlayKind,
  modules: Record<string, { is_enabled?: boolean } | undefined>,
): boolean {
  const req = SALON_HOTSPOT_MODULES[kind];
  const names = Array.isArray(req) ? req : [req];
  return names.some((n) => moduleOn(modules, n));
}

export type SalonCapabilities = Record<SalonOverlayKind, boolean> & {
  /** Terminal POS (estación de trabajo), además de la caja del salón. */
  pos: boolean;
};

/** Capacidades del salón según módulos activos de la sucursal (session store). */
export function useSalonCapabilities(): SalonCapabilities {
  const modules = useBranchModulesState();
  return useMemo(() => {
    const kind = (k: SalonOverlayKind) => isSalonHotspotEnabled(k, modules);
    return {
      kitchen: kind("kitchen"),
      inventory: kind("inventory"),
      orders: kind("orders"),
      catalog: kind("catalog"),
      deliveries: kind("deliveries"),
      cash: kind("cash"),
      pos: moduleOn(modules, "pos"),
    };
  }, [modules]);
}
