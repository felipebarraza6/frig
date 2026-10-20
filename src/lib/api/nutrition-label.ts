/**
 * Etiqueta nutricional oficial del backend (Yggdra).
 *
 * Endpoints (app recipes, ViewSet recipes):
 * - GET /recipes/recipes/{id}/download-nutrition-label-pdf/?page_size=label|a4|letter
 * - GET /recipes/recipes/{id}/preview-nutrition-label/?media=png|svg
 *
 * 409 `nutrition_incomplete` (IncompleteNutritionError / assert_label_ready)
 * incluye `missing_ingredients` con insumos/campos faltantes.
 */

import { apiFile, ApiError, type ApiFileResult } from "./client";

/** Tamaños de página del PDF oficial (label = rotuladora 62×100 mm). */
export type NutritionLabelPageSize = "label" | "a4" | "letter";

export type NutritionLabelPreviewMedia = "png" | "svg";

export const NUTRITION_LABEL_PAGE_SIZES: {
  id: NutritionLabelPageSize;
  label: string;
  hint: string;
}[] = [
  { id: "label", label: "Etiqueta 62×100", hint: "Rotuladora térmica" },
  { id: "a4", label: "A4", hint: "Hoja A4" },
  { id: "letter", label: "Letter", hint: "Carta US" },
];

/** Fila de `missing_ingredients` (IncompleteNutritionError). */
export type NutritionMissingDetail = {
  product_id?: number | null;
  ingredient_id?: number | null;
  product_name?: string | null;
  ingredient_name?: string | null;
  name?: string | null;
  missing_fields?: string[];
  fields?: string[];
  reason?: string | null;
  detail?: string | null;
  unit?: string | null;
  message?: string | null;
};

export const NUTRITION_INCOMPLETE = "nutrition_incomplete" as const;

export type NutritionIncompletePayload = {
  code: typeof NUTRITION_INCOMPLETE;
  detail?: unknown;
  missing_ingredients?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        for (const key of ["field", "name", "code", "key"]) {
          if (typeof rec[key] === "string") return rec[key] as string;
        }
      }
      return null;
    })
    .filter((v): v is string => Boolean(v));
}

function coerceMissingDetail(raw: unknown): NutritionMissingDetail | null {
  const rec = asRecord(raw);
  if (!rec) {
    if (typeof raw === "string" && raw.trim()) {
      return { message: raw.trim() };
    }
    return null;
  }

  const productId =
    typeof rec.product_id === "number"
      ? rec.product_id
      : typeof rec.product === "number"
        ? rec.product
        : typeof rec.ingredient === "number"
          ? rec.ingredient
          : null;
  const ingredientId =
    typeof rec.ingredient_id === "number"
      ? rec.ingredient_id
      : typeof rec.ingredient === "number"
        ? rec.ingredient
        : null;

  return {
    product_id: productId,
    ingredient_id: ingredientId,
    product_name:
      (typeof rec.product_name === "string" && rec.product_name) ||
      (typeof rec.ingredient_name === "string" && rec.ingredient_name) ||
      (typeof rec.name === "string" && rec.name) ||
      null,
    ingredient_name:
      (typeof rec.ingredient_name === "string" && rec.ingredient_name) || null,
    name: typeof rec.name === "string" ? rec.name : null,
    missing_fields: asStringList(
      rec.missing_fields ?? rec.fields ?? rec.missing ?? rec.reasons,
    ),
    fields: asStringList(rec.fields),
    reason:
      (typeof rec.reason === "string" && rec.reason) ||
      (typeof rec.detail === "string" && rec.detail) ||
      (typeof rec.message === "string" && rec.message) ||
      null,
    detail: typeof rec.detail === "string" ? rec.detail : null,
    unit: typeof rec.unit === "string" ? rec.unit : null,
    message: typeof rec.message === "string" ? rec.message : null,
  };
}

/** Normaliza `missing_ingredients` (lista u objeto) a filas UI. */
export function normalizeMissingIngredients(raw: unknown): NutritionMissingDetail[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map(coerceMissingDetail).filter((d): d is NutritionMissingDetail => d != null);
  }
  const rec = asRecord(raw);
  if (!rec) return [];

  if ("missing_ingredients" in rec) {
    return normalizeMissingIngredients(rec.missing_ingredients);
  }

  const nested: NutritionMissingDetail[] = [];
  for (const key of ["ingredients", "products", "items", "details", "missing"]) {
    if (key in rec) nested.push(...normalizeMissingIngredients(rec[key]));
  }
  if (nested.length > 0) return nested;

  const fromMap: NutritionMissingDetail[] = [];
  for (const [key, value] of Object.entries(rec)) {
    if (Array.isArray(value) || typeof value === "string") {
      const id = Number(key);
      fromMap.push({
        product_id: Number.isFinite(id) ? id : null,
        product_name: Number.isFinite(id) ? null : key,
        missing_fields: asStringList(Array.isArray(value) ? value : [value]),
      });
    } else {
      const row = coerceMissingDetail(value);
      if (row) {
        if (row.product_id == null && Number.isFinite(Number(key))) {
          row.product_id = Number(key);
        }
        fromMap.push(row);
      }
    }
  }
  return fromMap;
}

