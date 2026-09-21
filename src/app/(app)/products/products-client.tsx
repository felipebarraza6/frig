"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  List,
  FilterX,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCLP } from "@/lib/utils";
import {
  fetchProductsForManage,
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
import { useCurrentBranch, useIsModuleEnabledFromConfig } from "@/lib/store/session";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";

import type { YggdraProduct, YggdraSchemas } from "@/lib/api/types";

function productStock(p: YggdraProduct): number {
  // Productos que no controlan inventario no tienen stock relevante.
  // El backend anota stock_available (stock efectivo, incluido el de bowls
  // derivado de recetas). Si no viene, caemos al quantity plano del producto.
  const tracks = (p as { tracks_inventory?: boolean }).tracks_inventory;
  if (tracks === false) return 0;
  return p.stock_available ?? p.quantity ?? 0;
}

function isLowStock(p: YggdraProduct): boolean {
  const tracks = (p as { tracks_inventory?: boolean }).tracks_inventory;
  if (tracks === false) return false;
  if (p.minimum_stock === undefined || p.minimum_stock === null) return false;
  return productStock(p) <= p.minimum_stock;
}

const CATEGORY_PALETTE = [
  { bg: "bg-primary/5", text: "text-primary" },
  { bg: "bg-primary/10", text: "text-primary" },
  { bg: "bg-primary/15", text: "text-primary" },
  { bg: "bg-primary/20", text: "text-primary" },
  { bg: "bg-primary/5", text: "text-primary" },
  { bg: "bg-primary/10", text: "text-primary" },
  { bg: "bg-primary/15", text: "text-primary" },
  { bg: "bg-primary/20", text: "text-primary" },
  { bg: "bg-primary/5", text: "text-primary" },
  { bg: "bg-primary/10", text: "text-primary" },
  { bg: "bg-primary/15", text: "text-primary" },
  { bg: "bg-primary/20", text: "text-primary" },
  { bg: "bg-primary/5", text: "text-primary" },
  { bg: "bg-primary/10", text: "text-primary" },
];

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 shrink-0 items-center justify-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-foreground/10 text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

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
  onOpen: () => void;
}

function ProductCard({
  product,
  recipe,
  ingredients,
  colorClass,
  productTypeLabel,
  onOpen,
}: ProductCardProps) {
  const stock = productStock(product);
  const lowStock = isLowStock(product);
  const inventoryEnabled = useIsModuleEnabledFromConfig("inventory");
  const categoryName = product.category && typeof product.category === "object" ? product.category.name : null;

  const typeLabel =
    product.product_type === "RECIPE_BASED" && recipe
      ? recipe.name
      : productTypeLabel(product.product_type);
  const tracksInventory = (product as { tracks_inventory?: boolean }).tracks_inventory !== false;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !product.is_active && "opacity-50 grayscale",
      )}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            colorClass.bg,
            colorClass.text,
          )}
        >
          <Package className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold leading-snug" title={product.name}>
            {product.name}
          </h3>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {product.code ? product.code : "Sin código"}
            {inventoryEnabled && tracksInventory ? ` · Stock ${stock}` : ""}
            {inventoryEnabled && !tracksInventory ? " · Sin límite" : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-bold tabular-nums leading-none">
            {formatCLP(product.sale_price ?? product.price ?? "0")}
          </p>
          {inventoryEnabled && tracksInventory && lowStock && (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-warning">
              <AlertTriangle className="h-3 w-3" />
              Bajo
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        <span
          className={cn(
            "inline-flex max-w-[55%] truncate rounded-full px-2 py-0.5 text-[11px] font-medium",
            categoryName ? cn(colorClass.bg, colorClass.text) : "bg-muted text-muted-foreground",
          )}
          title={categoryName ?? "Sin categoría"}
        >
          {categoryName ?? "Sin categoría"}
        </span>
        <span
          className="inline-flex max-w-[45%] truncate rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
          title={typeLabel}
        >
          {typeLabel}
        </span>
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
            product.is_for_sale ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
          )}
        >
          {product.is_for_sale ? "En venta" : "No venta"}
        </span>
      </div>

      {product.description && (
        <p className="mt-auto line-clamp-1 px-4 pb-4 text-xs text-muted-foreground">{product.description}</p>
      )}
    </div>
  );
}

