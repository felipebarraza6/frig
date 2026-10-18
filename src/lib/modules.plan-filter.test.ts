import { describe, expect, it } from "vitest";
import {
  FRIG_SETTINGS_MODULES,
  branchBypassesPlanModuleLimits,
  filterSettingsModulesForPlan,
  isModuleOfferedForActivation,
  normalizePlanModuleList,
} from "@/lib/modules";

describe("normalizePlanModuleList", () => {
  it("acepta strings y objetos {key|name|module_name}", () => {
    expect(normalizePlanModuleList(["pos", "iot_telemetry"])).toEqual([
      "pos",
      "iot_telemetry",
    ]);
    expect(
      normalizePlanModuleList([
        { key: "pos" },
        { name: "tables" },
        { module_name: "inventory" },
      ]),
    ).toEqual(["pos", "tables", "inventory"]);
  });

  it("devuelve null si no es lista", () => {
    expect(normalizePlanModuleList(undefined)).toBeNull();
    expect(normalizePlanModuleList({ pos: true })).toBeNull();
  });
});

describe("branchBypassesPlanModuleLimits", () => {
  it("detecta plan comercial demo y nombres con «demo»", () => {
    expect(
      branchBypassesPlanModuleLimits({
        commercial_plan: { plan_id: "demo", display_name: "Plan Demo" },
      }),
    ).toBe(true);
    expect(
      branchBypassesPlanModuleLimits({ plan_name: "Frig Demo Completo" }),
    ).toBe(true);
    expect(
      branchBypassesPlanModuleLimits({ login_slug: "mani-demo" }),
    ).toBe(true);
  });

  it("no bypassea sucursales de producción (p. ej. mani)", () => {
    expect(
      branchBypassesPlanModuleLimits({
        plan_name: "Gestión gastronómica/comercial",
        login_slug: "mani",
        commercial_plan: { plan_id: "local", display_name: "Plan Local" },
      }),
    ).toBe(false);
  });
});

describe("filterSettingsModulesForPlan", () => {
  const settings = FRIG_SETTINGS_MODULES;

  it("oculta módulos fuera del plan (p. ej. IoT en mani)", () => {
    const plan = new Set(["pos", "tables", "inventory", "invoices"]);
    const visible = filterSettingsModulesForPlan(settings, {
      planModules: plan,
      enabledModules: new Set(),
    });
    expect(visible).toContain("pos");
    expect(visible).toContain("tables");
    expect(visible).not.toContain("iot_telemetry");
    expect(visible).not.toContain("equipment");
  });

  it("mantiene legacy activos fuera del plan para poder apagarlos", () => {
    const plan = new Set(["pos"]);
    const visible = filterSettingsModulesForPlan(settings, {
      planModules: plan,
      enabledModules: new Set(["iot_telemetry", "pos"]),
    });
    expect(visible).toContain("pos");
    expect(visible).toContain("iot_telemetry");
    expect(visible).not.toContain("nutrition");
  });

  it("en demo / bypass muestra todos los de settings", () => {
    const visible = filterSettingsModulesForPlan(settings, {
      planModules: new Set(["pos"]),
      enabledModules: new Set(),
      bypassPlanLimits: true,
    });
    expect(visible).toEqual([...settings]);
  });

  it("sin dato de plan (null) no filtra aún", () => {
    const visible = filterSettingsModulesForPlan(settings, {
      planModules: null,
      enabledModules: new Set(),
    });
    expect(visible).toEqual([...settings]);
  });

  it("plan vacío (sin entitlements) solo deja legacy activos", () => {
    const visible = filterSettingsModulesForPlan(settings, {
      planModules: new Set(),
      enabledModules: new Set(["promotions"]),
    });
    expect(visible).toEqual(["promotions"]);
  });
});

describe("isModuleOfferedForActivation", () => {
  it("no ofrece activar IoT si no está en el plan y está apagado", () => {
    expect(
      isModuleOfferedForActivation("iot_telemetry", {
        planModules: new Set(["pos", "tables"]),
        enabledModules: new Set(),
      }),
    ).toBe(false);
  });

  it("sí ofrece activar si está en el plan o es legacy activo", () => {
    expect(
      isModuleOfferedForActivation("pos", {
        planModules: new Set(["pos"]),
      }),
    ).toBe(true);
    expect(
      isModuleOfferedForActivation("iot_telemetry", {
        planModules: new Set(["pos"]),
        enabledModules: new Set(["iot_telemetry"]),
      }),
    ).toBe(true);
  });

  it("demo bypassea el filtro", () => {
    expect(
      isModuleOfferedForActivation("iot_telemetry", {
        planModules: new Set(),
        bypassPlanLimits: true,
      }),
    ).toBe(true);
  });
});
