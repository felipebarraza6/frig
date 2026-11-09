import { describe, expect, it } from "vitest";
import { cashPaymentWithoutRegister } from "./cash-sale-guard";

const cash = { id: "cash", payment_type: "CASH" };
const card = { id: "card", payment_type: "CREDIT_CARD" };

describe("cashPaymentWithoutRegister", () => {
  it("exige caja cuando el cobro es en efectivo", () => {
    expect(
      cashPaymentWithoutRegister(
        [{ payment_method_id: "cash", amount: "1000" }],
        [cash],
        false,
      ),
    ).toBe(true);
  });

  it("deja pasar efectivo si hay caja abierta", () => {
    expect(
      cashPaymentWithoutRegister(
        [{ payment_method_id: "cash", amount: "1000" }],
        [cash],
        true,
      ),
    ).toBe(false);
  });

  it("deja pasar un cobro que no es efectivo", () => {
    expect(
      cashPaymentWithoutRegister(
        [{ payment_method_id: "card", amount: "1000" }],
        [card],
        false,
      ),
    ).toBe(false);
  });
});
