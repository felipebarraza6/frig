"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { m } from "framer-motion";
import {
  Search,
  Pencil,
  X,
  Apple,
  FileDown,
  Calculator,
  ChefHat,
  Printer,
  Wheat,
  ShoppingCart,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import {
  fetchProducts,
  fetchProduct,
  updateProduct,
  type ProductPayload,
} from "@/lib/api/products";
import {
  fetchRecipesByProduct,
  calculateRecipeNutrition,
  NUTRITION_LABEL_PAGE_SIZES,
  downloadRecipeNutritionLabelPdf,
  previewRecipeNutritionLabel,
  isNutritionLabelNotReady,
  nutritionMissingDetailsFromError,
  normalizeNutritionMissingDetails,
  missingDetailLabel,
  missingDetailFields,
  missingDetailProductId,
  nutritionFieldLabel,
  type NutritionLabelPageSize,
  type NutritionMissingDetail,
  type RecipeNutritionCompleteness,
} from "@/lib/api/recipes";
import { ProductForm } from "@/components/products/product-form";
import { useDownloadFile } from "@/lib/hooks/useDownloadFile";
import { cn, formatCLP } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import type { YggdraProduct } from "@/lib/api/types";
import { useToast } from "@/lib/store/toast";
import { useIsNutritionEnabled } from "@/lib/store/session";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";

type ProductDetail = YggdraProduct & {
  is_nutritional_ingredient?: boolean;
  energy_kcal?: string | number | null;
  proteins_g?: string | number | null;
  total_fats_g?: string | number | null;
  saturated_fats_g?: string | number | null;
  monounsaturated_fats_g?: string | number | null;
  polyunsaturated_fats_g?: string | number | null;
  trans_fats_g?: string | number | null;
  cholesterol_mg?: string | number | null;
  carbohydrates_g?: string | number | null;
  total_sugars_g?: string | number | null;
  sodium_mg?: string | number | null;
};

type RecipeWithNutrition = NonNullable<
  Awaited<ReturnType<typeof fetchRecipesByProduct>>[number]
> &
  RecipeNutritionCompleteness;

function isRecipeBased(product: ProductDetail): boolean {
  return product.product_type === "RECIPE_BASED";
}

function productTypeLabel(type?: string | null): string {
  switch (type) {
    case "RAW_MATERIAL":
      return "Materia prima";
    case "RECIPE_BASED":
      return "Compuesto";
    case "DIRECT_SALE":
      return "Venta directa";
    default:
      return "Producto";
  }
}

type GalleryFilter = "all" | "RECIPE_BASED" | "RAW_MATERIAL" | "DIRECT_SALE";

const GALLERY_FILTERS: { id: GalleryFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "RECIPE_BASED", label: "Compuestos" },
  { id: "RAW_MATERIAL", label: "Materias primas" },
  { id: "DIRECT_SALE", label: "Venta directa" },
];

