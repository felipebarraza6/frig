import { apiFetch } from "./client";
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
  const data = await apiFetch<PaginatedRecipeList>("/recipes/recipes/");
  return data.results.filter((r) => r.resulting_product === productId);
}

export async function createRecipe(payload: RecipePayload): Promise<Recipe> {
  return apiFetch<Recipe>("/recipes/recipes/", {
    method: "POST",
    body: {
      ...payload,
      branch: 0,
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
