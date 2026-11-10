import { describe, expect, it } from "vitest";
import { advancePaymentError, suggestedAdvance } from "./advance-payment";

describe("advance-payment", () => {
  it("sugiere la mitad del total, redondeada", () => {
    expect(suggestedAdvance(35990)).toBe(17995);
    expect(suggestedAdvance(5001)).toBe(2501);
  });
  it("acepta un anticipo parcial o el total", () => {
    expect(advancePaymentError(10000, 35990)).toBeNull();
    expect(advancePaymentError(35990, 35990)).toBeNull();
  });
  it("rechaza anticipo en cero", () => {
    expect(advancePaymentError(0, 35990)).toMatch(/mayor a 0/);
  });
  it("rechaza anticipo mayor al total", () => {
    expect(advancePaymentError(40000, 35990)).toMatch(/no puede superar/);
  });
});
