"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchModuleCatalog } from "@/lib/api/module-catalog";
import type { ModuleCatalogMetadata } from "@/lib/api/types/modules";
import { COMPOSITE_SUBMODULES } from "@/lib/modules";

/**
 * Labels en castellano chileno para módulos cuyo catálogo del backend aún
 * entrega slugs en inglés. Si el backend envía un label distinto, lo respeta.
 */
const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  config: "Configuración",
  pos: "Punto de Venta (POS)",
  tables: "Mesas",
  sales: "Ventas",
  promotions: "Promociones",
  invoices: "Facturas",
  customers: "Clientes",
  clients: "Clientes",
  crm: "Clientes",
  inventory: "Inventario",
  products: "Productos",
  product_catalog: "Catálogo de Productos",
  product_gallery: "Galería de Productos",
  stock_control: "Control de Stock",
  warehouse_management: "Gestión de Bodegas",
  raw_materials: "Materias Primas",
  nutrition: "Nutrición",
  recipes: "Recetas",
  ingredients: "Ingredientes",
  finance: "Finanzas",
  financial: "Finanzas",
  payment_methods: "Métodos de Pago",
  bank_accounts: "Cuentas Bancarias",
  cash_register: "Arqueo de Caja",
  suppliers: "Proveedores",
  purchase_orders: "Órdenes de Compra",
  employees: "Empleados",
  departments: "Departamentos",
  positions: "Cargos",
  payroll: "Nómina",
  human_resources: "RRHH",
  scheduling: "Agendamiento",
  public_catalog: "Menús Digitales",
  analytics: "Analítica",
  ai_agents: "IA y Automatización",
  workflows: "Flujos de Trabajo",
  services: "Servicios",
  equipment: "Equipamiento",
  logistics: "Logística",
  deliveries: "Despachos",
  production: "Producción Cocina",
  measurements: "Mediciones",
  measurement_points: "Puntos de Medición",
};

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
    const raw = data?.composite_modules;
    if (Array.isArray(raw)) {
      // Forma array: [{ name, optional_submodules }]
      raw.forEach((composite) => {
        map.set(composite.name, composite.optional_submodules ?? []);
      });
    } else if (raw && typeof raw === "object") {
      // Forma mapa: { customers: ["clients"], inventory: [...] }
      for (const [name, subs] of Object.entries(raw as Record<string, unknown>)) {
        if (Array.isArray(subs)) {
          map.set(name, subs.filter((s): s is string => typeof s === "string"));
        }
      }
    }
    if (map.size === 0) {
      // Fallback: estructura estática conocida de módulos compuestos.
      for (const [name, subs] of Object.entries(COMPOSITE_SUBMODULES)) {
        if (subs) map.set(name, subs);
      }
    }
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
  const meta = metadataByName[moduleName];
  const translatedLabel = MODULE_LABELS[moduleName];
  return {
    label: translatedLabel ?? meta?.label ?? moduleName,
    icon: meta?.icon ?? "Package",
    category: meta?.category ?? "General",
    is_extension: meta?.is_extension,
  };
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
