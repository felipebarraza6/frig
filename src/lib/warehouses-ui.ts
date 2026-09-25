import { createElement } from "react";
import type { LucideIcon } from "lucide-react";
import { Layers, Snowflake, Trash2, Warehouse as WarehouseIcon, Wrench } from "lucide-react";
import type { Warehouse, WarehouseProduct } from "@/lib/api/warehouses";

export const FALLBACK_WAREHOUSE_TYPES = [
  { value: "GENERAL", label: "Bodega general" },
  { value: "RAW_MATERIAL", label: "Materias primas" },
  { value: "TOOLS", label: "Herramientas" },
  { value: "WASTE", label: "Residuos" },
  { value: "CUSTOM", label: "Personalizada" },
] as const;

export function warehouseTypeLabel(value?: string | null): string {
  if (!value) return "Bodega";
  const found = FALLBACK_WAREHOUSE_TYPES.find((t) => t.value === value);
  return found?.label ?? value;
}

export function warehouseTypeIcon(value?: string | null): LucideIcon {
  switch (value) {
    case "RAW_MATERIAL":
      return Snowflake;
    case "TOOLS":
      return Wrench;
    case "WASTE":
      return Trash2;
    case "GENERAL":
      return WarehouseIcon;
    default:
      return Layers;
  }
}

/** Componente wrapper del icono por tipo: evita "componentes creados durante render"
 *  que marca el linter con la asignación `const Icon = warehouseTypeIcon(...)`. */
