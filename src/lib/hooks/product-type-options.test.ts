import { describe, expect, it } from "vitest";
import { resolveProductTypeOptions } from "@/lib/hooks/product-type-options";

describe("resolveProductTypeOptions", () => {
  it("oculta Materia prima si la sucursal no la tiene habilitada", () => {
    const options = resolveProductTypeOptions({
      enabledTypes: ["DIRECT_SALE", "RECIPE_BASED", "TOOL", "EQUIPMENT"],
      isDemo: false,
      equipmentOn: false,
      iotOn: false,
    });
    expect(options.map((o) => o.value)).toEqual(["DIRECT_SALE", "RECIPE_BASED"]);
  });

  it("muestra Materia prima cuando está habilitada", () => {
    const options = resolveProductTypeOptions({
      enabledTypes: ["DIRECT_SALE", "RECIPE_BASED", "RAW_MATERIAL"],
      isDemo: false,
      equipmentOn: false,
      iotOn: false,
    });
    expect(options.map((o) => o.value)).toContain("RAW_MATERIAL");
  });

  it("sucursales demo ven los tres tipos gastronómicos aunque el API no traiga RAW", () => {
    const options = resolveProductTypeOptions({
      enabledTypes: ["DIRECT_SALE"],
      isDemo: true,
      equipmentOn: false,
      iotOn: false,
    });
    expect(options.map((o) => o.value)).toEqual([
      "DIRECT_SALE",
      "RECIPE_BASED",
      "RAW_MATERIAL",
    ]);
  });

  it("sin config (lista vacía) no inventa Materia prima", () => {
    const options = resolveProductTypeOptions({
      enabledTypes: [],
      isDemo: false,
      equipmentOn: false,
      iotOn: false,
    });
    expect(options.map((o) => o.value)).toEqual(["DIRECT_SALE", "RECIPE_BASED"]);
  });
});
