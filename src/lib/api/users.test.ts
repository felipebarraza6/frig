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

describe("users api", () => {
  it("desactiva con PATCH is_active false", async () => {
    apiFetch.mockResolvedValueOnce({ id: 246, is_active: false, email: "inv@test.com" });
    const { updateUser } = await import("./users");
    const user = await updateUser(246, { is_active: false });
    expect(user.is_active).toBe(false);
    expect(apiFetch.mock.calls[0]).toEqual([
      "/accounts/users/246/",
      { method: "PATCH", body: { is_active: false } },
    ]);
  });
});
