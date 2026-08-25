"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Search,
  Pencil,
  X,
  Package,
  Loader2,
  AlertTriangle,
  Apple,
  FileDown,
  Calculator,
  ChefHat,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  fetchProducts,
  fetchProduct,
  updateProduct,
  type ProductPayload,
} from "@/lib/api/products";
import {
  fetchRecipesByProduct,
  calculateRecipeNutrition,
  downloadRecipeNutritionLabel,
  fetchRecipeNutritionLabel,
} from "@/lib/api/recipes";
import { ProductForm } from "@/components/products/product-form";
import { ProductNutritionLabel } from "@/components/products/product-nutrition-label";
import { useDownloadFile } from "@/lib/hooks/useDownloadFile";
import { formatCLP } from "@/lib/utils";
import type { YggdraProduct } from "@/lib/api/types";
import { useToast } from "@/lib/store/toast";
import { useIsNutritionEnabled } from "@/lib/store/session";

type ProductDetail = YggdraProduct & {
  is_nutritional_ingredient?: boolean;
  energy_kcal?: string | null;
  proteins_g?: string | null;
  total_fats_g?: string | null;
  saturated_fats_g?: string | null;
  monounsaturated_fats_g?: string | null;
  polyunsaturated_fats_g?: string | null;
  trans_fats_g?: string | null;
  cholesterol_mg?: string | null;
  carbohydrates_g?: string | null;
  total_sugars_g?: string | null;
  sodium_mg?: string | null;
};

interface NutritionLabelData {
  compliance?: {
    is_compliant?: boolean;
    warnings?: string[];
    errors?: string[];
  };
  [key: string]: unknown;
}

function hasNutrition(product: ProductDetail): boolean {
  return (
    product.is_nutritional_ingredient ||
    Boolean(
      product.energy_kcal ||
        product.proteins_g ||
        product.total_fats_g ||
        product.carbohydrates_g ||
        product.sodium_mg,
    )
  );
}

function isRecipeBased(product: ProductDetail): boolean {
  return product.product_type === "RECIPE_BASED";
}

