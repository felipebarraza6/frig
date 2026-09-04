import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllDiscounts,
  fetchDiscount,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  fetchDiscountDashboard,
  fetchDiscountAnalytics,
  fetchDiscountUsageReport,
  fetchDiscountDetailReport,
  type DiscountFormPayload,
  type PromotionDiscount,
  type PromotionDiscountList,
  type DiscountUsageReportFilters,
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

export function useDiscountDashboard(branchId?: number | string | null) {
  return useQuery({
    queryKey: [...DISCOUNT_KEYS.all, "dashboard", branchId],
    queryFn: () => fetchDiscountDashboard(branchId),
    staleTime: 60_000,
  });
}

export function useDiscountAnalytics(
  startDate?: string,
  endDate?: string,
  branchId?: number | string | null,
) {
  return useQuery({
    queryKey: [...DISCOUNT_KEYS.all, "analytics", startDate, endDate, branchId],
    queryFn: () => fetchDiscountAnalytics(startDate, endDate, branchId),
    staleTime: 60_000,
  });
}

export function useDiscountUsageReport(filters: DiscountUsageReportFilters = {}) {
  return useQuery({
    queryKey: [...DISCOUNT_KEYS.all, "usage-report", filters],
    queryFn: () => fetchDiscountUsageReport(filters),
    staleTime: 60_000,
  });
}

export function useDiscountDetailReport(id: string | undefined | null) {
  return useQuery({
    queryKey: [...DISCOUNT_KEYS.all, "detail-report", id],
    queryFn: () => fetchDiscountDetailReport(id!),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export type { PromotionDiscount, PromotionDiscountList, DiscountFormPayload };
