/** Ancho de rollo térmico. `thermal` es 80 mm (default de la API). */
export type ThermalPdfFormat = "thermal" | "thermal_58";

export type VoucherPdfFormat = ThermalPdfFormat | "a4";

const STORAGE_KEY = "frig.thermalPdfFormat";

export function thermalPdfStorageKey(branchId?: string | number | null): string {
  return branchId != null && branchId !== "" ? `${STORAGE_KEY}.${branchId}` : STORAGE_KEY;
}

export function readThermalPdfFormat(branchId?: string | number | null): ThermalPdfFormat {
  if (typeof window === "undefined") return "thermal";
  try {
    const scoped = branchId ? window.localStorage.getItem(thermalPdfStorageKey(branchId)) : null;
    const raw = scoped ?? window.localStorage.getItem(STORAGE_KEY);
    return raw === "thermal_58" ? "thermal_58" : "thermal";
  } catch {
    return "thermal";
  }
}

export function writeThermalPdfFormat(format: ThermalPdfFormat, branchId?: string | number | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(thermalPdfStorageKey(branchId), format);
  } catch {
    // localStorage puede estar bloqueado; la descarga igual sigue.
  }
}

/** Sufijo de archivo solo para 58 mm. 80 mm conserva el nombre histórico. */
export function thermalDownloadSuffix(format: ThermalPdfFormat): string {
  return format === "thermal_58" ? "_58mm" : "";
}

/** El nombre del servidor gana, pero 58 mm siempre queda marcado en el archivo. */
export function withThermalFilename(
  serverName: string | null | undefined,
  format: ThermalPdfFormat,
  fallback: string,
): string {
  const raw = serverName?.trim() || fallback;
  if (format !== "thermal_58" || /58/.test(raw)) return raw;
  return raw.replace(/\.pdf$/i, "") + "_58mm.pdf";
}

export function voucherDownloadLabel(format: VoucherPdfFormat): string {
  if (format === "a4") return "a4";
  if (format === "thermal_58") return "58mm";
  return "80mm";
}
