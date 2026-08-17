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