export function ProductsClient() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const branch = useCurrentBranch();
  const { download: downloadFile, isLoading: isExporting } = useDownloadFile();
  const { options: productTypeOptions, labelFor: productTypeLabel } = useBranchProductTypes();
  const { options: categoryOptions, isLoading: loadingCategories, error: categoriesError } = useCategoryOptions();

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("");
  const [productTypes, setProductTypes] = useState<string[]>([]);
  const [forSale, setForSale] = useState("");
  const [active, setActive] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const inventoryEnabled = useIsModuleEnabledFromConfig("inventory");

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
  const [creating, setCreating] = useState(false);
  // Para editar se carga el detalle completo: el listado no trae
  // is_public ni nutrición y re-guardar desde ahí borra esos datos.
  const searchParams = useSearchParams();
  const router = useRouter();
  const editParam = searchParams.get("edit");
  const [editingId, setEditingId] = useState<number | null>(
    editParam ? Number(editParam) || null : null,
  );
  const [editInitialTab, setEditInitialTab] = useState<FormTab>("basic");
  const [confirmDelete, setConfirmDelete] = useState<YggdraProduct | null>(null);
  const [confirmCopy, setConfirmCopy] = useState<YggdraProduct | null>(null);
  const [copying, setCopying] = useState(false);

  function clearEditParam() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("edit");
    const query = next.toString();
    router.replace(`/products${query ? `?${query}` : ""}`, { scroll: false });
  }

  const filter = useMemo<ProductsFilter>(
    () => ({
      search: search || undefined,
      category: category ? Number(category) : undefined,
      product_type: productTypes.length ? productTypes : undefined,
      is_for_sale: forSale ? forSale === "true" : undefined,
      is_active: active ? active === "true" : undefined,
      page_size: 100,
      ...pageUrl,
    }),
    [search, category, productTypes, forSale, active, pageUrl],
  );

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["products", "manage", filter],
    queryFn: () => fetchProductsForManage(filter),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });

  const products = useMemo(() => page?.results ?? [], [page]);
  const totalProducts = page?.count ?? 0;

  const recipesByProductId = useMemo(() => new Map<number, YggdraSchemas["Recipe"]>(), []);
  const ingredientsByRecipeId = useMemo(
    () => new Map<string, YggdraSchemas["RecipeIngredient"][]>(),
    [],
  );

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      setProductActive(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
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
    return product;
  };

  async function handleDuplicate(product: YggdraProduct) {
    setCopying(true);
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
      toast.success("Producto copiado");
      setConfirmCopy(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo duplicar el producto.");
    } finally {
      setCopying(false);
    }
  }

  function updateFilter<T>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  function clearFilters() {
    setSearch("");
    setSearchInput("");
    setCategory("");
    setProductTypes([]);
    setForSale("");
    setActive("");
    setPageUrl({});
  }

  function handleExport(format: "excel" | "pdf") {
    downloadFile(() => exportProducts(filter, format), {
      filename: exportFilename("productos", format === "excel" ? "xlsx" : "pdf"),
    });
  }

  const hasActiveFilters =
    search.trim() || category || productTypes.length || forSale || active;

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
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <MultiSelect
            options={productTypeOptions.map((t) => ({ value: t.value, label: t.label }))}
            value={productTypes}
            onChange={(v) => updateFilter(setProductTypes, v)}
            placeholder="Tipo"
            className="w-auto min-w-[9rem] shrink-0"
            maxChips={1}
          />
          <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />
          <FilterChip
            active={forSale === "true"}
            onClick={() => updateFilter(setForSale, forSale === "true" ? "" : "true")}
          >
            En venta
          </FilterChip>
          <FilterChip
            active={forSale === "false"}
            onClick={() => updateFilter(setForSale, forSale === "false" ? "" : "false")}
          >
            No venta
          </FilterChip>
          <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />
          <FilterChip
            active={active === "true"}
            onClick={() => updateFilter(setActive, active === "true" ? "" : "true")}
          >
            Activo
          </FilterChip>
          <FilterChip
            active={active === "false"}
            onClick={() => updateFilter(setActive, active === "false" ? "" : "false")}
          >
            Inactivo
          </FilterChip>
          <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />
          <Select
            id="filter-category"
            value={category}
            disabled={loadingCategories}
            onChange={(e) => updateFilter(setCategory, e.target.value)}
            className="h-7 w-auto min-w-[8.5rem] shrink-0 rounded-full border-transparent bg-muted/40 px-2.5 text-xs shadow-none"
          >
            <option value="">Categoría</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-1 inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <FilterX className="h-3 w-3" />
              Limpiar
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudo cargar el catálogo.</p>
        ) : isLoading ? (
          <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(18.5rem,1fr))] gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex h-full w-full flex-col rounded-2xl border border-border bg-background p-4 shadow-sm"
              >
                <div className="mb-4 flex items-start gap-3">
                  <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-full max-w-[75%]" />
                    <Skeleton className="h-3 w-full max-w-[50%]" />
                  </div>
                </div>
                <div className="mb-3 flex flex-wrap gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="mb-4 flex flex-1 items-end justify-between gap-2">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="ml-auto h-3 w-10" />
                    <Skeleton className="ml-auto h-5 w-12" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
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
                    "grid grid-cols-[repeat(auto-fill,minmax(18.5rem,1fr))] gap-4",
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
                        onOpen={() => {
                          setEditInitialTab("basic");
                          setEditingId(p.id);
                        }}
                      />
                    );
                  })}
                </div>

                {/* Vista lista (tabla) */}
                <div
                  className={cn(
                    "hidden overflow-x-auto rounded-xl border border-border bg-card shadow-sm",
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
                        {inventoryEnabled && <th className="px-4 py-3 text-center">Stock</th>}
                        <th className="px-4 py-3 text-center">Venta</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr
                          key={p.id}
                          className={cn(
                            "cursor-pointer border-b border-border last:border-0 hover:bg-muted/40",
                            !p.is_active && "opacity-50 grayscale",
                          )}
                          onClick={() => {
                            setEditInitialTab("basic");
                            setEditingId(p.id);
                          }}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                                colorFor(p.name || p.code || String(p.id)).bg,
                                colorFor(p.name || p.code || String(p.id)).text,
                              )}>
                                <Package className="h-5 w-5" />
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
                                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
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
                          {inventoryEnabled && (
                          <td className="px-4 py-3 text-center">
                          {((p as { tracks_inventory?: boolean }).tracks_inventory === false) ? (
                            <span className="text-xs font-medium text-success">Sin límite</span>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <span className="tabular-nums">{productStock(p)}</span>
                              {isLowStock(p) && (
                                <span title="Stock bajo">
                                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                                </span>
                              )}
                            </div>
                          )}
                          </td>
                          )}
                          <td className="px-4 py-3 text-center">
                            <span
                              className={
                                p.is_for_sale
                                  ? "rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
                                  : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                              }
                            >
                              {p.is_for_sale ? "Sí" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
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
                              onDuplicate={() => setConfirmCopy(p)}
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

      {creating && (
        <ProductForm
          onClose={() => setCreating(false)}
          onSubmit={onSubmit}
        />
      )}

      {editingId && (
        <ProductForm
          productId={editingId}
          initialTab={editInitialTab}
          onClose={() => {
            queryClient.removeQueries({ queryKey: ["products", "detail", editingId] });
            setEditingId(null);
            setEditInitialTab("basic");
            clearEditParam();
          }}
          onSubmit={onSubmit}
          extraActions={{
            onCopy: () => {
              const p = products.find((x) => x.id === editingId);
              if (p) setConfirmCopy(p);
            },
            onDelete: () => {
              const p = products.find((x) => x.id === editingId);
              if (p) setConfirmDelete(p);
            },
            onToggleActive: () => {
              const p = products.find((x) => x.id === editingId);
              if (p) toggleActive.mutate({ id: p.id, isActive: !p.is_active });
            },
            isTogglingActive: toggleActive.isPending,
          }}
        />
      )}

      <AnimatedOverlay
        open={!!confirmCopy}
        onClose={() => !copying && setConfirmCopy(null)}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
        {confirmCopy && (
          <div className="w-full rounded-t-xl border-x border-t border-border bg-background p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <h2 className="text-base font-semibold">Copiar producto</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              ¿Seguro que quieres copiar <strong>{confirmCopy.name}</strong>? Se creará un
              duplicado con el sufijo “(copia)”.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmCopy(null)}
                disabled={copying}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={() => handleDuplicate(confirmCopy)} isLoading={copying}>
                Copiar
              </Button>
            </div>
          </div>
        )}
      </AnimatedOverlay>

      <AnimatedOverlay
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        zIndex="z-[70]"
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          {confirmDelete && (
          <div className="w-full rounded-t-xl border-x border-t border-border bg-background p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
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
