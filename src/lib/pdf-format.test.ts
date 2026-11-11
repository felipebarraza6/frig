import { afterEach, describe, expect, it } from "vitest";
import {
  readThermalPdfFormat,
  thermalDownloadSuffix,
  thermalPdfStorageKey,
  voucherDownloadLabel,
  withThermalFilename,
  writeThermalPdfFormat,
} from "./pdf-format";

describe("pdf format preference", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("defaults to 80 mm thermal", () => {
    expect(readThermalPdfFormat("branch-1")).toBe("thermal");
    expect(thermalDownloadSuffix("thermal")).toBe("");
    expect(voucherDownloadLabel("thermal")).toBe("80mm");
    expect(voucherDownloadLabel("a4")).toBe("a4");
  });

  it("remembers 58 mm per branch", () => {
    writeThermalPdfFormat("thermal_58", "branch-1");
    writeThermalPdfFormat("thermal", "branch-2");
    expect(window.localStorage.getItem(thermalPdfStorageKey("branch-1"))).toBe("thermal_58");
    expect(readThermalPdfFormat("branch-1")).toBe("thermal_58");
    expect(readThermalPdfFormat("branch-2")).toBe("thermal");
    expect(thermalDownloadSuffix("thermal_58")).toBe("_58mm");
    expect(voucherDownloadLabel("thermal_58")).toBe("58mm");
    expect(withThermalFilename("boleta_12.pdf", "thermal_58", "boleta.pdf")).toBe("boleta_12_58mm.pdf");
    expect(withThermalFilename("boleta_58mm.pdf", "thermal_58", "boleta.pdf")).toBe("boleta_58mm.pdf");
    expect(withThermalFilename("boleta_12.pdf", "thermal", "boleta.pdf")).toBe("boleta_12.pdf");
  });
});
