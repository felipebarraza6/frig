import { describe, expect, it } from "vitest";
import { liveRefetchInterval } from "./useLiveRefetchInterval";

describe("liveRefetchInterval", () => {
  it("apaga el polling si la query no está habilitada", () => {
    expect(liveRefetchInterval(10_000, false, false)).toBe(false);
    expect(liveRefetchInterval(10_000, true, false)).toBe(false);
  });

  it("mantiene el intervalo agresivo mientras el socket está caído", () => {
    expect(liveRefetchInterval(5_000, false)).toBe(5_000);
    expect(liveRefetchInterval(30_000, false)).toBe(30_000);
  });

  it("baja a un latido de al menos 2 min cuando el socket está abierto", () => {
    expect(liveRefetchInterval(5_000, true)).toBe(120_000);
    expect(liveRefetchInterval(10_000, true)).toBe(120_000);
    expect(liveRefetchInterval(30_000, true)).toBe(120_000);
  });
});
