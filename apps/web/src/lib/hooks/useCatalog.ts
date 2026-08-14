import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { toPosProduct, type PosProduct, type YggdraCategory } from "@/lib/api/types";
import type { YggdraPaginatedCategory, YggdraPaginatedProduct } from "@/lib/api/types";

export const PRODUCT_KEYS = {
  all: ["products"] as const,
};

export function useProducts(enabled = true) {
  return useQuery({
    queryKey: [...PRODUCT_KEYS.all, "sale"],
    queryFn: async () => {
      const data = await apiFetch<YggdraPaginatedProduct>(
        "/inventory/products/?is_for_sale=true&is_active=true",
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

export type { PosProduct };
