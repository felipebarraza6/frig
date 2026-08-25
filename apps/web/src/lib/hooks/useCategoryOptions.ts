"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCategories } from "@/lib/api/categories";

export interface CategoryOption {
  id: number;
  name: string;
}

/**
 * Hook centralizado para obtener las opciones de categoría usadas en selects.
 *
 * Usa el listado paginado `/inventory/categories/` (el mismo endpoint de la
 * página de Categorías) porque es el que hemos verificado que trae datos en
 * todas las sucursales. El endpoint `/inventory/categories/simple-list/` ha
 * mostrado comportamiento inconsistente (devuelve vacío aunque el paginado
 * tenga resultados), por lo que ya no se usa aquí.
 */
export function useCategoryOptions() {
  const {
    data: page,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["categories", "options"],
    queryFn: () => fetchCategories({}),
    staleTime: 60_000,
    retry: 1,
  });

  const options = useMemo<CategoryOption[]>(() => {
    return (page?.results ?? []).map((c) => ({
      id: Number(c.id),
      name: c.name ?? "Sin nombre",
    }));
  }, [page]);

  return {
    options,
    isLoading,
    error,
    refetch,
  };
}
