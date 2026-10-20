import { describe, expect, it } from "vitest";
import {
  buildPayOrderPayload,
  canConfirmOrderPay,
  cashRegisterChargeLabel,
  cashRegisterStaleMessage,
  isBlockingStaleCashRegister,
  normalizePayText,
  usableOpenCashRegister,
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

  it("envía el cash_register_id que devolvió current/", () => {
    const body = buildPayOrderPayload({
      payment_method_id: "pm-1",
      amount: "10.00",
      cash_register_id: 42,
    });
    expect(body.cash_register_id).toBe(42);
  });
});

describe("stationScopedOpenRegister", () => {
  it("rechaza un fallback de otra estación", async () => {
    const { stationScopedOpenRegister } = await import("./cash-register");
    expect(
      stationScopedOpenRegister(
        { id: 9, status: "OPEN", station: 1 } as never,
        2,
      ),
    ).toBeNull();
    expect(
      stationScopedOpenRegister(
        { id: 9, status: "OPEN", station: 2 } as never,
        2,
      )?.id,
    ).toBe(9);
  });
});

describe("cashRegisterChargeLabel", () => {
  it("usa el nombre de la estación", () => {
    expect(
      cashRegisterChargeLabel({ id: 1, station_name: "Caja 2", station_code: "CAJA2" }),
    ).toBe("Caja 2");
  });

  it("cae al código si no hay nombre", () => {
    expect(cashRegisterChargeLabel({ id: 1, station_code: "PRINCIPAL" })).toBe("PRINCIPAL");
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

  it("bloquea el cobro si la caja es stale", () => {
    expect(
      canConfirmOrderPay({
        amount: 1000,
        remaining: 1000,
        methodId: "pm-1",
        hasOpenCashRegister: true,
        isStaleCashRegister: true,
      }),
    ).toBe(false);
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

describe("isBlockingStaleCashRegister", () => {
  it("detecta blocking, code stale o stale", () => {
    expect(isBlockingStaleCashRegister({ id: 1, blocking: true })).toBe(true);
    expect(isBlockingStaleCashRegister({ id: 1, code: "cash_register_stale" })).toBe(true);
    expect(isBlockingStaleCashRegister({ id: 1, stale: true })).toBe(true);
    expect(isBlockingStaleCashRegister({ id: 1, stale: false })).toBe(false);
  });
});

describe("usableOpenCashRegister", () => {
  it("no usa una caja stale para cobrar", () => {
    expect(usableOpenCashRegister({ id: 9, status: "OPEN", stale: true, blocking: true })).toBeNull();
    expect(usableOpenCashRegister({ id: 9, status: "OPEN", stale: false })?.id).toBe(9);
  });
});

describe("cashRegisterStaleMessage", () => {
  it("usa detail del API o arma el aviso con el nombre", () => {
    expect(
      cashRegisterStaleMessage({
        detail: "Hay una caja abierta de un día anterior (Caja Principal). Ciérrala y abre la de hoy antes de cobrar",
      }),
    ).toContain("Caja Principal");
    expect(cashRegisterStaleMessage({ station_name: "Caja 2" })).toContain("Caja 2");
  });
});

describe("normalizePayText", () => {
  it("convierte null/undefined en vacío", () => {
    expect(normalizePayText(null)).toBe("");
    expect(normalizePayText(undefined)).toBe("");
    expect(normalizePayText("  x ")).toBe("x");
  });
});
