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

  it("no ofrece Herramienta/Equipo si el backend no los habilita (aunque inventario esté activo)", () => {
    const options = resolveProductTypeOptions({
      enabledTypes: ["DIRECT_SALE", "RECIPE_BASED", "RAW_MATERIAL", "MEASUREMENT_MATERIAL"],
      isDemo: false,
      equipmentOn: true,
      iotOn: false,
    });
    const values = options.map((o) => o.value);
    expect(values).not.toContain("TOOL");
    expect(values).not.toContain("EQUIPMENT");
    expect(values).toContain("RAW_MATERIAL");
  });

  it("ofrece Herramienta/Equipo cuando el backend los habilita y el módulo está activo", () => {
    const options = resolveProductTypeOptions({
      enabledTypes: ["DIRECT_SALE", "TOOL", "EQUIPMENT"],
      isDemo: false,
      equipmentOn: true,
      iotOn: false,
    });
    expect(options.map((o) => o.value)).toEqual(
      expect.arrayContaining(["TOOL", "EQUIPMENT"]),
    );
  });
});
