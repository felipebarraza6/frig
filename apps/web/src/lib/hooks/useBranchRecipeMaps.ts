import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentBranch } from "@/lib/store/session";
import {
  fetchBranchRecipes,
  fetchBranchRecipeIngredients,
} from "@/lib/api/recipes";
import type { YggdraSchemas } from "@/lib/api/types";

export interface BranchRecipeMaps {
  recipesByProductId: Map<number, YggdraSchemas["Recipe"]>;
  ingredientsByRecipeId: Map<string, YggdraSchemas["RecipeIngredient"][]>;
  isLoading: boolean;
}

export function useBranchRecipeMaps(enabled = true): BranchRecipeMaps {
  const branch = useCurrentBranch();

  const { data: branchRecipes = [], isLoading: loadingRecipes } = useQuery({
    queryKey: ["recipes", "branch", branch?.branch_id],
    queryFn: fetchBranchRecipes,
    enabled: !!branch?.branch_id && enabled,
    staleTime: 5 * 60_000,
  });

  const { data: branchRecipeIngredients = [], isLoading: loadingIngredients } =
    useQuery({
      queryKey: ["recipe-ingredients", "branch", branch?.branch_id],
      queryFn: fetchBranchRecipeIngredients,
      enabled: !!branch?.branch_id && enabled,
      staleTime: 5 * 60_000,
    });

  return useMemo(() => {
    const recipesByProductId = new Map<number, YggdraSchemas["Recipe"]>();
    for (const recipe of branchRecipes) {
      if (recipe.resulting_product == null) continue;
      if (!recipesByProductId.has(recipe.resulting_product)) {
        recipesByProductId.set(recipe.resulting_product, recipe);
      }
    }

    const ingredientsByRecipeId = new Map<
      string,
      YggdraSchemas["RecipeIngredient"][]
    >();
    for (const ing of branchRecipeIngredients) {
      if (!ing.recipe) continue;
      const list = ingredientsByRecipeId.get(ing.recipe) ?? [];
      list.push(ing);
      ingredientsByRecipeId.set(ing.recipe, list);
    }

    return {
      recipesByProductId,
      ingredientsByRecipeId,
      isLoading: loadingRecipes || loadingIngredients,
    };
  }, [branchRecipes, branchRecipeIngredients, loadingRecipes, loadingIngredients]);
}
