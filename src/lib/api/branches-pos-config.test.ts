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

describe("ensureBranchPosConfig", () => {
  it("reusa el primer resultado del listado", async () => {
    apiFetch.mockResolvedValueOnce({
      results: [{ id: 9, default_delivery_fee: "1500.00" }],
    });
    const { ensureBranchPosConfig } = await import("./branches");
    const cfg = await ensureBranchPosConfig();
    expect(cfg.id).toBe(9);
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch.mock.calls[0]![0]).toBe("/branches/pos-config/");
  });

  it("POST /branches/pos-config/ si el listado viene vacío", async () => {
    apiFetch.mockResolvedValueOnce({ results: [] });
    apiFetch.mockResolvedValueOnce({ id: 12, default_delivery_fee: "0.00" });
    const { ensureBranchPosConfig } = await import("./branches");
    const cfg = await ensureBranchPosConfig();
    expect(cfg.id).toBe(12);
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(apiFetch.mock.calls[1]).toEqual([
      "/branches/pos-config/",
      { method: "POST", body: {} },
    ]);
  });
});
