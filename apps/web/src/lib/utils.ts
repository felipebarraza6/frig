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