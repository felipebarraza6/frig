import { describe, expect, it } from "vitest";
import {
  normalizeRecipeUnit,
  isVolumeUnit,
  isCountUnit,
  isRecipeNutritionUnit,
  DEFAULT_RECIPE_UNIT,
} from "./recipe-units";

describe("recipe units (NutritionCalculator)", () => {
  it("acepta el enum estricto del backend", () => {
    for (const u of ["g", "kg", "mg", "ml", "l", "litro", "litros", "cc", "unidad"]) {
      expect(isRecipeNutritionUnit(u)).toBe(true);
    }
  });

  it("rechaza UN / porcion / texto libre", () => {
    expect(isRecipeNutritionUnit("UN")).toBe(false);
    expect(isRecipeNutritionUnit("porcion")).toBe(false);
    expect(isRecipeNutritionUnit("docena")).toBe(false);
  });

  it("normaliza aliases legacy a unidades válidas", () => {
    expect(normalizeRecipeUnit("UN")).toBe("unidad");
    expect(normalizeRecipeUnit("un")).toBe("unidad");
    expect(normalizeRecipeUnit("gramos")).toBe("g");
    expect(normalizeRecipeUnit("mL")).toBe("ml");
    expect(normalizeRecipeUnit("porcion")).toBeNull();
  });

  it("detecta volumen vs unidad de conteo", () => {
    expect(isVolumeUnit("ml")).toBe(true);
    expect(isVolumeUnit("litro")).toBe(true);
    expect(isCountUnit("unidad")).toBe(true);
    expect(isCountUnit("g")).toBe(false);
    expect(DEFAULT_RECIPE_UNIT).toBe("g");
  });
});
