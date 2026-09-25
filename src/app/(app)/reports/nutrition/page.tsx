"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import Link from "next/link";
import {
  Package,
  FlaskConical,
  Apple,
  ArrowRight,
  Leaf,
  ChefHat,
  Flame,
  Repeat2,
  CircleDollarSign,
  Scale,
  Pin,
  X,
  Info,
} from "lucide-react";
import {
  fetchIngredientConsumption,
  type IngredientConsumptionItem,
} from "@/lib/api/analytics";
import { fetchProduct, fetchProducts, fetchProductsByIds } from "@/lib/api/products";
import {
  fetchRecipesByProduct,
  fetchRecipesForProductIds,
  fetchRecipesUsingIngredient,
  type IngredientRecipeUsage,
} from "@/lib/api/recipes";
import type { YggdraProduct, YggdraSchemas } from "@/lib/api/types";

import { getCurrentMonthRange } from "@/lib/date-range";
import { cn, formatCLP } from "@/lib/utils";
import { useCurrentBranch } from "@/lib/store/session";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { Modal, ModalBody } from "@/components/ui/modal";

type ProductDetail = YggdraSchemas["Product"];
type Recipe = YggdraSchemas["Recipe"];

type NutriFields = {
  energy_kcal?: string | number | null;
  proteins_g?: string | number | null;
  carbohydrates_g?: string | number | null;
  total_fats_g?: string | number | null;
  saturated_fats_g?: string | number | null;
  monounsaturated_fats_g?: string | number | null;
  polyunsaturated_fats_g?: string | number | null;
  trans_fats_g?: string | number | null;
  cholesterol_mg?: string | number | null;
  total_sugars_g?: string | number | null;
  sodium_mg?: string | number | null;
  is_nutritional_ingredient?: boolean;
};

type DetailSelection =
  | { kind: "product"; productId: number; name: string; ingredientCount: number }
  | { kind: "ingredient"; item: IngredientConsumptionItem };

type NutriTotals = {
  kcal: number;
  proteins: number;
  carbs: number;
  fats: number;
  satFats: number;
  monoFats: number;
  polyFats: number;
  transFats: number;
  cholesterol: number;
  sugars: number;
  sodium: number;
};

/** Colocar ficha: entra desde abajo con un toque de escala. */
function placeFicha(i: number): Transition {
  const delay = 0.028 * i + (i % 3) * 0.012 + (i % 5) * 0.006;
  return { duration: 0.45, delay: Math.min(delay, 0.55), ease: [0.22, 1, 0.36, 1] };
}

/** Sacar ficha: sale más rápido, distinto eje (como retirar del mazo). */
function removeFicha(i: number): Transition {
  return { duration: 0.26, delay: Math.min(i, 5) * 0.02, ease: [0.4, 0, 0.2, 1] };
}

const PLACE_COMPOUND = {
  initial: { opacity: 0, y: 16, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, x: -22, scale: 0.95 },
};

const PLACE_CONSUMED = {
  initial: { opacity: 0, y: 12, x: 14, scale: 0.98 },
  animate: { opacity: 1, y: 0, x: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.96 },
};

const PLACE_STAT = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

const PRODUCT_TYPE_ES: Record<string, string> = {
  DIRECT_SALE: "Venta directa",
  RECIPE_BASED: "Producto compuesto",
  RAW_MATERIAL: "Materia prima",
  SERVICE: "Servicio",
};

function productTypeLabelEs(raw?: string | null): string {
  if (!raw) return "—";
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return PRODUCT_TYPE_ES[key] ?? raw;
}

function unitLabel(unit: string | null | undefined): string {
  if (!unit) return "—";
  const key = unit.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const map: Record<string, string> = {
    UN: "un.",
    U: "un.",
    UNIT: "un.",
    UNIDAD: "un.",
    G: "g",
    GR: "g",
    GRAM: "g",
    GRAMS: "g",
    GRAMO: "g",
    GRAMOS: "g",
    KG: "kg",
    KILOGRAM: "kg",
    KILOGRAMO: "kg",
    ML: "ml",
    L: "L",
    LT: "L",
    LITER: "L",
    LITRE: "L",
    LITRO: "L",
  };
  return map[key] ?? unit;
}

