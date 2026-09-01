"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Power,
  Package,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  SlidersHorizontal,
  LayoutGrid,
  List,
  FilterX,
  Pencil,
  Warehouse,
  Copy,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { cn, formatCLP } from "@/lib/utils";
import {
  fetchProducts,
  fetchProduct,
  createProduct,
  updateProduct,
  setProductActive,
  deleteProduct,
  exportProducts,
  type ProductPayload,
  type ProductsFilter,
} from "@/lib/api/products";

import { ProductForm, type FormTab } from "@/components/products/product-form";
import { ProductActionsMenu } from "@/components/products/product-actions-menu";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { useBranchProductTypes } from "@/lib/hooks/useBranchProductTypes";
import { useCategoryOptions } from "@/lib/hooks/useCategoryOptions";
import { useToast } from "@/lib/store/toast";
import { useCurrentBranch } from "@/lib/store/session";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import {
  fetchBranchRecipes,
  fetchBranchRecipeIngredients,
} from "@/lib/api/recipes";
import type { YggdraProduct, YggdraSchemas } from "@/lib/api/types";

function productStock(p: YggdraProduct): number {
  // El backend anota stock_available (stock efectivo, incluido el de bowls
  // derivado de recetas). Si no viene, caemos al quantity plano del producto.
  return p.stock_available ?? p.quantity ?? 0;
}

function isLowStock(p: YggdraProduct): boolean {
  if (p.minimum_stock === undefined || p.minimum_stock === null) return false;
  return productStock(p) <= p.minimum_stock;
}

