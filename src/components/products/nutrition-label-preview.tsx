"use client";

import { cn } from "@/lib/utils";

export type NutritionLabelMode = "simple" | "branded";
export type NutritionLabelPortion = "per_100g" | "per_serving";

export interface NutritionLabelSize {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
}

export const NUTRITION_LABEL_SIZES: NutritionLabelSize[] = [
  { id: "62x100", label: "62 × 100 mm", widthMm: 62, heightMm: 100 },
  { id: "50x80", label: "50 × 80 mm", widthMm: 50, heightMm: 80 },
  { id: "80x120", label: "80 × 120 mm", widthMm: 80, heightMm: 120 },
];

export interface NutritionValues {
  energyKcal: string;
  proteinsG: string;
  totalFatsG: string;
  saturatedFatsG: string;
  monounsaturatedFatsG: string;
  polyunsaturatedFatsG: string;
  transFatsG: string;
  cholesterolMg: string;
  carbohydratesG: string;
  totalSugarsG: string;
  sodiumMg: string;
}

/** Extra del endpoint `nutrition_label` (receta) para etiqueta completa. */
export interface NutritionLabelExtras {
  ingredientsText?: string | null;
  allergenWarning?: string | null;
  branchText?: string | null;
}

interface NutritionLabelPreviewProps {
  values: NutritionValues;
  mode?: NutritionLabelMode;
  portion?: NutritionLabelPortion;
  size?: NutritionLabelSize;
  productName?: string;
  branchName?: string;
  logoUrl?: string | null;
  servingGrams?: number;
  /** Si true, `values` ya vienen para la porción elegida (no re-escalar desde 100 g). */
  valuesAlreadyForPortion?: boolean;
  extras?: NutritionLabelExtras;
  className?: string;
  /** Oculta el caption “Vista previa · …” (p.ej. en impresión). */
  hideCaption?: boolean;
}

function fmt(value: string): string {
  if (!value || value === "0" || value === "0.0" || value === "0.00") return "0";
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  if (Number.isInteger(num)) return String(num);
  return (Math.round(num * 10) / 10).toFixed(1);
}

/** Escala valores de 100 g a una porción en gramos. */
export function scaleNutritionValues(
  values: NutritionValues,
  servingGrams: number,
): NutritionValues {
  const factor = servingGrams / 100;
  const scale = (raw: string) => {
    const n = Number(raw);
    if (!raw || Number.isNaN(n)) return raw || "0";
    const out = n * factor;
    return out % 1 === 0 ? String(out) : out.toFixed(2);
  };
  return {
    energyKcal: scale(values.energyKcal),
    proteinsG: scale(values.proteinsG),
    totalFatsG: scale(values.totalFatsG),
    saturatedFatsG: scale(values.saturatedFatsG),
    monounsaturatedFatsG: scale(values.monounsaturatedFatsG),
    polyunsaturatedFatsG: scale(values.polyunsaturatedFatsG),
    transFatsG: scale(values.transFatsG),
    cholesterolMg: scale(values.cholesterolMg),
    carbohydratesG: scale(values.carbohydratesG),
    totalSugarsG: scale(values.totalSugarsG),
    sodiumMg: scale(values.sodiumMg),
  };
}

