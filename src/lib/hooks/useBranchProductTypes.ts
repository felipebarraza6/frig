"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBranchEnabledProductTypes } from "@/lib/api/product-types";
import type { ProductTypeOption } from "@/lib/api/types/modules";
import { branchBypassesPlanModuleLimits } from "@/lib/modules";
import { useCurrentBranch, useIsModuleEnabledFromConfig } from "@/lib/store/session";
import {
  FRIG_PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS,
  resolveProductTypeOptions,
} from "@/lib/hooks/product-type-options";

export { FRIG_PRODUCT_TYPES, PRODUCT_TYPE_LABELS, resolveProductTypeOptions };

export function useBranchProductTypes() {
  const branch = useCurrentBranch();
  const branchId = branch?.branch_id ? Number(branch.branch_id) : null;
  const inventoryOn = useIsModuleEnabledFromConfig("inventory");
  const equipmentMod = useIsModuleEnabledFromConfig("equipment");
  const equipmentOn = inventoryOn || equipmentMod;
  const iotMod = useIsModuleEnabledFromConfig("iot_telemetry");
  const isDemo = branchBypassesPlanModuleLimits(branch);

  const { data, isLoading, error } = useQuery({
    queryKey: ["branch-product-types-enabled", branchId],
    queryFn: () => fetchBranchEnabledProductTypes(branchId!),
    enabled: !!branchId,
    staleTime: 60_000,
  });

  const options = useMemo<ProductTypeOption[]>(
    () =>
      resolveProductTypeOptions({
        enabledTypes: data?.enabled_types ?? [],
        isDemo,
        equipmentOn,
        iotOn: iotMod,
      }),
    [data, isDemo, equipmentOn, iotMod],
  );

  const defaultType =
    options.find((o) => FRIG_PRODUCT_TYPES.has(o.value))?.value ?? options[0]?.value;

  const labelFor = (value?: string | null): string => {
    if (!value) return "—";
    return PRODUCT_TYPE_LABELS[value] ?? options.find((o) => o.value === value)?.label ?? value;
  };

  return { options, defaultType, labelFor, isLoading, error };
}
