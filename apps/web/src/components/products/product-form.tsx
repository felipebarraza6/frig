"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fetchCategoryList } from "@/lib/api/categories";
import { fetchProducts } from "@/lib/api/products";
import type { ProductPayload } from "@/lib/api/products";
import type { YggdraProduct } from "@/lib/api/types";
import {
  fetchRecipesByProduct,
  createRecipe,
  updateRecipe,
  createRecipeIngredient,
  updateRecipeIngredient,
  deleteRecipeIngredient,
  type RecipePayload,
  type RecipeIngredientPayload,
} from "@/lib/api/recipes";
import { fetchWarehouses, addProductToWarehouse } from "@/lib/api/warehouses";
import type { YggdraSchemas } from "@/lib/api/types";

const PRODUCT_TYPES = [
  { value: "DIRECT_SALE", label: "Simple" },
  { value: "RECIPE_BASED", label: "Compuesto (elaboración)" },
] as const;

const RECIPE_TYPES = [
  { value: "SIMPLE", label: "Simple" },
  { value: "PREPARATION", label: "Preparación" },
  { value: "COOKING", label: "Cocción" },
  { value: "ASSEMBLY", label: "Ensamblaje" },
] as const;

type IngredientProduct = YggdraSchemas["ProductList"];

interface IngredientDraft {
  localId: string;
  id?: number; // real id si ya existe
  ingredient: number;
  quantity: string;
  unit: string;
  is_optional?: boolean;
  preparation_notes?: string;
}

