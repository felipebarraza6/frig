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
  downloadRecipeNutritionLabel,
  fetchRecipeNutritionLabel,
} from "@/lib/api/recipes";
import { ProductForm } from "@/components/products/product-form";
import {
  NutritionLabelPreview,
  NUTRITION_LABEL_SIZES,
  type NutritionLabelExtras,
  type NutritionLabelMode,
  type NutritionLabelPortion,
  type NutritionValues,
} from "@/components/products/nutrition-label-preview";
import { useDownloadFile } from "@/lib/hooks/useDownloadFile";
import {
  buildNutritionLabelPdfBlob,
  countFilledNutrients,
} from "@/lib/nutrition-label-pdf";
import { cn, downloadBlob, formatCLP } from "@/lib/utils";
import { mediaUrl } from "@/lib/api/client";
import type { YggdraProduct } from "@/lib/api/types";
import { useToast } from "@/lib/store/toast";
import { useIsNutritionEnabled, useSessionStore, useCurrentBranch } from "@/lib/store/session";
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

interface NutritionLabelData {
  compliance?: {
    is_compliant?: boolean;
    compliance_score?: number;
    warnings?: string[];
    errors?: string[];
  };
  nutrition_per_100g?: Record<string, number>;
  nutrition_per_serving?: Record<string, number>;
  serving_size_grams?: number;
  product_name?: string;
  ingredients_text?: string;
  allergen_warning?: string;
  branch_info?: {
    business_name?: string;
    full_text?: string;
  };
  [key: string]: unknown;
}

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

function s(v: string | number | null | undefined): string {
  return v == null || v === "" ? "" : String(v);
}

function valuesFromProduct(product: ProductDetail): NutritionValues {
  return {
    energyKcal: s(product.energy_kcal),
    proteinsG: s(product.proteins_g),
    totalFatsG: s(product.total_fats_g),
    saturatedFatsG: s(product.saturated_fats_g),
    monounsaturatedFatsG: s(product.monounsaturated_fats_g),
    polyunsaturatedFatsG: s(product.polyunsaturated_fats_g),
    transFatsG: s(product.trans_fats_g),
    cholesterolMg: s(product.cholesterol_mg),
    carbohydratesG: s(product.carbohydrates_g),
    totalSugarsG: s(product.total_sugars_g),
    sodiumMg: s(product.sodium_mg),
  };
}

function valuesFromLabelApi(
  block: Record<string, number> | undefined,
): NutritionValues | null {
  if (!block) return null;
  return {
    energyKcal: s(block.energia_kcal),
    proteinsG: s(block.proteinas_g),
    totalFatsG: s(block.grasas_totales_g),
    saturatedFatsG: s(block.grasas_saturadas_g),
    monounsaturatedFatsG: s(block.grasas_monoinsaturadas_g),
    polyunsaturatedFatsG: s(block.grasas_poliinsaturadas_g),
    transFatsG: s(block.grasas_trans_g),
    cholesterolMg: s(block.colesterol_mg),
    carbohydratesG: s(block.hidratos_carbono_g),
    totalSugarsG: s(block.azucares_totales_g),
    sodiumMg: s(block.sodio_mg),
  };
}

