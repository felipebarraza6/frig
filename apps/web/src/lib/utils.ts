import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCLP(value: number | string): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  BANK_TRANSFER: "Transferencia bancaria",
  CHECK: "Cheque",
  CREDIT_CARD: "Tarjeta de crédito",
  DEBIT_CARD: "Tarjeta de débito",
  DIGITAL_WALLET: "Billetera digital",
  CRYPTO: "Criptomoneda",
  OTHER: "Otro",
};

export function paymentTypeLabel(value?: string | null): string {
  if (!value) return "—";
  return PAYMENT_TYPE_LABELS[value] ?? value;
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  SALE: "Venta",
  ORDER: "Orden",
  AGREEMENT: "Convenio",
};

export function orderTypeLabel(value?: string | null): string {
  if (!value) return "—";
  return ORDER_TYPE_LABELS[value] ?? value;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  RETURNED: "Devuelta",
  REFUNDED: "Reembolsada",
};

export function orderStatusLabel(value?: string | null): string {
  if (!value) return "—";
  return ORDER_STATUS_LABELS[value] ?? value;
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIAL: "Parcial",
  INVOICED: "Facturada",
  PAID: "Pagada",
  REFUNDED: "Reembolsada",
};

const STOCK_STATUS_LABELS: Record<string, string> = {
  IN_STOCK: "En stock",
  LOW_STOCK: "Stock bajo",
  OUT_OF_STOCK: "Sin stock",
};

export function stockStatusLabel(value?: string | null): string {
  if (!value) return "—";
  return STOCK_STATUS_LABELS[value] ?? value;
}

export function paymentStatusLabel(value?: string | null): string {
  if (!value) return "—";
  return PAYMENT_STATUS_LABELS[value] ?? value;
}

// ── Etiquetas defensivas para ingresos / egresos ─────────────────────────────
// El backend Yggdra suele entregar los *_display ya localizados, pero como
// respaldo (y para evitar que una clave cruda como "revenue" o "SALE" llegue a
// la UI), exponemos estos helpers y los usamos en lugar del campo crudo.

const REVENUE_TYPE_LABELS: Record<string, string> = {
  SALE: "Venta",
  SERVICE: "Servicio",
  RENTAL: "Alquiler",
  COMMISSION: "Comisión",
  INVESTMENT: "Inversión",
  REFUND: "Reembolso",
  OTHER: "Otro",
};

const REVENUE_CATEGORY_TYPE_LABELS: Record<string, string> = {
  SALES: "Ventas",
  SERVICES: "Servicios",
  RENTAL: "Alquiler",
  COMMISSION: "Comisión",
  INVESTMENT: "Inversión",
  REFUND: "Reembolso",
  OTHER: "Otro",
};

const EXPENSE_CATEGORY_TYPE_LABELS: Record<string, string> = {
  RENT: "Arriendo",
  UTILITIES: "Servicios básicos",
  SALARIES: "Sueldos",
  SUPPLIES: "Insumos",
  MAINTENANCE: "Mantención",
  MARKETING: "Marketing",
  TAXES: "Impuestos",
  TRANSPORT: "Transporte",
  INSURANCE: "Seguros",
  OTHER: "Otro",
};

const EXPENSE_FREQUENCY_LABELS: Record<string, string> = {
  ONE_TIME: "Única",
  DAILY: "Diaria",
  WEEKLY: "Semanal",
  MONTHLY: "Mensual",
  QUARTERLY: "Trimestral",
  YEARLY: "Anual",
};

const EXPENSE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  CANCELLED: "Cancelado",
  COMPLETED: "Completado",
  PENDING: "Pendiente",
  PAID: "Pagado",
  OVERDUE: "Vencido",
};

/**
 * Devuelve la etiqueta en español del `revenue_type` de un ingreso. Si el
 * backend ya envía `revenue_type_display`, úsalo; si no, mapea con el
 * diccionario local; en último caso devuelve el valor crudo.
 */
export function revenueTypeLabel(
  raw?: string | null,
  display?: string | null,
): string {
  if (display && display.trim() && display !== raw) return display;
  if (!raw) return "—";
  return REVENUE_TYPE_LABELS[raw] ?? raw;
}

export function revenueCategoryTypeLabel(
  raw?: string | null,
  display?: string | null,
): string {
  if (display && display.trim() && display !== raw) return display;
  if (!raw) return "—";
  return REVENUE_CATEGORY_TYPE_LABELS[raw] ?? raw;
}

export function expenseCategoryTypeLabel(
  raw?: string | null,
  display?: string | null,
): string {
  if (display && display.trim() && display !== raw) return display;
  if (!raw) return "—";
  return EXPENSE_CATEGORY_TYPE_LABELS[raw] ?? raw;
}

export function expenseFrequencyLabel(value?: string | null): string {
  if (!value) return "—";
  return EXPENSE_FREQUENCY_LABELS[value] ?? value;
}

export function expenseStatusLabel(value?: string | null): string {
  if (!value) return "—";
  return EXPENSE_STATUS_LABELS[value] ?? value;
}

/**
 * Fuerza la descarga de un Blob en el navegador.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Abre un Blob en una nueva pestaña para previsualización (PDF, imagen, etc.).
 * Devuelve el Object URL creado; el caller debe revocarlo cuando ya no lo
 * necesite (típicamente al cerrar la pestaña o tras un tiempo prudencial).
 */
export function viewBlobInNewTab(blob: Blob): string | null {
  if (typeof window === "undefined") return null;
  const url = window.URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    // Si el navegador bloqueó el popup, igual devolvemos el URL para que
    // el caller pueda mostrarlo o forzar la descarga.
    return url;
  }
  // Liberamos después de un breve delay para que el navegador alcance a
  // cargar el blob antes de revocar.
  setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  return url;
}