export function NutritionLabelPreview({
  values,
  mode = "simple",
  portion = "per_100g",
  size = NUTRITION_LABEL_SIZES[0],
  productName,
  branchName,
  logoUrl,
  servingGrams = 100,
  valuesAlreadyForPortion = false,
  extras,
  className,
  hideCaption = false,
}: NutritionLabelPreviewProps) {
  const hasAny = Object.values(values).some((v) => {
    const n = Number(v);
    return v !== "" && !Number.isNaN(n) && n !== 0;
  });
  if (!hasAny) return null;

  const display =
    !valuesAlreadyForPortion &&
    portion === "per_serving" &&
    servingGrams > 0 &&
    servingGrams !== 100
      ? scaleNutritionValues(values, servingGrams)
      : values;

  const portionGramsLabel =
    servingGrams % 1 === 0 ? String(servingGrams) : (Math.round(servingGrams * 10) / 10).toFixed(1);
  const portionLabel =
    portion === "per_serving"
      ? `Por porción de ${portionGramsLabel} g`
      : "Por porción de 100 g";

  // Preview ~3.2 px/mm for on-screen readability (not 1:1 print).
  const previewW = Math.round(size.widthMm * 3.2);
  const compact = size.widthMm <= 50;
  const textSize = compact ? "text-[9px]" : "text-[10px]";
  const rowSize = compact ? "text-[9px]" : "text-[11px]";

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {!hideCaption && (
        <p className="text-[11px] text-muted-foreground">
          Vista previa · {size.label}
          {mode === "branded" ? " · con logo" : " · simple"}
        </p>
      )}
      <div
        className={cn(
          "overflow-hidden bg-white text-black shadow-md ring-1 ring-black/10",
          mode === "branded" ? "rounded-md" : "rounded-sm border-2 border-black",
        )}
        style={{ width: previewW }}
      >
        {/* Modo con logo: cabecera de sucursal */}
        {mode === "branded" && (
          <div className="flex items-center gap-2 border-b border-black/15 bg-neutral-50 px-2.5 py-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={branchName || "Logo"}
                className="h-7 w-7 rounded object-contain"
              />
            ) : (
              <div className="grid h-7 w-7 place-items-center rounded bg-black/5 text-[10px] font-bold uppercase text-black/50">
                {(branchName || productName || "F").trim().charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold leading-tight">
                {branchName || "Sucursal"}
              </p>
              {productName ? (
                <p className="truncate text-[10px] text-black/60">{productName}</p>
              ) : null}
            </div>
          </div>
        )}

        <div className={cn("px-2.5 pt-2.5", mode === "simple" ? "pb-2.5" : "pb-1.5")}>
          {mode === "simple" && productName ? (
            <p className="mb-1 truncate text-[10px] font-semibold text-black/70">{productName}</p>
          ) : null}
          <h4
            className={cn(
              "font-black uppercase leading-none border-black",
              compact ? "border-b-2 pb-0.5 text-sm" : "border-b-4 pb-1 text-base",
            )}
          >
            Información nutricional
          </h4>
          <p className="mt-1 text-[10px] text-black/55">{portionLabel}</p>

          <div className={cn("mt-2 space-y-0.5", rowSize)}>
            <Row label="Energía" value={`${fmt(display.energyKcal)} kcal`} bold />
            <Row label="Proteínas" value={`${fmt(display.proteinsG)} g`} bold />
            <Row label="Grasas totales" value={`${fmt(display.totalFatsG)} g`} bold />
            <Row label="Grasas saturadas" value={`${fmt(display.saturatedFatsG)} g`} indent />
            <Row label="Grasas monoinsaturadas" value={`${fmt(display.monounsaturatedFatsG)} g`} indent />
            <Row label="Grasas poliinsaturadas" value={`${fmt(display.polyunsaturatedFatsG)} g`} indent />
            <Row label="Grasas trans" value={`${fmt(display.transFatsG)} g`} indent />
            <Row label="Colesterol" value={`${fmt(display.cholesterolMg)} mg`} bold />
            <Row label="Carbohidratos" value={`${fmt(display.carbohydratesG)} g`} bold />
            <Row label="Azúcares totales" value={`${fmt(display.totalSugarsG)} g`} indent />
            <Row label="Sodio" value={`${fmt(display.sodiumMg)} mg`} bold thick />
          </div>
        </div>

        {/* Modo con logo: pie con ingredientes, alérgenos y sucursal (datos del API) */}
        {mode === "branded" && (
          <div className={cn("space-y-1.5 border-t border-black/15 bg-neutral-50/80 px-2.5 py-2", textSize)}>
            {extras?.ingredientsText ? (
              <p className="leading-snug text-black/75">
                <span className="font-bold text-black">Ingredientes: </span>
                {extras.ingredientsText}
              </p>
            ) : null}
            {extras?.allergenWarning ? (
              <p className="leading-snug text-black/75">
                <span className="font-bold text-black">Alérgenos: </span>
                {extras.allergenWarning}
              </p>
            ) : null}
            {extras?.branchText ? (
              <p className="leading-snug text-black/55">{extras.branchText}</p>
            ) : branchName ? (
              <p className="leading-snug text-black/55">{branchName}</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  indent,
  thick,
}: {
  label: string;
  value: string;
  bold?: boolean;
  indent?: boolean;
  thick?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-2 py-0.5",
        thick ? "border-b-2 border-black" : "border-b border-black/20",
        indent && "pl-2",
      )}
    >
      <span className={cn(bold && "font-semibold")}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