const CATEGORY_PALETTE = [
  { bg: "bg-red-100", text: "text-red-700" },
  { bg: "bg-orange-100", text: "text-orange-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-green-100", text: "text-green-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-teal-100", text: "text-teal-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
  { bg: "bg-sky-100", text: "text-sky-700" },
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-purple-100", text: "text-purple-700" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700" },
  { bg: "bg-pink-100", text: "text-pink-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
];

function colorFor(value: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CATEGORY_PALETTE.length;
  return CATEGORY_PALETTE[index];
}

interface ProductCardProps {
  product: YggdraProduct;
  recipe?: YggdraSchemas["Recipe"] | null;
  ingredients?: YggdraSchemas["RecipeIngredient"][];
  colorClass: { bg: string; text: string };
  productTypeLabel: (type?: string) => string;
  onEdit: () => void;
  onEditWarehouses: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  isTogglingActive: boolean;
}

function ProductCard({
  product,
  recipe,
  ingredients,
  colorClass,
  productTypeLabel,
  onEdit,
  onEditWarehouses,
  onDuplicate,
  onDelete,
  onToggleActive,
  isTogglingActive,
}: ProductCardProps) {
  const stock = productStock(product);
  const lowStock = isLowStock(product);
  const categoryName = product.category && typeof product.category === "object" ? product.category.name : null;

  return (
    <div className="group flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-4 flex items-start gap-3">
        <div
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl",
            colorClass.bg,
            colorClass.text,
          )}
        >
          <Package className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold leading-tight" title={product.name}>
            {product.name}
          </h3>
          {product.code ? (
            <p className="mt-0.5 text-xs text-muted-foreground">Código: {product.code}</p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">Sin código</p>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {categoryName ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              colorClass.bg,
              colorClass.text,
            )}
          >
            {categoryName}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            Sin categoría
          </span>
        )}
        {product.product_type === "RECIPE_BASED" ? (
          <span
            className="inline-flex max-w-full items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
            title={recipe ? recipe.name : "Sin receta"}
          >
            <span className="truncate">{recipe ? recipe.name : "Sin receta"}</span>
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
            {productTypeLabel(product.product_type)}
          </span>
        )}
      </div>
      {product.product_type === "RECIPE_BASED" && ingredients && ingredients.length > 0 && (
        <p className="mb-3 text-xs text-muted-foreground">
          <span className="font-medium">Ingredientes:</span>{" "}
          {ingredients.map((i) => i.ingredient_name).join(", ")}
        </p>
      )}
      {product.description && (
        <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
      )}

      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Precio de venta</p>
          <p className="text-xl font-bold tabular-nums text-foreground">
            {formatCLP(product.sale_price ?? product.price ?? "0")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Stock</p>
          <div className="flex items-center justify-end gap-1.5">
            <span
              className={cn(
                "text-lg font-semibold tabular-nums",
                lowStock ? "text-amber-600" : "text-foreground",
              )}
            >
              {stock}
            </span>
            {lowStock && (
              <span title="Stock bajo">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              </span>
            )}
          </div>
          {lowStock && (
            <p className="text-xs font-medium text-amber-600">Stock bajo</p>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            product.is_for_sale
              ? "bg-emerald-500/10 text-emerald-700"
              : "bg-muted text-muted-foreground",
          )}
        >
          {product.is_for_sale ? "En venta" : "No venta"}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            product.is_active
              ? "bg-emerald-500/10 text-emerald-700"
              : "bg-danger/10 text-danger",
          )}
        >
          {product.is_active ? "Activo" : "Inactivo"}
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
            title="Editar"
            aria-label={`Editar ${product.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onEditWarehouses}
            title="Editar bodegas"
            aria-label={`Editar bodegas de ${product.name}`}
          >
            <Warehouse className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onDuplicate}
            title="Duplicar"
            aria-label={`Duplicar ${product.name}`}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-danger"
            onClick={onDelete}
            title="Eliminar"
            aria-label={`Eliminar ${product.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 rounded-full",
            product.is_active
              ? "text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
              : "text-muted-foreground hover:bg-muted hover:text-danger",
          )}
          onClick={onToggleActive}
          disabled={isTogglingActive}
          title={product.is_active ? "Desactivar" : "Activar"}
          aria-label={`${product.is_active ? "Desactivar" : "Activar"} ${product.name}`}
        >
          <Power className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ProductsClient() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const branch = useCurrentBranch();
  const { download: downloadFile, isLoading: isExporting } = useDownloadFile();
  const { options: productTypeOptions, labelFor: productTypeLabel } = useBranchProductTypes();
  const { options: categoryOptions, isLoading: loadingCategories, error: categoriesError, refetch: refetchCategories } = useCategoryOptions();

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("");
  const [productType, setProductType] = useState("");
  const [forSale, setForSale] = useState("");
  const [active, setActive] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});

  // Debounce del buscador. Evitamos correr el efecto en el montaje inicial para
  // no generar un queryKey distinto (setPageUrl({}) crea una nueva referencia)
  // antes de que el usuario interactúe.
  const searchInputPrevRef = useRef(searchInput);
  useEffect(() => {
    if (searchInputPrevRef.current === searchInput) return;
    searchInputPrevRef.current = searchInput;

    const timer = setTimeout(() => {
      setSearch((prev) => {
        if (prev === searchInput) return prev;
        setPageUrl((pagePrev) => {
          if (pagePrev.next === undefined && pagePrev.previous === undefined) return pagePrev;
          return {};
        });
        return searchInput;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [creating, setCreating] = useState(false);
  // Para editar se carga el detalle completo: el listado no trae
  // is_public ni nutrición y re-guardar desde ahí borra esos datos.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editInitialTab, setEditInitialTab] = useState<FormTab>("basic");
  const [confirmDelete, setConfirmDelete] = useState<YggdraProduct | null>(null);

  const { data: editingProduct, isLoading: loadingEditing } = useQuery({
    queryKey: ["products", "detail", editingId],
    queryFn: () => fetchProduct(editingId!),
    enabled: !!editingId,
  });

  const filter = useMemo<ProductsFilter>(
    () => ({
      search: search || undefined,
      category: category ? Number(category) : undefined,
      product_type: productType || undefined,
      is_for_sale: forSale ? forSale === "true" : undefined,
      is_active: active ? active === "true" : undefined,
      ...pageUrl,
    }),
    [search, category, productType, forSale, active, pageUrl],
  );

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["products", "manage", filter],
    queryFn: () => fetchProducts(filter),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });

  const products = page?.results ?? [];
  const totalProducts = page?.count ?? 0;

  // Recetas e ingredientes de productos compuestos visibles.
  const compoundProductIds = useMemo(
    () => products.filter((p) => p.product_type === "RECIPE_BASED").map((p) => p.id),
    [products],
  );

  const { data: branchRecipes = [] } = useQuery({
    queryKey: ["recipes", "branch", branch?.branch_id],
    queryFn: fetchBranchRecipes,
    enabled: !!branch?.branch_id && compoundProductIds.length > 0,
    staleTime: 5 * 60_000,
  });

  const { data: branchRecipeIngredients = [] } = useQuery({
    queryKey: ["recipe-ingredients", "branch", branch?.branch_id],
    queryFn: fetchBranchRecipeIngredients,
    enabled: !!branch?.branch_id && compoundProductIds.length > 0,
    staleTime: 5 * 60_000,
  });

  const recipesByProductId = useMemo(() => {
    const map = new Map<number, YggdraSchemas["Recipe"]>();
    for (const recipe of branchRecipes) {
      if (recipe.resulting_product == null) continue;
      if (!map.has(recipe.resulting_product)) {
        map.set(recipe.resulting_product, recipe);
      }
    }
    return map;
  }, [branchRecipes]);

  const ingredientsByRecipeId = useMemo(() => {
    const map = new Map<string, YggdraSchemas["RecipeIngredient"][]>();
    for (const ing of branchRecipeIngredients) {
      const list = map.get(ing.recipe) ?? [];
      list.push(ing);
      map.set(ing.recipe, list);
    }
    return map;
  }, [branchRecipeIngredients]);

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      setProductActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Estado actualizado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo actualizar el estado.");
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setConfirmDelete(null);
      toast.success("Producto eliminado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo eliminar el producto.");
    },
  });

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    remove.mutate(confirmDelete.id);
  }

  const onSubmit = async (payload: ProductPayload, id?: number): Promise<YggdraProduct> => {
    const product = id
      ? await updateProduct(id, payload)
      : await createProduct(payload);
    queryClient.invalidateQueries({ queryKey: ["products"] });
    toast.success(id ? "Producto actualizado" : "Producto creado");
    return product;
  };

  async function handleDuplicate(product: YggdraProduct) {
    try {
      const detail = await fetchProduct(product.id);
      const { id, ...payload } = detail;
      void id;
      await createProduct({
        ...payload,
        name: `${detail.name} (copia)`,
        code: detail.code ? `${detail.code}-copia` : null,
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Producto duplicado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo duplicar el producto.");
    }
  }

  function updateFilter<T extends string>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  function clearFilters() {
    setSearch("");
    setSearchInput("");
    setCategory("");
    setProductType("");
    setForSale("");
    setActive("");
    setPageUrl({});
  }

  function handleExport(format: "excel" | "pdf") {
    downloadFile(() => exportProducts(filter, format), {
      filename: exportFilename("productos", format === "excel" ? "xlsx" : "pdf"),
    });
  }

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string }[] = [];
    if (search.trim()) filters.push({ key: "search", label: `Búsqueda: "${search.trim()}"` });
    if (category) {
      const name = categoryOptions.find((c) => String(c.id) === category)?.name;
      filters.push({ key: "category", label: `Categoría: ${name ?? category}` });
    }
    if (productType) {
      const label = productTypeOptions.find((t) => t.value === productType)?.label;
      filters.push({ key: "productType", label: `Tipo: ${label ?? productType}` });
    }
    if (forSale) {
      filters.push({ key: "forSale", label: forSale === "true" ? "En venta" : "No venta" });
    }
    if (active) {
      filters.push({ key: "active", label: active === "true" ? "Activo" : "Inactivo" });
    }
    return filters;
  }, [search, category, productType, forSale, active, categoryOptions, productTypeOptions]);

  const hasActiveFilters =
    search.trim() || category || productType || forSale || active;

  function removeFilter(key: string) {
    switch (key) {
      case "search":
        setSearch("");
        setSearchInput("");
        break;
      case "category":
        setCategory("");
        break;
      case "productType":
        setProductType("");
        break;
      case "forSale":
        setForSale("");
        break;
      case "active":
        setActive("");
        break;
    }
    setPageUrl({});
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Productos</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona el catálogo de la sucursal
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64 lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar productos…"
              className="h-10 rounded-xl pl-10"
              aria-label="Buscar producto"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-border bg-muted/40 p-0.5">
              <Button
                variant={view === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => setView("grid")}
                title="Vista galería"
                aria-label="Vista galería"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => setView("list")}
                title="Vista lista"
                aria-label="Vista lista"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("excel")}
              disabled={isExporting}
              className="hidden h-9 w-9 px-0 sm:flex sm:h-9 sm:w-auto sm:px-3"
              title="Exportar Excel"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("pdf")}
              disabled={isExporting}
              className="hidden h-9 w-9 px-0 sm:flex sm:h-9 sm:w-auto sm:px-3"
              title="Exportar PDF"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">PDF</span>
            </Button>

            <Button
              size="icon"
              onClick={() => setCreating(true)}
              className="h-9 w-9 sm:hidden"
              title="Nuevo producto"
              aria-label="Nuevo producto"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setCreating(true)}
              className="hidden h-9 sm:flex"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nuevo producto
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3">
          {/* Desktop filters */}
          <div className="hidden flex-wrap items-end gap-3 lg:flex">
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-category" className="text-xs text-muted-foreground">Categoría</label>
              <Select
                id="filter-category"
                value={category}
                disabled={loadingCategories}
                onChange={(e) => updateFilter(setCategory, e.target.value)}
                className="w-44"
              >
                <option value="">Todas</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              {!loadingCategories && categoryOptions.length === 0 && (
                <div className="flex flex-col gap-1 text-xs text-amber-700">
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span>Sin categorías para <strong>{branch?.branch_name ?? "esta sucursal"}</strong>.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => refetchCategories()}
                    className="w-fit underline hover:text-amber-800"
                  >
                    Reintentar
                  </button>
                </div>
              )}
              {categoriesError && (
                <p className="text-xs text-danger">
                  Error: {categoriesError.message || "No se pudieron cargar las categorías."}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-type" className="text-xs text-muted-foreground">Tipo</label>
              <Select
                id="filter-type"
                value={productType}
                onChange={(e) => updateFilter(setProductType, e.target.value)}
                className="w-44"
              >
                <option value="">Todos</option>
                {productTypeOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-sale" className="text-xs text-muted-foreground">Venta</label>
              <Select
                id="filter-sale"
                value={forSale}
                onChange={(e) => updateFilter(setForSale, e.target.value)}
                className="w-36"
              >
                <option value="">Todas</option>
                <option value="true">En venta</option>
                <option value="false">No venta</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-active" className="text-xs text-muted-foreground">Estado</label>
              <Select
                id="filter-active"
                value={active}
                onChange={(e) => updateFilter(setActive, e.target.value)}
                className="w-36"
              >
                <option value="">Todos</option>
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </Select>
            </div>
          </div>

          {/* Mobile/tablet filters */}
          <div className="flex flex-col gap-3 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar productos…"
                  className="h-10 rounded-xl pl-10"
                  aria-label="Buscar producto"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-10 px-3"
                onClick={() => setShowMobileFilters((v) => !v)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="ml-2">Filtros</span>
              </Button>
            </div>

            <div className={`flex flex-col gap-3 ${showMobileFilters ? "" : "hidden"}`}>
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-category-mobile" className="text-xs text-muted-foreground">Categoría</label>
                <Select
                  id="filter-category-mobile"
                  value={category}
                  disabled={loadingCategories}
                  onChange={(e) => updateFilter(setCategory, e.target.value)}
                >
                  <option value="">Todas</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
                {!loadingCategories && categoryOptions.length === 0 && (
                  <div className="flex flex-col gap-1 text-xs text-amber-700">
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>Sin categorías para <strong>{branch?.branch_name ?? "esta sucursal"}</strong>.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => refetchCategories()}
                      className="w-fit underline hover:text-amber-800"
                    >
                      Reintentar
                    </button>
                  </div>
                )}
                {categoriesError && (
                  <p className="text-xs text-danger">
                    Error: {categoriesError.message || "No se pudieron cargar las categorías."}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-type-mobile" className="text-xs text-muted-foreground">Tipo</label>
                  <Select
                    id="filter-type-mobile"
                    value={productType}
                    onChange={(e) => updateFilter(setProductType, e.target.value)}
                  >
                    <option value="">Todos</option>
                    {productTypeOptions.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-sale-mobile" className="text-xs text-muted-foreground">Venta</label>
                  <Select
                    id="filter-sale-mobile"
                    value={forSale}
                    onChange={(e) => updateFilter(setForSale, e.target.value)}
                  >
                    <option value="">Todas</option>
                    <option value="true">En venta</option>
                    <option value="false">No venta</option>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-active-mobile" className="text-xs text-muted-foreground">Estado</label>
                  <Select
                    id="filter-active-mobile"
                    value={active}
                    onChange={(e) => updateFilter(setActive, e.target.value)}
                  >
                    <option value="">Todos</option>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => removeFilter(f.key)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
                  title="Quitar filtro"
                >
                  {f.label}
                  <FilterX className="h-3 w-3 text-muted-foreground" />
                </button>
              ))}
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
              >
                <FilterX className="h-3 w-3" />
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudo cargar el catálogo.</p>
        ) : isLoading ? (
          <div className="grid flex-1 content-start gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="mb-4 flex items-start gap-3">
                  <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <div className="mb-3 flex gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="mb-4 flex items-end justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="ml-auto h-3 w-10" />
                    <Skeleton className="ml-auto h-5 w-12" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {products.length === 0 ? (
              <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
                <div>
                  <Package className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">
                    {hasActiveFilters
                      ? "No se encontraron productos"
                      : "Aún no hay productos"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasActiveFilters
                      ? "Prueba con otros filtros o limpia los actuales."
                      : "Crea tu primer producto para comenzar."}
                  </p>
                  {hasActiveFilters && (
                    <Button className="mt-4" size="sm" variant="outline" onClick={clearFilters}>
                      <FilterX className="mr-1 h-3.5 w-3.5" />
                      Limpiar filtros
                    </Button>
                  )}
                  {!hasActiveFilters && (
                    <Button className="mt-4" size="sm" onClick={() => setCreating(true)}>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Nuevo producto
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Vista galería */}
                <div
                  className={cn(
                    "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
                    view === "grid" ? "" : "sm:hidden",
                  )}
                >
                  {products.map((p) => {
                    const seed =
                      (p.category && typeof p.category === "object" ? p.category.name : null) ??
                      p.name ??
                      String(p.id);
                    return (
                      <ProductCard
                        key={p.id}
                        product={p}
                        recipe={recipesByProductId.get(p.id)}
                        ingredients={ingredientsByRecipeId.get(recipesByProductId.get(p.id)?.id ?? "")}
                        colorClass={colorFor(seed)}
                        productTypeLabel={productTypeLabel}
                        onEdit={() => {
                          setEditInitialTab("basic");
                          setEditingId(p.id);
                        }}
                        onEditWarehouses={() => {
                          setEditInitialTab("warehouses");
                          setEditingId(p.id);
                        }}
                        onDuplicate={() => handleDuplicate(p)}
                        onDelete={() => setConfirmDelete(p)}
                        onToggleActive={() =>
                          toggleActive.mutate({ id: p.id, isActive: !p.is_active })
                        }
                        isTogglingActive={toggleActive.isPending}
                      />
                    );
                  })}
                </div>

                {/* Vista lista (tabla) */}
                <div
                  className={cn(
                    "hidden overflow-x-auto rounded-xl border border-border",
                    view === "list" ? "sm:block" : "hidden",
                  )}
                >
                  <table className="w-full min-w-[880px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3">Producto</th>
                        <th className="px-4 py-3">Categoría</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3 text-right">Precio</th>
                        <th className="px-4 py-3 text-center">Stock</th>
                        <th className="px-4 py-3 text-center">Venta</th>
                        <th className="px-4 py-3 text-center">Activo</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary">
                                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium">{p.name}</p>
                                {p.code && (
                                  <p className="text-xs text-muted-foreground">{p.code}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {p.category && typeof p.category === "object" ? p.category.name : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {p.product_type === "RECIPE_BASED" ? (
                              <div className="max-w-[200px]">
                                <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                                  {recipesByProductId.get(p.id)?.name ?? "Sin receta"}
                                </span>
                                {ingredientsByRecipeId.get(recipesByProductId.get(p.id)?.id ?? "")?.length ? (
                                  <p className="mt-1 truncate text-xs">
                                    {ingredientsByRecipeId
                                      .get(recipesByProductId.get(p.id)?.id ?? "")
                                      ?.map((i) => i.ingredient_name)
                                      .join(", ")}
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              productTypeLabel(p.product_type)
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatCLP(p.sale_price ?? p.price ?? "0")}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="tabular-nums">{productStock(p)}</span>
                              {isLowStock(p) && (
                                <span title="Stock bajo">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={
                                p.is_for_sale
                                  ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                                  : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                              }
                            >
                              {p.is_for_sale ? "Sí" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() =>
                                toggleActive.mutate({ id: p.id, isActive: !p.is_active })
                              }
                              aria-label={`${p.is_active ? "Desactivar" : "Activar"} ${p.name}`}
                              className={
                                p.is_active
                                  ? "text-emerald-600 hover:text-emerald-700"
                                  : "text-muted-foreground hover:text-danger"
                              }
                            >
                              <Power className="h-4 w-4" />
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <ProductActionsMenu
                              product={p}
                              onEdit={() => {
                                setEditInitialTab("basic");
                                setEditingId(p.id);
                              }}
                              onEditWarehouses={() => {
                                setEditInitialTab("warehouses");
                                setEditingId(p.id);
                              }}
                              onDuplicate={() => handleDuplicate(p)}
                              onDelete={() => setConfirmDelete(p)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground">
                {totalProducts} producto{totalProducts === 1 ? "" : "s"} en total
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 flex-1 sm:h-9 sm:flex-none"
                  onClick={() => setPageUrl({ previous: page?.previous })}
                  disabled={!page?.previous}
                >
                  <span className="sm:hidden">Ant.</span>
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 flex-1 sm:h-9 sm:flex-none"
                  onClick={() => setPageUrl({ next: page?.next })}
                  disabled={!page?.next}
                >
                  <span className="sm:hidden">Sig.</span>
                  <span className="hidden sm:inline">Siguiente</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {loadingEditing && editingId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <TableSkeleton rows={3} columns={2} />
        </div>
      )}

      {creating && (
        <ProductForm
          onClose={() => setCreating(false)}
          onSubmit={onSubmit}
        />
      )}

      {editingProduct && (
        <ProductForm
          product={editingProduct}
          initialTab={editInitialTab}
          onClose={() => {
            if (editingId) queryClient.removeQueries({ queryKey: ["products", "detail", editingId] });
            setEditingId(null);
            setEditInitialTab("basic");
          }}
          onSubmit={onSubmit}
        />
      )}

      <AnimatedOverlay
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          {confirmDelete && (
          <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <h2 className="text-base font-semibold">Eliminar producto</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              ¿Seguro que quieres eliminar <strong>{confirmDelete.name}</strong>? El producto
              quedará desactivado (soft-delete) y se ocultará del catálogo y del POS.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(null)}
                disabled={remove.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDelete}
                isLoading={remove.isPending}
              >
                Eliminar
              </Button>
            </div>
          </div>
          )}
      </AnimatedOverlay>
    </div>
  );
}
