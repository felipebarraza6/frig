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

export async function fetchRecipesByProduct(productId: number): Promise<Recipe[]> {
  const recipes: Recipe[] = [];
  // El listado solo acepta page/page_size y no permite filtrar por
  // resulting_product, así que recorremos las páginas en bloques de 500.
  let url: string = "/recipes/recipes/?page_size=500";
  for (;;) {
    const data: PaginatedRecipeList = await apiFetch<PaginatedRecipeList>(url);
    recipes.push(...data.results);
    if (!data.next) break;
    const nextUrl = new URL(data.next, API_BASE);
    url = `${nextUrl.pathname}${nextUrl.search}`;
  }
  return recipes.filter((r) => r.resulting_product === productId);
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
    body: payload as RecipeIngredientRequest,
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

/**
 * Descarga el PDF de etiqueta nutricional con autenticación (la ruta relativa
 * abierta con window.open pega contra Next.js y sin token → 404).
 */
export function downloadRecipeNutritionLabel(id: string): Promise<ApiFileResult> {
  return apiFile(`/recipes/recipes/${id}/download-nutrition-label-pdf/`);
}

export async function fetchRecipeNutritionLabel(id: string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/recipes/recipes/${id}/nutrition_label/`);
}
