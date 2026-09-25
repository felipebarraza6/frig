"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { m, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  Trash2,
  Search,
  Warehouse,
  ChevronLeft,
  ChevronRight,
  Copy,
  Power,
  FileText,
  CircleDollarSign,
  ChefHat,
  Layers,
  Apple,
  Hash,
  Tags,
  Truck,
  Ruler,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Field } from "@/components/ui/field";
import { cn, stockStatusLabel } from "@/lib/utils";
import { statusBadge } from "@/lib/status-styles";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { useCategoryOptions } from "@/lib/hooks/useCategoryOptions";
import { fetchProduct, searchProductsByType } from "@/lib/api/products";
import type { ProductPayload } from "@/lib/api/products";
import type { YggdraProduct } from "@/lib/api/types";
import {
  lookupSuppliers,
  fetchSupplierProductsByProduct,
  pickPreferredSupplierProduct,
  createSupplierProduct,
  updateSupplierProduct,
} from "@/lib/api/suppliers";
import { useToast } from "@/lib/store/toast";
import { useCurrentBranch } from "@/lib/store/session";
import { ProductTypePicker } from "@/components/products/product-type-picker";
import { CompoundAvailability } from "@/components/products/compound-availability";
import { IngredientNutritionQuickEdit } from "@/components/products/ingredient-nutrition-quick-edit";
import {
  fetchRecipesByProduct,
  createRecipe,
  updateRecipe,
  createRecipeIngredient,
  updateRecipeIngredient,
  deleteRecipeIngredient,
  calculateRecipeNutrition,
  type RecipePayload,
  type RecipeIngredientPayload,
} from "@/lib/api/recipes";
import {
  fetchWarehouses,
  fetchProductWarehouses,
  addProductToWarehouse,
  deleteWarehouseProduct,
} from "@/lib/api/warehouses";
import {
  fetchModifierGroups,
  fetchProductModifierGroups,
  assignModifierGroupToProduct,
  removeProductModifierGroup,
  updateProductModifierGroup,
  type ModifierGroupList,
  type ProductModifierGroup,
  type ProductModifierGroupWriteRequest,
} from "@/lib/api/modifier-groups";
import { useBranchProductTypes } from "@/lib/hooks/useBranchProductTypes";

import { useIsNutritionEnabled, useIsModuleEnabledFromConfig } from "@/lib/store/session";
import type { YggdraSchemas } from "@/lib/api/types";

const RECIPE_TYPES = [
  { value: "SIMPLE", label: "Simple" },
  { value: "PREPARATION", label: "Preparación" },
  { value: "COOKING", label: "Cocción" },
  { value: "ASSEMBLY", label: "Ensamblaje" },
] as const;

/** Unidades de medida normalizadas. Evita que "Kg" y "kg" sean distintos. */
const MEASUREMENT_UNITS = [
  { value: "unidad", label: "Unidad" },
  { value: "kg", label: "Kilogramo (kg)" },
  { value: "g", label: "Gramo (g)" },
  { value: "litro", label: "Litro" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "porcion", label: "Porción" },
  { value: "docena", label: "Docena" },
  { value: "metro", label: "Metro" },
  { value: "cm", label: "Centímetro" },
  { value: "m2", label: "Metro cuadrado (m²)" },
  { value: "caja", label: "Caja" },
  { value: "botella", label: "Botella" },
  { value: "lata", label: "Lata" },
  { value: "bolsa", label: "Bolsa" },
  { value: "otro", label: "Otro…" },
] as const;

type IngredientProduct = YggdraSchemas["ProductList"];

interface IngredientDraft {
  localId: string;
  id?: number; // real id si ya existe
  ingredient: number;
  /** Nombre/código cacheados: el API ya los trae y evita mostrar "Producto #X"
   * cuando el ingrediente no está en los resultados de búsqueda actuales. */
  ingredient_name?: string;
  ingredient_code?: string | null;
  quantity: string;
  unit: string;
  is_optional?: boolean;
  preparation_notes?: string;
}

interface ModifierAssignmentDraft {
  id?: number;
  modifier_group: number;
  is_required: boolean;
  groupName?: string;
}

interface YggdraProductDetail extends Omit<YggdraProduct, "category" | "branch" | "history_product"> {
  /** El listado trae la categoría expandida; el retrieve trae el id numérico. */
  category?: number | null | { id: number; name?: string };
  is_nutritional_ingredient?: boolean;
  is_public?: boolean;
  tracks_inventory?: boolean;
  energy_kcal?: number | null;
  proteins_g?: number | null;
  total_fats_g?: number | null;
  saturated_fats_g?: number | null;
  monounsaturated_fats_g?: number | null;
  polyunsaturated_fats_g?: number | null;
  trans_fats_g?: number | null;
  cholesterol_mg?: number | null;
  carbohydrates_g?: number | null;
  total_sugars_g?: number | null;
  sodium_mg?: number | null;
}

export type FormTab = "basic" | "pricing" | "recipe" | "warehouses" | "nutrition" | "modifiers";

interface ProductFormProps {
  product?: YggdraProductDetail;
  productId?: number;
  initialTab?: FormTab;
  onClose: () => void;
  onSubmit: (payload: ProductPayload, id?: number) => Promise<YggdraProduct>;
  extraActions?: {
    onCopy: () => void;
    onDelete: () => void;
    onToggleActive: () => void;
    isTogglingActive?: boolean;
  };
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Convierte un valor numérico del API a string para el estado del formulario. */
function numToStr(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

type WarehouseProduct = YggdraSchemas["WarehouseProduct"];

function groupProductWarehousesByWarehouse(items: WarehouseProduct[]): WarehouseProduct[] {
  const groups = new Map<string, WarehouseProduct[]>();
  for (const item of items) {
    const key = String(item.warehouse.id ?? item.warehouse.name ?? "").trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  return Array.from(groups.values()).map((group) => {
    const first = group[0];
    let minimumQuantity: number | undefined;
    let maximumQuantity: number | null = null;
    let reorderPoint: number | undefined;
    let currentQuantity = 0;
    let location = first.location_in_warehouse ?? null;
    let earliestCreated = first.created;
    let recordId = first.id;
    let stockStatus = first.stock_status;

    for (const w of group) {
      currentQuantity += Number(w.current_quantity ?? 0);
      if (w.minimum_quantity != null) {
        minimumQuantity =
          minimumQuantity === undefined ? w.minimum_quantity : Math.min(minimumQuantity, w.minimum_quantity);
      }
      if (w.maximum_quantity != null) {
        maximumQuantity =
          maximumQuantity === null ? w.maximum_quantity : Math.max(maximumQuantity, w.maximum_quantity);
      }
      if (w.reorder_point != null) {
        reorderPoint =
          reorderPoint === undefined ? w.reorder_point : Math.min(reorderPoint, w.reorder_point);
      }
      if (!location && w.location_in_warehouse) {
        location = w.location_in_warehouse;
      }
      if (w.created < earliestCreated) {
        earliestCreated = w.created;
        recordId = w.id;
      }
    }

    if (minimumQuantity != null && currentQuantity <= minimumQuantity) {
      stockStatus = currentQuantity <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK";
    } else if (currentQuantity <= 0) {
      stockStatus = "OUT_OF_STOCK";
    } else if (group.length === 1) {
      stockStatus = first.stock_status;
    } else {
      stockStatus = "IN_STOCK";
    }

    return {
      ...first,
      id: recordId,
      current_quantity: currentQuantity,
      minimum_quantity: minimumQuantity,
      maximum_quantity: maximumQuantity,
      reorder_point: reorderPoint,
      location_in_warehouse: location,
      stock_status: stockStatus,
      created: earliestCreated,
    } as WarehouseProduct;
  });
}

function buildInitialForm(product?: YggdraProductDetail, defaultProductType?: string) {
  return {
    name: product?.name ?? "",
    code: product?.code ?? "",
    description: product?.description ?? "",
    price: numToStr(product?.sale_price ?? product?.price),
    costPrice: numToStr(product?.cost_price),
    priceInternal: numToStr(product?.price_internal),
    wholesalePrice: numToStr(product?.wholesale_price),
    stock: product?.quantity !== undefined ? String(product.quantity) : "",
    minimumStock: product?.minimum_stock !== undefined ? String(product.minimum_stock) : "",
    measurementUnit: product?.measurement_unit ?? "",
    category:
      product?.category && typeof product.category === "object"
        ? String(product.category.id)
        : typeof product?.category === "number"
          ? String(product.category)
          : "",
    supplier: "",
    productType: product?.product_type ?? defaultProductType ?? "DIRECT_SALE",
    isForSale: product?.is_for_sale ?? true,
    isForInternalUse: product?.is_for_internal_use ?? false,
    isPublic: product?.is_public ?? false,
    isActive: product?.is_active ?? true,
    isNutritionalIngredient: product?.is_nutritional_ingredient ?? false,
    energyKcal: numToStr(product?.energy_kcal),
    proteinsG: numToStr(product?.proteins_g),
    totalFatsG: numToStr(product?.total_fats_g),
    saturatedFatsG: numToStr(product?.saturated_fats_g),
    monounsaturatedFatsG: numToStr(product?.monounsaturated_fats_g),
    polyunsaturatedFatsG: numToStr(product?.polyunsaturated_fats_g),
    transFatsG: numToStr(product?.trans_fats_g),
    cholesterolMg: numToStr(product?.cholesterol_mg),
    carbohydratesG: numToStr(product?.carbohydrates_g),
    totalSugarsG: numToStr(product?.total_sugars_g),
    sodiumMg: numToStr(product?.sodium_mg),
  };
}

function StatusSwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
  accent,
  disabled,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 transition-all duration-200",
        disabled && "opacity-60",
        checked
          ? accent
            ? "bg-primary/12 text-foreground shadow-[inset_0_1px_0_var(--glass-highlight)]"
            : "bg-secondary/40 shadow-[inset_0_1px_0_var(--glass-highlight)]"
          : "bg-transparent hover:bg-muted/35",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        label={title}
        disabled={disabled}
        className="mt-0.5"
      />
    </div>
  );
}

/** Toggle compacto para el header del modal (siempre visible). */
function HeaderStatusToggle({
  label,
  checked,
  onCheckedChange,
  disabled,
  activeClassName,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  activeClassName?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full px-2.5 text-xs font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        "shadow-[inset_0_1px_0_var(--glass-highlight)]",
        checked
          ? (activeClassName ?? "bg-primary/20 text-primary ring-1 ring-primary/30")
          : "bg-muted/40 text-muted-foreground ring-1 ring-border/50 hover:bg-muted/70 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-background shadow transition-transform duration-200",
            checked ? "left-3.5" : "left-0.5",
          )}
        />
      </span>
      {label}
    </button>
  );
}