function hasMeaningfulNutrition(values: NutritionValues | null | undefined): boolean {
  if (!values) return false;
  return Object.values(values).some((v) => {
    const n = Number(v);
    return v !== "" && !Number.isNaN(n) && n !== 0;
  });
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
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
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
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
      <PageHeader
        title="Etiquetado nutricional"
        icon={<Apple className="h-5 w-5" />}
        subtitle="Compuestos, venta directa o materias primas · ver, imprimir y descargar etiqueta"
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
}: {
  productId: number;
  listProduct: ProductDetail | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const branch = useCurrentBranch();
  const branchTheme = useSessionStore((s) => s.theme ?? s.organizationTheme);
  const { download: downloadNutritionPdf, isLoading: downloadingNutritionPdf } = useDownloadFile();

  const [labelMode, setLabelMode] = useState<NutritionLabelMode>("simple");
  const [labelPortion, setLabelPortion] = useState<NutritionLabelPortion>("per_100g");
  const [labelSizeId, setLabelSizeId] = useState(NUTRITION_LABEL_SIZES[0].id);
  const [servingGramsInput, setServingGramsInput] = useState("100");
  const [buildingPdf, setBuildingPdf] = useState(false);

  const labelSize =
    NUTRITION_LABEL_SIZES.find((sz) => sz.id === labelSizeId) ?? NUTRITION_LABEL_SIZES[0];
  const servingGrams = Math.max(1, Number(servingGramsInput) || 100);
  const branchLogoUrl = mediaUrl(branchTheme?.logo ?? null);
  const branchDisplayName =
    branch?.branch_name ||
    branch?.business_name ||
    branchTheme?.app_name ||
    "Sucursal";

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["products", "detail", productId],
    queryFn: async () => (await fetchProduct(productId)) as unknown as ProductDetail,
  });

  const product = detail ?? listProduct;
  const isCompound = product ? isRecipeBased(product) : false;

  // Siempre buscar receta por productId (+ nombre): no depender solo de product_type
  // del listado (a veces llega sin tipo y el PDF quedaba siempre deshabilitado).
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

  const primaryRecipe = recipes[0] ?? null;

  const { data: labelData } = useQuery<NutritionLabelData>({
    queryKey: ["recipe", "nutrition-label", primaryRecipe?.id],
    queryFn: () => fetchRecipeNutritionLabel(primaryRecipe!.id) as Promise<NutritionLabelData>,
    enabled: Boolean(primaryRecipe?.id),
  });

  const calculate = useMutation({
    mutationFn: calculateRecipeNutrition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes", "by-product", productId] });
      queryClient.invalidateQueries({ queryKey: ["recipes", "by-product", "nutrition-label", productId] });
      queryClient.invalidateQueries({ queryKey: ["recipe", "nutrition-label"] });
      queryClient.invalidateQueries({ queryKey: ["products", "detail", productId] });
      toast.success("Nutrición calculada desde la receta");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Auto-calcular una vez si hay receta sin cálculo (para llenar la etiqueta con data real).
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

  const per100Api = valuesFromLabelApi(labelData?.nutrition_per_100g);
  const perServingApi = valuesFromLabelApi(labelData?.nutrition_per_serving);
  const productVals = product ? valuesFromProduct(product) : null;

  // Fuente de verdad: nutrition_label del back; producto solo si no hay receta/cálculo.
  let previewValues: NutritionValues | null = null;
  let valuesAlreadyForPortion = false;
  if (labelPortion === "per_serving") {
    if (hasMeaningfulNutrition(perServingApi)) {
      previewValues = perServingApi;
      valuesAlreadyForPortion = true;
    } else if (hasMeaningfulNutrition(per100Api)) {
      previewValues = per100Api;
    } else {
      previewValues = productVals;
    }
  } else if (hasMeaningfulNutrition(per100Api)) {
    previewValues = per100Api;
  } else {
    previewValues = productVals;
  }

  const labelExtras: NutritionLabelExtras = {
    ingredientsText: labelData?.ingredients_text || null,
    allergenWarning: labelData?.allergen_warning || null,
    branchText: labelData?.branch_info?.full_text || null,
  };

  const hasOfficialPdf = Boolean(primaryRecipe?.id);
  const recipesPending = Boolean(product?.name) && (!recipesFetched || loadingRecipes);
  const hasPreview = hasMeaningfulNutrition(previewValues);
  /** PDF oficial (receta) o etiqueta del producto (materia prima / sin receta). */
  const canExport = hasOfficialPdf || hasPreview;

  const apiServing = labelData?.serving_size_grams;
  const effectiveServing =
    labelPortion === "per_serving" && apiServing && apiServing > 0
      ? apiServing
      : servingGrams;

  const displayProductName =
    (typeof labelData?.product_name === "string" && labelData.product_name) ||
    product?.name ||
    undefined;
  const displayBranchName =
    labelData?.branch_info?.business_name || branchDisplayName;

  function openLabelPrintWindow(opts?: { suggestSaveAsPdf?: boolean }) {
    const node = document.getElementById("nutrition-studio-print-root");
    if (!node) {
      toast.error("No hay etiqueta para imprimir. Carga o edita los datos nutricionales.");
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
        @page { size: ${labelSize.widthMm}mm ${labelSize.heightMm}mm; margin: 0; }
        html, body { margin: 0; background: #fff; }
        body { display: grid; place-items: center; min-height: 100vh; font-family: system-ui, sans-serif; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
      </style></head><body>${node.innerHTML}</body></html>`,
    );
    win.document.close();
    win.focus();
    window.setTimeout(() => {
      win.print();
      if (opts?.suggestSaveAsPdf) {
        toast.success("En el diálogo elige «Guardar como PDF» si quieres el archivo");
      }
    }, 280);
  }

  async function handleDownload() {
    if (!product) return;
    if (!hasPreview || !previewValues) {
      toast.error("Este producto no tiene datos nutricionales. Edítalos primero.");
      return;
    }
    const filled = countFilledNutrients(previewValues);
    if (filled < 3) {
      toast.error(
        `Nutrición incompleta (${filled} valores). Edita el producto y completa kcal, proteínas, grasas, carbohidratos, etc. antes de descargar.`,
      );
      return;
    }
    // El PDF de Yggdra es un stub (~3 KB) que ignora modo/tamaño/porción.
    // Generamos el archivo desde la misma data de la vista previa.
    setBuildingPdf(true);
    try {
      const blob = await buildNutritionLabelPdfBlob({
        values: previewValues,
        mode: labelMode,
        portion: labelPortion,
        size: labelSize,
        servingGrams: effectiveServing,
        valuesAlreadyForPortion,
        productName: displayProductName,
        branchName: displayBranchName,
        extras: labelMode === "branded" ? labelExtras : undefined,
      });
      const filename = `etiqueta-nutricional_${product.name
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "")
        .toLowerCase()}_${labelMode}_${labelSize.id}_${labelPortion}.pdf`;
      downloadBlob(blob, filename);
      if (filled < 8) {
        toast.success(`PDF descargado · atención: solo ${filled} nutrientes con valor (completa el resto en Editar)`);
      } else {
        toast.success(
          labelMode === "branded"
            ? "PDF descargado · etiqueta con logo / datos de sucursal"
            : "PDF descargado · etiqueta simple",
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el PDF");
      openLabelPrintWindow({ suggestSaveAsPdf: true });
    } finally {
      setBuildingPdf(false);
    }
  }

  function handlePrintPreview() {
    if (!hasPreview) {
      toast.error("Sin datos nutricionales para imprimir.");
      return;
    }
    openLabelPrintWindow();
  }

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
                  : " · etiqueta desde datos del producto"}
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
                  <div className="space-y-2.5">
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-muted-foreground">Modo</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Chip active={labelMode === "simple"} onClick={() => setLabelMode("simple")}>
                          Etiqueta simple
                        </Chip>
                        <Chip active={labelMode === "branded"} onClick={() => setLabelMode("branded")}>
                          Con logo
                        </Chip>
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-muted-foreground">Tamaño</p>
                      <div className="flex flex-wrap gap-1.5">
                        {NUTRITION_LABEL_SIZES.map((sz) => (
                          <Chip
                            key={sz.id}
                            active={labelSizeId === sz.id}
                            onClick={() => setLabelSizeId(sz.id)}
                          >
                            {sz.label}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-muted-foreground">Porción</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip
                          active={labelPortion === "per_100g"}
                          onClick={() => setLabelPortion("per_100g")}
                        >
                          100 g
                        </Chip>
                        <Chip
                          active={labelPortion === "per_serving"}
                          onClick={() => setLabelPortion("per_serving")}
                        >
                          Porción
                        </Chip>
                        {labelPortion === "per_serving" && (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={
                                apiServing && apiServing > 0
                                  ? String(Math.round(apiServing * 100) / 100)
                                  : servingGramsInput
                              }
                              onChange={(e) => setServingGramsInput(e.target.value)}
                              disabled={Boolean(apiServing && apiServing > 0)}
                              className="h-7 w-20 rounded-full border-0 bg-background/70 text-xs ring-1 ring-border/40"
                              aria-label="Gramos por porción"
                            />
                            <span className="text-[11px] text-muted-foreground">g</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border/40 pt-2.5">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canExport}
                      isLoading={buildingPdf || downloadingNutritionPdf}
                      onClick={() => void handleDownload()}
                      title="PDF con el mismo contenido que la vista previa (modo, tamaño y porción)"
                    >
                      {!buildingPdf && !downloadingNutritionPdf && (
                        <FileDown className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Descargar PDF
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!hasPreview}
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

                  {!hasPreview && !loadingDetail && (
                    <p className="mt-2 text-[11px] text-warning">
                      Sin valores nutricionales. Usa «Editar datos» y completa kcal, proteínas,
                      grasas, carbohidratos, sodio, etc.
                    </p>
                  )}
                  {hasPreview && previewValues && countFilledNutrients(previewValues) < 8 && (
                    <p className="mt-2 text-[11px] text-warning">
                      Solo {countFilledNutrients(previewValues)} nutrientes con valor. La etiqueta
                      saldrá casi vacía hasta que completes la ficha del producto.
                    </p>
                  )}
                  {hasPreview && previewValues && countFilledNutrients(previewValues) >= 8 && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      PDF = vista previa · {labelMode === "branded" ? "con logo" : "simple"} ·{" "}
                      {labelSize.label} ·{" "}
                      {labelPortion === "per_serving" ? `porción ${effectiveServing} g` : "100 g"}
                    </p>
                  )}

                  {primaryRecipe && labelData?.compliance && (
                    <div className="mt-2 space-y-1 text-[11px]">
                      <p
                        className={cn(
                          "font-semibold",
                          labelData.compliance.is_compliant ? "text-success" : "text-warning",
                        )}
                      >
                        {labelData.compliance.is_compliant ? "Cumple MINSAL" : "Revisar MINSAL"}
                        {typeof labelData.compliance.compliance_score === "number"
                          ? ` · ${Math.round(labelData.compliance.compliance_score)}%`
                          : ""}
                      </p>
                      {Array.isArray(labelData.compliance.errors) &&
                        labelData.compliance.errors.slice(0, 2).map((e, i) => (
                          <p key={`e-${i}`} className="text-danger">
                            {e}
                          </p>
                        ))}
                      {Array.isArray(labelData.compliance.warnings) &&
                        labelData.compliance.warnings.slice(0, 1).map((w, i) => (
                          <p key={`w-${i}`} className="text-muted-foreground">
                            {w}
                          </p>
                        ))}
                    </div>
                  )}
                </div>

                {isCompound && !primaryRecipe && !recipesPending && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ChefHat className="h-3.5 w-3.5" />
                    Producto compuesto sin receta guardada.
                  </p>
                )}
              </div>

              <div className="mx-auto shrink-0 sm:mx-0">
                {hasPreview && previewValues ? (
                  <div id="nutrition-studio-print-root" className="origin-top scale-[0.92]">
                    <NutritionLabelPreview
                      mode={labelMode}
                      portion={labelPortion}
                      size={labelSize}
                      servingGrams={effectiveServing}
                      valuesAlreadyForPortion={valuesAlreadyForPortion}
                      productName={displayProductName}
                      branchName={displayBranchName}
                      logoUrl={labelMode === "branded" ? branchLogoUrl : null}
                      extras={labelMode === "branded" ? labelExtras : undefined}
                      values={previewValues}
                    />
                  </div>
                ) : (
                  <div className="grid h-40 w-40 place-items-center rounded-xl border border-dashed border-border text-center text-[11px] text-muted-foreground">
                    {calculate.isPending
                      ? "Calculando nutrición…"
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
