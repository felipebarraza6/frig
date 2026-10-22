import type { ProductTypeOption } from "@/lib/api/types/modules";

export const FRIG_PRODUCT_TYPES = new Set(["DIRECT_SALE", "RECIPE_BASED", "RAW_MATERIAL"]);

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  DIRECT_SALE: "Venta directa",
  RECIPE_BASED: "Producto compuesto",
  RAW_MATERIAL: "Materia prima",
  SERVICE: "Servicio",
  MEASUREMENT_MATERIAL: "Materia de medición",
  TOOL: "Herramienta",
  EQUIPMENT: "Equipo",
  CERTIFICATE: "Certificado",
  SUPPLIER_PRODUCT: "Producto de proveedor",
  WASTE_MATERIAL: "Material de residuos",
  TANK_CONTAINER: "Estanque / contenedor",
  IOT: "Equipo IoT / Telemetría",
};

export const FRIG_DEFAULT_OPTIONS: ProductTypeOption[] = [
  { value: "DIRECT_SALE", label: "Venta directa" },
  { value: "RECIPE_BASED", label: "Producto compuesto" },
  { value: "RAW_MATERIAL", label: "Materia prima" },
];

const BASIC_FALLBACK: ProductTypeOption[] = [
  { value: "DIRECT_SALE", label: "Venta directa" },
  { value: "RECIPE_BASED", label: "Producto compuesto" },
];

export function resolveProductTypeOptions(args: {
  enabledTypes: string[];
  isDemo: boolean;
  equipmentOn: boolean;
  iotOn: boolean;
}): ProductTypeOption[] {
  const enabled = new Set(args.enabledTypes);
  const merged = new Map<string, ProductTypeOption>();

  if (args.isDemo) {
    FRIG_DEFAULT_OPTIONS.forEach((t) => merged.set(t.value, t));
  } else {
    for (const value of FRIG_PRODUCT_TYPES) {
      if (enabled.has(value)) {
        merged.set(value, {
          value,
          label: PRODUCT_TYPE_LABELS[value] ?? value,
        });
      }
    }
    if (merged.size === 0) {
      BASIC_FALLBACK.forEach((t) => merged.set(t.value, t));
    }
  }

  // Equipo / Herramienta solo si el backend los habilita para la sucursal:
  // ofrecerlos sin estar habilitados termina en "El tipo de producto 'TOOL'
  // no está habilitado para esta sucursal" al guardar.
  if (args.equipmentOn) {
    for (const value of ["EQUIPMENT", "TOOL"] as const) {
      if (enabled.has(value)) {
        merged.set(value, { value, label: PRODUCT_TYPE_LABELS[value] });
      }
    }
  }
  if (args.iotOn || enabled.has("IOT")) {
    merged.set("IOT", { value: "IOT", label: PRODUCT_TYPE_LABELS.IOT });
  }

  return Array.from(merged.values());
}
