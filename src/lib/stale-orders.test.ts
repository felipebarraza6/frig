import { describe, expect, it } from "vitest";
import { pickStaleOrders, yesterdayLocal } from "./stale-orders";

describe("stale-orders", () => {
  it("calcula ayer en hora local", () => {
    expect(yesterdayLocal(new Date(2026, 9, 1, 10))).toBe("2026-09-30");
  });
  it("excluye cotizaciones", () => {
    expect(pickStaleOrders([{ is_quotation: true }, { is_quotation: false }, {}])).toHaveLength(2);
  });
});
