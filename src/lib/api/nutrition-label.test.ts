import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiFile = vi.fn();

vi.mock("./client", async () => {
  const actual = await vi.importActual<typeof import("./client")>("./client");
  return {
    ...actual,
    apiFile: (...args: unknown[]) => apiFile(...args),
  };
});

beforeEach(() => {
  apiFile.mockReset();
  window.localStorage.clear();
  window.localStorage.setItem("frig.token", "test-token");
  window.localStorage.setItem("frig.branch_id", "7");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("downloadRecipeNutritionLabelPdf", () => {
  it("GET download-nutrition-label-pdf con page_size=label|a4|letter", async () => {
    const blob = new Blob(["%PDF"], { type: "application/pdf" });
    apiFile.mockResolvedValueOnce({ blob, filename: "label.pdf" });

    const { downloadRecipeNutritionLabelPdf } = await import("./nutrition-label");
    const result = await downloadRecipeNutritionLabelPdf("rec-1", "a4");

    expect(result.filename).toBe("label.pdf");
    expect(apiFile).toHaveBeenCalledOnce();
    const [path] = apiFile.mock.calls[0]!;
    expect(path).toBe("/recipes/recipes/rec-1/download-nutrition-label-pdf/?page_size=a4");
  });

  it("usa page_size=label por defecto (rotuladora 62×100)", async () => {
    apiFile.mockResolvedValueOnce({ blob: new Blob(["x"]), filename: undefined });
    const { downloadRecipeNutritionLabelPdf } = await import("./nutrition-label");
    await downloadRecipeNutritionLabelPdf("rec-2");
    expect(apiFile.mock.calls[0]![0]).toBe(
      "/recipes/recipes/rec-2/download-nutrition-label-pdf/?page_size=label",
    );
  });
});

describe("previewRecipeNutritionLabel", () => {
  it("GET preview-nutrition-label con media=png|svg", async () => {
    apiFile.mockResolvedValueOnce({
      blob: new Blob(["png"], { type: "image/png" }),
      filename: "preview.png",
    });
    const { previewRecipeNutritionLabel } = await import("./nutrition-label");
    await previewRecipeNutritionLabel("rec-9", "svg");
    expect(apiFile.mock.calls[0]![0]).toBe(
      "/recipes/recipes/rec-9/preview-nutrition-label/?media=svg",
    );
  });
});

describe("409 nutrition_label_not_ready", () => {
  it("detecta el código y normaliza nutrition_missing_details", async () => {
    const { ApiError } = await import("./client");
    const {
      isNutritionLabelNotReady,
      nutritionMissingDetailsFromError,
      missingDetailLabel,
      missingDetailFields,
      missingDetailProductId,
      nutritionFieldLabel,
    } = await import("./nutrition-label");

    const err = new ApiError(409, "Etiqueta no lista", {
      code: "nutrition_label_not_ready",
      nutrition_missing_details: [
        {
          product_id: 42,
          product_name: "Leche entera",
          missing_fields: ["density_g_per_ml", "energy_kcal"],
        },
        {
          ingredient_id: 7,
          ingredient_name: "Huevo",
          fields: ["grams_per_unit"],
        },
      ],
    });

    expect(isNutritionLabelNotReady(err)).toBe(true);
    const rows = nutritionMissingDetailsFromError(err);
    expect(rows).toHaveLength(2);
    expect(missingDetailLabel(rows[0]!)).toBe("Leche entera");
    expect(missingDetailProductId(rows[0]!)).toBe(42);
    expect(missingDetailFields(rows[0]!)).toEqual([
      "density_g_per_ml",
      "energy_kcal",
    ]);
    expect(nutritionFieldLabel("density_g_per_ml")).toMatch(/Densidad/i);
    expect(missingDetailFields(rows[1]!)).toEqual(["grams_per_unit"]);
  });

  it("normaliza mapa product_id → campos", async () => {
    const { normalizeNutritionMissingDetails } = await import("./nutrition-label");
    const rows = normalizeNutritionMissingDetails({
      "15": ["density_g_per_ml"],
      "22": ["grams_per_unit", "sodium_mg"],
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.product_id).sort()).toEqual([15, 22]);
  });

  it("no marca 409 genéricos sin código de etiqueta", async () => {
    const { ApiError } = await import("./client");
    const { isNutritionLabelNotReady } = await import("./nutrition-label");
    expect(isNutritionLabelNotReady(new ApiError(409, "Otro conflicto", { code: "other" }))).toBe(
      false,
    );
    expect(isNutritionLabelNotReady(new ApiError(400, "Bad", { code: "nutrition_label_not_ready" }))).toBe(
      false,
    );
  });

  it("propaga ApiError 409 desde download (blob)", async () => {
    const { ApiError } = await import("./client");
    const { downloadRecipeNutritionLabelPdf, isNutritionLabelNotReady, nutritionMissingDetailsFromError } =
      await import("./nutrition-label");

    apiFile.mockRejectedValueOnce(
      new ApiError(409, "not ready", {
        code: "nutrition_label_not_ready",
        nutrition_missing_details: [
          { product_id: 3, product_name: "Aceite", missing_fields: ["density_g_per_ml"] },
        ],
      }),
    );

    await expect(downloadRecipeNutritionLabelPdf("rec-x", "letter")).rejects.toSatisfy(
      (err: unknown) =>
        isNutritionLabelNotReady(err) &&
        nutritionMissingDetailsFromError(err)[0]?.product_id === 3,
    );
  });
});
