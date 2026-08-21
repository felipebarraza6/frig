"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBranchProductTypes } from "@/lib/api/product-types";
import { useCurrentBranch } from "@/lib/store/session";

/** Labels en castellano chileno para los tipos de producto del backend. */
const PRODUCT_TYPE_LABELS: Record<string, string> = {
  DIRECT_SALE: "Venta directa",
  RECIPE_BASED: "Basado en receta",
  RAW_MATERIAL: "Materia prima",
  COMPOSITE: "Compuesto",
  COMBO: "Combo",
  MENU: "Menú",
  SERVICE: "Servicio",
};

export function useBranchProductTypes() {
  const branch = useCurrentBranch();
  const branchId = branch?.branch_id ? Number(branch.branch_id) : null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["branch-product-types", branchId],
    queryFn: () => fetchBranchProductTypes(branchId!),
    enabled: !!branchId,
    staleTime: 60_000,
  });

  const options = useMemo(
    () => data?.available_product_types ?? data?.product_types ?? [],
    [data],
  );
  const defaultType = data?.default;

  const labelFor = (value?: string | null): string => {
    if (!value) return "—";
    return PRODUCT_TYPE_LABELS[value] ?? options.find((o) => o.value === value)?.label ?? value;
  };

  return { options, defaultType, labelFor, isLoading, error };
}
