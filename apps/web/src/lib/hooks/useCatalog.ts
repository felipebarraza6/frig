import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { toPosProduct, type PosProduct, type YggdraCategory } from "@/lib/api/types";
import type { YggdraPaginatedCategory, YggdraPaginatedProduct } from "@/lib/api/types";
import { fetchProductModifierGroups, type ProductModifierGroup } from "@/lib/api/modifier-groups";
import { useCurrentBranch } from "@/lib/store/session";
import {
  fetchCombos,
  fetchAllCombos,
  fetchCombo,
  createCombo,
  updateCombo,
  deleteCombo,
  type ComboList,
  type Combo,
  type ComboWriteRequest,
} from "@/lib/api/combos";

export const PRODUCT_KEYS = {
  all: ["products"] as const,
};

export const COMBO_KEYS = {
  all: ["combos"] as const,
  detail: (id: number) => [...COMBO_KEYS.all, id] as const,
};

export function useProducts(enabled = true) {
  const branch = useCurrentBranch();
  const branchId = branch?.branch_id;
  return useQuery({
    queryKey: [...PRODUCT_KEYS.all, "sale", branchId],
    queryFn: async () => {
      const data = await apiFetch<YggdraPaginatedProduct>(
        "/inventory/products/?is_for_sale=true&is_active=true&page_size=1000",
      );
      return data.results.map(toPosProduct);
    },
    staleTime: 60_000,
    enabled,
  });
}

export const CATEGORY_KEYS = {
  all: ["categories"] as const,
};

export function useCategories(enabled = true) {
  return useQuery({
    queryKey: CATEGORY_KEYS.all,
    queryFn: async () => {
      const data = await apiFetch<YggdraPaginatedCategory>("/inventory/categories/");
      return data.results as YggdraCategory[];
    },
    staleTime: 60_000,
    enabled,
  });
}

export function useProductModifierGroups(enabled = true) {
  return useQuery({
    queryKey: ["product-modifier-groups"],
    queryFn: async () => {
      const data = await fetchProductModifierGroups();
      return data;
    },
    staleTime: 60_000,
    enabled,
  });
}

export function useCombos(enabled = true) {
  return useQuery({
    queryKey: ["combos"],
    queryFn: fetchCombos,
    staleTime: 60_000,
    enabled,
  });
}

export function useCombo(id?: number | null) {
  return useQuery({
    queryKey: ["combos", id],
    queryFn: () => fetchCombo(id!),
    enabled: id !== undefined && id !== null,
    staleTime: 60_000,
  });
}

export function getModifierGroupsForProduct(
  productId: number,
  groups: ProductModifierGroup[],
): ProductModifierGroup[] {
  return groups.filter((g) => g.product === productId);
}

export function useAllCombos(enabled = true) {
  return useQuery({
    queryKey: COMBO_KEYS.all,
    queryFn: fetchAllCombos,
    staleTime: 60_000,
    enabled,
  });
}

export function useCreateComboMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ComboWriteRequest) => createCombo(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMBO_KEYS.all }),
  });
}

export function useUpdateComboMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ComboWriteRequest> }) =>
      updateCombo(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: COMBO_KEYS.all });
      queryClient.invalidateQueries({ queryKey: COMBO_KEYS.detail(variables.id) });
    },
  });
}

export function useDeleteComboMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCombo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COMBO_KEYS.all }),
  });
}

export type { PosProduct, ProductModifierGroup, ComboList, Combo, ComboWriteRequest };
