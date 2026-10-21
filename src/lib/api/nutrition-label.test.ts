import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiFile = vi.fn();
const apiFetch = vi.fn();

vi.mock("./client", async () => {
  const actual = await vi.importActual<typeof import("./client")>("./client");
  return {
    ...actual,
    apiFile: (...args: unknown[]) => apiFile(...args),
    apiFetch: (...args: unknown[]) => apiFetch(...args),
  };
});

beforeEach(() => {
  apiFile.mockReset();
  apiFetch.mockReset();
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

describe("409 nutrition_incomplete", () => {
  it("detecta code nutrition_incomplete y missing_ingredients", async () => {
    const { ApiError } = await import("./client");
    const {
      isNutritionIncomplete,
      missingIngredientsFromError,
      missingDetailLabel,
      missingDetailFields,
      missingDetailProductId,
      nutritionFieldLabel,
      nutritionCalculateToastMessage,
    } = await import("./nutrition-label");

    const err = new ApiError(409, "Nutrición incompleta", {
      code: "nutrition_incomplete",
      missing_ingredients: [
        {
          product_id: 42,
          product_name: "Leche entera",
          missing_fields: ["density_g_per_ml", "energy_kcal"],
          unit: "ml",
        },
        {
          ingredient_id: 7,
          ingredient_name: "Huevo",
          fields: ["grams_per_unit"],
          unit: "unidad",
        },
      ],
    });

    expect(isNutritionIncomplete(err)).toBe(true);
    expect(nutritionCalculateToastMessage(err)).toBeNull();

    const alias = new ApiError(409, "incompleto", { nutrition_is_complete: false });
    expect(isNutritionIncomplete(alias)).toBe(true);
    expect(nutritionCalculateToastMessage(alias)).toBeNull();
    const rows = missingIngredientsFromError(err);
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

  it("no trata el código viejo nutrition_label_not_ready como incompleto sin missing_ingredients", async () => {
    const { ApiError } = await import("./client");
    const { isNutritionIncomplete } = await import("./nutrition-label");
    expect(
      isNutritionIncomplete(
        new ApiError(409, "old", { code: "nutrition_label_not_ready" }),
      ),
    ).toBe(false);
  });

  it("propaga ApiError 409 desde download (blob)", async () => {
    const { ApiError } = await import("./client");
    const {
      downloadRecipeNutritionLabelPdf,
      isNutritionIncomplete,
      missingIngredientsFromError,
    } = await import("./nutrition-label");

    apiFile.mockRejectedValueOnce(
      new ApiError(409, "not ready", {
        code: "nutrition_incomplete",
        missing_ingredients: [
          { product_id: 3, product_name: "Aceite", missing_fields: ["density_g_per_ml"] },
        ],
      }),
    );

    await expect(downloadRecipeNutritionLabelPdf("rec-x", "letter")).rejects.toSatisfy(
      (err: unknown) =>
        isNutritionIncomplete(err) &&
        missingIngredientsFromError(err)[0]?.product_id === 3,
    );
  });
});

describe("calculateRecipeNutrition", () => {
  it("POST calculate_nutrition tipado como CalculateNutritionResponse", async () => {
    apiFetch.mockResolvedValueOnce({
      id: "rec-calc",
      has_nutritional_calculation: true,
      nutrition_is_complete: true,
      calculated_energy_kcal: 120,
      calculated_proteins_g: 5,
    });
    const { calculateRecipeNutrition } = await import("./recipes");
    const result = await calculateRecipeNutrition("rec-calc");
    expect(result.calculated_energy_kcal).toBe(120);
    expect(result.nutrition_is_complete).toBe(true);
    expect(apiFetch).toHaveBeenCalledWith(
      "/recipes/recipes/rec-calc/calculate_nutrition/",
      expect.objectContaining({ method: "POST", body: {} }),
    );
  });
});
