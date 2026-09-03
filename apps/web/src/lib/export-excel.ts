/**
 * Genera un archivo .xlsx en el cliente con encabezado estilado con el color
 * de marca (fondo primario, texto blanco en negrita) y anchos de columna
 * aproximados. Devuelve un Blob listo para descargar.
 *
 * `xlsx-js-style` se importa dinámicamente para mantenerla fuera del bundle
 * inicial. El patrón de estilos replica al de `generateOrdersExcel`.
 */
export async function generateExcelBlob(
  sheetName: string,
  headers: string[],
  rows: (string | number)[][],
  primaryColor = "#2f6b3c",
): Promise<Blob> {
  const XLSX = await import("xlsx-js-style");

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  const hex = primaryColor.replace("#", "").trim().toUpperCase();
  const fill = {
    patternType: "solid",
    fgColor: { rgb: /^([0-9A-F]{6}|[0-9A-F]{8})$/.test(hex) ? hex : "FF2F6B3C" },
  };
  const font = { bold: true, color: { rgb: "FFFFFF" } };
  for (let c = 0; c < headers.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellRef]) {
      ws[cellRef] = { t: "s", v: headers[c] };
    }
    ws[cellRef].s = { fill, font };
  }

  ws["!cols"] = headers.map((key) => ({ wch: Math.max(key.length, 12) }));

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