interface ProductFormProps {
  product?: YggdraProduct;
  onClose: () => void;
  onSubmit: (payload: ProductPayload, id?: number) => Promise<YggdraProduct>;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ProductForm({ product, onClose, onSubmit }: ProductFormProps) {
  const queryClient = useQueryClient();
  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["categories", "list"],
    queryFn: fetchCategoryList,
  });

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
    productType: string;
    isForSale: boolean;
    isForInternalUse: boolean;
    isActive: boolean;
  }>({
    name: product?.name ?? "",
    code: product?.code ?? "",
    description: product?.description ?? "",
    price: product?.sale_price ?? product?.price ?? "",
    costPrice: product?.cost_price ?? "",
    priceInternal: product?.price_internal ?? "",
    wholesalePrice: product?.wholesale_price ?? "",
    stock: product?.quantity !== undefined ? String(product.quantity) : "",
    minimumStock: product?.minimum_stock !== undefined ? String(product.minimum_stock) : "",
    measurementUnit: product?.measurement_unit ?? "",
    category: product?.category && typeof product.category === "object" ? String(product.category.id) : "",
    productType: product?.product_type ?? "DIRECT_SALE",
    isForSale: product?.is_for_sale ?? true,
    isForInternalUse: product?.is_for_internal_use ?? false,
    isActive: product?.is_active ?? true,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses", "all"],
    queryFn: async () => {
      const data = await fetchWarehouses({});
      return data.results;
    },
  });

  const [tracksWarehouseStock, setTracksWarehouseStock] = useState(false);
  const [warehouseAssignments, setWarehouseAssignments] = useState<
    { localId: string; warehouseId: string; initialQuantity: string }[]
  >([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedInitialQty, setSelectedInitialQty] = useState("");

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
    name: product ? `${product.name} - Receta` : "",
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
  const [removedIngredientIds, setRemovedIngredientIds] = useState<number[]>([]);

  const isCompound = form.productType === "RECIPE_BASED";

  const { data: existingRecipes = [], isLoading: loadingRecipes } = useQuery({
    queryKey: ["recipes", "by-product", product?.id],
    queryFn: () => fetchRecipesByProduct(product!.id),
    enabled: !!product && isCompound,
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
        yield_quantity: r.yield_quantity ?? "",
        yield_unit: r.yield_unit ?? "",
        servings: r.servings !== undefined ? String(r.servings) : "",
        notes: r.notes ?? "",
      });
      setIngredients(
        r.ingredients.map((ing) => ({
          localId: generateId(),
          id: ing.id,
          ingredient: ing.ingredient,
          quantity: ing.quantity,
          unit: ing.unit,
          is_optional: ing.is_optional,
          preparation_notes: ing.preparation_notes ?? "",
        })),
      );
    }
  }, [existingRecipes]);

  const { data: ingredientProducts = [] } = useQuery({
    queryKey: ["products", "raw-materials", ingredientSearch],
    queryFn: async () => {
      const data = await fetchProducts({
        product_type: "RAW_MATERIAL",
        search: ingredientSearch || undefined,
      });
      return data.results;
    },
    enabled: isCompound && ingredientSearch.trim().length >= 2,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        quantity: "",
        unit: product.measurement_unit ?? "",
        is_optional: false,
        preparation_notes: "",
      },
    ]);
    setIngredientSearch("");
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
      },
    ]);
    setSelectedWarehouse("");
    setSelectedInitialQty("");
  }

  function removeWarehouseAssignment(localId: string) {
    setWarehouseAssignments((prev) => prev.filter((a) => a.localId !== localId));
  }

  async function saveWarehouseAssignments(productId: number) {
    await Promise.all(
      warehouseAssignments.map((a) =>
        addProductToWarehouse({
          warehouse_id: Number(a.warehouseId),
          product_id: productId,
          initial_quantity: Number(a.initialQuantity) || 0,
        }),
      ),
    );
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

    for (const id of removedIngredientIds) {
      await deleteRecipeIngredient(id);
    }

    for (const ing of ingredients) {
      const payload: RecipeIngredientPayload = {
        recipe: recipeId,
        ingredient: ing.ingredient,
        quantity: ing.quantity || "0",
        unit: ing.unit || "unidad",
        is_optional: ing.is_optional,
        preparation_notes: ing.preparation_notes || null,
      };
      if (ing.id) {
        await updateRecipeIngredient(ing.id, payload);
      } else {
        await createRecipeIngredient(payload);
      }
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload: ProductPayload = {
        name: form.name,
        code: form.code || null,
        description: form.description || null,
        price: form.price || undefined,
        sale_price: form.price || undefined,
        cost_price: form.costPrice || undefined,
        price_internal: form.priceInternal || undefined,
        wholesale_price: form.wholesalePrice || undefined,
        quantity: form.stock ? Number(form.stock) : undefined,
        minimum_stock: form.minimumStock ? Number(form.minimumStock) : undefined,
        measurement_unit: form.measurementUnit || null,
        category: form.category ? Number(form.category) : null,
        product_type: form.productType as unknown as ProductPayload["product_type"],
        is_for_sale: form.isForSale,
        is_for_internal_use: form.isForInternalUse,
        is_active: form.isActive,
      };
      const savedProduct = await onSubmit(payload, product?.id);

      if (isCompound) {
        await saveRecipeAndIngredients(savedProduct.id);
        queryClient.invalidateQueries({ queryKey: ["recipes"] });
      }

      if (!product?.id && tracksWarehouseStock && warehouseAssignments.length > 0) {
        await saveWarehouseAssignments(savedProduct.id);
        queryClient.invalidateQueries({ queryKey: ["warehouses"] });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {product ? "Editar producto" : "Nuevo producto"}
          </h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="product-name" className="text-sm font-medium">Nombre</label>
            <Input
              id="product-name"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              required
              placeholder="Ej: Cono artesanal"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="product-code" className="text-sm font-medium">Código</label>
              <Input
                id="product-code"
                value={form.code}
                onChange={(e) => updateField("code", e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="product-category" className="text-sm font-medium">Categoría</label>
              <Select
                id="product-category"
                value={form.category}
                disabled={loadingCategories}
                onChange={(e) => updateField("category", e.target.value)}
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="product-price" className="text-sm font-medium">Precio venta</label>
              <Input
                id="product-price"
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => updateField("price", e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="product-cost" className="text-sm font-medium">Costo</label>
              <Input
                id="product-cost"
                type="number"
                step="0.01"
                min="0"
                value={form.costPrice}
                onChange={(e) => updateField("costPrice", e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="product-wholesale" className="text-sm font-medium">Precio mayorista</label>
              <Input
                id="product-wholesale"
                type="number"
                step="0.01"
                min="0"
                value={form.wholesalePrice}
                onChange={(e) => updateField("wholesalePrice", e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="product-internal" className="text-sm font-medium">Precio interno</label>
              <Input
                id="product-internal"
                type="number"
                step="0.01"
                min="0"
                value={form.priceInternal}
                onChange={(e) => updateField("priceInternal", e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="product-stock" className="text-sm font-medium">Cantidad inicial</label>
              <Input
                id="product-stock"
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => updateField("stock", e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="product-min-stock" className="text-sm font-medium">Stock mínimo</label>
              <Input
                id="product-min-stock"
                type="number"
                min="0"
                value={form.minimumStock}
                onChange={(e) => updateField("minimumStock", e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="product-type" className="text-sm font-medium">Tipo</label>
              <Select
                id="product-type"
                value={form.productType}
                onChange={(e) => updateField("productType", e.target.value)}
              >
                {PRODUCT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="product-unit" className="text-sm font-medium">Unidad de medida</label>
              <Input
                id="product-unit"
                value={form.measurementUnit}
                onChange={(e) => updateField("measurementUnit", e.target.value)}
                placeholder="Ej: unidad, kg, litro"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="product-description" className="text-sm font-medium">Descripción</label>
            <Input
              id="product-description"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isForSale}
                onChange={(e) => updateField("isForSale", e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Disponible para venta
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isForInternalUse}
                onChange={(e) => updateField("isForInternalUse", e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Uso interno
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => updateField("isActive", e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Activo
            </label>
          </div>

          {!product?.id && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={tracksWarehouseStock}
                onChange={(e) => setTracksWarehouseStock(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Gestiona stock por bodega
            </label>
          )}

          {!product?.id && tracksWarehouseStock && (
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <h3 className="mb-3 text-sm font-semibold">Asignación a bodegas</h3>

              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-muted-foreground">Bodega</label>
                    <Select
                      value={selectedWarehouse}
                      onChange={(e) => setSelectedWarehouse(e.target.value)}
                    >
                      <option value="">Selecciona</option>
                      {warehouses
                        .filter((w) => !warehouseAssignments.some((a) => a.warehouseId === String(w.id)))
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
                          <p className="text-xs text-muted-foreground">Cantidad inicial: {a.initialQuantity}</p>
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
          )}

          {isCompound && (
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <h3 className="mb-3 text-sm font-semibold">Receta / materias primas</h3>

              {loadingRecipes && (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando receta existente…
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
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

              <div className="mt-3 grid grid-cols-4 gap-3">
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
                    value={ingredientSearch}
                    onChange={(e) => setIngredientSearch(e.target.value)}
                    placeholder="Buscar materia prima…"
                    className="pl-9"
                  />
                  {ingredientSearch.trim().length >= 2 && (
                    <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
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
                      return (
                        <div key={ing.localId} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-border bg-background p-2">
                          <div className="col-span-4">
                            <span className="block truncate text-sm font-medium">
                              {product?.name ?? `Producto #${ing.ingredient}`}
                            </span>
                          </div>
                          <div className="col-span-2">
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
                          <div className="col-span-3">
                            <Input
                              value={ing.unit}
                              onChange={(e) => updateIngredient(ing.localId, { unit: e.target.value })}
                              placeholder="Unidad"
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-2">
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
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {product ? "Guardar cambios" : "Crear producto"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
