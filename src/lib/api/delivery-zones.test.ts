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
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("delivery-zones api", () => {
  it("lista zonas activas", async () => {
    apiFetch.mockResolvedValueOnce({
      results: [{ id: 1, name: "Las Condes", price: "2500.00", is_active: true }],
    });
    const { fetchDeliveryZones } = await import("./delivery-zones");
    const zones = await fetchDeliveryZones({ isActive: true });
    expect(zones).toHaveLength(1);
    expect(zones[0]!.name).toBe("Las Condes");
    expect(apiFetch.mock.calls[0]![0]).toBe("/branches/delivery-zones/?is_active=true");
  });

  it("crea una zona", async () => {
    apiFetch.mockResolvedValueOnce({
      id: 2,
      name: "Providencia",
      price: "1800.00",
      is_active: true,
    });
    const { createDeliveryZone } = await import("./delivery-zones");
    const zone = await createDeliveryZone({ name: "Providencia", price: "1800" });
    expect(zone.id).toBe(2);
    expect(apiFetch.mock.calls[0]).toEqual([
      "/branches/delivery-zones/",
      { method: "POST", body: { name: "Providencia", price: "1800" } },
    ]);
  });
});
