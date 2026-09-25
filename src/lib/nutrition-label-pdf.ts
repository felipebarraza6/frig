/**
 * PDF de etiqueta nutricional generado en el cliente.
 *
 * El endpoint Yggdra `download-nutrition-label-pdf` hoy entrega un stub
 * ReportLab (~3 KB) que ignora mode/size/per. Esta descarga refleja exactamente
 * la vista previa FRIG (valores, porción, tamaño, modo simple/logo).
 */

import type {
  NutritionLabelExtras,
  NutritionLabelMode,
  NutritionLabelOrientation,
  NutritionLabelPortion,
  NutritionLabelSize,
  NutritionValues,
} from "@/components/products/nutrition-label-preview";
import { orientedLabelSize, scaleNutritionValues } from "@/components/products/nutrition-label-preview";

const MM_TO_PT = 72 / 25.4;

export interface NutritionLabelPdfInput {
  values: NutritionValues;
  mode: NutritionLabelMode;
  portion: NutritionLabelPortion;
  orientation?: NutritionLabelOrientation;
  size: NutritionLabelSize;
  servingGrams: number;
  valuesAlreadyForPortion?: boolean;
  productName?: string;
  branchName?: string;
  extras?: NutritionLabelExtras;
  /** PNG/JPEG data URL opcional para modo branded. */
  logoDataUrl?: string | null;
}

function fmt(value: string): string {
  if (!value || value === "0" || value === "0.0" || value === "0.00") return "0";
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  if (Number.isInteger(num)) return String(num);
  return (Math.round(num * 10) / 10).toFixed(1);
}

/**
 * Texto para literales PDF `(...)`.
 * Deja bytes Latin-1 / WinAnsi tal cual (á, é, ñ, ó…) y solo escapa \ ( ).
 * El stream se escribe luego en Latin-1, no UTF-8.
 */
function pdfText(input: string): string {
  const map: Record<string, string> = {
    "\u2014": "-",
    "\u2013": "-",
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u2026": "...",
    "\u00a0": " ",
  };
  let s = input;
  for (const [k, v] of Object.entries(map)) s = s.split(k).join(v);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    const code = ch.charCodeAt(0);
    if (ch === "\\" || ch === "(" || ch === ")") {
      out += `\\${ch}`;
      continue;
    }
    if (code === 0x0a) {
      out += "\\n";
      continue;
    }
    if (code < 32) continue;
    if (code > 255) {
      out += "?";
      continue;
    }
    out += ch;
  }
  return out;
}

