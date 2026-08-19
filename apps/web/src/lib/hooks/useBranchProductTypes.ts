"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBranchProductTypes } from "@/lib/api/product-types";
import { useCurrentBranch } from "@/lib/store/session";

export function useBranchProductTypes() {
  const branch = useCurrentBranch();
  const branchId = branch?.branch_id ? Number(branch.branch_id) : null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["branch-product-types", branchId],
    queryFn: () => fetchBranchProductTypes(branchId!),
    enabled: !!branchId,
    staleTime: 60_000,
  });

  const options = useMemo(() => data?.product_types ?? [], [data]);
  const defaultType = data?.default;

  const labelFor = (value?: string | null): string => {
    if (!value) return "—";
    return options.find((o) => o.value === value)?.label ?? value;
  };

  return { options, defaultType, labelFor, isLoading, error };
}