function num(v: string | number | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Factor sobre valores por 100 g/ml (o por unidad si no es masa/volumen). */
function nutritionFactor(qty: number, unit: string): number {
  const u = unit.trim().toUpperCase();
  if (["G", "GR", "GRAM", "GRAMS", "GRAMO", "GRAMOS"].includes(u)) return qty / 100;
  if (["KG", "KILOGRAM", "KILOGRAMO"].includes(u)) return (qty * 1000) / 100;
  if (["ML"].includes(u)) return qty / 100;
  if (["L", "LT", "LITER", "LITRE", "LITRO"].includes(u)) return (qty * 1000) / 100;
  return qty;
}

function hasNutrition(p: NutriFields | null | undefined): boolean {
  if (!p) return false;
  return Boolean(
    p.is_nutritional_ingredient ||
      num(p.energy_kcal) ||
      num(p.proteins_g) ||
      num(p.carbohydrates_g) ||
      num(p.total_fats_g) ||
      num(p.saturated_fats_g) ||
      num(p.monounsaturated_fats_g) ||
      num(p.polyunsaturated_fats_g) ||
      num(p.trans_fats_g) ||
      num(p.cholesterol_mg) ||
      num(p.total_sugars_g) ||
      num(p.sodium_mg),
  );
}

function shortNutri(p: NutriFields | null | undefined): string | null {
  if (!hasNutrition(p)) return null;
  const parts: string[] = [];
  if (num(p?.energy_kcal)) parts.push(`${Math.round(num(p?.energy_kcal))} kcal`);
  if (num(p?.proteins_g)) parts.push(`${num(p?.proteins_g)} g prot.`);
  return parts.length ? parts.join(" · ") : null;
}

function emptyNutri(): NutriTotals {
  return {
    kcal: 0,
    proteins: 0,
    carbs: 0,
    fats: 0,
    satFats: 0,
    monoFats: 0,
    polyFats: 0,
    transFats: 0,
    cholesterol: 0,
    sugars: 0,
    sodium: 0,
  };
}

function addNutri(acc: NutriTotals, p: NutriFields | null | undefined, qty: number, unit: string): NutriTotals {
  if (!hasNutrition(p)) return acc;
  const f = nutritionFactor(qty, unit);
  return {
    kcal: acc.kcal + num(p?.energy_kcal) * f,
    proteins: acc.proteins + num(p?.proteins_g) * f,
    carbs: acc.carbs + num(p?.carbohydrates_g) * f,
    fats: acc.fats + num(p?.total_fats_g) * f,
    satFats: acc.satFats + num(p?.saturated_fats_g) * f,
    monoFats: acc.monoFats + num(p?.monounsaturated_fats_g) * f,
    polyFats: acc.polyFats + num(p?.polyunsaturated_fats_g) * f,
    transFats: acc.transFats + num(p?.trans_fats_g) * f,
    cholesterol: acc.cholesterol + num(p?.cholesterol_mg) * f,
    sugars: acc.sugars + num(p?.total_sugars_g) * f,
    sodium: acc.sodium + num(p?.sodium_mg) * f,
  };
}

type QtyKind = "mass" | "volume" | "count" | "unknown";

function toBaseQty(qty: number, unit: string): { value: number; kind: QtyKind } {
  const u = unit.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (["G", "GR", "GRAM", "GRAMS", "GRAMO", "GRAMOS"].includes(u)) return { value: qty, kind: "mass" };
  if (["KG", "KILOGRAM", "KILOGRAMO", "KILOGRAMOS"].includes(u)) return { value: qty * 1000, kind: "mass" };
  if (["ML", "MILILITRO", "MILILITROS"].includes(u)) return { value: qty, kind: "volume" };
  if (["L", "LT", "LITER", "LITRE", "LITRO", "LITROS"].includes(u)) return { value: qty * 1000, kind: "volume" };
  if (["UN", "U", "UNIT", "UNIDAD", "UNIDADES"].includes(u)) return { value: qty, kind: "count" };
  return { value: qty, kind: "unknown" };
}

/** Réplicas de receta que “alcanza” el consumo (null si unidades no comparables). */
function estimateReplicas(
  consumedQty: number,
  consumedUnit: string,
  perRecipeQty: number,
  recipeUnit: string,
): number | null {
  if (!(consumedQty > 0) || !(perRecipeQty > 0)) return null;
  const a = toBaseQty(consumedQty, consumedUnit);
  const b = toBaseQty(perRecipeQty, recipeUnit);
  if (a.kind !== "unknown" && a.kind === b.kind && b.value > 0) {
    return a.value / b.value;
  }
  const ua = consumedUnit.trim().toUpperCase();
  const ub = recipeUnit.trim().toUpperCase();
  if (ua && ua === ub) return consumedQty / perRecipeQty;
  return null;
}

function fmtReplicas(n: number): string {
  if (n >= 100) return String(Math.round(n));
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

/** Tamaño de página de productos / listas (evita payloads enormes de golpe). */
const PAGE_SIZE = 40;
/** Tope de ids de insumos del período para hidratar nutrición. */
const MAX_INGREDIENT_NUTRI_IDS = 200;
/** Filas visibles de insumos antes de “cargar más” en UI. */
const CONSUMED_UI_STEP = 40;

export default function NutritionReportsPage() {
  const branch = useCurrentBranch();
  const monthRange = useMemo(() => getCurrentMonthRange(), []);
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>(monthRange);
  const [detail, setDetail] = useState<DetailSelection | null>(null);
  const [consumedVisible, setConsumedVisible] = useState(CONSUMED_UI_STEP);
  /** Producto compuesto cuyo pin filtra los insumos de la derecha. */
  const [pinnedProductId, setPinnedProductId] = useState<number | null>(null);
  const dates = customRange;
  const branchId = branch?.branch_id;

  const {
    data: compoundsPages,
    isLoading: loadingCompounds,
    isFetchingNextPage: loadingMoreCompounds,
    hasNextPage: hasMoreCompounds,
    fetchNextPage: fetchMoreCompounds,
  } = useInfiniteQuery({
    queryKey: ["reports", "nutrition", "compounds", branchId],
    queryFn: ({ pageParam }) =>
      pageParam
        ? fetchProducts({ next: pageParam })
        : fetchProducts({ product_type: "RECIPE_BASED", is_active: true, page_size: PAGE_SIZE }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next ?? undefined,
    enabled: !!branch,
  });

  const compoundProducts = useMemo(
    () => compoundsPages?.pages?.flatMap((p) => p.results ?? []) ?? [],
    [compoundsPages],
  );
  const compoundsTotal = compoundsPages?.pages?.[0]?.count ?? compoundProducts.length;

  const compoundIds = useMemo(() => compoundProducts.map((p) => p.id), [compoundProducts]);

  const { data: recipesMap, isLoading: loadingRecipes } = useQuery({
    queryKey: ["reports", "nutrition", "recipes-for", branchId, compoundIds],
    queryFn: () => fetchRecipesForProductIds(compoundIds, { pageSize: 100, maxPages: 8 }),
    enabled: !!branch && compoundIds.length > 0,
  });

  const recipesByProduct = useMemo(() => {
    if (recipesMap instanceof Map) return recipesMap;
    return new Map<number, Recipe>();
  }, [recipesMap]);

  const { data: ingredientConsumption, isLoading: loadingConsumption } = useQuery({
    queryKey: ["reports", "ingredient-consumption", "v2", dates.start, dates.end, branchId],
    queryFn: () => fetchIngredientConsumption(dates.start, dates.end, branchId),
    enabled: !!branch,
  });

  const consumedItems = useMemo(() => {
    const items = Array.isArray(ingredientConsumption?.items) ? ingredientConsumption.items : [];
    return items.slice().sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0));
  }, [ingredientConsumption]);

  const ingredientIdsForNutri = useMemo(() => {
    const ids: number[] = [];
    const seen = new Set<number>();
    for (const item of consumedItems) {
      const id = Number.parseInt(String(item.ingredient_id ?? ""), 10);
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      if (ids.length >= MAX_INGREDIENT_NUTRI_IDS) break;
    }
    return ids;
  }, [consumedItems]);

  const { data: rawMaterials = [], isLoading: loadingRaws } = useQuery({
    queryKey: ["reports", "nutrition", "raw-by-ids", branchId, ingredientIdsForNutri],
    queryFn: () => fetchProductsByIds(ingredientIdsForNutri, 50),
    enabled: !!branch && ingredientIdsForNutri.length > 0,
  });

  const loading = loadingCompounds || loadingConsumption || !branch;

  const rawById = useMemo(() => {
    const map = new Map<number, YggdraProduct & NutriFields>();
    for (const p of rawMaterials ?? []) {
      if (p?.id != null) map.set(p.id, p as YggdraProduct & NutriFields);
    }
    return map;
  }, [rawMaterials]);

  const rawByName = useMemo(() => {
    const map = new Map<string, YggdraProduct & NutriFields>();
    for (const p of rawMaterials ?? []) {
      const name = p?.name?.trim().toLowerCase();
      if (name) map.set(name, p as YggdraProduct & NutriFields);
    }
    return map;
  }, [rawMaterials]);

  function resolveIngredient(item: IngredientConsumptionItem): (YggdraProduct & NutriFields) | undefined {
    const id = Number.parseInt(String(item.ingredient_id ?? ""), 10);
    if (Number.isFinite(id) && id > 0) {
      const byId = rawById.get(id);
      if (byId) return byId;
    }
    const name = item.ingredient_name?.trim().toLowerCase();
    return name ? rawByName.get(name) : undefined;
  }

  const compoundRows = useMemo(() => {
    return compoundProducts.map((p) => {
      const recipe = recipesByProduct.get(p.id);
      const rawIngs = (recipe as { ingredients?: unknown } | undefined)?.ingredients;
      const ings = Array.isArray(rawIngs) ? rawIngs : [];
      const nutri = p as YggdraProduct & NutriFields;
      return {
        id: p.id,
        name: p.name,
        ingredientCount: ings.length,
        nutri,
        nutriLabel: shortNutri(nutri),
      };
    });
  }, [compoundProducts, recipesByProduct]);

  const pinnedProduct = useMemo(
    () => (pinnedProductId != null ? compoundRows.find((r) => r.id === pinnedProductId) ?? null : null),
    [pinnedProductId, compoundRows],
  );

  /** Ids / nombres de insumos de la receta del producto pineado. */
  const pinnedIngredientKeys = useMemo(() => {
    if (pinnedProductId == null) return null;
    const recipe = recipesByProduct.get(pinnedProductId);
    const rawIngs = (recipe as { ingredients?: unknown } | undefined)?.ingredients;
    const ings = Array.isArray(rawIngs) ? rawIngs : [];
    const ids = new Set<number>();
    const names = new Set<string>();
    for (const raw of ings) {
      const ing = raw as { ingredient?: number | string; ingredient_name?: string };
      const id = Number(ing.ingredient);
      if (Number.isFinite(id) && id > 0) ids.add(id);
      const name = String(ing.ingredient_name ?? "").trim().toLowerCase();
      if (name) names.add(name);
    }
    return { ids, names };
  }, [pinnedProductId, recipesByProduct]);

  const filteredConsumed = useMemo(() => {
    if (!pinnedIngredientKeys) return consumedItems;
    return consumedItems.filter((item) => {
      const id = Number.parseInt(String(item.ingredient_id ?? ""), 10);
      if (Number.isFinite(id) && pinnedIngredientKeys.ids.has(id)) return true;
      const name = item.ingredient_name?.trim().toLowerCase();
      return Boolean(name && pinnedIngredientKeys.names.has(name));
    });
  }, [consumedItems, pinnedIngredientKeys]);

  const visibleConsumed = useMemo(
    () => filteredConsumed.slice(0, consumedVisible),
    [filteredConsumed, consumedVisible],
  );
  const hasMoreConsumed = consumedVisible < filteredConsumed.length;

  const periodNutri = useMemo(() => {
    return consumedItems.reduce(
      (acc, item) => addNutri(acc, resolveIngredient(item), item.total_quantity, item.unit),
      emptyNutri(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- maps derived from rawMaterials
  }, [consumedItems, rawById, rawByName]);

  const withNutriCount = compoundRows.filter((r) => hasNutrition(r.nutri)).length;
  const maxIngs = Math.max(...compoundRows.map((r) => r.ingredientCount), 1);
  const maxCost = Math.max(...filteredConsumed.map((i) => i.cost), 1);

  function togglePinProduct(productId: number) {
    setPinnedProductId((prev) => (prev === productId ? null : productId));
    setConsumedVisible(CONSUMED_UI_STEP);
  }

  if (!branch && !loading) {
    return null;
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-5.5rem)] w-full max-w-7xl flex-col overflow-hidden md:h-dvh">
      <style>{`
        @media print {
          .print-hidden { display: none !important; }
          .nutrition-split, .nutrition-list { overflow: visible !important; height: auto !important; max-height: none !important; }
        }
      `}</style>

      <PageHeader
        title="Nutricional"
        subtitle="Productos compuestos, insumos consumidos y cálculo nutricional del período."
        icon={<Apple className="h-5 w-5" />}
        className="print-hidden shrink-0 sticky top-0 z-20 glass-strong border-b"
        actions={
          <div className="glass-chip inline-flex items-center gap-1 rounded-xl p-1">
            <input
              type="date"
              value={customRange.start}
              max={customRange.end}
              onChange={(e) => {
                const start = e.target.value;
                setCustomRange((prev) => ({ start, end: prev.end < start ? start : prev.end }));
                setConsumedVisible(CONSUMED_UI_STEP);
                setPinnedProductId(null);
              }}
              className="rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-xs font-medium text-foreground outline-none"
            />
            <span className="text-xs text-muted-foreground">-</span>
            <input
              type="date"
              value={customRange.end}
              min={customRange.start}
              onChange={(e) => {
                const end = e.target.value;
                setCustomRange((prev) => ({ start: prev.start > end ? end : prev.start, end }));
                setConsumedVisible(CONSUMED_UI_STEP);
                setPinnedProductId(null);
              }}
              className="rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-xs font-medium text-foreground outline-none"
            />
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 py-3 sm:px-5 sm:py-4">
        {loading ? (
          <ReportsSkeleton />
        ) : (
          <div className="glass-read flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
            <section className="grid shrink-0 grid-cols-2 divide-x divide-y divide-border/50 border-b border-border/50 sm:grid-cols-4 sm:divide-y-0">
              {[
                { label: "Productos compuestos", value: String(compoundsTotal), icon: ChefHat },
                { label: "Con info nutricional", value: String(withNutriCount), icon: Apple },
                { label: "Insumos del período", value: String(consumedItems.length), icon: Leaf },
                {
                  label: "Energía del período",
                  value:
                    loadingRaws && ingredientIdsForNutri.length > 0
                      ? "…"
                      : periodNutri.kcal > 0
                        ? `${Math.round(periodNutri.kcal)} kcal`
                        : "—",
                  icon: Flame,
                },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={PLACE_STAT.initial}
                  animate={PLACE_STAT.animate}
                  transition={placeFicha(i)}
                >
                  <NotebookStat label={stat.label} value={stat.value} icon={stat.icon} />
                </motion.div>
              ))}
            </section>

            {periodNutri.kcal > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 border-b border-border/50 px-3 py-2 text-[11px] text-muted-foreground sm:px-4"
              >
                <span>
                  Proteínas <strong className="font-mono text-foreground">{periodNutri.proteins.toFixed(1)} g</strong>
                </span>
                <span>
                  Carbohidratos <strong className="font-mono text-foreground">{periodNutri.carbs.toFixed(1)} g</strong>
                </span>
                <span>
                  Grasas <strong className="font-mono text-foreground">{periodNutri.fats.toFixed(1)} g</strong>
                </span>
                {periodNutri.satFats > 0 && (
                  <span>
                    Grasas sat. <strong className="font-mono text-foreground">{periodNutri.satFats.toFixed(1)} g</strong>
                  </span>
                )}
                {periodNutri.monoFats > 0 && (
                  <span>
                    Monoins. <strong className="font-mono text-foreground">{periodNutri.monoFats.toFixed(1)} g</strong>
                  </span>
                )}
                {periodNutri.polyFats > 0 && (
                  <span>
                    Poliins. <strong className="font-mono text-foreground">{periodNutri.polyFats.toFixed(1)} g</strong>
                  </span>
                )}
                {periodNutri.transFats > 0 && (
                  <span>
                    Grasas trans <strong className="font-mono text-foreground">{periodNutri.transFats.toFixed(1)} g</strong>
                  </span>
                )}
                {periodNutri.cholesterol > 0 && (
                  <span>
                    Colesterol <strong className="font-mono text-foreground">{Math.round(periodNutri.cholesterol)} mg</strong>
                  </span>
                )}
                <span>
                  Azúcares <strong className="font-mono text-foreground">{periodNutri.sugars.toFixed(1)} g</strong>
                </span>
                <span>
                  Sodio <strong className="font-mono text-foreground">{Math.round(periodNutri.sodium)} mg</strong>
                </span>
              </motion.div>
            )}

            <section className="nutrition-split grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
              <NotebookColumn
                title="Productos compuestos"
                icon={ChefHat}
                count={compoundRows.length}
                countLabel={
                  compoundsTotal > compoundRows.length
                    ? `${compoundRows.length} / ${compoundsTotal}`
                    : String(compoundsTotal)
                }
                emptyTitle="Sin productos compuestos"
                emptySubtitle="No hay productos con receta activos en el catálogo."
                footer={
                  hasMoreCompounds ? (
                    <button
                      type="button"
                      disabled={loadingMoreCompounds}
                      onClick={() => void fetchMoreCompounds()}
                      className="w-full py-3 text-center text-xs font-medium text-primary transition-colors hover:bg-primary/[0.04] disabled:opacity-50"
                    >
                      {loadingMoreCompounds
                        ? "Cargando…"
                        : loadingRecipes
                          ? "Cargando recetas…"
                          : "Cargar más productos"}
                    </button>
                  ) : null
                }
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {compoundRows.map((row, i) => {
                    const pct = (row.ingredientCount / maxIngs) * 100;
                    const isPinned = pinnedProductId === row.id;
                    return (
                      <motion.div
                        key={row.id}
                        layout
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={{
                          initial: PLACE_COMPOUND.initial,
                          animate: {
                            ...PLACE_COMPOUND.animate,
                            transition: placeFicha(i),
                          },
                          exit: {
                            ...PLACE_COMPOUND.exit,
                            transition: removeFicha(i),
                          },
                        }}
                        transition={{ layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
                        className={cn(
                          "group w-full border-b border-border/50 transition-colors",
                          isPinned
                            ? "bg-primary/[0.09]"
                            : "hover:bg-primary/[0.05]",
                        )}
                      >
                        <div className="flex w-full items-stretch gap-0.5 px-2 py-2 sm:px-3">
                          <button
                            type="button"
                            onClick={() => togglePinProduct(row.id)}
                            title={isPinned ? "Quitar filtro de insumos" : "Ver insumos de este producto"}
                            aria-pressed={isPinned}
                            aria-label={
                              isPinned
                                ? `Dejar de filtrar insumos de ${row.name}`
                                : `Filtrar insumos de ${row.name}`
                            }
                            className={cn(
                              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                              isPinned
                                ? "bg-primary text-white shadow-sm"
                                : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                            )}
                          >
                            <Pin className={cn("h-3.5 w-3.5", isPinned && "fill-current")} />
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePinProduct(row.id)}
                            className="min-w-0 flex-1 px-1 py-0.5 text-left"
                          >
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  className={cn(
                                    "w-5 shrink-0 text-right font-mono text-[11px] tabular-nums",
                                    isPinned ? "text-primary" : "text-muted-foreground",
                                  )}
                                >
                                  {String(i + 1).padStart(2, "0")}
                                </span>
                                <span
                                  className={cn(
                                    "truncate font-medium",
                                    isPinned ? "text-primary" : "group-hover:text-primary",
                                  )}
                                >
                                  {row.name}
                                </span>
                              </span>
                              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground sm:text-sm">
                                {loadingRecipes && !recipesByProduct.has(row.id) ? (
                                  <span className="text-muted-foreground/70">…</span>
                                ) : (
                                  <>
                                    <span className="font-semibold text-foreground">{row.ingredientCount}</span>
                                    {" "}
                                    {row.ingredientCount === 1 ? "insumo" : "insumos"}
                                  </>
                                )}
                              </span>
                            </div>
                            {row.nutriLabel ? (
                              <p className="ml-7 mt-0.5 text-[11px] text-muted-foreground">{row.nutriLabel}</p>
                            ) : (
                              <p className="ml-7 mt-0.5 text-[11px] text-muted-foreground/70">Sin info nutricional</p>
                            )}
                            <div className="ml-7">
                              <ChalkStroke pct={pct} tone="primary" delay={Math.min(i, 10) * 0.02} />
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDetail({
                                kind: "product",
                                productId: row.id,
                                name: row.name,
                                ingredientCount: row.ingredientCount,
                              })
                            }
                            title="Ver ficha del producto"
                            aria-label={`Ver ficha de ${row.name}`}
                            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </NotebookColumn>

              <NotebookColumn
                title={pinnedProduct ? `Insumos · ${pinnedProduct.name}` : "Insumos consumidos"}
                icon={FlaskConical}
                count={filteredConsumed.length}
                countLabel={
                  pinnedProduct
                    ? `${filteredConsumed.length} de ${consumedItems.length}`
                    : periodNutri.kcal > 0
                      ? `${Math.round(periodNutri.kcal)} kcal`
                      : formatCLP(ingredientConsumption?.total_cost ?? 0)
                }
                emptyTitle={pinnedProduct ? "Sin consumo de estos insumos" : "Sin consumo"}
                emptySubtitle={
                  pinnedProduct
                    ? `Ningún insumo de «${pinnedProduct.name}» aparece en el período.`
                    : "No hay insumos consumidos en el período."
                }
                className={cn(
                  "lg:border-l lg:border-border/50",
                  pinnedProduct && "bg-primary/[0.03]",
                )}
                banner={
                  <AnimatePresence initial={false}>
                    {pinnedProduct ? (
                      <motion.div
                        key={pinnedProduct.id}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="flex items-center gap-2 border-b border-primary/25 bg-primary/[0.07] px-3 py-2"
                      >
                        <Pin className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" />
                        <p className="min-w-0 flex-1 truncate text-[12px]">
                          Viendo insumos de{" "}
                          <strong className="font-semibold text-primary">{pinnedProduct.name}</strong>
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setPinnedProductId(null);
                            setConsumedVisible(CONSUMED_UI_STEP);
                          }}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                          Quitar
                        </button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                }
                footer={
                  hasMoreConsumed ? (
                    <button
                      type="button"
                      onClick={() => setConsumedVisible((n) => n + CONSUMED_UI_STEP)}
                      className="w-full py-3 text-center text-xs font-medium text-warning transition-colors hover:bg-warning/[0.06]"
                    >
                      Cargar más ({filteredConsumed.length - consumedVisible} restantes)
                    </button>
                  ) : null
                }
              >
                <AnimatePresence initial={false} mode="popLayout">
                  {visibleConsumed.map((item, i) => {
                    const pct = maxCost > 0 ? (item.cost / maxCost) * 100 : 0;
                    const raw = resolveIngredient(item);
                    const itemNutri = addNutri(emptyNutri(), raw, item.total_quantity, item.unit);
                    return (
                      <motion.button
                        key={`${pinnedProductId ?? "all"}-${item.ingredient_id}`}
                        type="button"
                        layout
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={{
                          initial: PLACE_CONSUMED.initial,
                          animate: {
                            ...PLACE_CONSUMED.animate,
                            transition: placeFicha(i),
                          },
                          exit: {
                            ...PLACE_CONSUMED.exit,
                            transition: removeFicha(i),
                          },
                        }}
                        transition={{ layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }}
                        onClick={() => setDetail({ kind: "ingredient", item })}
                        className={cn(
                          "group w-full border-b border-border/50 px-2 py-2.5 text-left transition-colors sm:px-3",
                          pinnedProduct ? "bg-warning/[0.04] hover:bg-warning/[0.08]" : "hover:bg-warning/[0.06]",
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="truncate font-medium group-hover:text-warning">{item.ingredient_name}</span>
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums sm:text-sm">
                            <span className="text-muted-foreground">
                              {item.total_quantity} {unitLabel(item.unit)}
                            </span>
                            <span className="mx-1.5 opacity-40">·</span>
                            <span className="font-semibold text-foreground">{formatCLP(item.cost)}</span>
                          </span>
                        </div>
                        <p className="ml-7 mt-0.5 text-[11px] text-muted-foreground">
                          {itemNutri.kcal > 0
                            ? `≈ ${Math.round(itemNutri.kcal)} kcal · ${itemNutri.proteins.toFixed(1)} g prot.`
                            : "Sin cálculo nutricional"}
                        </p>
                        <ChalkStroke pct={pct} tone="warning" delay={Math.min(i, 10) * 0.02} />
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </NotebookColumn>
            </section>
          </div>
        )}
      </div>

      <NutritionDetailModal
        selection={detail}
        periodLabel={`${dates.start} — ${dates.end}`}
        periodTotalCost={ingredientConsumption?.total_cost ?? 0}
        resolveIngredient={resolveIngredient}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}

function NotebookStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Package;
}) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-3 sm:px-4">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate font-mono text-base font-semibold tabular-nums tracking-tight sm:text-lg">
          {value}
        </p>
      </div>
    </div>
  );
}

function ChalkStroke({
  pct,
  tone = "primary",
  delay = 0,
}: {
  pct: number;
  tone?: "primary" | "warning";
  delay?: number;
}) {
  const clamped = Math.min(100, Math.max(6, pct));
  const widthPx = Math.round(18 + (clamped / 100) * 54);
  const wobble = (clamped % 7) - 3;

  return (
    <div className="ml-7 mt-1.5" aria-hidden>
      <svg
        width={widthPx}
        height={10}
        viewBox={`0 0 ${widthPx} 10`}
        className={cn("overflow-visible", tone === "primary" ? "text-primary" : "text-warning")}
      >
        <motion.path
          d={`M 1.5 ${5.2 + wobble * 0.08}
              C ${widthPx * 0.28} ${3.4 - wobble * 0.1},
                ${widthPx * 0.55} ${6.4 + wobble * 0.08},
                ${widthPx - 2} ${4.6 - wobble * 0.05}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.32"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.55, delay, ease: "easeOut" }}
        />
        <motion.path
          d={`M 2 ${5.4 - wobble * 0.06}
              C ${widthPx * 0.32} ${6.2 + wobble * 0.12},
                ${widthPx * 0.62} ${3.8 - wobble * 0.08},
                ${widthPx - 1.5} ${5.1 + wobble * 0.04}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          opacity="0.92"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, delay: delay + 0.04, ease: "easeOut" }}
        />
        <motion.circle
          cx={widthPx - 1}
          cy={5}
          r="1.2"
          fill="currentColor"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 0.55, scale: 1 }}
          transition={{ duration: 0.25, delay: delay + 0.45 }}
        />
      </svg>
    </div>
  );
}

function NotebookColumn({
  title,
  icon: Icon,
  count,
  countLabel,
  emptyTitle,
  emptySubtitle,
  children,
  footer,
  banner,
  className,
}: {
  title: string;
  icon: typeof Package;
  count: number;
  countLabel?: string;
  emptyTitle: string;
  emptySubtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  banner?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex shrink-0 items-end justify-between gap-2 border-b border-border/50 px-3 pb-2 pt-3">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight">
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{title}</span>
        </h2>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {countLabel ?? count}
        </span>
      </div>
      {banner}
      {/* Sin padding horizontal aquí: el hover/selección de cada fila debe ir de borde a borde. */}
      <div className="nutrition-list min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {count > 0 ? (
          <>
            {children}
            {footer}
          </>
        ) : (
          <div className="grid h-full min-h-[10rem] place-items-center px-3 py-10 text-center">
            <div>
              <Icon className="mx-auto h-7 w-7 text-muted-foreground/70" />
              <p className="mt-2 text-sm font-medium">{emptyTitle}</p>
              <p className="text-xs text-muted-foreground">{emptySubtitle}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NutritionDetailModal({
  selection,
  periodLabel,
  periodTotalCost,
  resolveIngredient,
  onClose,
}: {
  selection: DetailSelection | null;
  periodLabel: string;
  periodTotalCost: number;
  resolveIngredient: (item: IngredientConsumptionItem) => (YggdraProduct & NutriFields) | undefined;
  onClose: () => void;
}) {
  const open = Boolean(selection);
  const isIngredient = selection?.kind === "ingredient";
  const productId = selection?.kind === "product" ? selection.productId : undefined;
  const ingredientProduct =
    isIngredient && selection ? resolveIngredient(selection.item) : undefined;
  const ingredientId =
    ingredientProduct?.id ??
    (isIngredient && selection
      ? Number.parseInt(String(selection.item.ingredient_id ?? ""), 10) || undefined
      : undefined);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ["nutrition-detail", "product", productId ?? ingredientId],
    queryFn: () => fetchProduct((productId ?? ingredientId)!),
    enabled: open && (productId != null || (ingredientId != null && Number.isFinite(ingredientId))),
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ["nutrition-detail", "recipes", productId],
    queryFn: () => fetchRecipesByProduct(productId!),
    enabled: open && productId != null,
  });

  const { data: recipeUsages = [], isLoading: loadingUsages } = useQuery({
    queryKey: ["nutrition-detail", "ingredient-usages", ingredientId],
    queryFn: () => fetchRecipesUsingIngredient(ingredientId!, { maxPages: 12, maxRecipes: 8 }),
    enabled: open && isIngredient && ingredientId != null && Number.isFinite(ingredientId),
    staleTime: 60_000,
  });

  const recipeIngredients = (() => {
    const raw = (recipes[0] as { ingredients?: unknown } | undefined)?.ingredients;
    return Array.isArray(raw)
      ? (raw as Array<{
          id: string | number;
          ingredient_name?: string;
          quantity?: string | number;
          unit?: string;
        }>)
      : [];
  })();

  const title =
    selection?.kind === "product"
      ? selection.name
      : selection?.kind === "ingredient"
        ? selection.item.ingredient_name
        : "";

  const nutriSource = (ingredientProduct ?? (product as NutriFields | undefined)) as NutriFields | undefined;
  const itemNutri =
    isIngredient && selection
      ? addNutri(emptyNutri(), nutriSource, selection.item.total_quantity, selection.item.unit)
      : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={isIngredient ? `Consumo del período · ${periodLabel}` : `Detalle · ${periodLabel}`}
      size={isIngredient ? "lg" : "md"}
    >
      <ModalBody className="space-y-5">
        {selection?.kind === "product" && (
          <div className="grid grid-cols-2 gap-3">
            <DetailStat label="Insumos en receta" value={String(selection.ingredientCount)} />
            <DetailStat label="Tipo" value="Producto compuesto" />
          </div>
        )}

        {selection?.kind === "ingredient" && (
          <IngredientConsumptionPanel
            item={selection.item}
            periodTotalCost={periodTotalCost}
            nutri={itemNutri}
            nutriSource={nutriSource}
            usages={recipeUsages}
            loadingUsages={loadingUsages}
          />
        )}

        {isLoading && (
          <div className="space-y-2 py-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        )}

        {error && (
          <p className="text-sm text-warning">No se pudo cargar la ficha de catálogo.</p>
        )}

        {product && selection?.kind === "product" && <ProductCatalogBlock product={product} />}

        {selection?.kind === "product" && recipeIngredients.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Receta · insumos
            </p>
            <ul className="divide-y divide-border/50">
              {recipeIngredients.map((ing) => (
                <li key={String(ing.id)} className="flex justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                  <span className="truncate">{ing.ingredient_name ?? "Insumo"}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {ing.quantity} {unitLabel(String(ing.unit ?? ""))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {product && selection?.kind === "ingredient" && (
          <details className="group">
            <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
              <span className="underline-offset-2 group-open:underline">Ficha de catálogo</span>
            </summary>
            <div className="mt-3">
              <ProductCatalogBlock product={product} />
            </div>
          </details>
        )}

        {(productId != null || ingredientId != null) && (
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Ir al catálogo
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </ModalBody>
    </Modal>
  );
}

function IngredientConsumptionPanel({
  item,
  periodTotalCost,
  nutri,
  nutriSource,
  usages,
  loadingUsages,
}: {
  item: IngredientConsumptionItem;
  periodTotalCost: number;
  nutri: NutriTotals | null;
  nutriSource: NutriFields | undefined;
  usages: IngredientRecipeUsage[];
  loadingUsages: boolean;
}) {
  const qty = num(item.total_quantity);
  const cost = num(item.cost);
  const unit = unitLabel(item.unit);
  const unitCost = qty > 0 ? cost / qty : 0;
  const share = periodTotalCost > 0 ? Math.round((cost / periodTotalCost) * 100) : 0;

  const replicaRows = useMemo(() => {
    return usages
      .map((u) => {
        const replicas = estimateReplicas(qty, item.unit, u.quantity, u.unit);
        const portions =
          replicas != null && u.servings != null && u.servings > 0
            ? replicas * u.servings
            : null;
        return { usage: u, replicas, portions };
      })
      .sort((a, b) => (b.replicas ?? -1) - (a.replicas ?? -1));
  }, [usages, qty, item.unit]);

  const best = replicaRows.find((r) => r.replicas != null && r.replicas > 0);

  return (
    <div className="space-y-5">
      {/* Hero consumo */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-warning/[0.12] via-transparent to-primary/[0.08] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Consumido en el período
            </p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {qty.toLocaleString("es-CL", { maximumFractionDigits: 2 })}
              <span className="ml-1.5 text-lg font-medium text-muted-foreground">{unit}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Costo{" "}
              <span className="font-semibold tabular-nums text-foreground">{formatCLP(cost)}</span>
              {unitCost > 0 && (
                <>
                  <span className="mx-1.5 opacity-40">·</span>
                  <span className="tabular-nums">{formatCLP(unitCost)}</span>
                  <span> / {unit}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {share > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-background/70 px-2.5 py-1 text-xs font-medium tabular-nums ring-1 ring-border/60">
                <CircleDollarSign className="h-3.5 w-3.5 text-warning" />
                {share}% del costo de insumos
              </span>
            )}
            {hasNutrition(nutriSource) && (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-background/70 px-2.5 py-1 text-xs font-medium ring-1 ring-border/60">
                <Apple className="h-3.5 w-3.5 text-primary" />
                Con ficha nutricional
              </span>
            )}
          </div>
        </div>

        {/* Barra de participación */}
        {share > 0 && (
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
              <motion.div
                className="h-full rounded-full bg-warning/80"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, share)}%` }}
                transition={{ duration: 0.55, ease: "easeOut" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Nutrición del consumo */}
      {nutri &&
        (nutri.kcal > 0 ||
          nutri.proteins > 0 ||
          nutri.carbs > 0 ||
          nutri.fats > 0 ||
          nutri.sugars > 0 ||
          nutri.sodium > 0) && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-primary" />
            Nutrición estimada del consumo
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { label: "Energía", value: `${Math.round(nutri.kcal)} kcal`, accent: true },
              { label: "Proteínas", value: `${nutri.proteins.toFixed(1)} g` },
              { label: "Carbos", value: `${nutri.carbs.toFixed(1)} g` },
              { label: "Grasas tot.", value: `${nutri.fats.toFixed(1)} g` },
              ...(nutri.satFats > 0
                ? [{ label: "Grasas sat.", value: `${nutri.satFats.toFixed(1)} g` }]
                : []),
              ...(nutri.monoFats > 0
                ? [{ label: "Monoinsaturadas", value: `${nutri.monoFats.toFixed(1)} g` }]
                : []),
              ...(nutri.polyFats > 0
                ? [{ label: "Poliinsaturadas", value: `${nutri.polyFats.toFixed(1)} g` }]
                : []),
              ...(nutri.transFats > 0
                ? [{ label: "Grasas trans", value: `${nutri.transFats.toFixed(1)} g` }]
                : []),
              ...(nutri.cholesterol > 0
                ? [{ label: "Colesterol", value: `${Math.round(nutri.cholesterol)} mg` }]
                : []),
              { label: "Azúcares", value: `${nutri.sugars.toFixed(1)} g` },
              { label: "Sodio", value: `${Math.round(nutri.sodium)} mg` },
            ].map((n) => (
              <div
                key={n.label}
                className={cn(
                  "rounded-xl px-3 py-2.5",
                  n.accent ? "bg-primary/10 ring-1 ring-primary/20" : "bg-muted/40",
                )}
              >
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{n.label}</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">{n.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Réplicas de receta — el insight poderoso */}
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Repeat2 className="h-3.5 w-3.5 text-primary" />
            Qué alcanzó a preparar
          </p>
          {best && (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              Hasta ~{fmtReplicas(best.replicas!)}× en {best.usage.recipeName}
            </span>
          )}
        </div>

        {loadingUsages ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : replicaRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center">
            <ChefHat className="mx-auto h-6 w-6 text-muted-foreground/70" />
            <p className="mt-2 text-sm font-medium">Sin recetas vinculadas</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Este insumo no aparece en las recetas activas indexadas.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {replicaRows.map(({ usage, replicas, portions }) => (
              <li
                key={usage.recipeId}
                className="flex items-stretch gap-3 rounded-xl border border-border/60 bg-background/50 p-3 transition-colors hover:border-primary/30"
              >
                <div
                  className={cn(
                    "flex w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-lg px-1 py-2",
                    replicas != null
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <span className="font-display text-xl font-semibold tabular-nums leading-none">
                    {replicas != null ? fmtReplicas(replicas) : "—"}
                  </span>
                  <span className="mt-1 text-[10px] font-medium uppercase tracking-wide opacity-80">
                    réplicas
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold tracking-tight">{usage.recipeName}</p>
                  {usage.productName && usage.productName !== usage.recipeName && (
                    <p className="truncate text-[11px] text-muted-foreground">{usage.productName}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Scale className="h-3 w-3" />
                      {usage.quantity} {unitLabel(usage.unit)} / receta
                    </span>
                    {portions != null && (
                      <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                        ≈ {fmtReplicas(portions)} porciones
                      </span>
                    )}
                    {usage.yieldQuantity != null && usage.yieldQuantity > 0 && (
                      <span>
                        Rinde {usage.yieldQuantity} {unitLabel(usage.yieldUnit ?? "")}
                      </span>
                    )}
                  </div>
                  {replicas != null && (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full rounded-full bg-primary/70"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(100, (replicas / Math.max(best?.replicas ?? replicas, 1)) * 100)}%`,
                        }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  )}
                  {replicas == null && (
                    <p className="mt-1.5 text-[10px] text-muted-foreground/80">
                      Unidades distintas ({unitLabel(item.unit)} vs {unitLabel(usage.unit)}); no se puede estimar.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          Estimación según la fórmula actual de cada receta. El consumo del período puede mezclar varias
          preparaciones; las réplicas son una lectura de “cuánto habría alcanzado” con ese insumo.
        </p>
      </div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ProductCatalogBlock({ product }: { product: ProductDetail }) {
  const nutri = product as ProductDetail & NutriFields;
  const nutrients: { label: string; value: string }[] = [
    { label: "Energía", value: num(nutri.energy_kcal) ? `${num(nutri.energy_kcal)} kcal` : "" },
    { label: "Proteínas", value: num(nutri.proteins_g) ? `${num(nutri.proteins_g)} g` : "" },
    { label: "Carbohidratos", value: num(nutri.carbohydrates_g) ? `${num(nutri.carbohydrates_g)} g` : "" },
    { label: "Grasas tot.", value: num(nutri.total_fats_g) ? `${num(nutri.total_fats_g)} g` : "" },
    { label: "Grasas sat.", value: num(nutri.saturated_fats_g) ? `${num(nutri.saturated_fats_g)} g` : "" },
    { label: "Monoinsaturadas", value: num(nutri.monounsaturated_fats_g) ? `${num(nutri.monounsaturated_fats_g)} g` : "" },
    { label: "Poliinsaturadas", value: num(nutri.polyunsaturated_fats_g) ? `${num(nutri.polyunsaturated_fats_g)} g` : "" },
    { label: "Grasas trans", value: num(nutri.trans_fats_g) ? `${num(nutri.trans_fats_g)} g` : "" },
    { label: "Colesterol", value: num(nutri.cholesterol_mg) ? `${num(nutri.cholesterol_mg)} mg` : "" },
    { label: "Azúcares", value: num(nutri.total_sugars_g) ? `${num(nutri.total_sugars_g)} g` : "" },
    { label: "Sodio", value: num(nutri.sodium_mg) ? `${num(nutri.sodium_mg)} mg` : "" },
  ].filter((n) => n.value);

  const categoryName =
    product.category && typeof product.category === "object" && "name" in product.category
      ? String((product.category as { name?: string }).name ?? "")
      : "";

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Ficha de catálogo
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {product.code && (
            <>
              <dt className="text-muted-foreground">Código</dt>
              <dd className="font-mono tabular-nums">{product.code}</dd>
            </>
          )}
          {categoryName && (
            <>
              <dt className="text-muted-foreground">Categoría</dt>
              <dd>{categoryName}</dd>
            </>
          )}
          {product.product_type && (
            <>
              <dt className="text-muted-foreground">Tipo</dt>
              <dd>{productTypeLabelEs(String(product.product_type))}</dd>
            </>
          )}
          {product.measurement_unit && (
            <>
              <dt className="text-muted-foreground">Unidad</dt>
              <dd>{unitLabel(product.measurement_unit)}</dd>
            </>
          )}
        </dl>
      </div>

      {nutrients.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Información nutricional
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {nutrients.map((n) => (
              <div key={n.label} className="rounded-lg bg-muted/40 px-2.5 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{n.label}</p>
                <p className="font-mono text-sm font-semibold tabular-nums">{n.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="glass-read flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
      <section className="grid shrink-0 grid-cols-2 border-b border-border/50 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-4 py-3">
            <Skeleton className="mb-2 h-3 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </section>
      <section className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col} className="flex min-h-0 flex-col border-border/50 lg:border-l lg:first:border-l-0">
            <div className="border-b border-border/50 px-3 py-3">
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="space-y-3 p-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