/** Mini etiqueta visual para la galería (no requiere datos nutricionales del listado). */
function NutritionLabelThumb({
  name,
  type,
}: {
  name: string;
  type?: string | null;
}) {
  const tint =
    type === "RAW_MATERIAL"
      ? "from-success/25 via-success/5 to-transparent"
      : type === "RECIPE_BASED"
        ? "from-warning/25 via-warning/5 to-transparent"
        : "from-primary/25 via-primary/5 to-transparent";
  const Icon = type === "RAW_MATERIAL" ? Wheat : type === "RECIPE_BASED" ? ChefHat : ShoppingCart;

  return (
    <div
      className={cn(
        "relative mx-auto aspect-[62/100] w-[7.5rem] overflow-hidden rounded-sm border-2 border-black bg-white text-black shadow-md transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-[-1.5deg] group-hover:shadow-xl sm:w-[8.5rem]",
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-10 bg-gradient-to-b", tint)} />
      <div className="relative flex h-full flex-col px-2 pb-2 pt-2">
        <div className="mb-1 flex items-center gap-1 border-b-2 border-black pb-1">
          <Icon className="h-3 w-3 shrink-0 opacity-70" />
          <p className="truncate text-[9px] font-black uppercase leading-none tracking-tight">
            Info. nutricional
          </p>
        </div>
        <p className="line-clamp-2 text-[10px] font-semibold leading-tight">{name}</p>
        <p className="mt-0.5 text-[8px] text-black/50">Por 100 g</p>
        <div className="mt-1.5 flex-1 space-y-1">
          {["Energía", "Proteínas", "Grasas", "Carb.", "Sodio"].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between border-b border-black/15 pb-0.5 text-[8px]"
            >
              <span className="font-medium">{row}</span>
              <span className="h-1 w-6 rounded-full bg-black/10" />
            </div>
          ))}
        </div>
        <p className="mt-auto pt-1 text-center text-[8px] font-semibold text-black/40">
          {productTypeLabel(type)}
        </p>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200",
        active
          ? "bg-primary/15 text-primary ring-1 ring-primary/30 shadow-[inset_0_1px_0_var(--glass-highlight)]"
          : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function NutritionMissingPanel({
  details,
  onEditProduct,
}: {
  details: NutritionMissingDetail[];
  onEditProduct: (productId: number) => void;
}) {
  if (details.length === 0) return null;

  return (
    <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs">
      <div className="mb-2 flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div>
          <p className="font-semibold text-foreground">Etiqueta no lista</p>
          <p className="mt-0.5 text-muted-foreground">
            Completa las fichas de estos insumos (tab Nutrición) y vuelve a
            calcular.
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {details.map((row, idx) => {
          const productId = missingDetailProductId(row);
          const fields = missingDetailFields(row);
          const label = missingDetailLabel(row);
          return (
            <li
              key={`${productId ?? label}-${idx}`}
              className="rounded-lg bg-background/70 px-2.5 py-2 ring-1 ring-border/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{label}</p>
                  {fields.length > 0 ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Falta: {fields.map(nutritionFieldLabel).join(", ")}
                    </p>
                  ) : row.reason || row.message ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {row.reason || row.message}
                    </p>
                  ) : null}
                </div>
                {productId != null ? (
                  <button
                    type="button"
                    onClick={() => onEditProduct(productId)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/15"
                  >
                    Completar
                    <ExternalLink className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ProductNutritionPage() {
  const queryClient = useQueryClient();
  const nutritionEnabled = useIsNutritionEnabled();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<GalleryFilter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["products", "nutrition", search],
    queryFn: () => fetchProducts({ search, page_size: 200 }),
  });

  const filtered = useMemo(() => {
    const list = (page?.results ?? []) as ProductDetail[];
    if (typeFilter === "all") return list;
    return list.filter((p) => p.product_type === typeFilter);
  }, [page, typeFilter]);

  const onSubmit = async (payload: ProductPayload, id?: number): Promise<YggdraProduct> => {
    if (!id) {
      throw new Error("No se puede guardar sin un producto seleccionado.");
    }
    const product = await updateProduct(id, payload);
    queryClient.invalidateQueries({ queryKey: ["products"] });
    return product;
  };

  if (!nutritionEnabled) {
    return (
      <div className="mx-auto flex min-h-full w-full min-w-0 max-w-7xl flex-col">
        <PageHeader
          title="Etiquetado nutricional"
          icon={<Apple className="h-5 w-5" />}
          subtitle="Imprime y descarga etiquetas nutricionales desde el backend"
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <Apple className="h-10 w-10 text-muted-foreground" />
          <div className="max-w-sm">
            <p className="text-sm font-medium">Etiquetado nutricional no activo</p>
            <p className="text-xs text-muted-foreground">
              Activa el módulo Etiquetado nutricional en Configuración → Módulos
              para usar esta función.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full min-w-0 max-w-7xl flex-col">
      <PageHeader
        title="Etiquetado nutricional"
        icon={<Apple className="h-5 w-5" />}
        subtitle="PDF y vista previa oficiales del backend · tamaño etiqueta / A4 / Letter"
      />

      <div className="relative flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,_color-mix(in_srgb,var(--brand-primary)_12%,transparent),_transparent_70%)]"
        />

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en la galería…"
              className="h-10 rounded-xl border-0 bg-primary/[0.06] pl-9 shadow-[inset_0_1px_0_var(--glass-highlight)] ring-1 ring-border/40"
            />
          </div>
          <div className="glass-chip flex gap-1 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {GALLERY_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTypeFilter(f.id)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200",
                  typeFilter === f.id
                    ? "bg-primary/15 text-primary shadow-[inset_0_1px_0_var(--glass-highlight)] ring-1 ring-primary/25"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p className="relative text-sm text-danger">No se pudo cargar el catálogo.</p>
        ) : isLoading ? (
          <div className="relative grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-3 rounded-3xl p-4">
                <Skeleton className="aspect-[62/100] w-[7.5rem] rounded-sm sm:w-[8.5rem]" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="relative rounded-2xl border border-dashed border-border p-8 text-center">
            <Apple className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-medium text-foreground">No hay productos en esta vista</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Prueba otro filtro o busca por nombre.
            </p>
          </div>
        ) : (
          <m.div
            className="relative grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.045 } },
            }}
          >
            {filtered.map((product) => (
              <m.button
                key={product.id}
                type="button"
                onClick={() => setSelectedId(product.id)}
                variants={{
                  hidden: { opacity: 0, y: 14, scale: 0.96 },
                  show: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
                  },
                }}
                className="group flex flex-col items-center gap-2.5 rounded-3xl p-3 text-left transition-colors hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <div className="relative">
                  <div
                    aria-hidden
                    className="absolute -inset-3 rounded-[1.75rem] bg-gradient-to-b from-primary/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />
                  <NutritionLabelThumb name={product.name} type={product.product_type} />
                </div>
                <div className="w-full min-w-0 px-1 text-center">
                  <p className="truncate text-sm font-semibold leading-tight">{product.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {productTypeLabel(product.product_type)}
                    {product.sale_price || product.price
                      ? ` · ${formatCLP(product.sale_price ?? product.price ?? "0")}`
                      : ""}
                  </p>
                  <span className="mt-1.5 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    Abrir etiqueta
                  </span>
                </div>
              </m.button>
            ))}
          </m.div>
        )}
      </div>

      {selectedId != null && (
        <NutritionLabelStudio
          productId={selectedId}
          listProduct={filtered.find((p) => p.id === selectedId) ?? null}
          onClose={() => setSelectedId(null)}
          onEdit={() => {
            setEditingId(selectedId);
            setSelectedId(null);
          }}
          onEditIngredient={(ingredientProductId) => {
            setSelectedId(null);
            setEditingId(ingredientProductId);
          }}
        />
      )}

      {editingId && (
        <ProductForm
          key={`edit-nutrition-${editingId}`}
          productId={editingId}
          initialTab="nutrition"
          onClose={() => {
            queryClient.removeQueries({ queryKey: ["products", "detail", editingId] });
            setEditingId(null);
          }}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}

function NutritionLabelStudio({
  productId,
  listProduct,
  onClose,
  onEdit,
  onEditIngredient,
}: {
  productId: number;
  listProduct: ProductDetail | null;
  onClose: () => void;
  onEdit: () => void;
  onEditIngredient: (productId: number) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { download, isLoading: downloadingNutritionPdf } = useDownloadFile();

  const [pageSize, setPageSize] = useState<NutritionLabelPageSize>("label");
  /** 409 de preview/download; se ignora si cambia la receta. */
  const [errorMissing, setErrorMissing] = useState<{
    recipeId: string;
    details: NutritionMissingDetail[];
  } | null>(null);

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["products", "detail", productId],
    queryFn: async () => (await fetchProduct(productId)) as unknown as ProductDetail,
  });

  const product = detail ?? listProduct;
  const isCompound = product ? isRecipeBased(product) : false;

  const {
    data: recipes = [],
    isLoading: loadingRecipes,
    isFetched: recipesFetched,
  } = useQuery({
    queryKey: ["recipes", "by-product", "nutrition-label", productId, product?.name],
    queryFn: () =>
      fetchRecipesByProduct(productId, {
        productName: product?.name,
      }),
    enabled: Boolean(productId && product?.name),
    staleTime: 30_000,
  });

  const primaryRecipe = (recipes[0] ?? null) as RecipeWithNutrition | null;

  const calculate = useMutation({
    mutationFn: calculateRecipeNutrition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes", "by-product", productId] });
      queryClient.invalidateQueries({ queryKey: ["recipes", "by-product", "nutrition-label", productId] });
      queryClient.invalidateQueries({ queryKey: ["recipe", "nutrition-preview"] });
      queryClient.invalidateQueries({ queryKey: ["products", "detail", productId] });
      setErrorMissing(null);
      toast.success("Nutrición calculada desde la receta");
    },
    onError: (err: Error) => {
      if (isNutritionLabelNotReady(err) && primaryRecipe?.id) {
        setErrorMissing({
          recipeId: primaryRecipe.id,
          details: nutritionMissingDetailsFromError(err),
        });
      }
      toast.error(err.message);
    },
  });

  const autoCalcTried = useRef<string | null>(null);
  useEffect(() => {
    const recipeId = primaryRecipe?.id;
    if (!recipeId) return;
    if (primaryRecipe?.has_nutritional_calculation) return;
    if (autoCalcTried.current === recipeId) return;
    autoCalcTried.current = recipeId;
    calculate.mutate(recipeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al resolver receta
  }, [primaryRecipe?.id, primaryRecipe?.has_nutritional_calculation]);

  const recipeMissingDetails = useMemo(() => {
    if (!primaryRecipe || primaryRecipe.nutrition_is_complete !== false) return [];
    return normalizeNutritionMissingDetails(primaryRecipe.nutrition_missing_details);
  }, [primaryRecipe]);

  const errorMissingDetails =
    errorMissing && primaryRecipe && errorMissing.recipeId === primaryRecipe.id
      ? errorMissing.details
      : [];

  const missingDetails =
    errorMissingDetails.length > 0 ? errorMissingDetails : recipeMissingDetails;

  const recipesPending = Boolean(product?.name) && (!recipesFetched || loadingRecipes);
  const canUseOfficial = Boolean(primaryRecipe?.id);
  const nutritionBlocked =
    missingDetails.length > 0 || primaryRecipe?.nutrition_is_complete === false;

  const previewQuery = useQuery({
    queryKey: ["recipe", "nutrition-preview", primaryRecipe?.id, "png"],
    queryFn: async () => {
      try {
        const file = await previewRecipeNutritionLabel(primaryRecipe!.id, "png");
        return URL.createObjectURL(file.blob);
      } catch (err) {
        if (isNutritionLabelNotReady(err)) {
          setErrorMissing({
            recipeId: primaryRecipe!.id,
            details: nutritionMissingDetailsFromError(err),
          });
        }
        throw err;
      }
    },
    enabled: Boolean(primaryRecipe?.id) && !nutritionBlocked,
    staleTime: 60_000,
    retry: false,
  });

  const previewUrl = previewQuery.data ?? null;
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleDownload() {
    if (!primaryRecipe?.id) {
      toast.error(
        "Necesitas una receta asociada para descargar el PDF oficial. Edita el producto compuesto y guarda la receta.",
      );
      return;
    }
    if (nutritionBlocked) {
      toast.error("Completa los datos faltantes de los insumos antes de descargar.");
      return;
    }

    void download(
      async () => {
        try {
          return await downloadRecipeNutritionLabelPdf(primaryRecipe.id, pageSize);
        } catch (err) {
          if (isNutritionLabelNotReady(err)) {
            setErrorMissing({
              recipeId: primaryRecipe.id,
              details: nutritionMissingDetailsFromError(err),
            });
          }
          throw err;
        }
      },
      {
        filename: `etiqueta-nutricional_${(product?.name ?? "receta")
          .replace(/[^a-z0-9]+/gi, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "")
          .toLowerCase()}_${pageSize}.pdf`,
        extension: "pdf",
        onSuccess: () => toast.success(`PDF descargado · ${pageSize}`),
        onError: (error) => {
          if (isNutritionLabelNotReady(error)) {
            toast.error("Etiqueta no lista: revisa los insumos incompletos.");
            return;
          }
          toast.error(
            error instanceof ApiError
              ? error.message
              : error.message || "No se pudo descargar el PDF",
          );
        },
      },
    );
  }

  function handlePrintPreview() {
    if (!previewUrl) {
      toast.error("Sin vista previa para imprimir.");
      return;
    }
    const win = window.open("", "_blank", "noopener,noreferrer,width=520,height=780");
    if (!win) {
      toast.error("El navegador bloqueó la ventana de impresión.");
      return;
    }
    const title = product?.name
      ? `Etiqueta · ${product.name}`
      : "Etiqueta nutricional";
    win.document.write(
      `<!doctype html><html><head><title>${title.replace(/[<>&"]/g, "")}</title>
      <style>
        @page { margin: 0; }
        html, body { margin: 0; background: #fff; }
        body { display: grid; place-items: center; min-height: 100vh; }
        img { max-width: 100%; height: auto; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style></head><body><img src="${previewUrl}" alt="Etiqueta nutricional" /></body></html>`,
    );
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 280);
  }

  const previewError =
    previewQuery.error instanceof Error ? previewQuery.error : null;
  const previewNotReady =
    previewError != null && isNutritionLabelNotReady(previewError);

  return (
    <AnimatedOverlay
      open={true}
      onClose={onClose}
      zIndex="z-[60]"
      panelClassName="flex items-end justify-center overflow-hidden p-0 sm:items-center sm:p-3"
    >
      <div className="relative flex max-h-[min(92dvh,720px)] w-full flex-col overflow-hidden rounded-t-2xl border-x border-t border-border/70 bg-background shadow-xl sm:max-w-2xl sm:rounded-2xl sm:border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_srgb,var(--brand-primary)_12%,transparent),_transparent_50%)]"
        />

        <div className="glass-strong relative flex shrink-0 items-center justify-between gap-3 border-b border-border/50 px-3.5 py-2.5 sm:px-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight">
              {product?.name ?? "Cargando…"}
            </h2>
            <p className="truncate text-[11px] text-muted-foreground">
              {productTypeLabel(product?.product_type)}
              {primaryRecipe
                ? ` · Receta: ${primaryRecipe.name}`
                : recipesPending
                  ? " · buscando receta…"
                  : " · sin receta (PDF oficial requiere receta)"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button type="button" variant="ghost" size="sm" onClick={onEdit} title="Editar datos">
              <Pencil className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-3.5 py-3 sm:px-4">
          {loadingDetail && !product ? (
            <TableSkeleton rows={3} columns={2} showHeader={false} />
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="rounded-2xl bg-primary/[0.04] p-3 ring-1 ring-border/40 shadow-[inset_0_1px_0_var(--glass-highlight)]">
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                      Tamaño del PDF
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {NUTRITION_LABEL_PAGE_SIZES.map((sz) => (
                        <Chip
                          key={sz.id}
                          active={pageSize === sz.id}
                          onClick={() => setPageSize(sz.id)}
                        >
                          {sz.label}
                        </Chip>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {NUTRITION_LABEL_PAGE_SIZES.find((s) => s.id === pageSize)?.hint}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border/40 pt-2.5">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canUseOfficial || nutritionBlocked}
                      isLoading={downloadingNutritionPdf}
                      onClick={handleDownload}
                      title="Descarga el PDF oficial del backend"
                    >
                      {!downloadingNutritionPdf && (
                        <FileDown className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Descargar PDF
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!previewUrl}
                      onClick={handlePrintPreview}
                    >
                      <Printer className="mr-1.5 h-3.5 w-3.5" />
                      Imprimir
                    </Button>
                    {primaryRecipe && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => calculate.mutate(primaryRecipe.id)}
                        isLoading={calculate.isPending}
                      >
                        {!calculate.isPending && <Calculator className="mr-1.5 h-3.5 w-3.5" />}
                        Calcular
                      </Button>
                    )}
                  </div>

                  {primaryRecipe?.nutrition_is_complete === true && (
                    <p className="mt-2 text-[11px] text-success">
                      Nutrición completa · lista para etiquetar
                    </p>
                  )}
                  {!canUseOfficial && !recipesPending && (
                    <p className="mt-2 text-[11px] text-warning">
                      El generador oficial requiere una receta.{" "}
                      {isCompound
                        ? "Guarda ingredientes en el tab Receta."
                        : "Los productos sin receta no emiten PDF oficial."}
                    </p>
                  )}
                </div>

                {(missingDetails.length > 0 || previewNotReady) && (
                  <NutritionMissingPanel
                    details={
                      missingDetails.length > 0
                        ? missingDetails
                        : nutritionMissingDetailsFromError(previewError)
                    }
                    onEditProduct={onEditIngredient}
                  />
                )}

                {isCompound && !primaryRecipe && !recipesPending && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ChefHat className="h-3.5 w-3.5" />
                    Producto compuesto sin receta guardada.
                  </p>
                )}
              </div>

              <div className="mx-auto shrink-0 sm:mx-0">
                {previewUrl ? (
                  <div
                    id="nutrition-studio-print-root"
                    className="overflow-hidden rounded-sm border-2 border-black bg-white shadow-md"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- blob autenticado */}
                    <img
                      src={previewUrl}
                      alt={`Vista previa etiqueta ${product?.name ?? ""}`}
                      className="block max-h-[min(58vh,420px)] w-auto max-w-[11rem] object-contain sm:max-w-[13rem]"
                    />
                  </div>
                ) : (
                  <div className="grid h-40 w-40 place-items-center rounded-xl border border-dashed border-border text-center text-[11px] text-muted-foreground">
                    {previewQuery.isFetching || calculate.isPending
                      ? "Cargando vista previa…"
                      : nutritionBlocked
                        ? "Completa insumos para previsualizar"
                        : !canUseOfficial
                          ? "Sin receta para previsualizar"
                          : previewError
                            ? "No se pudo cargar la vista previa"
                            : "Sin datos para previsualizar"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative flex shrink-0 justify-end gap-2 border-t border-border/60 px-3.5 py-2.5 sm:px-4">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="button" size="sm" onClick={onEdit}>
            Editar datos
          </Button>
        </div>
      </div>
    </AnimatedOverlay>
  );
}
