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

describe("drivers api", () => {
  it("lista repartidores disponibles sin branch_id en query (usa X-Branch-ID)", async () => {
    apiFetch.mockResolvedValueOnce({
      branch_id: 15,
      available_drivers: [
        { id: 1, user_id: 9, name: "Lina Ruta", is_available: true, estimated_fee: 1200 },
      ],
    });
    const { fetchAvailableDrivers } = await import("./drivers");
    const drivers = await fetchAvailableDrivers();
    expect(drivers).toHaveLength(1);
    expect(drivers[0]!.user_id).toBe(9);
    expect(apiFetch.mock.calls[0]![0]).toBe("/logistics/delivery-pricing/available-drivers/");
  });

  it("asigna repartidor a la orden", async () => {
    apiFetch.mockResolvedValueOnce({
      id: "ord-1",
      delivery_cost: "2500.00",
      driver_fee: "1200.00",
      total_amount: "3000.00",
      delivered_by_id: 9,
    });
    const { assignOrderDriver } = await import("./drivers");
    const order = (await assignOrderDriver("ord-1", { driver_user_id: 9 })) as {
      driver_fee?: string;
      delivery_cost?: string;
    };
    expect(order.driver_fee).toBe("1200.00");
    expect(order.delivery_cost).toBe("2500.00");
    expect(apiFetch.mock.calls[0]).toEqual([
      "/sales/orders/ord-1/assign-driver/",
      { method: "POST", body: { driver_user_id: 9 } },
    ]);
  });
});