/** Bloque plano: label + contenido, sin card anidada. */
function FormSection({
  title,
  children,
  className,
  tint,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  tint?: "primary" | "success" | "warning" | "none";
}) {
  return (
    <section className={cn("relative", className)}>
      {title ? (
        <div className="mb-2 flex items-center gap-2">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              tint === "success" && "bg-success",
              tint === "warning" && "bg-warning",
              tint === "primary" && "bg-primary",
              (!tint || tint === "none") && "bg-primary/70",
            )}
          />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {title}
          </h3>
          <span className="h-px flex-1 bg-gradient-to-r from-border/80 to-transparent" />
        </div>
      ) : null}
      {children}
    </section>
  );
}

function IconFieldShell({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Icon className="pointer-events-none absolute left-2.5 top-1/2 z-[1] h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <div className="[&_input]:pl-8 [&_button]:pl-8 [&_select]:pl-8">{children}</div>
    </div>
  );
}

function ProductFormSkeleton() {
  return (
    <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-background shadow-lg sm:h-[85vh] sm:max-w-4xl sm:rounded-xl sm:border">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
        <div className="overflow-x-auto rounded-lg bg-muted p-1">
          <div className="flex min-w-max gap-1 sm:min-w-0 sm:flex-wrap">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-7 flex-1 rounded-md" />
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-6">
        <Skeleton className="h-9 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
    </div>
  );
}

