import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = "ApiError";
    }
  },
}));

import { apiFetch } from "./client";

const mockedFetch = vi.mocked(apiFetch);

describe("createInventoryMovement", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it("ADJUSTMENT se envía tal cual (stock absoluto), no remapeado a OUT", async () => {
    mockedFetch.mockResolvedValueOnce({ id: 1 });
    const { createInventoryMovement } = await import("./inventory");
    await createInventoryMovement({
      product: 10,
      movement_type: "ADJUSTMENT",
      quantity: 5,
      notes: "conteo",
    } as never);
    const [path, opts] = mockedFetch.mock.calls[0]!;
    expect(path).toBe("/inventory/inventory-history/create_movement/");
    expect(opts?.method).toBe("POST");
    expect(opts?.body).toMatchObject({
      product_id: 10,
      movement_type: "ADJUSTMENT",
      quantity: 5,
      notes: "conteo",
    });
  });

  it("LOSS se remapea a OUT con cantidad negativa (workaround backend)", async () => {
    mockedFetch.mockResolvedValueOnce({ id: 2 });
    const { createInventoryMovement } = await import("./inventory");
    await createInventoryMovement({
      product: 11,
      movement_type: "LOSS",
      quantity: 3,
      notes: "rotura",
    } as never);
    const [, opts] = mockedFetch.mock.calls[0]!;
    expect(opts?.body).toMatchObject({
      product_id: 11,
      movement_type: "OUT",
      quantity: -3,
    });
    expect(String((opts?.body as { notes?: string }).notes)).toContain("Merma");
  });
});
