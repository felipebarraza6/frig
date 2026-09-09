"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChefHat } from "lucide-react";
import { fetchProductInventory } from "@/lib/api/inventory";
import { useBranchRecipeMaps } from "@/lib/hooks/useBranchRecipeMaps";
import { useCurrentBranch } from "@/lib/store/session";
import { cn } from "@/lib/utils";
import type { YggdraSchemas } from "@/lib/api/types";

type RecipeIngredient = YggdraSchemas["RecipeIngredient"];

function formatQty(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

interface CompoundCalc {
  units: number;
  limitingIds: Set<number>;
}

// Cantidades por unidad de producto resultante: cuántas unidades se pueden
// fabricar con el stock disponible de los ingredientes en la sucursal.
function calcFabricableUnits(
  ingredients: RecipeIngredient[],
  stockById: Map<number, number>,
): CompoundCalc {
  const limitingPool = ingredients.filter((i) => !i.is_optional);
  const pool = limitingPool.length > 0 ? limitingPool : ingredients;
  const needed = pool
    .map((i) => ({ ingredient: i, need: Number(i.quantity) }))
    .filter((e) => e.need > 0);
  if (ingredients.length === 0 || needed.length === 0) {
    return { units: 0, limitingIds: new Set() };
  }

  let units = Infinity;
  for (const e of needed) {
    const available = stockById.get(e.ingredient.ingredient) ?? 0;
    units = Math.min(units, Math.floor(available / e.need));
  }

  const limitingIds = new Set<number>();
  for (const e of needed) {
    const available = stockById.get(e.ingredient.ingredient) ?? 0;
    if (Math.floor(available / e.need) === units) {
      limitingIds.add(e.ingredient.ingredient);
    }
  }
  return { units, limitingIds };
}

/**
 * Disponibilidad de un producto compuesto en bodega: cuántas unidades se
 * pueden fabricar con el stock actual de los ingredientes de su receta en la
 * sucursal. Se muestra en el tab Bodegas del formulario de producto.
 */
export function CompoundAvailability({ productId }: { productId: number }) {
  const branch = useCurrentBranch();
  const { recipesByProductId, ingredientsByRecipeId, isLoading: loadingRecipes } =
    useBranchRecipeMaps(!!branch?.branch_id);

  const { data: inventory = [], isLoading: loadingInventory } = useQuery({
    queryKey: ["product-inventory", "compound-stock", branch?.branch_id],
    queryFn: () => fetchProductInventory({ page_size: 500 }),
    enabled: !!branch?.branch_id,
    staleTime: 60_000,
  });

  const stockById = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of inventory) {
      map.set(item.id, item.stock_available ?? 0);
    }
    return map;
  }, [inventory]);

  const recipe = recipesByProductId.get(productId);
  const ingredients = recipe
    ? (ingredientsByRecipeId.get(String(recipe.id)) ?? [])
    : [];
  const { units, limitingIds } = calcFabricableUnits(ingredients, stockById);
  const loading = loadingRecipes || loadingInventory;

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ChefHat className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Disponibilidad en bodega</h3>
        <p className="text-xs text-muted-foreground">
          Depende del stock de los ingredientes en la sucursal
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-6 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : !recipe ? (
        <p className="text-sm text-muted-foreground">
          Este producto no tiene una receta asociada. Define sus ingredientes en
          la pestaña Receta para calcular cuántas unidades puedes fabricar.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                units > 0
                  ? "bg-success/10 text-success"
                  : "bg-danger/10 text-danger",
              )}
            >
              Puedes fabricar {units}
            </span>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {recipe.name}
            </span>
          </div>

          {ingredients.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              La receta no tiene ingredientes.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {ingredients.map((ing) => {
                const need = Number(ing.quantity) || 0;
                const available = stockById.get(ing.ingredient) ?? 0;
                const short = need > 0 && available < need;
                const isLimiting = limitingIds.has(ing.ingredient);
                return (
                  <div
                    key={ing.id}
                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
                  >
                    <span className="font-medium">{ing.ingredient_name}</span>
                    <span className="text-muted-foreground">
                      necesita {formatQty(need)} {ing.unit}
                    </span>
                    <span
                      className={cn(
                        "text-muted-foreground",
                        short && "font-medium text-danger",
                      )}
                    >
                      disponible {formatQty(available)}
                    </span>
                    {isLimiting && (
                      <span className="rounded-full bg-warning/10 px-1.5 py-0.5 font-medium text-warning">
                        limitante
                      </span>
                    )}
                    {ing.is_optional && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
                        opcional
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
