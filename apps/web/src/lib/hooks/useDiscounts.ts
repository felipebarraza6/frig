import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllDiscounts,
  fetchDiscount,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  type DiscountFormPayload,
  type PromotionDiscount,
  type PromotionDiscountList,
} from "@/lib/api/discounts";

export const DISCOUNT_KEYS = {
  all: ["discounts"] as const,
  detail: (id: string) => [...DISCOUNT_KEYS.all, id] as const,
};

export function useAllDiscounts(enabled = true) {
  return useQuery({
    queryKey: DISCOUNT_KEYS.all,
    queryFn: fetchAllDiscounts,
    staleTime: 60_000,
    enabled,
  });
}

export function useDiscount(id: string | undefined | null) {
  return useQuery({
    queryKey: DISCOUNT_KEYS.detail(id ?? ""),
    queryFn: () => fetchDiscount(id!),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useCreateDiscountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DiscountFormPayload) => createDiscount(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DISCOUNT_KEYS.all }),
  });
}

export function useUpdateDiscountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<DiscountFormPayload> }) =>
      updateDiscount(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DISCOUNT_KEYS.all }),
  });
}

export function useDeleteDiscountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDiscount(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DISCOUNT_KEYS.all }),
  });
}

export type { PromotionDiscount, PromotionDiscountList, DiscountFormPayload };
