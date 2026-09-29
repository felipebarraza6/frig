import { apiFetch } from "@/lib/api/client";

/** Catálogo SII de DTE electrónicos (misma lista que Yggdra). */
export type SiiDocGroup = "venta" | "ajuste" | "despacho" | "compra" | "exportacion" | "consulta";

export type SiiDocumentType = {
  code: string | null;
  label: string;
  action: string;
  slug: string;
  group: SiiDocGroup;
  hint: string;
};

export const SII_DOCUMENT_TYPES: SiiDocumentType[] = [
  { code: "33", label: "Factura electrónica", action: "factura", slug: "generate_factura", group: "venta", hint: "Venta a empresa con RUT, con IVA (tipo 33)" },
  { code: "34", label: "Factura exenta electrónica", action: "factura_exenta", slug: "generate_factura_exenta", group: "venta", hint: "Venta no afecta o exenta de IVA (tipo 34)" },
  { code: "39", label: "Boleta electrónica", action: "boleta", slug: "generate_boleta", group: "venta", hint: "Venta a consumidor final, con IVA (tipo 39)" },
  { code: "41", label: "Boleta exenta electrónica", action: "boleta_exenta", slug: "generate_boleta_exenta", group: "venta", hint: "Boleta a consumidor final sin IVA (tipo 41)" },
  { code: "43", label: "Liquidación factura electrónica", action: "liquidacion", slug: "generate_liquidacion", group: "venta", hint: "Liquidación de ventas en consignación (tipo 43)" },
  { code: "46", label: "Factura de compra electrónica", action: "factura_compra", slug: "generate_factura_compra", group: "compra", hint: "La emite el comprador (cambio de sujeto, tipo 46)" },
  { code: "52", label: "Guía de despacho electrónica", action: "guia", slug: "generate_guia", group: "despacho", hint: "Traslado de mercadería (tipo 52)" },
  { code: "56", label: "Nota de débito electrónica", action: "debit_note", slug: "generate_debit_note", group: "ajuste", hint: "Aumenta un DTE emitido (tipo 56)" },
  { code: "61", label: "Nota de crédito electrónica", action: "credit_note", slug: "generate_credit_note", group: "ajuste", hint: "Anula o corrige un DTE (tipo 61)" },
  { code: "110", label: "Factura de exportación electrónica", action: "factura_exportacion", slug: "generate_factura_exportacion", group: "exportacion", hint: "Venta al exterior (tipo 110)" },
  { code: "111", label: "Nota de débito de exportación", action: "nd_exportacion", slug: "generate_nd_exportacion", group: "exportacion", hint: "Aumenta una factura de exportación (tipo 111)" },
  { code: "112", label: "Nota de crédito de exportación", action: "nc_exportacion", slug: "generate_nc_exportacion", group: "exportacion", hint: "Anula o corrige una factura de exportación (tipo 112)" },
  { code: null, label: "Consultar estado SII", action: "status", slug: "get_status", group: "consulta", hint: "Seguimiento de un documento enviado" },
];

export const SII_CAF_TYPES = SII_DOCUMENT_TYPES.filter((t) => t.code);

export const SII_GROUP_LABELS: Record<SiiDocGroup, string> = {
  venta: "Venta",
  ajuste: "Ajustes",
  despacho: "Despacho",
  compra: "Compra",
  exportacion: "Exportación",
  consulta: "Consulta",
};

export async function fetchSiiDocumentTypes(): Promise<SiiDocumentType[]> {
  try {
    const data = await apiFetch<SiiDocumentType[] | { results?: SiiDocumentType[] }>(
      "/finance/folios/document_types/",
    );
    const list = Array.isArray(data) ? data : data.results ?? [];
    if (list.length > 0) return list;
  } catch {
    /* catálogo local */
  }
  return SII_DOCUMENT_TYPES;
}

export function siiTypeLabel(code?: string | null): string {
  if (!code) return "—";
  return SII_CAF_TYPES.find((t) => t.code === code)?.label ?? code;
}
