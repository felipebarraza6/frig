"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBranchProductTypes } from "@/lib/api/product-types";
import type { ProductTypeOption } from "@/lib/api/types/modules";
import { useCurrentBranch } from "@/lib/store/session";

/**
 * Tipos de producto que FRIG gestiona en el módulo Productos.
 * El backend tiene más tipos (TOOL, IOT, MEASUREMENT_MATERIAL, SUPPLIER_PRODUCT,
 * etc.) que existen para otro contexto de app (APR/Smart Hydro) y no se ofrecen
 * en FRIG, aunque la sucursal los tenga habilitados en su plan.
 *
 * En FRIG los 3 tipos gastronómicos están siempre disponibles para venta,
 * independientemente de si el módulo de etiquetado nutricional está activo.
 */
export const FRIG_PRODUCT_TYPES = new Set(["DIRECT_SALE", "RECIPE_BASED", "RAW_MATERIAL"]);

/** Labels en español chileno para los tipos de producto del backend. */
const PRODUCT_TYPE_LABELS: Record<string, string> = {
  DIRECT_SALE: "Venta directa",
  RECIPE_BASED: "Producto compuesto",
  RAW_MATERIAL: "Materia prima",
  SERVICE: "Servicio",
  MEASUREMENT_MATERIAL: "Materia de medición",
  TOOL: "Herramienta",
  EQUIPMENT: "Equipo",
  CERTIFICATE: "Certificado",
  SUPPLIER_PRODUCT: "Producto de proveedor",
  WASTE_MATERIAL: "Material de residuos",
  TANK_CONTAINER: "Estanque / contenedor",
  IOT: "Equipo IoT",
};

/**
 * Fallback de tipos cuando el endpoint por sucursal falla (403 para roles
 * distintos de OWNER/ADMIN_LOCAL en `branch_modules.py`) o el plan no incluye
 * tipos gastronómicos. FRIG gestiona siempre estos 3 tipos.
 */
const FRIG_DEFAULT_OPTIONS: ProductTypeOption[] = [
  { value: "DIRECT_SALE", label: "Venta directa" },
  { value: "RECIPE_BASED", label: "Producto compuesto" },
  { value: "RAW_MATERIAL", label: "Materia prima" },
];

export function useBranchProductTypes() {
  const branch = useCurrentBranch();
  const branchId = branch?.branch_id ? Number(branch.branch_id) : null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["branch-product-types", branchId],
    queryFn: () => fetchBranchProductTypes(branchId!),
    enabled: !!branchId,
    staleTime: 60_000,
  });

  // Solo los tipos gastronómicos de FRIG permitidos por el plan de la sucursal.
  // El backend puede devolver solo uno de los 3 (p. ej. solo DIRECT_SALE si el
  // plan no incluye recetas/nutrición), pero en FRIG siempre ofrecemos los 3
  // tipos gastronómicos para venta. Se mergean los labels del backend con los
  // defaults para no perder ninguno.
  const options = useMemo<ProductTypeOption[]>(() => {
    const configured = (data?.available_product_types ?? data?.product_types ?? []).filter((t) =>
      FRIG_PRODUCT_TYPES.has(t.value),
    );
    const merged = new Map<string, ProductTypeOption>();
    FRIG_DEFAULT_OPTIONS.forEach((t) => merged.set(t.value, t));
    configured.forEach((t) => merged.set(t.value, t));
    return Array.from(merged.values());
  }, [data]);

  const defaultType =
    data?.default && FRIG_PRODUCT_TYPES.has(data.default) ? data.default : options[0]?.value;

  const labelFor = (value?: string | null): string => {
    if (!value) return "—";
    return PRODUCT_TYPE_LABELS[value] ?? options.find((o) => o.value === value)?.label ?? value;
  };

  return { options, defaultType, labelFor, isLoading, error };
}
