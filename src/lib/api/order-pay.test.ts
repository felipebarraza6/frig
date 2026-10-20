import { describe, expect, it } from "vitest";
import {
  buildPayOrderPayload,
  canConfirmOrderPay,
  normalizePayText,
} from "./order-pay";

describe("buildPayOrderPayload", () => {
  it("manda notes y reference como string vacío, nunca null", () => {
    expect(
      buildPayOrderPayload({
        payment_method_id: "pm-1",
        amount: "1000.00",
        notes: null,
        reference: "  ",
        cash_register_id: 9,
      }),
    ).toEqual({
      payment_method_id: "pm-1",
      amount: "1000.00",
      notes: "",
      reference: "",
      cash_register_id: 9,
      skip_cash_register_validation: false,
    });
  });

  it("omite cash_register_id si no hay caja", () => {
    const body = buildPayOrderPayload({
      payment_method_id: "pm-1",
      amount: "10.00",
      notes: "hola",
    });
    expect(body.notes).toBe("hola");
    expect(body).not.toHaveProperty("cash_register_id");
  });
});

describe("canConfirmOrderPay", () => {
  it("bloquea el cobro si no hay caja abierta", () => {
    expect(
      canConfirmOrderPay({
        amount: 1000,
        remaining: 1000,
        methodId: "pm-1",
        hasOpenCashRegister: false,
      }),
    ).toBe(false);
  });

  it("permite confirmar con caja abierta y monto válido", () => {
    expect(
      canConfirmOrderPay({
        amount: 1000,
        remaining: 1000,
        methodId: "pm-1",
        hasOpenCashRegister: true,
      }),
    ).toBe(true);
  });

  it("exige referencia cuando el método lo pide", () => {
    expect(
      canConfirmOrderPay({
        amount: 1000,
        remaining: 1000,
        methodId: "pm-1",
        requiresReference: true,
        reference: " ",
        hasOpenCashRegister: true,
      }),
    ).toBe(false);
    expect(
      canConfirmOrderPay({
        amount: 1000,
        remaining: 1000,
        methodId: "pm-1",
        requiresReference: true,
        reference: "TRX-1",
        hasOpenCashRegister: true,
      }),
    ).toBe(true);
  });
});

describe("normalizePayText", () => {
  it("convierte null/undefined en vacío", () => {
    expect(normalizePayText(null)).toBe("");
    expect(normalizePayText(undefined)).toBe("");
    expect(normalizePayText("  x ")).toBe("x");
  });
});
