import { formatCLP } from "@/lib/utils";

/** Monto sugerido para el anticipo de una orden: la mitad del total. */
export function suggestedAdvance(total: number): number {
  return Math.max(0, Math.round(total / 2));
}

/** Error del anticipo, o null si el monto sirve. */
export function advancePaymentError(paid: number, total: number): string | null {
  if (paid <= 0) return "El anticipo debe ser mayor a 0.";
  if (paid > Math.round(total)) {
    return `El anticipo no puede superar el total de ${formatCLP(Math.round(total))}.`;
  }
  return null;
}