export function WarehouseTypeIcon({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  return createElement(warehouseTypeIcon(value), { className });
}

export function warehouseTypeAccent(value?: string | null): string {
  switch (value) {
    case "RAW_MATERIAL":
      return "bg-warning/15 text-warning border-warning/35";
    case "TOOLS":
      return "bg-muted text-foreground border-border";
    case "WASTE":
      return "bg-danger/15 text-danger border-danger/35";
    case "CUSTOM":
      return "bg-secondary text-foreground border-border";
    case "GENERAL":
    default:
      return "bg-primary/15 text-primary border-primary/35";
  }
}

/** Tint del recinto (paredes / suelo) por tipo. En dark las opacidades suben para mantener contraste. */
export function warehouseRoomTone(value?: string | null): {
  wall: string;
  floor: string;
  cargo: string;
  cargoDim: string;
} {
  switch (value) {
    case "RAW_MATERIAL":
      return {
        wall: "from-warning/20 via-card to-card dark:from-warning/25 dark:via-card dark:to-card",
        floor: "bg-warning/15 dark:bg-warning/25",
        cargo: "bg-warning",
        cargoDim: "bg-warning/30 dark:bg-warning/40",
      };
    case "TOOLS":
      return {
        wall: "from-muted via-card to-card dark:from-muted/80 dark:via-card dark:to-card",
        floor: "bg-muted dark:bg-muted/70",
        cargo: "bg-foreground/55 dark:bg-foreground/60",
        cargoDim: "bg-foreground/15 dark:bg-foreground/25",
      };
    case "WASTE":
      return {
        wall: "from-danger/15 via-card to-card dark:from-danger/25 dark:via-card dark:to-card",
        floor: "bg-danger/10 dark:bg-danger/20",
        cargo: "bg-danger/80 dark:bg-danger",
        cargoDim: "bg-danger/25 dark:bg-danger/40",
      };
    case "CUSTOM":
      return {
        wall: "from-secondary via-card to-card dark:from-secondary/80 dark:via-card dark:to-card",
        floor: "bg-secondary dark:bg-secondary/70",
        cargo: "bg-primary/70 dark:bg-primary/80",
        cargoDim: "bg-primary/20 dark:bg-primary/30",
      };
    case "GENERAL":
    default:
      return {
        wall: "from-primary/20 via-card to-card dark:from-primary/30 dark:via-card dark:to-card",
        floor: "bg-primary/10 dark:bg-primary/20",
        cargo: "bg-primary",
        cargoDim: "bg-primary/25 dark:bg-primary/40",
      };
  }
}

/** Color sólido de acento por tipo (para badges, puntos, celdas del mini-mapa). */
export function warehouseTypeToneSolid(value?: string | null): string {
  switch (value) {
    case "RAW_MATERIAL":
      return "bg-warning text-warning-foreground";
    case "TOOLS":
      return "bg-muted text-foreground";
    case "WASTE":
      return "bg-danger text-white";
    case "CUSTOM":
      return "bg-secondary text-secondary-foreground";
    case "GENERAL":
    default:
      return "bg-primary text-primary-foreground";
  }
}

/** Devuelve la clase semántica dominante de una bodega según alertas de stock. */
export function warehouseAlertTone(warehouse: Warehouse): string {
  if (numValue(warehouse.out_of_stock_products) > 0) return "text-danger bg-danger/10 border-danger/30";
  if (numValue(warehouse.low_stock_products) > 0) return "text-warning bg-warning/10 border-warning/30";
  return "text-success bg-success/10 border-success/30";
}

/** Estado general del recinto para usar en aria-label y tooltips. */
export function warehouseStatusSummary(warehouse: Warehouse): string {
  const out = numValue(warehouse.out_of_stock_products);
  const low = numValue(warehouse.low_stock_products);
  const products = numValue(warehouse.total_products);
  if (products <= 0) return "Vacío";
  if (out > 0) return `${out} sin stock`;
  if (low > 0) return `${low} stock bajo`;
  return "Stock en rango";
}

/** 0–1 para llenar el recinto cuando no hay capacidad: relativo al de mayor stock. */
export function warehouseRelativeFill(
  quantity: string | number | null | undefined,
  peakQuantity: number,
): number {
  if (peakQuantity <= 0) return 0;
  return Math.min(1, Math.max(0, numValue(quantity) / peakQuantity));
}

export function numValue(v: string | number | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** Ocupación 0–100, o null si la bodega no declara capacidad. */
export function warehouseOccupancy(capacity?: number | null, totalQuantity?: string | number | null): number | null {
  const cap = Number(capacity);
  if (!cap || cap <= 0) return null;
  return Math.min(100, Math.max(0, (numValue(totalQuantity) / cap) * 100));
}

export type LocationGroup = {
  location: string | null;
  items: WarehouseProduct[];
};

export function groupWarehouseProductsByLocation(products: WarehouseProduct[]): LocationGroup[] {
  const map = new Map<string, WarehouseProduct[]>();
  const unlocated: WarehouseProduct[] = [];
  for (const product of products) {
    const loc = product.location_in_warehouse?.trim();
    if (!loc) {
      unlocated.push(product);
      continue;
    }
    const key = loc.toLocaleLowerCase("es");
    const list = map.get(key) ?? [];
    list.push(product);
    map.set(key, list);
  }
  const groups: LocationGroup[] = [...map.values()].map((items) => ({
    location: items[0]?.location_in_warehouse?.trim() ?? null,
    items,
  }));
  groups.sort((a, b) => (a.location ?? "").localeCompare(b.location ?? "", "es"));
  if (unlocated.length > 0) groups.push({ location: null, items: unlocated });
  return groups;
}

/** 0–1 para la barra de nivel. Máx gana; si no hay, se usa mín/reorden/cantidad. */
export function stockFillRatio(wp: WarehouseProduct): number {
  const qty = numValue(wp.current_quantity);
  const max = wp.maximum_quantity != null && wp.maximum_quantity > 0
    ? Number(wp.maximum_quantity)
    : Math.max(qty, numValue(wp.minimum_quantity), numValue(wp.reorder_point), 1);
  return Math.min(1, Math.max(0, qty / max));
}

export function fillBarClass(status?: string | null): string {
  switch ((status ?? "").toUpperCase()) {
    case "OUT_OF_STOCK":
      return "bg-danger";
    case "LOW_STOCK":
    case "NEEDS_REORDER":
      return "bg-warning";
    default:
      return "bg-success";
  }
}

export function formatQty(value: string | number | null | undefined): string {
  const n = numValue(value);
  return n.toLocaleString("es-CL", { maximumFractionDigits: 2 });
}