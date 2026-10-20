import { describe, expect, it } from "vitest";
import { formatRUT, isValidRUT } from "@/lib/validation";

describe("formatRUT", () => {
  it("quita espacios y puntos y formatea antes de enviar", () => {
    expect(formatRUT(" 12345678-5 ")).toBe("12.345.678-5");
    expect(formatRUT("123456785")).toBe("12.345.678-5");
  });
});

describe("isValidRUT", () => {
  it("acepta con o sin puntos si el DV es correcto", () => {
    expect(isValidRUT("12.345.678-5")).toBe(true);
    expect(isValidRUT("12345678-5")).toBe(true);
  });

  it("rechaza dígito verificador incorrecto", () => {
    expect(isValidRUT("12.345.678-9")).toBe(false);
  });
});
