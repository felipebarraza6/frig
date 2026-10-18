import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  apiFetch.mockResolvedValue({ id: 1, name: "QA Provider" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("telemetry providers CRUD", () => {
  it("POST crea proveedor", async () => {
    const { createTelemetryProvider } = await import("./iot");
    await createTelemetryProvider({
      name: "QA UI Provider",
      protocol: "HTTP_REST",
      handler_name: "generic_json",
      auth_type: "BEARER",
    });
    expect(apiFetch).toHaveBeenCalledWith("/iot-telemetry/providers/", {
      method: "POST",
      body: expect.objectContaining({ name: "QA UI Provider" }),
    });
  });

  it("PATCH actualiza proveedor", async () => {
    const { updateTelemetryProvider } = await import("./iot");
    await updateTelemetryProvider(42, {
      name: "QA Provider Edit",
      base_url: "https://example.test/v1",
    });
    expect(apiFetch).toHaveBeenCalledWith("/iot-telemetry/providers/42/", {
      method: "PATCH",
      body: expect.objectContaining({
        name: "QA Provider Edit",
        base_url: "https://example.test/v1",
      }),
    });
  });

  it("DELETE elimina proveedor", async () => {
    const { deleteTelemetryProvider } = await import("./iot");
    await deleteTelemetryProvider(42);
    expect(apiFetch).toHaveBeenCalledWith("/iot-telemetry/providers/42/", {
      method: "DELETE",
    });
  });
});