export function ProductForm({ product, productId, initialTab, onClose, onSubmit, extraActions }: ProductFormProps) {
  const queryClient = useQueryClient();
  const { data: loadedProduct, isLoading: loadingProduct } = useQuery<YggdraProductDetail>({
    queryKey: ["products", "detail", productId],
    queryFn: () => fetchProduct(productId!) as Promise<YggdraProductDetail>,
    enabled: !!productId,
  });
  const effectiveProduct = product ?? loadedProduct;

  const { options: productTypeOptions, defaultType, isLoading: loadingProductTypes } = useBranchProductTypes();
  const nutritionEnabled = useIsNutritionEnabled();
  // El check "Público en menú QR" depende del módulo Menús y vitrinas
  // (public_catalog), igual que el tab Nutrición depende de `nutrition`.
  const publicCatalogEnabled = useIsModuleEnabledFromConfig("public_catalog");
  // El tab Bodegas depende del módulo Inventario.
  const inventoryEnabled = useIsModuleEnabledFromConfig("inventory");
  const { options: categories, isLoading: loadingCategories } = useCategoryOptions();

  // Mostramos un skeleton dentro del modal mientras llegan los datos mínimos
  // necesarios para no pintar selects vacíos ni mezclar valores antiguos.
  const isInitializing =
    (productId ? loadingProduct : false) || loadingProductTypes || loadingCategories;

  const [form, setForm] = useState<{
    name: string;
    code: string;
    description: string;
    price: string;
    costPrice: string;
    priceInternal: string;
    wholesalePrice: string;
    stock: string;
    minimumStock: string;
    measurementUnit: string;
    category: string;
    supplier: string;
    productType: string;
    isForSale: boolean;
    isForInternalUse: boolean;
    isPublic: boolean;
    isActive: boolean;
    isNutritionalIngredient: boolean;
    energyKcal: string;
    proteinsG: string;
    totalFatsG: string;
    saturatedFatsG: string;
    monounsaturatedFatsG: string;
    polyunsaturatedFatsG: string;
    transFatsG: string;
    cholesterolMg: string;
    carbohydratesG: string;
    totalSugarsG: string;
    sodiumMg: string;
  }>(buildInitialForm(product, defaultType));

  // Al abrir en edición el producto se carga asíncronamente (productId); al
  // llegar el detalle, o si cambia el producto recibido por prop, reseteamos
  // el formulario para evitar valores vacíos o mezclados.
  // Solo nos interesa el id: no queremos re-resetear en cada render si la
  // referencia del objeto cambia.
  // También invalidamos el sync de proveedor: defaultType puede llegar después
  // y un reset del form no debe dejar el supplier “trabado” con el valor viejo.
  const supplierSyncKeyRef = useRef<string | null>(null);
  const [supplierLabel, setSupplierLabel] = useState("");
  useEffect(() => {
    setForm(buildInitialForm(effectiveProduct, defaultType));
    setSupplierLabel("");
    supplierSyncKeyRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveProduct?.id, defaultType]);

  // Misma key que inventario: a veces el cache trae la página `{ results }` y
  // a veces un array (queryFn viejo). Normalizamos para evitar
  // `warehouses.filter is not a function`.
  const { data: warehousesPage } = useQuery({
    queryKey: ["warehouses", "all"],
    queryFn: () => fetchWarehouses({ page_size: 100 }),
    enabled: inventoryEnabled,
  });
  const warehouses = useMemo(() => {
    if (Array.isArray(warehousesPage)) return warehousesPage;
    if (warehousesPage && Array.isArray(warehousesPage.results)) return warehousesPage.results;
    return [];
  }, [warehousesPage]);

  const { data: productWarehouses = [], isLoading: loadingProductWarehouses } = useQuery({
    queryKey: ["warehouse-products", "product", "v2", effectiveProduct?.id],
    queryFn: () =>
      fetchProductWarehouses(effectiveProduct!.id, {
        productName: effectiveProduct?.name,
      }),
    enabled: !!effectiveProduct?.id && inventoryEnabled,
    staleTime: 0,
  });

  const groupedProductWarehouses = useMemo(
    () => groupProductWarehousesByWarehouse(productWarehouses),
    [productWarehouses],
  );

  const { data: modifierGroups = [], isLoading: loadingModifierGroups } = useQuery({
    queryKey: ["modifier-groups"],
    queryFn: fetchModifierGroups,
  });

  const { data: productModifierGroups = [], isLoading: loadingProductModifierGroups } = useQuery({
    queryKey: ["product-modifier-groups", effectiveProduct?.id],
    queryFn: () => fetchProductModifierGroups(effectiveProduct!.id),
    enabled: !!effectiveProduct?.id,
  });

  const branch = useCurrentBranch();
  const toast = useToast();

  const [supplierQuery, setSupplierQuery] = useState("");
  const [debouncedSupplierQuery, setDebouncedSupplierQuery] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSupplierQuery(supplierQuery), 300);
    return () => window.clearTimeout(t);
  }, [supplierQuery]);

  const supplierLookup = useQuery({
    queryKey: ["suppliers", "lookup", "product-form", debouncedSupplierQuery],
    queryFn: () => lookupSuppliers({ q: debouncedSupplierQuery, limit: 20 }),
    enabled: debouncedSupplierQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  const supplierLinkQuery = useQuery({
    queryKey: ["supplier-products", "by-product", "v2", effectiveProduct?.id],
    queryFn: () =>
      fetchSupplierProductsByProduct(effectiveProduct!.id, {
        productName: effectiveProduct?.name,
      }),
    enabled: !!effectiveProduct?.id,
    staleTime: 0,
  });
  const supplierProductsForProduct = supplierLinkQuery.data ?? [];
  const loadingSupplierProduct = supplierLinkQuery.isFetching && !supplierLinkQuery.isFetched;

  const linkedSupplierOptions = useMemo(
    () =>
      supplierProductsForProduct.map((sp) => ({
        value: String(sp.supplier),
        label: sp.is_preferred ? `${sp.supplier_name} · preferido` : sp.supplier_name,
        description: sp.supplier_product_code || undefined,
      })),
    [supplierProductsForProduct],
  );

  const supplierOptions = useMemo(() => {
    const found = (supplierLookup.data ?? []).map((s) => ({
      value: s.id,
      label: s.name,
      description: [s.tax_id, s.business_name].filter(Boolean).join(" · ") || undefined,
    }));
    const byValue = new Map<string, { value: string; label: string; description?: string }>();
    for (const opt of [...linkedSupplierOptions, ...found]) {
      if (!byValue.has(opt.value)) byValue.set(opt.value, opt);
    }
    if (form.supplier && supplierLabel && !byValue.has(form.supplier)) {
      byValue.set(form.supplier, { value: form.supplier, label: supplierLabel });
    }
    return Array.from(byValue.values());
  }, [supplierLookup.data, linkedSupplierOptions, form.supplier, supplierLabel]);

  // Sync proveedor principal cuando llegan los vínculos (tras fetch real).
  // No usar isLoading=false + data=[]: con la query disabled eso “traba” el
  // supplier vacío o el primero global. Esperamos isFetched.
  useEffect(() => {
    const productId = effectiveProduct?.id;
    if (!productId || !supplierLinkQuery.isFetched) return;

    const syncKey = `${productId}:${supplierLinkQuery.dataUpdatedAt}`;
    if (supplierSyncKeyRef.current === syncKey) return;
    supplierSyncKeyRef.current = syncKey;

    const principal = pickPreferredSupplierProduct(supplierProductsForProduct);
    if (principal) {
      setForm((prev) => ({ ...prev, supplier: String(principal.supplier) }));
      setSupplierLabel(principal.supplier_name || "");
    } else {
      setForm((prev) => ({ ...prev, supplier: "" }));
      setSupplierLabel("");
    }
  }, [
    effectiveProduct?.id,
    supplierLinkQuery.isFetched,
    supplierLinkQuery.dataUpdatedAt,
    supplierProductsForProduct,
  ]);

  const [tracksWarehouseStock, setTracksWarehouseStock] = useState(false);

  // "Controla inventario": inicializa desde el producto (default true, igual
  // que el backend). Resetea igual que el form cuando cambia el producto
  // editado (el detalle llega asíncrono cuando se abre por productId).
  useEffect(() => {
    setTracksWarehouseStock(effectiveProduct?.tracks_inventory ?? true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveProduct?.id]);
  const [warehouseAssignments, setWarehouseAssignments] = useState<
    {
      localId: string;
      warehouseId: string;
      initialQuantity: string;
      minimumQuantity: string;
      maximumQuantity: string;
      reorderPoint: string;
      location: string;
    }[]
  >([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedInitialQty, setSelectedInitialQty] = useState("");
  const [selectedMinimumQty, setSelectedMinimumQty] = useState("");
  const [selectedMaximumQty, setSelectedMaximumQty] = useState("");
  const [selectedReorderPoint, setSelectedReorderPoint] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [removingWarehouseId, setRemovingWarehouseId] = useState<number | null>(null);

  const [modifierAssignments, setModifierAssignments] = useState<ModifierAssignmentDraft[]>([]);

  useEffect(() => {
    if (productModifierGroups.length > 0) {
      setModifierAssignments(
        productModifierGroups.map((pmg) => ({
          id: pmg.id,
          modifier_group: pmg.modifier_group.id,
          is_required: pmg.is_required ?? false,
          groupName: pmg.modifier_group_name,
        })),
      );
    }
  }, [productModifierGroups]);

  const [recipe, setRecipe] = useState<{
    id?: string;
    name: string;
    instructions: string;
    recipe_type: RecipePayload["recipe_type"];
    preparation_time_minutes: string;
    cooking_time_minutes: string;
    yield_quantity: string;
    yield_unit: string;
    servings: string;
    notes: string;
  }>({
    name: effectiveProduct ? `${effectiveProduct.name} - Receta` : "",
    instructions: "",
    recipe_type: "SIMPLE",
    preparation_time_minutes: "",
    cooking_time_minutes: "",
    yield_quantity: "",
    yield_unit: "",
    servings: "",
    notes: "",
  });

  const [ingredients, setIngredients] = useState<IngredientDraft[]>([]);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [ingredientSearchInput, setIngredientSearchInput] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setIngredientSearch(ingredientSearchInput), 300);
    return () => clearTimeout(timer);
  }, [ingredientSearchInput]);

  const [removedIngredientIds, setRemovedIngredientIds] = useState<number[]>([]);

  const isCompound = form.productType === "RECIPE_BASED";
  const isRawMaterial = form.productType === "RAW_MATERIAL";
  const isSellable = !isRawMaterial;
  /** Receta existente que quedaría huérfana si se guarda con otro tipo. */
  const orphanRecipe = Boolean(recipe.id) && !isCompound;
  /** True si la unidad de medida no está en el catálogo normalizado. */
  const isCustomUnit = form.measurementUnit
    ? !MEASUREMENT_UNITS.some((u) => u.value === form.measurementUnit)
    : false;

  const [activeTab, setActiveTab] = useState<FormTab>(initialTab ?? "basic");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollEdge, setScrollEdge] = useState({ top: false, bottom: false });

  const tabs = useMemo<{ id: FormTab; label: string; icon: LucideIcon; enabled: boolean }[]>(() => {
    const list: { id: FormTab; label: string; icon: LucideIcon; enabled: boolean }[] = [
      { id: "basic", label: "Datos", icon: FileText, enabled: true },
      { id: "pricing", label: "Precios", icon: CircleDollarSign, enabled: true },
      { id: "recipe", label: "Receta", icon: ChefHat, enabled: isCompound },
      // En compuestos el tab muestra la disponibilidad calculada desde los
      // ingredientes (no gestionan stock propio por bodega).
      { id: "warehouses", label: "Bodegas", icon: Warehouse, enabled: inventoryEnabled },
      { id: "modifiers", label: "Mods", icon: Layers, enabled: true },
      ];
    if (nutritionEnabled) {
      list.push({ id: "nutrition", label: "Nutrición", icon: Apple, enabled: true });
    }
    return list;
  }, [isCompound, nutritionEnabled, inventoryEnabled]);

  const enabledTabs = useMemo(() => tabs.filter((t) => t.enabled), [tabs]);

  useEffect(() => {
    if (isInitializing) return;
    const t = window.setTimeout(() => nameInputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [isInitializing, effectiveProduct?.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
        return;
      }
      if (meta && e.key === "Enter") {
        e.preventDefault();
        formRef.current?.requestSubmit();
        return;
      }
      if (e.altKey && e.key >= "1" && e.key <= "9") {
        const idx = Number(e.key) - 1;
        const tab = enabledTabs[idx];
        if (tab) {
          e.preventDefault();
          setActiveTab(tab.id);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabledTabs]);

  function updateScrollEdges() {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop > 4;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    setScrollEdge((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollEdges();
    el.addEventListener("scroll", updateScrollEdges, { passive: true });
    const ro = new ResizeObserver(updateScrollEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollEdges);
      ro.disconnect();
    };
  }, [activeTab, isInitializing]);

  // Al cargar las opciones de tipo (la query puede llegar después de abrir el
  // form), corrige el valor actual si no está entre las disponibles.
  useEffect(() => {
    if (productTypeOptions.length === 0) return;
    if (productTypeOptions.some((o) => o.value === form.productType)) return;
    const next =
      defaultType && productTypeOptions.some((o) => o.value === defaultType)
        ? defaultType
        : productTypeOptions[0]?.value;
    if (next) setForm((prev) => ({ ...prev, productType: next }));
  }, [productTypeOptions, defaultType, form.productType]);

  // Al cambiar a materia prima en un alta nueva, apaga venta/público una vez.
  // El usuario puede volver a activar En venta (Yggdra lo permite en RAW_MATERIAL).
  const rawSaleDefaultAppliedRef = useRef(false);
  useEffect(() => {
    if (!isRawMaterial || effectiveProduct) {
      rawSaleDefaultAppliedRef.current = false;
      return;
    }
    if (rawSaleDefaultAppliedRef.current) return;
    rawSaleDefaultAppliedRef.current = true;
    setForm((prev) => ({ ...prev, isForSale: false, isPublic: false }));
  }, [isRawMaterial, effectiveProduct]);

  // Si se desmarca la gestión por bodega, limpiar las asignaciones pendientes.
  useEffect(() => {
    if (!tracksWarehouseStock && warehouseAssignments.length > 0) {
      setWarehouseAssignments([]);
    }
  }, [tracksWarehouseStock, warehouseAssignments.length]);

  // Antes el tab Bodegas activaba silenciosamente la gestión de stock. Ahora el
  // switch "Controla inventario" es visible en Precios y venta e inicializa
  // desde el producto, así que se respeta la elección del usuario: entrar a
  // Bodegas no vuelve a prenderlo si el usuario lo apagó.

  const {
    data: existingRecipes = [],
    isLoading: loadingRecipes,
    error: recipesError,
  } = useQuery({
    queryKey: ["recipes", "by-product", effectiveProduct?.id],
    queryFn: () => fetchRecipesByProduct(effectiveProduct!.id),
    enabled: !!effectiveProduct && isCompound,
  });

  useEffect(() => {
    if (existingRecipes.length > 0) {
      const r = existingRecipes[0];
      setRecipe({
        id: r.id,
        name: r.name,
        instructions: r.instructions ?? "",
        recipe_type: r.recipe_type ?? "SIMPLE",
        preparation_time_minutes: r.preparation_time_minutes !== undefined ? String(r.preparation_time_minutes) : "",
        cooking_time_minutes: r.cooking_time_minutes !== undefined ? String(r.cooking_time_minutes) : "",
        yield_quantity: r.yield_quantity !== undefined ? String(r.yield_quantity) : "",
        yield_unit: r.yield_unit ?? "",
        servings: r.servings !== undefined ? String(r.servings) : "",
        notes: r.notes ?? "",
      });
      setIngredients(
        r.ingredients.map((ing) => ({
          localId: generateId(),
          id: ing.id,
          ingredient: ing.ingredient,
          ingredient_name: ing.ingredient_name,
          ingredient_code: ing.ingredient_code ?? null,
          quantity: String(ing.quantity),
          unit: ing.unit,
          is_optional: ing.is_optional,
          preparation_notes: ing.preparation_notes ?? "",
        })),
      );
    }
  }, [existingRecipes]);

  const { data: ingredientProducts = [] } = useQuery({
    queryKey: ["products", "raw-materials", ingredientSearch],
    queryFn: () =>
      searchProductsByType({
        product_type: "RAW_MATERIAL",
        search: ingredientSearch,
      }),
    enabled: isCompound && ingredientSearch.trim().length >= 2,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculatingNutrition, setCalculatingNutrition] = useState(false);

  async function handleCalculateNutrition() {
    if (!recipe.id) {
      setError("Guarda la receta primero para calcular la nutrición.");
      return;
    }
    setCalculatingNutrition(true);
    setError(null);
    try {
      const result = await calculateRecipeNutrition(recipe.id);
      setForm((prev) => ({
        ...prev,
        isNutritionalIngredient: true,
        energyKcal: numToStr(result.calculated_energy_kcal),
        proteinsG: numToStr(result.calculated_proteins_g),
        totalFatsG: numToStr(result.calculated_total_fats_g),
        saturatedFatsG: numToStr(result.calculated_saturated_fats_g),
        monounsaturatedFatsG: numToStr(result.calculated_monounsaturated_fats_g),
        polyunsaturatedFatsG: numToStr(result.calculated_polyunsaturated_fats_g),
        cholesterolMg: numToStr(result.calculated_cholesterol_mg),
        carbohydratesG: numToStr(result.calculated_carbohydrates_g),
        totalSugarsG: numToStr(result.calculated_total_sugars_g),
        sodiumMg: numToStr(result.calculated_sodium_mg),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al calcular nutrición");
    } finally {
      setCalculatingNutrition(false);
    }
  }

  function updateField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateRecipeField<K extends keyof typeof recipe>(field: K, value: (typeof recipe)[K]) {
    setRecipe((prev) => ({ ...prev, [field]: value }));
  }

  function addIngredient(product: IngredientProduct) {
    setIngredients((prev) => [
      ...prev,
      {
        localId: generateId(),
        ingredient: product.id,
        ingredient_name: product.name,
        ingredient_code: product.code ?? null,
        quantity: "",
        unit: product.measurement_unit ?? "",
        is_optional: false,
        preparation_notes: "",
      },
    ]);
    setIngredientSearch("");
    setIngredientSearchInput("");
  }

  function updateIngredient(localId: string, patch: Partial<IngredientDraft>) {
    setIngredients((prev) => prev.map((i) => (i.localId === localId ? { ...i, ...patch } : i)));
  }

  function removeIngredient(localId: string) {
    setIngredients((prev) => {
      const item = prev.find((i) => i.localId === localId);
      if (item?.id) {
        setRemovedIngredientIds((ids) => [...ids, item.id!]);
      }
      return prev.filter((i) => i.localId !== localId);
    });
  }

  function addWarehouseAssignment() {
    if (!selectedWarehouse) return;
    setWarehouseAssignments((prev) => [
      ...prev,
      {
        localId: generateId(),
        warehouseId: selectedWarehouse,
        initialQuantity: selectedInitialQty || "0",
        minimumQuantity: selectedMinimumQty,
        maximumQuantity: selectedMaximumQty,
        reorderPoint: selectedReorderPoint,
        location: selectedLocation,
      },
    ]);
    setSelectedWarehouse("");
    setSelectedInitialQty("");
    setSelectedMinimumQty("");
    setSelectedMaximumQty("");
    setSelectedReorderPoint("");
    setSelectedLocation("");
  }

  function removeWarehouseAssignment(localId: string) {
    setWarehouseAssignments((prev) => prev.filter((a) => a.localId !== localId));
  }

  async function removeExistingWarehouseProduct(id: number) {
    if (!effectiveProduct?.id) return;
    setRemovingWarehouseId(id);
    try {
      await deleteWarehouseProduct(id);
      queryClient.invalidateQueries({ queryKey: ["warehouse-products", "product", effectiveProduct.id] });
      queryClient.invalidateQueries({ queryKey: ["products", effectiveProduct.id, "warehouses"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar la bodega");
    } finally {
      setRemovingWarehouseId(null);
    }
  }

  function getAssignment(groupId: number) {
    return modifierAssignments.find((a) => a.modifier_group === groupId);
  }

  function toggleGroupAssignment(group: ModifierGroupList) {
    setModifierAssignments((prev) => {
      const exists = prev.some((a) => a.modifier_group === group.id);
      if (exists) {
        return prev.filter((a) => a.modifier_group !== group.id);
      }
      return [
        ...prev,
        {
          modifier_group: group.id,
          is_required: group.is_required ?? false,
          groupName: group.name,
        },
      ];
    });
  }

  function updateAssignmentRequired(groupId: number, is_required: boolean) {
    setModifierAssignments((prev) =>
      prev.map((a) => (a.modifier_group === groupId ? { ...a, is_required } : a)),
    );
  }

  async function saveWarehouseAssignments(productId: number) {
    await Promise.all(
      warehouseAssignments.map((a) =>
        addProductToWarehouse({
          warehouse_id: Number(a.warehouseId),
          product_id: productId,
          initial_quantity: Number(a.initialQuantity) || 0,
          minimum_quantity: a.minimumQuantity ? Number(a.minimumQuantity) : undefined,
          maximum_quantity: a.maximumQuantity ? Number(a.maximumQuantity) : undefined,
          reorder_point: a.reorderPoint ? Number(a.reorderPoint) : undefined,
          location_in_warehouse: a.location || undefined,
        }),
      ),
    );
  }

  async function saveSupplierRelation(productId: number) {
    const supplierId = form.supplier.trim();
    const branchId = branch?.branch_id;
    if (!branchId) return;

    const costPrice = Number(form.costPrice || "0");
    const supplierName = form.name.trim() || effectiveProduct?.name || "Producto";
    const linked = supplierProductsForProduct;

    try {
      if (!supplierId) {
        await Promise.all(
          linked
            .filter((sp) => sp.is_preferred)
            .map((sp) => updateSupplierProduct(sp.id, { is_preferred: false })),
        );
        queryClient.invalidateQueries({ queryKey: ["supplier-products"] });
        return;
      }

      const matching = linked.find((sp) => String(sp.supplier) === supplierId);
      let preferredId: number;

      if (matching) {
        await updateSupplierProduct(matching.id, {
          cost_price: costPrice,
          supplier_product_name: supplierName,
          is_active: true,
          is_preferred: true,
          branch: Number(branchId),
        });
        preferredId = matching.id;
      } else {
        const created = await createSupplierProduct({
          supplier: supplierId,
          product: productId,
          cost_price: costPrice,
          supplier_product_name: supplierName,
          is_active: true,
          is_preferred: true,
          branch: Number(branchId),
          create_inventory_product: false,
          measurement_unit: form.measurementUnit || "UN",
        });
        preferredId = created.id;
      }

      await Promise.all(
        linked
          .filter((sp) => sp.id !== preferredId && sp.is_preferred)
          .map((sp) => updateSupplierProduct(sp.id, { is_preferred: false })),
      );

      queryClient.invalidateQueries({ queryKey: ["supplier-products"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el proveedor del producto.");
    }
  }

  async function saveRecipeAndIngredients(productId: number) {
    let recipeId = recipe.id;
    const recipePayload: RecipePayload = {
      name: recipe.name.trim() || `${form.name} - Receta`,
      resulting_product: productId,
      instructions: recipe.instructions || "Sin instrucciones",
      recipe_type: recipe.recipe_type,
      preparation_time_minutes: recipe.preparation_time_minutes ? Number(recipe.preparation_time_minutes) : undefined,
      cooking_time_minutes: recipe.cooking_time_minutes ? Number(recipe.cooking_time_minutes) : undefined,
      yield_quantity: recipe.yield_quantity || undefined,
      yield_unit: recipe.yield_unit || undefined,
      servings: recipe.servings ? Number(recipe.servings) : undefined,
      notes: recipe.notes || null,
    };

    if (recipeId) {
      await updateRecipe(recipeId, recipePayload);
    } else {
      const created = await createRecipe(recipePayload);
      recipeId = created.id;
    }

    await Promise.all(removedIngredientIds.map((id) => deleteRecipeIngredient(id)));

    await Promise.all(
      ingredients.map((ing) => {
        const payload: RecipeIngredientPayload = {
          recipe: recipeId,
          ingredient: ing.ingredient,
          quantity: ing.quantity || "0",
          unit: ing.unit || "unidad",
          is_optional: ing.is_optional,
          preparation_notes: ing.preparation_notes || null,
        };
        return ing.id ? updateRecipeIngredient(ing.id, payload) : createRecipeIngredient(payload);
      }),
    );
  }

  async function saveModifierGroups(productId: number) {
    const originalByGroup = new Map<number, ProductModifierGroup>(
      productModifierGroups.map((pmg) => [pmg.modifier_group.id, pmg]),
    );

    try {
      await Promise.all(
        modifierAssignments.map(async (assignment) => {
          const original = originalByGroup.get(assignment.modifier_group);

          if (assignment.id) {
            if (original && original.is_required !== assignment.is_required) {
              await updateProductModifierGroup(assignment.id, {
                is_required: assignment.is_required,
              });
            }
          } else if (!original) {
            await assignModifierGroupToProduct({
              product: productId,
              modifier_group: assignment.modifier_group,
              is_required: assignment.is_required,
            } as ProductModifierGroupWriteRequest);
          }
        }),
      );

      const assignmentGroupIds = new Set(modifierAssignments.map((a) => a.modifier_group));
      const toRemove = productModifierGroups.filter(
        (pmg) => !assignmentGroupIds.has(pmg.modifier_group.id),
      );

      await Promise.all(toRemove.map((pmg) => removeProductModifierGroup(pmg.id)));

      queryClient.invalidateQueries({ queryKey: ["product-modifier-groups", productId] });
      queryClient.invalidateQueries({ queryKey: ["product-modifier-groups"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron guardar los modificadores.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (isSellable) {
      const price = Number(form.price);
      if (!form.price || Number.isNaN(price) || price <= 0) {
        setError("Ingresa un precio de venta mayor a 0.");
        return;
      }
    }
    if (isCompound) {
      if (ingredients.length === 0) {
        setError("Agrega al menos una materia prima a la receta.");
        return;
      }
      const emptyIngredient = ingredients.find((i) => !i.quantity || Number(i.quantity) <= 0);
      if (emptyIngredient) {
        setError("Todas las materias primas deben tener una cantidad mayor a 0.");
        return;
      }
    }

    setLoading(true);
    try {
      const payload: ProductPayload = {
        name: form.name.trim(),
        code: form.code || null,
        description: form.description || null,
        price: form.price ? Number(form.price) : undefined,
        sale_price: form.price ? Number(form.price) : undefined,
        cost_price: form.costPrice ? Number(form.costPrice) : undefined,
        price_internal: form.priceInternal ? Number(form.priceInternal) : undefined,
        wholesale_price: form.wholesalePrice ? Number(form.wholesalePrice) : undefined,
        // En creación no enviamos stock general: si se gestiona por bodega se
        // asigna abajo; si no, el producto se crea sin stock inicial. Los
        // compuestos no tienen stock propio: su disponibilidad sale de la receta.
        quantity:
          effectiveProduct?.id && !isCompound ? (form.stock ? Number(form.stock) : undefined) : undefined,
        minimum_stock:
          effectiveProduct?.id && !isCompound ? (form.minimumStock ? Number(form.minimumStock) : undefined) : undefined,
        measurement_unit: form.measurementUnit || null,
        category: form.category ? Number(form.category) : null,
        // Los compuestos siempre trackean inventario vía receta; el backend lo
        // fuerza en la creación, así que solo lo enviamos para no compuestos.
        tracks_inventory: !isCompound ? tracksWarehouseStock : undefined,
        product_type: form.productType as unknown as ProductPayload["product_type"],
        is_for_sale: form.isForSale,
        is_for_internal_use: form.isForInternalUse,
        is_public: form.isPublic,
        is_active: form.isActive,
        is_nutritional_ingredient: form.isNutritionalIngredient,
        energy_kcal: form.energyKcal ? Number(form.energyKcal) : null,
        proteins_g: form.proteinsG ? Number(form.proteinsG) : null,
        total_fats_g: form.totalFatsG ? Number(form.totalFatsG) : null,
        saturated_fats_g: form.saturatedFatsG ? Number(form.saturatedFatsG) : null,
        monounsaturated_fats_g: form.monounsaturatedFatsG ? Number(form.monounsaturatedFatsG) : null,
        polyunsaturated_fats_g: form.polyunsaturatedFatsG ? Number(form.polyunsaturatedFatsG) : null,
        trans_fats_g: form.transFatsG ? Number(form.transFatsG) : null,
        cholesterol_mg: form.cholesterolMg ? Number(form.cholesterolMg) : null,
        carbohydrates_g: form.carbohydratesG ? Number(form.carbohydratesG) : null,
        total_sugars_g: form.totalSugarsG ? Number(form.totalSugarsG) : null,
        sodium_mg: form.sodiumMg ? Number(form.sodiumMg) : null,
      };
      const savedProduct = await onSubmit(payload, effectiveProduct?.id);

      await saveSupplierRelation(savedProduct.id);

      if (isCompound) {
        await saveRecipeAndIngredients(savedProduct.id);
        queryClient.invalidateQueries({ queryKey: ["recipes"] });
      }

      await saveModifierGroups(savedProduct.id);

      if (!isCompound && tracksWarehouseStock && warehouseAssignments.length > 0) {
        await saveWarehouseAssignments(savedProduct.id);
        queryClient.invalidateQueries({ queryKey: ["warehouses"] });
        queryClient.invalidateQueries({ queryKey: ["warehouse-products", "product", effectiveProduct?.id] });
        // Actualiza el stock del listado de productos (suma por bodega).
        queryClient.invalidateQueries({ queryKey: ["warehouse-products", "branch"] });
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el producto");
    } finally {
      setLoading(false);
    }
  }

  const ingredientProductIds = useMemo(
    () => new Set(ingredients.map((i) => i.ingredient)),
    [ingredients],
  );

  return (
    <AnimatedOverlay
      open={true}
      onClose={onClose}
      zIndex="z-[60]"
      panelClassName="flex items-end justify-center overflow-hidden p-0 sm:items-center sm:p-4"
    >
      {isInitializing ? (
        <ProductFormSkeleton />
      ) : (
      <div className="relative flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border-x border-t border-border/70 bg-background shadow-xl sm:h-[min(88vh,820px)] sm:max-w-4xl sm:rounded-2xl sm:border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_srgb,var(--brand-primary)_18%,transparent),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_color-mix(in_srgb,var(--brand-secondary)_12%,transparent),_transparent_45%)]"
        />
        <div className="glass-strong relative shrink-0 border-b border-border/50 px-4 py-2.5 sm:px-5">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <input
                  ref={nameInputRef}
                  id="product-name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  required
                  placeholder="Nombre del producto…"
                  className="min-w-[10rem] flex-1 border-0 bg-transparent p-0 text-base font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-0 sm:text-lg"
                  aria-label="Nombre del producto"
                />
                <div className="relative w-[7.5rem] shrink-0 sm:w-[9rem]">
                  <Hash className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary/70" />
                  <Input
                    id="product-code"
                    value={form.code}
                    onChange={(e) => updateField("code", e.target.value)}
                    placeholder="Código"
                    className="h-8 rounded-full border-0 bg-primary/8 pl-7 text-xs shadow-[inset_0_1px_0_var(--glass-highlight)] ring-1 ring-primary/15"
                    aria-label="Código"
                  />
                </div>
                <HeaderStatusToggle
                  label={form.isForSale ? "En venta" : "Fuera de venta"}
                  checked={form.isForSale}
                  onCheckedChange={(v) => updateField("isForSale", v)}
                  activeClassName="bg-success/20 text-success ring-1 ring-success/35"
                />
                <HeaderStatusToggle
                  label={form.isActive ? "Activo" : "Inactivo"}
                  checked={form.isActive}
                  onCheckedChange={(v) => updateField("isActive", v)}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="glass-chip mt-2.5 flex gap-1 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {enabledTabs.map((tab, i) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  title={`Alt+${i + 1}`}
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-200",
                    active
                      ? "bg-primary/15 text-primary shadow-[inset_0_1px_0_var(--glass-highlight)] ring-1 ring-primary/25"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", active && "text-primary")} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            className={cn(
              "relative flex-1 overflow-y-auto scroll-smooth px-4 py-3 sm:px-5",
              scrollEdge.top && "shadow-[inset_0_8px_8px_-8px_rgba(0,0,0,0.18)]",
              scrollEdge.bottom && "shadow-[inset_0_-8px_8px_-8px_rgba(0,0,0,0.12)]",
            )}
          >
          <div>

          <AnimatePresence mode="wait">
          <m.div
            key={activeTab}
            initial={{ opacity: 0, y: 8, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -4, filter: "blur(2px)" }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-4"
          >
          {activeTab === "basic" && (
          <>
            <FormSection title="Tipo" tint="primary">
              <ProductTypePicker
                id="product-type"
                value={form.productType}
                options={productTypeOptions}
                onChange={(v) => updateField("productType", v)}
              />
            </FormSection>

            <FormSection title="Datos" tint="none">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Categoría" htmlFor="product-category">
                  <IconFieldShell icon={Tags}>
                    <Select
                      id="product-category"
                      value={form.category}
                      disabled={loadingCategories}
                      onChange={(e) => updateField("category", e.target.value)}
                      className="h-9 rounded-xl border-0 bg-primary/[0.06] shadow-[inset_0_1px_0_var(--glass-highlight)] ring-1 ring-border/40"
                    >
                      <option value="">Sin categoría</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Select>
                  </IconFieldShell>
                </Field>

                {!isCompound && (
                  <Field label="Unidad" htmlFor="product-unit">
                    <IconFieldShell icon={Ruler}>
                      <Select
                        id="product-unit"
                        value={isCustomUnit ? "otro" : form.measurementUnit}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateField("measurementUnit", value === "otro" ? "" : value);
                        }}
                        className="h-9 rounded-xl border-0 bg-primary/[0.06] shadow-[inset_0_1px_0_var(--glass-highlight)] ring-1 ring-border/40"
                      >
                        <option value="">Selecciona</option>
                        {MEASUREMENT_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </Select>
                    </IconFieldShell>
                    {isCustomUnit && (
                      <Input
                        value={form.measurementUnit}
                        onChange={(e) => updateField("measurementUnit", e.target.value.toLowerCase().trim())}
                        placeholder="Escribe la unidad (ej: galón)"
                        className="mt-1.5 h-9 rounded-xl border-0 bg-primary/[0.06] ring-1 ring-border/40"
                      />
                    )}
                  </Field>
                )}

                {!isCompound && (
                  <Field
                    label="Proveedor principal"
                    htmlFor="product-supplier"
                    className="sm:col-span-2"
                    hint={
                      supplierLinkQuery.isFetched && supplierProductsForProduct.length === 0
                        ? "Sin vínculos · busca uno para marcarlo como preferido"
                        : undefined
                    }
                  >
                    <IconFieldShell icon={Truck}>
                      <SearchableSelect
                        id="product-supplier"
                        options={supplierOptions}
                        value={form.supplier}
                        disabled={loadingSupplierProduct}
                        onChange={(value) => {
                          updateField("supplier", value);
                          const opt = supplierOptions.find((o) => o.value === value);
                          const linked = supplierProductsForProduct.find((sp) => String(sp.supplier) === value);
                          setSupplierLabel(
                            (opt?.label ?? linked?.supplier_name ?? "").replace(/ · preferido$/, ""),
                          );
                        }}
                        onQueryChange={setSupplierQuery}
                        minChars={linkedSupplierOptions.length > 0 ? 0 : 2}
                        loading={supplierLookup.isFetching || loadingSupplierProduct}
                        clearable
                        selectedOption={
                          form.supplier && supplierLabel
                            ? { value: form.supplier, label: supplierLabel }
                            : null
                        }
                        placeholder={loadingSupplierProduct ? "Cargando…" : "Elegir o buscar…"}
                        searchPlaceholder="Nombre, RUT o razón social…"
                        emptyMessage="Sin coincidencias"
                        searchHint={
                          linkedSupplierOptions.length > 0
                            ? "Vinculados · escribe para buscar otros"
                            : undefined
                        }
                        className="[&_button]:border-0 [&_button]:bg-primary/[0.06] [&_button]:shadow-[inset_0_1px_0_var(--glass-highlight)] [&_button]:ring-1 [&_button]:ring-border/40"
                      />
                    </IconFieldShell>
                    {linkedSupplierOptions.length > 1 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {supplierProductsForProduct.map((sp) => {
                          const selected = form.supplier === String(sp.supplier);
                          return (
                            <button
                              key={sp.id}
                              type="button"
                              onClick={() => {
                                updateField("supplier", String(sp.supplier));
                                setSupplierLabel(sp.supplier_name || "");
                              }}
                              className={cn(
                                "rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-200",
                                selected
                                  ? "bg-primary/15 text-primary ring-1 ring-primary/30 shadow-[inset_0_1px_0_var(--glass-highlight)]"
                                  : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                              )}
                            >
                              {sp.supplier_name}
                              {sp.is_preferred ? " · preferido" : ""}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </Field>
                )}

                <Field label="Descripción" htmlFor="product-description" className="sm:col-span-2">
                  <textarea
                    id="product-description"
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder="Notas para ventas o cocina…"
                    rows={2}
                    className="w-full resize-none rounded-xl border-0 bg-primary/[0.06] px-3 py-2 text-sm text-foreground shadow-[inset_0_1px_0_var(--glass-highlight)] ring-1 ring-border/40 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/35"
                  />
                </Field>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
                <StatusSwitchRow
                  title="Uso interno"
                  description="Consumo del equipo"
                  checked={form.isForInternalUse}
                  onCheckedChange={(v) => updateField("isForInternalUse", v)}
                />
                {publicCatalogEnabled && (
                  <StatusSwitchRow
                    title="Público en menú QR"
                    description="Catálogo digital"
                    checked={form.isPublic}
                    onCheckedChange={(v) => updateField("isPublic", v)}
                    disabled={!isSellable}
                    accent
                  />
                )}
              </div>
            </FormSection>
          </>
          )}

          {activeTab === "pricing" && (
          <FormSection title="Precios e inventario" tint="success">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {isSellable && (
                <Field label="Precio venta" htmlFor="product-price">
                  <IconFieldShell icon={CircleDollarSign}>
                    <Input
                      id="product-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.price}
                      onChange={(e) => updateField("price", e.target.value)}
                      placeholder="0"
                      className="h-9 rounded-xl border-0 bg-success/[0.07] shadow-[inset_0_1px_0_var(--glass-highlight)] ring-1 ring-success/20"
                    />
                  </IconFieldShell>
                </Field>
              )}
              <Field label="Costo" htmlFor="product-cost">
                <IconFieldShell icon={CircleDollarSign}>
                  <Input
                    id="product-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.costPrice}
                    onChange={(e) => updateField("costPrice", e.target.value)}
                    placeholder="Opcional"
                    className="h-9 rounded-xl border-0 bg-warning/[0.08] shadow-[inset_0_1px_0_var(--glass-highlight)] ring-1 ring-warning/20"
                  />
                </IconFieldShell>
              </Field>
              <Field label="Mayorista" htmlFor="product-wholesale">
                <IconFieldShell icon={CircleDollarSign}>
                  <Input
                    id="product-wholesale"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.wholesalePrice}
                    onChange={(e) => updateField("wholesalePrice", e.target.value)}
                    placeholder="Opcional"
                    className="h-9 rounded-xl border-0 bg-primary/[0.06] shadow-[inset_0_1px_0_var(--glass-highlight)] ring-1 ring-border/40"
                  />
                </IconFieldShell>
              </Field>
              <Field label="Interno" htmlFor="product-internal">
                <IconFieldShell icon={CircleDollarSign}>
                  <Input
                    id="product-internal"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.priceInternal}
                    onChange={(e) => updateField("priceInternal", e.target.value)}
                    placeholder="Opcional"
                    className="h-9 rounded-xl border-0 bg-primary/[0.06] shadow-[inset_0_1px_0_var(--glass-highlight)] ring-1 ring-border/40"
                  />
                </IconFieldShell>
              </Field>
            </div>

            {inventoryEnabled && !isCompound && (
              <div className="mt-3">
                <StatusSwitchRow
                  title="Controla inventario"
                  description="Apagado: venta sin límite de stock ni alertas"
                  checked={tracksWarehouseStock}
                  onCheckedChange={setTracksWarehouseStock}
                  accent
                />
              </div>
            )}
          </FormSection>
          )}

          {activeTab === "basic" && orphanRecipe && (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              El producto ya no es del tipo <strong>Producto compuesto</strong>, pero su receta
              asociada se mantendrá en el catálogo de recetas.
            </p>
          )}

          {activeTab === "warehouses" && isCompound && (
            <div className="flex flex-col gap-5">
              {effectiveProduct?.id ? (
                <CompoundAvailability productId={Number(effectiveProduct.id)} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Guarda el producto primero para ver cuántas unidades puedes
                  fabricar con el stock de los ingredientes en bodega.
                </p>
              )}
            </div>
          )}

          {activeTab === "warehouses" && !isCompound && (
            <div className="flex flex-col gap-4">
              {effectiveProduct?.id && (
                <FormSection title="Bodegas configuradas" tint="primary">
                  {loadingProductWarehouses ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                      <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Cargando estado por bodega…
                    </div>
                  ) : groupedProductWarehouses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Este producto no está asignado a ninguna bodega.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {groupedProductWarehouses.map((wp) => {
                        const qty = Number(wp.current_quantity ?? 0);
                        const unit = wp.product_measurement_unit || "u";
                        return (
                          <div
                            key={wp.id}
                            className="rounded-2xl bg-primary/[0.05] px-3.5 py-3 shadow-[inset_0_1px_0_var(--glass-highlight)] ring-1 ring-border/40"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-semibold">{wp.warehouse.name}</p>
                                  <span
                                    className={cn(
                                      "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                      statusBadge(wp.stock_status),
                                    )}
                                  >
                                    {stockStatusLabel(wp.stock_status)}
                                  </span>
                                </div>
                                <p className="mt-1.5 text-base font-bold tabular-nums tracking-tight text-foreground">
                                  {qty.toLocaleString("es-CL", { maximumFractionDigits: 2 })}{" "}
                                  <span className="text-xs font-medium text-muted-foreground">{unit}</span>
                                  <span className="ml-1.5 text-[11px] font-medium text-muted-foreground">
                                    stock actual
                                  </span>
                                </p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  Mín {wp.minimum_quantity ?? "—"}
                                  {" · "}
                                  Máx {wp.maximum_quantity ?? "—"}
                                  {" · "}
                                  Reorden {wp.reorder_point ?? "—"}
                                  {wp.location_in_warehouse ? ` · ${wp.location_in_warehouse}` : ""}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Link
                                  href={`/warehouses/view?id=${wp.warehouse.id}`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                                  title="Ver bodega"
                                >
                                  <Warehouse className="h-4 w-4" />
                                  <span className="sr-only">Ver bodega</span>
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => removeExistingWarehouseProduct(wp.id)}
                                  disabled={removingWarehouseId === wp.id}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                                  title="Quitar producto de esta bodega"
                                >
                                  {removingWarehouseId === wp.id ? (
                                    <svg className="h-4 w-4 shrink-0 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                  <span className="sr-only">Quitar</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </FormSection>
              )}

              <div className="rounded-xl border border-border bg-muted/40 p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {effectiveProduct ? "Agregar a nueva bodega" : "Asignación a bodegas"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    El stock de este producto se gestiona por bodega según el switch &quot;Controla inventario&quot; en Precios y venta.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-muted-foreground">Bodega</label>
                      <Select
                        value={selectedWarehouse}
                        onChange={(e) => setSelectedWarehouse(e.target.value)}
                      >
                        <option value="">Selecciona</option>
                        {warehouses
                          .filter(
                            (w) =>
                              !warehouseAssignments.some((a) => a.warehouseId === String(w.id)) &&
                              !groupedProductWarehouses.some((wp) => String(wp.warehouse.id) === String(w.id)),
                          )
                          .map((w) => (
                            <option key={w.id} value={String(w.id)}>{w.name}</option>
                          ))}
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-muted-foreground">Cantidad inicial</label>
                      <Input
                        type="number"
                        min="0"
                        value={selectedInitialQty}
                        onChange={(e) => setSelectedInitialQty(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-muted-foreground">Stock mínimo</label>
                      <Input
                        type="number"
                        min="0"
                        value={selectedMinimumQty}
                        onChange={(e) => setSelectedMinimumQty(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-muted-foreground">Stock máximo</label>
                      <Input
                        type="number"
                        min="0"
                        value={selectedMaximumQty}
                        onChange={(e) => setSelectedMaximumQty(e.target.value)}
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-muted-foreground">Alerta / reorden</label>
                      <Input
                        type="number"
                        min="0"
                        value={selectedReorderPoint}
                        onChange={(e) => setSelectedReorderPoint(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-muted-foreground">Ubicación</label>
                      <Input
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        placeholder="Ej: estante 3"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addWarehouseAssignment}
                      disabled={!selectedWarehouse}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Agregar bodega
                    </Button>
                  </div>
                </div>

                {warehouseAssignments.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {warehouseAssignments.map((a) => {
                      const warehouse = warehouses.find((w) => String(w.id) === a.warehouseId);
                      return (
                        <div
                          key={a.localId}
                          className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{warehouse?.name ?? "Bodega"}</p>
                            <p className="text-xs text-muted-foreground">
                              Inicial: {a.initialQuantity}
                              {a.minimumQuantity ? ` · Mín: ${a.minimumQuantity}` : ""}
                              {a.maximumQuantity ? ` · Máx: ${a.maximumQuantity}` : ""}
                              {a.reorderPoint ? ` · Alerta: ${a.reorderPoint}` : ""}
                              {a.location ? ` · ${a.location}` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeWarehouseAssignment(a.localId)}
                            className="text-danger hover:text-danger/80"
                            aria-label="Quitar bodega"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "recipe" && isCompound && (
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <h3 className="mb-3 text-sm font-semibold">Receta / materias primas</h3>

              {loadingRecipes && (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Cargando receta existente…
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="recipe-name" className="text-xs font-medium text-muted-foreground">Nombre de la receta</label>
                  <Input
                    id="recipe-name"
                    value={recipe.name}
                    onChange={(e) => updateRecipeField("name", e.target.value)}
                    placeholder="Ej: Receta de cono artesanal"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="recipe-type" className="text-xs font-medium text-muted-foreground">Tipo de receta</label>
                  <Select
                    id="recipe-type"
                    value={recipe.recipe_type}
                    onChange={(e) => updateRecipeField("recipe_type", e.target.value as RecipePayload["recipe_type"])}
                  >
                    {RECIPE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="recipe-prep-time" className="text-xs font-medium text-muted-foreground">Prep. (min)</label>
                  <Input
                    id="recipe-prep-time"
                    type="number"
                    min="0"
                    value={recipe.preparation_time_minutes}
                    onChange={(e) => updateRecipeField("preparation_time_minutes", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="recipe-cook-time" className="text-xs font-medium text-muted-foreground">Cocción (min)</label>
                  <Input
                    id="recipe-cook-time"
                    type="number"
                    min="0"
                    value={recipe.cooking_time_minutes}
                    onChange={(e) => updateRecipeField("cooking_time_minutes", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="recipe-yield" className="text-xs font-medium text-muted-foreground">Rendimiento</label>
                  <Input
                    id="recipe-yield"
                    type="number"
                    min="0"
                    step="0.01"
                    value={recipe.yield_quantity}
                    onChange={(e) => updateRecipeField("yield_quantity", e.target.value)}
                    placeholder="Ej: 10"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="recipe-yield-unit" className="text-xs font-medium text-muted-foreground">Unidad</label>
                  <Input
                    id="recipe-yield-unit"
                    value={recipe.yield_unit}
                    onChange={(e) => updateRecipeField("yield_unit", e.target.value)}
                    placeholder="unidad"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <label htmlFor="recipe-instructions" className="text-xs font-medium text-muted-foreground">Instrucciones</label>
                <textarea
                  id="recipe-instructions"
                  value={recipe.instructions}
                  onChange={(e) => updateRecipeField("instructions", e.target.value)}
                  placeholder="Pasos de preparación…"
                  rows={3}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-xs font-medium text-muted-foreground">Ingredientes / materias primas</label>

                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={ingredientSearchInput}
                    onChange={(e) => setIngredientSearchInput(e.target.value)}
                    placeholder="Buscar materia prima…"
                    className="pl-9"
                  />
                  {ingredientSearchInput.trim().length >= 2 && (
                    <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-border bg-background shadow-lg">
                      {ingredientProducts.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">No se encontraron materias primas.</p>
                      ) : (
                        ingredientProducts
                          .filter((p) => !ingredientProductIds.has(p.id))
                          .map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => addIngredient(p)}
                              className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted"
                            >
                              <span className="text-sm">{p.name}</span>
                              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          ))
                      )}
                    </div>
                  )}
                </div>

                {ingredients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Agrega materias primas para armar la receta.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {ingredients.map((ing) => {
                      const product = ingredientProducts.find((p) => p.id === ing.ingredient);
                      const ingName =
                        ing.ingredient_name ?? product?.name ?? `Producto #${ing.ingredient}`;
                      return (
                        <div key={ing.localId} className="rounded-lg border border-border bg-background p-2">
                        <div className="grid grid-cols-12 items-end gap-2">
                          <div className="col-span-12 sm:col-span-4">
                            <span className="block truncate text-sm font-medium">
                              {ingName}
                            </span>
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={ing.quantity}
                              onChange={(e) => updateIngredient(ing.localId, { quantity: e.target.value })}
                              placeholder="Cant."
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-4 sm:col-span-3">
                            <Input
                              value={ing.unit}
                              onChange={(e) => updateIngredient(ing.localId, { unit: e.target.value })}
                              placeholder="Unidad"
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-3 sm:col-span-2">
                            <Input
                              value={ing.preparation_notes ?? ""}
                              onChange={(e) => updateIngredient(ing.localId, { preparation_notes: e.target.value })}
                              placeholder="Nota"
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeIngredient(ing.localId)}
                              className="text-danger hover:text-danger/80"
                              aria-label="Quitar ingrediente"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {nutritionEnabled && (
                          <div className="mt-1.5">
                            <IngredientNutritionQuickEdit
                              productId={ing.ingredient}
                              productName={ingName}
                            />
                          </div>
                        )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "nutrition" && nutritionEnabled && (
            <div className="flex flex-col gap-4">
              <FormSection title="Datos nutricionales" tint="success">
                <div className="mb-3 flex flex-col gap-2">
                  <StatusSwitchRow
                    title="Tiene información nutricional"
                    description="Activa para editar valores del producto"
                    checked={form.isNutritionalIngredient}
                    onCheckedChange={(v) => updateField("isNutritionalIngredient", v)}
                    accent
                  />
                  {isCompound && recipe.id ? (
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCalculateNutrition}
                        isLoading={calculatingNutrition}
                      >
                        {!calculatingNutrition && <Plus className="mr-2 h-3.5 w-3.5" />}
                        Calcular desde receta
                      </Button>
                    </div>
                  ) : null}
                </div>
                {isCompound && !recipe.id && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    Producto compuesto sin receta guardada. Ingresa valores a mano o guarda
                    ingredientes en Receta para calcularlos.
                  </p>
                )}
                {recipesError && (
                  <p className="mb-3 text-xs text-danger">
                    No se pudo cargar la receta:{" "}
                    {recipesError instanceof Error ? recipesError.message : "error desconocido"}.
                  </p>
                )}

                {form.isNutritionalIngredient && (
                  <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                    {[
                      { key: "energyKcal", label: "Energía (kcal)" },
                      { key: "proteinsG", label: "Proteínas (g)" },
                      { key: "totalFatsG", label: "Grasas totales (g)" },
                      { key: "saturatedFatsG", label: "Grasas saturadas (g)" },
                      { key: "monounsaturatedFatsG", label: "Grasas monoinsaturadas (g)" },
                      { key: "polyunsaturatedFatsG", label: "Grasas poliinsaturadas (g)" },
                      { key: "transFatsG", label: "Grasas trans (g)" },
                      { key: "cholesterolMg", label: "Colesterol (mg)" },
                      { key: "carbohydratesG", label: "Carbohidratos (g)" },
                      { key: "totalSugarsG", label: "Azúcares totales (g)" },
                      { key: "sodiumMg", label: "Sodio (mg)" },
                    ].map((field) => (
                      <Field key={field.key} label={field.label} htmlFor={`nutrition-${field.key}`}>
                        <Input
                          id={`nutrition-${field.key}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={form[field.key as keyof typeof form] as string}
                          onChange={(e) => updateField(field.key as keyof typeof form, e.target.value)}
                          placeholder="0"
                          className="h-9 rounded-xl border-0 bg-success/[0.06] shadow-[inset_0_1px_0_var(--glass-highlight)] ring-1 ring-success/15"
                        />
                      </Field>
                    ))}
                  </div>
                )}
              </FormSection>

              {form.isNutritionalIngredient && (
                <p className="text-[11px] text-muted-foreground">
                  Para imprimir o descargar la etiqueta PDF ve a{" "}
                  <Link href="/products/nutrition" className="font-medium text-primary underline-offset-2 hover:underline">
                    Etiquetado nutricional
                  </Link>
                  .
                </p>
              )}
            </div>
          )}

          {activeTab === "modifiers" && (
            <div className="flex flex-col gap-5">
              <div className="rounded-xl border border-border bg-muted/40 p-5">
                <h3 className="mb-1 text-sm font-semibold">Grupos de modificadores</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  Los grupos seleccionados aparecerán como opciones en el POS al vender este producto.
                </p>

                {loadingModifierGroups || loadingProductModifierGroups ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Cargando modificadores…
                  </div>
                ) : modifierGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay grupos de modificadores disponibles.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {modifierGroups.map((group) => {
                      const assignment = getAssignment(group.id);
                      return (
                        <div
                          key={group.id}
                          className={`flex flex-col gap-2 rounded-lg border border-border bg-background px-4 py-3 ${assignment ? "" : "opacity-80"}`}
                        >
                          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
                            <input
                              type="checkbox"
                              checked={!!assignment}
                              onChange={() => toggleGroupAssignment(group)}
                              className="h-4 w-4 accent-primary"
                            />
                            <span className="flex-1">{group.name}</span>
                          </label>
                          {assignment && (
                            <div className="flex items-center justify-between gap-3 pl-7">
                              <span className="text-xs text-muted-foreground">Requerido</span>
                              <Switch
                                checked={assignment.is_required}
                                onCheckedChange={(checked) => updateAssignmentRequired(group.id, checked)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          </m.div>
          </AnimatePresence>

          {error && (
            <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          </div>
          </div>

          {extraActions && effectiveProduct && (
            <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-t border-border bg-muted/30 px-3 py-2 sm:px-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 shrink-0 rounded-lg text-xs",
                  form.isActive
                    ? "border-success/30 text-success hover:bg-success/10"
                    : "text-muted-foreground",
                )}
                disabled={extraActions.isTogglingActive}
                onClick={() => {
                  extraActions.onToggleActive();
                  updateField("isActive", !form.isActive);
                }}
              >
                <Power className="mr-1.5 h-3.5 w-3.5" />
                {form.isActive ? "Desactivar" : "Activar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 rounded-lg text-xs"
                onClick={extraActions.onCopy}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copiar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto h-8 shrink-0 rounded-lg text-xs text-danger hover:border-danger/40 hover:bg-danger/5"
                onClick={extraActions.onDelete}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Eliminar
              </Button>
            </div>
          )}
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-2.5 sm:px-5">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const idx = enabledTabs.findIndex((t) => t.id === activeTab);
                  const prev = enabledTabs[idx - 1];
                  if (prev) setActiveTab(prev.id);
                }}
                disabled={enabledTabs[0]?.id === activeTab}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                Ctrl+S guarda · Alt+1… pestañas
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              {activeTab !== enabledTabs.at(-1)?.id && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const idx = enabledTabs.findIndex((t) => t.id === activeTab);
                    const next = enabledTabs[idx + 1];
                    if (next) setActiveTab(next.id);
                  }}
                >
                  Siguiente
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
              <Button type="submit" size="sm" isLoading={loading}>
                {effectiveProduct ? "Guardar" : "Crear"}
              </Button>
            </div>
          </div>
        </form>
      </div>
      )}
    </AnimatedOverlay>
  );
}
