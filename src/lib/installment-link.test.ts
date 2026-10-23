import { describe, expect, it } from "vitest";
import { resolveInstallmentId } from "./installment-link";

const ID = "0b0c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3";
describe("resolveInstallmentId", () => {
  it("lee el id del path del correo", () => {
    expect(resolveInstallmentId(`/checkout/pay-installment/${ID}`, "")).toBe(ID);
    expect(resolveInstallmentId(`/checkout/pay-installment/${ID}/`, "")).toBe(ID);
  });
  it("acepta ?id=", () => {
    expect(resolveInstallmentId("/checkout/pay-installment", `?id=${ID}`)).toBe(ID);
  });
  it("rechaza ids inválidos", () => {
    expect(resolveInstallmentId("/checkout/pay-installment/abc", "")).toBeNull();
  });
});
