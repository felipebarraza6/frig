import { describe, expect, it } from "vitest";
import { formatRegisterDate, openedLabel } from "./cash-register-labels";

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

describe("formatRegisterDate", () => {
  it("no corre el día por zona horaria", () => {
    expect(formatRegisterDate("2026-10-23")).toBe("23-10-2026");
  });
  it("acepta fecha con hora", () => {
    expect(formatRegisterDate("2026-10-01T00:00:00Z")).toBe("01-10-2026");
  });
});