export default function ProductNutritionPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const nutritionEnabled = useIsNutritionEnabled();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProductDetail | null>(null);
  const [editing, setEditing] = useState<ProductDetail | null>(null);

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["products", "nutrition", search],
    queryFn: () => fetchProducts({ search, page_size: 200 }),
  });

  // El listado no trae nutrición/is_public (limitación del serializer de lista);
  // el search ya se aplica server-side con name__icontains.
  const filtered = useMemo(() => (page?.results ?? []) as ProductDetail[], [page]);

  const onSubmit = async (payload: ProductPayload, id?: number): Promise<YggdraProduct> => {
    if (!id) {
      throw new Error("No se puede guardar sin un producto seleccionado.");
    }
    const product = await updateProduct(id, payload);
    queryClient.invalidateQueries({ queryKey: ["products"] });
    return product;
  };

  function handleEditDetail(product: ProductDetail) {
    // El listado no trae nutrición ni is_public: al editar hay que cargar el
    // detalle o se borran esos datos al re-guardar.
    fetchProduct(product.id)
      .then((detail) => setEditing(detail as unknown as ProductDetail))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "No se pudo cargar el producto.");
      });
  }

  if (!nutritionEnabled) {
    return (
      <div className="flex min-h-full flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold">Etiquetado nutricional</h1>
            <p className="text-xs text-muted-foreground">
              Revisa y gestiona la información nutricional de los productos
            </p>
          </div>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Apple className="h-10 w-10 text-muted-foreground" />
          <div className="max-w-sm">
            <p className="text-sm font-medium">Módulo Recetas no activo</p>
            <p className="text-xs text-muted-foreground">
              El etiquetado nutricional requiere el módulo Recetas. Actívalo en
              Configuración → Módulos para usar esta función.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Etiquetado nutricional</h1>
          <p className="text-xs text-muted-foreground">
            Revisa y gestiona la información nutricional de los productos
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto…"
            className="pl-9"
          />
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudo cargar el catálogo.</p>
        ) : isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Apple className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-medium text-foreground">
              No hay productos con información nutricional.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Edita un producto para agregar sus datos nutricionales.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product) => (
              <article
                key={product.id}
                onClick={() => setSelected(product)}
                className="cursor-pointer rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCLP(product.sale_price ?? product.price ?? "0")}
                      </p>
                    </div>
                  </div>
                  {hasNutrition(product) ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Con etiqueta
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Sin datos
                    </span>
                  )}
                </div>

                {hasNutrition(product) ? (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {product.energy_kcal ? <span>{product.energy_kcal} kcal</span> : null}
                    {product.proteins_g ? <span>P {product.proteins_g} g</span> : null}
                    {product.total_fats_g ? <span>G {product.total_fats_g} g</span> : null}
                    {product.carbohydrates_g ? <span>C {product.carbohydrates_g} g</span> : null}
                    {product.sodium_mg ? <span>Na {product.sodium_mg} mg</span> : null}
                  </div>
                ) : (
                  <p className="flex items-center gap-1 text-xs text-amber-700">
                    <AlertTriangle className="h-3 w-3" />
                    Haz clic para agregar etiquetado nutricional
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <NutritionDetailModal
          product={selected}
          onClose={() => setSelected(null)}
          onEdit={() => handleEditDetail(selected)}
        />
      )}

      {editing && (
        <ProductForm
          product={editing}
          onClose={() => setEditing(null)}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}

function NutritionDetailModal({
  product,
  onClose,
  onEdit,
}: {
  product: ProductDetail;
  onClose: () => void;
  onEdit: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { download: downloadNutritionPdf, isLoading: downloadingNutritionPdf } = useDownloadFile();
  const isCompound = isRecipeBased(product);

  const { data: recipes = [], isLoading: loadingRecipes } = useQuery({
    queryKey: ["recipes", "by-product", product.id],
    queryFn: () => fetchRecipesByProduct(product.id),
    enabled: isCompound,
  });

  const { data: labelData, isLoading: loadingLabel } = useQuery<NutritionLabelData>({
    queryKey: ["recipe", "nutrition-label", recipes[0]?.id],
    queryFn: () => fetchRecipeNutritionLabel(recipes[0]!.id),
    enabled: isCompound && recipes.length > 0 && recipes[0].has_nutritional_calculation,
  });

  const calculate = useMutation({
    mutationFn: calculateRecipeNutrition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes", "by-product", product.id] });
      queryClient.invalidateQueries({ queryKey: ["recipe", "nutrition-label"] });
      toast.success("Nutrición calculada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{product.name}</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {hasNutrition(product) ? (
          <ProductNutritionLabel product={product} />
        ) : (
          <div className="rounded-lg bg-amber-500/10 p-4 text-sm text-amber-700">
            Este producto aún no tiene información nutricional.
          </div>
        )}

        {isCompound && (
          <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <ChefHat className="h-4 w-4" />
              Receta y etiqueta
            </h3>

            {loadingRecipes ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : recipes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No hay recetas asociadas.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {recipes.map((recipe) => (
                  <div key={recipe.id} className="rounded-lg border border-border bg-background p-3">
                    <p className="text-sm font-medium">{recipe.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {recipe.has_nutritional_calculation
                        ? "Cálculo nutricional disponible"
                        : "Sin cálculo nutricional"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => calculate.mutate(recipe.id)}
                        disabled={calculate.isPending}
                      >
                        {calculate.isPending ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Calculator className="mr-2 h-3.5 w-3.5" />
                        )}
                        Calcular
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!recipe.has_nutritional_calculation || downloadingNutritionPdf}
                        onClick={() => {
                          // Descarga autenticada via apiFile (window.open pega
                          // contra Next.js y sin token → 404).
                          downloadNutritionPdf(
                            () => downloadRecipeNutritionLabel(recipe.id),
                            {
                              filename: `etiqueta-nutricional_${product.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
                              extension: "pdf",
                            },
                          ).catch(() => toast.error("No se pudo descargar el PDF de la etiqueta."));
                        }}
                      >
                        {downloadingNutritionPdf ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileDown className="mr-2 h-3.5 w-3.5" />
                        )}
                        Descargar PDF
                      </Button>
                    </div>
                  </div>
                ))}

                {loadingLabel ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : labelData ? (
                  <div className="rounded-lg border border-border bg-background p-3 text-xs">
                    <p className="font-medium">Compliance MINSAL</p>
                    <p className="text-muted-foreground">
                      {String(labelData.compliance?.is_compliant ?? "—")}
                    </p>
                    {Array.isArray(labelData.compliance?.warnings) &&
                      labelData.compliance.warnings.length > 0 && (
                        <ul className="mt-1 list-inside list-disc text-amber-700">
                          {(labelData.compliance.warnings as string[]).map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
          <Button size="sm" onClick={onEdit}>
            Editar producto
          </Button>
        </div>
      </div>
    </div>
  );
}
