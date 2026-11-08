import { describe, expect, it } from "vitest";
import { findSelectOption } from "./select-value";

const options = [
  { value: "", label: "Ninguna" },
  { value: "12", label: "Caja 1" },
];

describe("findSelectOption", () => {
  it("encuentra la opción cuando el valor controlado es número", () => {
    expect(findSelectOption(options, 12)?.label).toBe("Caja 1");
  });

  it("trata null como la opción vacía", () => {
    expect(findSelectOption(options, undefined)?.label).toBe("Ninguna");
  });
});
