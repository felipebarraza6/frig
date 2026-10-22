import { describe, expect, it } from "vitest";
import { openedLabel } from "./cash-register-labels";

describe("openedLabel", () => {
  const created = "2026-10-22T15:20:00Z";
  it("dice 'hoy' si la caja es del día", () => {
    expect(openedLabel("2026-10-22", created, "2026-10-22")).toMatch(/^Abierta hoy a las /);
  });
  it("muestra la fecha si la caja es de otro día", () => {
    expect(openedLabel("2026-09-15", created, "2026-10-22")).toMatch(
      /^Abierta el 15-09-2026 a las .* \(día anterior\)$/,
    );
  });
});
