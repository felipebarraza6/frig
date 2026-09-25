import { getToken } from "@/lib/api/session-storage";
import { fetchRecipe, fetchRecipesForProductIds } from "@/lib/api/recipes";
import type { PublicMenuProduct } from "@/lib/api/public-catalog";

export function normalizeIngredientNames(names: string[]): string[] {
  return names.map((n) => n.trim()).filter(Boolean);
}

/** @deprecated usar chips con ingredient_names */
export function formatIngredientLine(names: string[]): string | null {
  const clean = normalizeIngredientNames(names);
  if (clean.length === 0) return null;
  return clean.join(" · ");
}

function namesFromProductFields(product: PublicMenuProduct): string[] {
  if (Array.isArray(product.ingredient_names) && product.ingredient_names.length > 0) {
    return normalizeIngredientNames(product.ingredient_names);
  }
  if (Array.isArray(product.ingredients) && product.ingredients.length > 0) {
    return normalizeIngredientNames(
      product.ingredients.map((item) =>
        typeof item === "string"
          ? item
          : item.ingredient_name ?? item.name ?? "",
      ),
    );
  }
  if (product.ingredient_line) {
    return normalizeIngredientNames(
      product.ingredient_line.split(/\s*[·,|]\s*/),
    );
  }
  return [];
}

/**
 * Para productos compuestos (receta), carga nombres de ingredientes.
 * Requiere sesión FRIG (recetas no son públicas hoy). Visitantes QR sin
 * token solo verán ingredientes si el back los manda en el catálogo público.
 */
export async function enrichProductsWithIngredientLines(
  products: PublicMenuProduct[],
): Promise<PublicMenuProduct[]> {
  if (products.length === 0) return products;

  const withApiFields = products.map((p) => {
    const names = namesFromProductFields(p);
    if (names.length === 0) return { ...p };
    return {
      ...p,
      ingredient_names: names,
      ingredient_line: formatIngredientLine(names),
    };
  });

  if (!getToken()) return withApiFields;

  const needRecipe = withApiFields
    .filter((p) => !(p.ingredient_names && p.ingredient_names.length > 0))
    .map((p) => p.id);

  if (needRecipe.length === 0) return withApiFields;

  try {
    const recipeByProduct = await fetchRecipesForProductIds(needRecipe, {
      pageSize: 100,
      maxPages: 15,
    });

    const entries = [...recipeByProduct.entries()];
    const details = await Promise.all(
      entries.map(async ([productId, recipe]) => {
        try {
          const full = await fetchRecipe(recipe.id);
          const names = normalizeIngredientNames(
            (full.ingredients ?? [])
              .filter((ing) => ing.is_active !== false)
              .slice()
              .sort(
                (a, b) => (a.order_in_recipe ?? 0) - (b.order_in_recipe ?? 0),
              )
              .map((ing) => ing.ingredient_name),
          );
          return [productId, names] as const;
        } catch {
          return [productId, [] as string[]] as const;
        }
      }),
    );

    const namesByProduct = new Map(details);
    return withApiFields.map((p) => {
      if (p.ingredient_names && p.ingredient_names.length > 0) return p;
      const names = namesByProduct.get(p.id) ?? [];
      if (names.length === 0) return p;
      return {
        ...p,
        ingredient_names: names,
        ingredient_line: formatIngredientLine(names),
      };
    });
  } catch {
    return withApiFields;
  }
}