/** Cuántos nutrientes tienen valor &gt; 0 (para avisar etiquetas incompletas). */
export function countFilledNutrients(values: NutritionValues): number {
  return Object.values(values).filter((v) => {
    const n = Number(v);
    return v !== "" && !Number.isNaN(n) && n !== 0;
  }).length;
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export async function buildNutritionLabelPdfBlob(
  input: NutritionLabelPdfInput,
): Promise<Blob> {
  const box = orientedLabelSize(input.size, input.orientation ?? "portrait");
  const pageW = box.widthMm * MM_TO_PT;
  const pageH = box.heightMm * MM_TO_PT;
  const landscape = (input.orientation ?? "portrait") === "landscape";
  const margin = 10;
  const contentW = pageW - margin * 2;

  const display =
    !input.valuesAlreadyForPortion &&
    input.portion === "per_serving" &&
    input.servingGrams > 0 &&
    input.servingGrams !== 100
      ? scaleNutritionValues(input.values, input.servingGrams)
      : input.values;

  const portionGramsLabel =
    input.servingGrams % 1 === 0
      ? String(input.servingGrams)
      : (Math.round(input.servingGrams * 10) / 10).toFixed(1);
  const unit = (input.extras?.nutritionUnit || "g").trim() || "g";
  const portionLabel =
    input.portion === "per_serving"
      ? `Por porción de ${portionGramsLabel} ${unit}`
      : `Por 100 ${unit}`;

  const rows: { label: string; value: string; indent?: boolean; bold?: boolean }[] = [
    { label: "Energía", value: `${fmt(display.energyKcal)} kcal`, bold: true },
    { label: "Proteínas", value: `${fmt(display.proteinsG)} g`, bold: true },
    { label: "Grasas totales", value: `${fmt(display.totalFatsG)} g`, bold: true },
    { label: "Grasas saturadas", value: `${fmt(display.saturatedFatsG)} g`, indent: true },
    { label: "Grasas monoinsaturadas", value: `${fmt(display.monounsaturatedFatsG)} g`, indent: true },
    { label: "Grasas poliinsaturadas", value: `${fmt(display.polyunsaturatedFatsG)} g`, indent: true },
    { label: "Grasas trans", value: `${fmt(display.transFatsG)} g`, indent: true },
    { label: "Colesterol", value: `${fmt(display.cholesterolMg)} mg`, bold: true },
    { label: "Carbohidratos", value: `${fmt(display.carbohydratesG)} g`, bold: true },
    { label: "Azúcares totales", value: `${fmt(display.totalSugarsG)} g`, indent: true },
    { label: "Sodio", value: `${fmt(display.sodiumMg)} mg`, bold: true },
  ];

  const colW = landscape ? (contentW - 8) / 2 : contentW;
  const maxChars = Math.max(18, Math.floor(colW / 4.2));
  type DrawLine = { text: string; size: number; bold?: boolean; gapAfter?: number; x?: number };
  const lines: DrawLine[] = [];
  const leftX = margin;
  const rightX = landscape ? margin + colW + 8 : margin;

  const push = (line: DrawLine, x = leftX) => lines.push({ ...line, x });

  if (input.mode === "branded" && input.branchName) {
    push({ text: input.branchName, size: 9, bold: true, gapAfter: 2 });
  }
  if (input.productName) {
    push({ text: input.productName, size: 8, bold: input.mode !== "branded", gapAfter: 4 });
  }
  push({ text: portionLabel, size: 7, gapAfter: 4 });
  if (input.extras?.servings && input.extras.servings > 0) {
    const n = input.extras.servings;
    push({ text: `${n} ${n === 1 ? "porción" : "porciones"} por envase`, size: 7, gapAfter: 4 });
  }
  if (input.extras?.ingredientsText) {
    push({ text: "Ingredientes:", size: 7, bold: true, gapAfter: 2 });
    for (const w of wrapLines(input.extras.ingredientsText, maxChars)) {
      push({ text: w, size: 7, gapAfter: 2 });
    }
  }
  const contains = (input.extras?.contains || []).map((item) => item.trim()).filter(Boolean);
  if (contains.length) {
    push({ text: "Contiene:", size: 7, bold: true, gapAfter: 2 });
    for (const w of wrapLines(contains.join(", "), maxChars)) {
      push({ text: w, size: 7, gapAfter: 2 });
    }
  }
  if (input.extras?.allergenWarning?.trim()) {
    for (const w of wrapLines(input.extras.allergenWarning.trim(), maxChars)) {
      push({ text: w, size: 7, bold: true, gapAfter: 2 });
    }
  }
  if (input.extras?.shelfLife?.trim()) {
    for (const w of wrapLines(input.extras.shelfLife.trim(), maxChars)) {
      push({ text: w, size: 6, gapAfter: 2 });
    }
  }
  if (input.extras?.branchText?.trim()) {
    for (const w of wrapLines(input.extras.branchText.trim(), maxChars)) {
      push({ text: w, size: 6, gapAfter: 2 });
    }
  }

  push({ text: "INFORMACIÓN NUTRICIONAL", size: 8, bold: true, gapAfter: 3 }, rightX);
  for (const row of rows) {
    const prefix = row.indent ? "  " : "";
    const label = `${prefix}${row.label}`;
    const rowChars = Math.max(16, Math.floor(colW / 4.2));
    const pad = Math.max(1, rowChars - label.length - row.value.length);
    push(
      {
        text: `${label}${" ".repeat(pad)}${row.value}`,
        size: 7,
        bold: row.bold,
        gapAfter: 2,
      },
      rightX,
    );
  }

  // Build content stream (top-down). Content must be Latin-1 / WinAnsi bytes.
  const ops: string[] = [];
  ops.push("0.6 w");
  ops.push(`${margin - 4} ${margin - 4} ${pageW - (margin - 4) * 2} ${pageH - (margin - 4) * 2} re S`);
  if (landscape) {
    const split = rightX - 4;
    ops.push(`${split.toFixed(2)} ${margin} m ${split.toFixed(2)} ${(pageH - margin).toFixed(2)} l S`);
  }

  const cursorY = new Map<number, number>();
  for (const line of lines) {
    const x = line.x ?? margin;
    const y = (cursorY.get(x) ?? pageH - margin - 12) ;
    if (y < margin + 8) continue;
    const font = line.bold ? "F2" : "F1";
    ops.push("BT");
    ops.push(`/${font} ${line.size} Tf`);
    ops.push(`${x.toFixed(2)} ${y.toFixed(2)} Td`);
    ops.push(`(${pdfText(line.text)}) Tj`);
    ops.push("ET");
    cursorY.set(x, y - line.size - (line.gapAfter ?? 3));
  }

  const content = ops.join("\n");
  const latin1 = (s: string) => {
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
    return out;
  };
  const contentBytes = latin1(content);

  const parts: Uint8Array[] = [];
  const offsets: number[] = [0];
  let cursor = 0;
  const add = (bytes: Uint8Array) => {
    parts.push(bytes);
    cursor += bytes.length;
  };
  const addStr = (s: string) => add(latin1(s));
  const markObj = () => {
    offsets.push(cursor);
  };

  addStr("%PDF-1.4\n");
  markObj();
  addStr("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  markObj();
  addStr("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
  markObj();
  addStr(
    `3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>endobj\n`,
  );
  markObj();
  addStr(`4 0 obj<< /Length ${contentBytes.length} >>stream\n`);
  add(contentBytes);
  addStr("\nendstream\nendobj\n");
  markObj();
  addStr("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>endobj\n");
  markObj();
  addStr("6 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>endobj\n");

  const xrefPos = cursor;
  let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer<< /Size ${offsets.length} /Root 1 0 R >>\n`;
  xref += `startxref\n${xrefPos}\n%%EOF`;
  addStr(xref);

  const out = new Uint8Array(cursor);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return new Blob([out], { type: "application/pdf" });
}

export async function fetchLogoDataUrl(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
