import { apiFetch, apiFile, API_BASE } from "./client";
import type { ApiFileResult } from "./client";
import { getBranchId } from "@/lib/api/session-storage";
import type { YggdraSchemas } from "@/lib/api/types";

type Recipe = YggdraSchemas["Recipe"];
type RecipeRequest = YggdraSchemas["RecipeRequest"];
type RecipeIngredient = YggdraSchemas["RecipeIngredient"];
type RecipeIngredientRequest = YggdraSchemas["RecipeIngredientRequest"];
type PaginatedRecipeList = YggdraSchemas["PaginatedRecipeList"];

export interface RecipePayload {
  name: string;
  resulting_product: number;
  instructions: string;
  recipe_type?: "SIMPLE" | "COMPLEX" | "ASSEMBLY" | "PREPARATION" | "COOKING" | "INGREDIENT_BASE" | "SUB_RECIPE" | "NUTRITIONAL_RECIPE";
  status?: "ACTIVE" | "INACTIVE" | "DRAFT" | "TESTING";
  description?: string | null;
  code?: string | null;
  preparation_time_minutes?: number;
  cooking_time_minutes?: number;
  yield_quantity?: string;
  yield_unit?: string;
  servings?: number;
  notes?: string | null;
  is_batch_recipe?: boolean;
  batch_size?: string;
  can_scale?: boolean;
  total_yield_grams?: string | null;
  shelf_life_days?: number | null;
  shelf_life_temperature?: string;
  shelf_life_conditions?: string;
}

export interface RecipeIngredientPayload {
  recipe: string;
  ingredient: number;
  quantity: string;
  unit: string;
  is_active?: boolean;
  is_optional?: boolean;
  is_substitutable?: boolean;
  preparation_notes?: string | null;
  order_in_recipe?: number;
}

export async function fetchRecipesByProduct(
  productId: number,
  opts?: { productName?: string },
): Promise<Recipe[]> {
  // Preferir search por nombre: `resulting_product=` se ignora en Yggdra.
  const name = opts?.productName?.trim();
  if (name) {
    const qs = new URLSearchParams({
      page_size: "50",
      search: name,
      status: "ACTIVE",
    });
    const data = await apiFetch<PaginatedRecipeList>(`/recipes/recipes/?${qs.toString()}`);
    const matched = (data.results ?? []).filter(
      (r) => Number(r.resulting_product) === Number(productId),
    );
    if (matched.length > 0) return matched;
  }

  const map = await fetchRecipesForProductIds([productId], { pageSize: 100, maxPages: 20 });
  const recipe = map.get(productId);
  return recipe ? [recipe] : [];
}

/**
 * Indexa recetas por `resulting_product` recorriendo el listado paginado.
 * Corta cuando cubre todos los `productIds` o al tope de páginas (protege la app).
 */
export async function fetchRecipesForProductIds(
  productIds: number[],
  opts?: { pageSize?: number; maxPages?: number },
): Promise<Map<number, Recipe>> {
  const needed = new Set(productIds.filter((id) => Number.isFinite(id) && id > 0));
  const map = new Map<number, Recipe>();
  if (needed.size === 0) return map;

  const pageSize = opts?.pageSize ?? 100;
  const maxPages = opts?.maxPages ?? 10;
  let url: string = `/recipes/recipes/?page_size=${pageSize}&status=ACTIVE`;

  for (let page = 0; page < maxPages && needed.size > 0; page += 1) {
    const data: PaginatedRecipeList = await apiFetch<PaginatedRecipeList>(url);
    for (const recipe of data.results ?? []) {
      const pid = Number(recipe.resulting_product);
      if (!needed.has(pid) || map.has(pid)) continue;
      map.set(pid, recipe);
      needed.delete(pid);
    }
    if (!data.next || needed.size === 0) break;
    const nextUrl = new URL(data.next, API_BASE);
    url = `${nextUrl.pathname}${nextUrl.search}`;
  }

  return map;
}