/** @deprecated Usar `normalizeMissingIngredients`. */
export const normalizeNutritionMissingDetails = normalizeMissingIngredients;

function incompletePayloadFrom(err: unknown): Record<string, unknown> | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const detail = asRecord(err.detail);
  if (!detail) return null;
  if (detail.code === NUTRITION_INCOMPLETE || "missing_ingredients" in detail) {
    return detail;
  }
  const nested = asRecord(detail.detail);
  if (nested && (nested.code === NUTRITION_INCOMPLETE || "missing_ingredients" in nested)) {
    return nested;
  }
  return null;
}

export function isNutritionIncomplete(err: unknown): err is ApiError {
  return incompletePayloadFrom(err) != null;
}

/** Mensaje de toast para calcular nutrición. Null = solo aviso inline. */
export function nutritionCalculateToastMessage(err: unknown): string | null {
  if (isNutritionIncomplete(err)) return null;
  if (err instanceof Error && err.message) return err.message;
  return "No se pudo calcular la nutrición";
}

/** @deprecated Usar `isNutritionIncomplete`. */
export const isNutritionLabelNotReady = isNutritionIncomplete;

export function missingIngredientsFromError(err: unknown): NutritionMissingDetail[] {
  const payload = incompletePayloadFrom(err);
  if (!payload) return [];
  return normalizeMissingIngredients(payload.missing_ingredients);
}

/** @deprecated Usar `missingIngredientsFromError`. */
export const nutritionMissingDetailsFromError = missingIngredientsFromError;

export function missingDetailLabel(row: NutritionMissingDetail): string {
  return (
    row.product_name ||
    row.ingredient_name ||
    row.name ||
    (row.product_id != null ? `Producto #${row.product_id}` : null) ||
    (row.ingredient_id != null ? `Insumo #${row.ingredient_id}` : null) ||
    "Ingrediente"
  );
}

export function missingDetailFields(row: NutritionMissingDetail): string[] {
  const fields = row.missing_fields?.length
    ? row.missing_fields
    : row.fields?.length
      ? row.fields
      : [];
  return fields;
}

export function missingDetailProductId(row: NutritionMissingDetail): number | null {
  const id = row.product_id ?? row.ingredient_id;
  return id != null && Number.isFinite(id) && id > 0 ? id : null;
}

/** Etiquetas amigables para campos técnicos del backend. */
export function nutritionFieldLabel(field: string): string {
  const map: Record<string, string> = {
    density_g_per_ml: "Densidad (g/ml)",
    grams_per_unit: "Gramos por unidad",
    energy_kcal: "Energía (kcal)",
    proteins_g: "Proteínas (g)",
    total_fats_g: "Grasas totales (g)",
    saturated_fats_g: "Grasas saturadas (g)",
    carbohydrates_g: "Carbohidratos (g)",
    total_sugars_g: "Azúcares (g)",
    sodium_mg: "Sodio (mg)",
    is_nutritional_ingredient: "Información nutricional",
    measurement_unit: "Unidad de medida",
    unit: "Unidad de medida",
  };
  return map[field] ?? field.replace(/_/g, " ");
}

export function downloadRecipeNutritionLabelPdf(
  id: string,
  pageSize: NutritionLabelPageSize = "label",
): Promise<ApiFileResult> {
  const qs = new URLSearchParams({ page_size: pageSize });
  return apiFile(`/recipes/recipes/${id}/download-nutrition-label-pdf/?${qs.toString()}`);
}

export function previewRecipeNutritionLabel(
  id: string,
  media: NutritionLabelPreviewMedia = "png",
): Promise<ApiFileResult> {
  const qs = new URLSearchParams({ media });
  return apiFile(`/recipes/recipes/${id}/preview-nutrition-label/?${qs.toString()}`);
}

/** Campos de completitud en Recipe (yggdra main). */
export type RecipeNutritionCompleteness = {
  nutrition_is_complete?: boolean;
  missing_ingredients?: unknown;
};

/**
 * Respuesta de `POST /recipes/recipes/{id}/calculate_nutrition/`.
 * El schema expone los valores calculados (prefijo `calculated_*`) y flags de completitud.
 */
export type CalculateNutritionResponse = {
  id?: string;
  has_nutritional_calculation?: boolean;
  nutrition_is_complete?: boolean;
  missing_ingredients?: unknown;
  calculated_energy_kcal?: number | null;
  calculated_proteins_g?: number | null;
  calculated_total_fats_g?: number | null;
  calculated_saturated_fats_g?: number | null;
  calculated_monounsaturated_fats_g?: number | null;
  calculated_polyunsaturated_fats_g?: number | null;
  calculated_trans_fats_g?: number | null;
  calculated_cholesterol_mg?: number | null;
  calculated_carbohydrates_g?: number | null;
  calculated_total_sugars_g?: number | null;
  calculated_sodium_mg?: number | null;
  last_nutritional_calculation?: string | null;
};

export const NUTRITION_LABEL_NOT_READY = NUTRITION_INCOMPLETE;
