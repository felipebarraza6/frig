import { afterEach, describe, expect, it } from "vitest";
import { assertOnlineSale, OFFLINE_SALE_MESSAGE } from "./online";

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value });
}

describe("assertOnlineSale", () => {
  const previous = navigator.onLine;

  afterEach(() => {
    setOnline(previous);
  });

  it("deja pasar cuando hay red", () => {
    setOnline(true);
    expect(() => assertOnlineSale()).not.toThrow();
  });

  it("corta el cobro sin marcar la venta como exitosa", () => {
    setOnline(false);
    expect(() => assertOnlineSale()).toThrow(OFFLINE_SALE_MESSAGE);
  });
});