export async function createRecipe(payload: RecipePayload): Promise<Recipe> {
  const branchId = Number(getBranchId());
  if (!branchId) {
    throw new Error("No hay una sucursal seleccionada. Selecciona una sucursal e inténtalo de nuevo.");
  }
  return apiFetch<Recipe>("/recipes/recipes/", {
    method: "POST",
    body: {
      ...payload,
      // Yggdra exige branch y code en el body al crear recetas (400 si faltan).
      branch: branchId,
      code: payload.code ?? `RCP-${Date.now().toString(36).toUpperCase()}`,
      recipe_type: payload.recipe_type ?? "SIMPLE",
      status: payload.status ?? "ACTIVE",
    } as RecipeRequest,
  });
}

export async function updateRecipe(id: string, payload: Partial<RecipePayload>): Promise<Recipe> {
  return apiFetch<Recipe>(`/recipes/recipes/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function createRecipeIngredient(payload: RecipeIngredientPayload): Promise<RecipeIngredient> {
  return apiFetch<RecipeIngredient>("/recipes/ingredients/", {
    method: "POST",
    body: { ...payload, quantity: Number(payload.quantity) } as RecipeIngredientRequest,
  });
}

export async function updateRecipeIngredient(
  id: number,
  payload: Partial<RecipeIngredientPayload>,
): Promise<RecipeIngredient> {
  return apiFetch<RecipeIngredient>(`/recipes/ingredients/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteRecipeIngredient(id: number): Promise<void> {
  await apiFetch(`/recipes/ingredients/${id}/`, { method: "DELETE" });
}

export async function calculateRecipeNutrition(id: string): Promise<Recipe> {
  return apiFetch<Recipe>(`/recipes/recipes/${id}/calculate_nutrition/`, {
    method: "POST",
    body: {},
  });
}

export interface NutritionLabelDownloadOptions {
  /** `simple` | `branded` / `logo` — el back puede ignorarlos hasta documentarlos. */
  mode?: "simple" | "branded" | "logo";
  /** Preset de tamaño, p.ej. `62x100`. */
  size?: string;
  /** `per_100g` | `per_serving`. */
  per?: "per_100g" | "per_serving";
  includeLogo?: boolean;
}

/**
 * Descarga el PDF de etiqueta nutricional con autenticación (la ruta relativa
 * abierta con window.open pega contra Next.js y sin token → 404).
 * Query params se envían best-effort; el schema OpenAPI aún no los documenta.
 */
export function downloadRecipeNutritionLabel(
  id: string,
  opts: NutritionLabelDownloadOptions = {},
): Promise<ApiFileResult> {
  const qs = new URLSearchParams();
  if (opts.mode) qs.set("mode", opts.mode === "branded" ? "logo" : opts.mode);
  if (opts.size) qs.set("size", opts.size);
  if (opts.per) qs.set("per", opts.per === "per_serving" ? "serving" : "100g");
  if (opts.includeLogo || opts.mode === "branded" || opts.mode === "logo") {
    qs.set("with_logo", "true");
  }
  const q = qs.toString();
  return apiFile(`/recipes/recipes/${id}/download-nutrition-label-pdf/${q ? `?${q}` : ""}`);
}

export async function fetchRecipeNutritionLabel(id: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/recipes/recipes/${id}/nutrition_label/`);
}

/** Detalle de receta (instrucciones, pasos, tiempos). */
export async function fetchRecipe(id: string): Promise<Recipe> {
  return apiFetch<Recipe>(`/recipes/recipes/${id}/`);
}

export type RecipeStep = YggdraSchemas["RecipeStep"];

/** Pasos de preparación de una receta (si el detalle no los trae anidados). */
export async function fetchRecipeSteps(recipeId: string): Promise<RecipeStep[]> {
  const data = await apiFetch<YggdraSchemas["PaginatedRecipeStepList"]>(
    `/recipes/steps/?recipe=${encodeURIComponent(recipeId)}&page_size=100`,
  );
  return data.results ?? [];
}

/** Carga todas las recetas activas de la sucursal actual. */
export async function fetchBranchRecipes(opts?: {
  pageSize?: number;
  maxPages?: number;
}): Promise<Recipe[]> {
  const recipes: Recipe[] = [];
  const pageSize = opts?.pageSize ?? 100;
  const maxPages = opts?.maxPages ?? 20;
  let url: string = `/recipes/recipes/?page_size=${pageSize}&status=ACTIVE`;
  for (let page = 0; page < maxPages; page += 1) {
    const data: PaginatedRecipeList = await apiFetch<PaginatedRecipeList>(url);
    recipes.push(...data.results);
    if (!data.next) break;
    const nextUrl = new URL(data.next, API_BASE);
    url = `${nextUrl.pathname}${nextUrl.search}`;
  }
  return recipes;
}

type PaginatedRecipeIngredientList = YggdraSchemas["PaginatedRecipeIngredientList"];

export type IngredientRecipeUsage = {
  recipeId: string;
  recipeName: string;
  productName: string;
  quantity: number;
  unit: string;
  servings: number | null;
  yieldQuantity: number | null;
  yieldUnit: string | null;
};

/**
 * Recetas que usan un insumo. Escanea el listado de ingredientes con tope
 * (el API solo filtra por recipe) y enriquece con el detalle de cada receta.
 */
export async function fetchRecipesUsingIngredient(
  ingredientId: number,
  opts?: { maxPages?: number; maxRecipes?: number },
): Promise<IngredientRecipeUsage[]> {
  if (!Number.isFinite(ingredientId) || ingredientId <= 0) return [];

  const maxPages = opts?.maxPages ?? 12;
  const maxRecipes = opts?.maxRecipes ?? 8;
  const byRecipe = new Map<string, RecipeIngredient>();

  // Intentamos filtro por ingredient; si el backend lo ignora, filtramos en cliente.
  let url: string = `/recipes/ingredients/?page_size=100&ingredient=${ingredientId}`;

  for (let page = 0; page < maxPages && byRecipe.size < maxRecipes * 3; page += 1) {
    const data: PaginatedRecipeIngredientList = await apiFetch<PaginatedRecipeIngredientList>(url);
    for (const row of data.results ?? []) {
      if (Number(row.ingredient) !== ingredientId) continue;
      if (row.is_active === false) continue;
      if (!byRecipe.has(row.recipe)) byRecipe.set(row.recipe, row);
    }
    if (!data.next || byRecipe.size >= maxRecipes) break;
    const nextUrl = new URL(data.next, API_BASE);
    url = `${nextUrl.pathname}${nextUrl.search}`;
  }

  const recipeIds = Array.from(byRecipe.keys()).slice(0, maxRecipes);
  const usages: IngredientRecipeUsage[] = [];

  await Promise.all(
    recipeIds.map(async (id) => {
      const ing = byRecipe.get(id)!;
      try {
        const recipe = await apiFetch<Recipe>(`/recipes/recipes/${id}/`);
        usages.push({
          recipeId: id,
          recipeName: recipe.name || recipe.resulting_product_name || "Receta",
          productName: recipe.resulting_product_name || recipe.name || "—",
          quantity: Number(ing.quantity) || 0,
          unit: ing.unit || "",
          servings: recipe.servings != null ? Number(recipe.servings) : null,
          yieldQuantity: recipe.yield_quantity != null ? Number(recipe.yield_quantity) : null,
          yieldUnit: recipe.yield_unit ?? null,
        });
      } catch {
        usages.push({
          recipeId: id,
          recipeName: `Receta ${id.slice(0, 8)}`,
          productName: "—",
          quantity: Number(ing.quantity) || 0,
          unit: ing.unit || "",
          servings: null,
          yieldQuantity: null,
          yieldUnit: null,
        });
      }
    }),
  );

  return usages.sort((a, b) => a.recipeName.localeCompare(b.recipeName, "es"));
}

/** Carga todos los ingredientes de recetas de la sucursal actual. */
export async function fetchBranchRecipeIngredients(): Promise<RecipeIngredient[]> {
  const ingredients: RecipeIngredient[] = [];
  let url: string = "/recipes/ingredients/?page_size=1000";
  for (;;) {
    const data: PaginatedRecipeIngredientList = await apiFetch<PaginatedRecipeIngredientList>(url);
    ingredients.push(...(data.results ?? []));
    if (!data.next) break;
    const nextUrl = new URL(data.next, API_BASE);
    url = `${nextUrl.pathname}${nextUrl.search}`;
  }
  return ingredients;
}
