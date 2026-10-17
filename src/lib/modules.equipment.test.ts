/**
 * Gate de módulo Equipos (mismo patrón que IoT): oculto si is_enabled !== true.
 */
import { describe, expect, it } from "vitest";
import {
  FRIG_SETTINGS_MODULES,
  ROUTE_MODULE_MAP,
  getModuleForPath,
  isModuleEnabled,
} from "@/lib/modules";
import { isPathModuleEnabled } from "@/lib/hooks/useRouteModuleAccess";

describe("módulos: equipment e iot_telemetry", () => {
  it("equipment está en settings y mapea rutas de equipos/informe", () => {
    expect(FRIG_SETTINGS_MODULES).toContain("equipment");
    expect(FRIG_SETTINGS_MODULES).toContain("iot_telemetry");
    expect(ROUTE_MODULE_MAP["/equipment"]).toBe("equipment");
    expect(ROUTE_MODULE_MAP["/reports/equipment"]).toBe("equipment");
    expect(ROUTE_MODULE_MAP["/iot"]).toBe("iot_telemetry");
    expect(getModuleForPath("/equipment")).toBe("equipment");
    expect(getModuleForPath("/reports/equipment")).toBe("equipment");
  });

  it("ruta /equipment se oculta si el módulo está desactivado", () => {
    const off = { equipment: { is_enabled: false } };
    const on = { equipment: { is_enabled: true } };
    expect(isPathModuleEnabled("/equipment", off)).toBe(false);
    expect(isPathModuleEnabled("/reports/equipment", off)).toBe(false);
    expect(isPathModuleEnabled("/equipment", on)).toBe(true);
    expect(isModuleEnabled("equipment", new Set(["equipment"]))).toBe(true);
    expect(isModuleEnabled("equipment", new Set())).toBe(false);
  });

  it("IoT sigue gated por iot_telemetry", () => {
    expect(isPathModuleEnabled("/iot", { iot_telemetry: { is_enabled: false } })).toBe(false);
    expect(isPathModuleEnabled("/iot", { iot_telemetry: { is_enabled: true } })).toBe(true);
  });

  it("finance y banks están en el mapa de rutas (ya no huérfanas de módulo)", () => {
    expect(getModuleForPath("/finance")).toBe("finance");
    expect(getModuleForPath("/banks")).toBe("bank_accounts");
    // finance / bank_accounts son always-on en Frig → path permitido aunque falte fila
    expect(isPathModuleEnabled("/finance", {})).toBe(true);
    expect(isPathModuleEnabled("/banks", {})).toBe(true);
  });
});
