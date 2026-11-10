import { describe, expect, it } from "vitest";
import { dayBefore, pickStaleOrders, yesterdayLocal } from "./stale-orders";

describe("stale-orders", () => {
  it("calcula ayer en hora local", () => {
    expect(yesterdayLocal(new Date(2026, 9, 1, 10))).toBe("2026-09-30");
  });
  it("excluye cotizaciones", () => {
    expect(pickStaleOrders([{ is_quotation: true }, { is_quotation: false }, {}])).toHaveLength(2);
  });
  it("da el día anterior al inicio del rango, cruzando mes", () => {
    expect(dayBefore("2026-11-01")).toBe("2026-10-31");
    expect(dayBefore("2026-03-01")).toBe("2026-02-28");
  });
  it("sin fecha de inicio no hay día anterior", () => {
    expect(dayBefore("")).toBeNull();
  });
});
