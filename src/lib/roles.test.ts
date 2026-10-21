import { describe, expect, it } from "vitest";
import { formDriverRoleCode, frigRoleOptions, getRoleLabel, isDriverRole } from "./roles";

describe("roles repartidor", () => {
  it("etiqueta DRIVER como Repartidor", () => {
    expect(getRoleLabel("DRIVER")).toBe("Repartidor");
    expect(getRoleLabel("REPARTIDOR")).toBe("Repartidor");
    expect(isDriverRole("DRIVER")).toBe(true);
    expect(formDriverRoleCode("DRIVER")).toBe("REPARTIDOR");
  });

  it("ofrece Repartidor cuando existe el rol DRIVER de sucursal", () => {
    const options = frigRoleOptions(
      [{ id: 7, code: "DRIVER", name: "Conductor" }],
      ["deliveries"],
    );
    expect(options.some((o) => o.label === "Repartidor" && o.code === "REPARTIDOR")).toBe(true);
  });
});
