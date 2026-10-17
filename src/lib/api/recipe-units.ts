/**
 * Unidades aceptadas por el calculador nutricional de Yggdra
 * (`NutritionCalculator` / assert_label_ready).
 *
 * El backend es estricto: no acepta `un`, `UN`, `porcion`, etc.
 */

export const RECIPE_NUTRITION_UNITS = [
  { value: "g", label: "Gramo (g)" },
  { value: "kg", label: "Kilogramo (kg)" },
  { value: "mg", label: "Miligramo (mg)" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "l", label: "Litro (l)" },
  { value: "litro", label: "Litro" },
  { value: "litros", label: "Litros" },
  { value: "cc", label: "Centímetro cúbico (cc)" },
  { value: "unidad", label: "Unidad" },
] as const;

export type RecipeNutritionUnit = (typeof RECIPE_NUTRITION_UNITS)[number]["value"];

const UNIT_SET = new Set<string>(RECIPE_NUTRITION_UNITS.map((u) => u.value));

/** Unidades de volumen que requieren `density_g_per_ml` en la ficha del insumo. */
export const VOLUME_UNITS = new Set<string>(["ml", "l", "litro", "litros", "cc"]);

/** Unidad de conteo que requiere `grams_per_unit`. */
export const COUNT_UNITS = new Set<string>(["unidad"]);

/** Alias legacy → unidad canónica del backend. */
const UNIT_ALIASES: Record<string, RecipeNutritionUnit> = {
  un: "unidad",
  UN: "unidad",
  Un: "unidad",
  und: "unidad",
  u: "unidad",
  unit: "unidad",
  units: "unidad",
  pieza: "unidad",
  piezas: "unidad",
  gr: "g",
  gramos: "g",
  gram: "g",
  grams: "g",
  kilogramo: "kg",
  kilogramos: "kg",
  kilo: "kg",
  litros: "litros",
  L: "l",
  Lt: "l",
  LT: "l",
  mililitro: "ml",
  mililitros: "ml",
  mL: "ml",
  ML: "ml",
  cm3: "cc",
  "cm³": "cc",
};

export function isRecipeNutritionUnit(value: string | null | undefined): value is RecipeNutritionUnit {
  if (!value) return false;
  return UNIT_SET.has(value);
}

/** Normaliza texto libre / legacy a una unidad válida, o `null` si no se puede mapear. */
export function normalizeRecipeUnit(raw: string | null | undefined): RecipeNutritionUnit | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (UNIT_SET.has(trimmed)) return trimmed as RecipeNutritionUnit;
  const lower = trimmed.toLowerCase();
  if (UNIT_SET.has(lower)) return lower as RecipeNutritionUnit;
  if (UNIT_ALIASES[trimmed]) return UNIT_ALIASES[trimmed]!;
  if (UNIT_ALIASES[lower]) return UNIT_ALIASES[lower]!;
  return null;
}

export function isVolumeUnit(unit: string | null | undefined): boolean {
  const n = normalizeRecipeUnit(unit) ?? unit?.toLowerCase();
  return Boolean(n && VOLUME_UNITS.has(n));
}

export function isCountUnit(unit: string | null | undefined): boolean {
  const n = normalizeRecipeUnit(unit) ?? unit?.toLowerCase();
  return Boolean(n && COUNT_UNITS.has(n));
}

/** Default seguro para fichas nuevas (peso). */
export const DEFAULT_RECIPE_UNIT: RecipeNutritionUnit = "g";
