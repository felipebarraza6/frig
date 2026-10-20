import type { PayOrderPayload } from "./orders";

export const CASH_REGISTER_CLOSED_MESSAGE =
  "Debes abrir la caja antes de cobrar";

export function normalizePayText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function buildPayOrderPayload(input: {
  payment_method_id: string;
  amount: string;
  notes?: string | null;
  reference?: string | null;
  cash_register_id?: number | string | null;
}): PayOrderPayload {
  const payload: PayOrderPayload = {
    payment_method_id: input.payment_method_id,
    amount: input.amount,
    notes: normalizePayText(input.notes),
    reference: normalizePayText(input.reference),
    skip_cash_register_validation: false,
  };
  if (input.cash_register_id != null && input.cash_register_id !== "") {
    payload.cash_register_id = input.cash_register_id;
  }
  return payload;
}

export function canConfirmOrderPay(input: {
  amount: number;
  remaining: number;
  methodId: string;
  requiresReference?: boolean;
  reference?: string | null;
  hasOpenCashRegister: boolean;
}): boolean {
  if (!input.hasOpenCashRegister) return false;
  if (!(input.amount > 0 && input.amount <= input.remaining + 0.009)) return false;
  if (!input.methodId) return false;
  if (input.requiresReference && !normalizePayText(input.reference)) return false;
  return true;
}
