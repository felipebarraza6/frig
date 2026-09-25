/**
 * Exportación CSV única de la app.
 *
 * Formato pensado para Excel en Chile: BOM UTF-8 (para que no se pierdan
 * tildes ni la ñ) y separador ";" (configuración regional es-CL). Las celdas
 * se entrecomillan solo cuando contienen ";", '"' o salto de línea.
 *
 * Unifica las dos copias casi idénticas de reports/money y finance (una con
 * separador ";" y otra con ",").
 */

export type CsvCell = string | number | null | undefined;

/** Descarga un CSV con headers + rows (primera fila: encabezados). */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: CsvCell[][],
): void {
  const escape = (v: CsvCell) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const csv = [headers, ...rows]
    .map((r) => r.map(escape).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
