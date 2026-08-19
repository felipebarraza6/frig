"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchModuleCatalog } from "@/lib/api/module-catalog";
import type { ModuleCatalogMetadata } from "@/lib/api/types/modules";

export function useModuleCatalog() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["module-catalog"],
    queryFn: fetchModuleCatalog,
    staleTime: 5 * 60 * 1000,
  });

  const metadataByName = useMemo(() => {
    return data?.metadata ?? {};
  }, [data]);

  const compositeByName = useMemo(() => {
    const map = new Map<string, string[]>();
    data?.composite_modules.forEach((composite) => {
      map.set(composite.name, composite.optional_submodules ?? []);
    });
    return map;
  }, [data]);

  const allSubmodules = useMemo(() => {
    return Array.from(compositeByName.values()).flat();
  }, [compositeByName]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    Object.values(metadataByName).forEach((meta) => {
      if (meta.category) set.add(meta.category);
    });
    return Array.from(set);
  }, [metadataByName]);

  return {
    catalog: data,
    metadataByName,
    compositeByName,
    allSubmodules,
    categories,
    isLoading,
    error,
  };
}

export function getModuleMetadata(
  moduleName: string,
  metadataByName: Record<string, ModuleCatalogMetadata>,
): ModuleCatalogMetadata {
  return (
    metadataByName[moduleName] ?? {
      label: moduleName,
      icon: "Package",
      category: "General",
    }
  );
}

export function isCompositeModuleFromCatalog(
  moduleName: string,
  compositeByName: Map<string, string[]>,
): boolean {
  return compositeByName.has(moduleName);
}

export function getCompositeSubmodulesFromCatalog(
  moduleName: string,
  compositeByName: Map<string, string[]>,
): string[] {
  return compositeByName.get(moduleName) ?? [];
}
