import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();

vi.mock("./client", async () => {
  const actual = await vi.importActual<typeof import("./client")>("./client");
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => apiFetch(...args),
  };
});

beforeEach(() => {
  apiFetch.mockReset();
});

describe("alertas IoT", () => {
  it("las reglas traen el umbral desde el detalle", async () => {
    apiFetch.mockImplementation(async (path: string) =>
      path.includes("?device=")
        ? { results: [{ id: 5 }, { id: 6 }] }
        : { id: Number(path.match(/(\d+)\/$/)?.[1]), threshold_value: 8 },
    );
    const { fetchAlertRules } = await import("./iot");
    const rules = await fetchAlertRules("7");
    expect(apiFetch).toHaveBeenCalledWith("/iot-telemetry/alert-rules/?device=7&page_size=50");
    expect(apiFetch).toHaveBeenCalledWith("/iot-telemetry/alert-rules/5/");
    expect(rules.map((r) => [r.id, r.threshold_value])).toEqual([
      [5, 8],
      [6, 8],
    ]);
  });

  it("crea la regla activa con device y variable numéricos", async () => {
    apiFetch.mockResolvedValue({ id: 1 });
    const { createAlertRule } = await import("./iot");
    await createAlertRule({
      name: "Temperatura sobre 8 °C",
      device: 7,
      variable: 3,
      target_type: "THRESHOLD_MAX",
      threshold_value: 8,
      severity: "ALERT",
    });
    expect(apiFetch).toHaveBeenCalledWith("/iot-telemetry/alert-rules/", {
      method: "POST",
      body: expect.objectContaining({ device: 7, variable: 3, threshold_value: 8, is_active: true }),
    });
  });

  it("lista alertas activas más recientes primero", async () => {
    apiFetch.mockResolvedValue({ results: [] });
    const { fetchAlertTriggers } = await import("./iot");
    await fetchAlertTriggers({ device: "7", is_acknowledged: false });
    expect(apiFetch).toHaveBeenCalledWith(
      "/iot-telemetry/alert-triggers/?ordering=-triggered_at&device=7&is_acknowledged=false&page_size=50",
    );
  });

  it("marcar revisada hace POST a acknowledge", async () => {
    apiFetch.mockResolvedValue({ id: 9, is_acknowledged: true });
    const { acknowledgeAlertTrigger } = await import("./iot");
    await acknowledgeAlertTrigger(9);
    expect(apiFetch).toHaveBeenCalledWith("/iot-telemetry/alert-triggers/9/acknowledge/", {
      method: "POST",
      body: {},
    });
  });
});
