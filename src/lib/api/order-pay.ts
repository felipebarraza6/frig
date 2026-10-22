import type { PayOrderPayload } from "./orders";

export const CASH_REGISTER_CLOSED_MESSAGE =
  "Debes abrir la caja antes de cobrar";

export const CASH_REGISTER_STALE_MESSAGE =
  "Hay una caja abierta de un día anterior. Ciérrala y abre la de hoy antes de cobrar";

export type CashRegisterChargeState = {
  id?: number | string | null;
  status?: string | null;
  station_name?: string | null;
  station_code?: string | null;
  stale?: boolean;
  blocking?: boolean;
  code?: string | null;
  detail?: string | null;
  stale_open_count?: number | null;
  stale_open_registers?: Array<{ id?: number | string | null }> | null;
} | null | undefined;

export function isBlockingStaleCashRegister(
  register: CashRegisterChargeState,
): boolean {
  if (!register) return false;
  return (
    register.blocking === true ||
    register.code === "cash_register_stale" ||
    register.stale === true ||
    (typeof register.stale_open_count === "number" && register.stale_open_count > 0) ||
    (Array.isArray(register.stale_open_registers) &&
      register.stale_open_registers.length > 0)
  );
}

export function cashRegisterStaleMessage(
  register: CashRegisterChargeState,
): string {
  const detail = String(register?.detail ?? "").trim();
  if (detail) return detail;
  const name = cashRegisterChargeLabel(register);
  if (name) {
    return `Hay una caja abierta de un día anterior (${name}). Ciérrala y abre la de hoy antes de cobrar`;
  }
  return CASH_REGISTER_STALE_MESSAGE;
}

export function usableOpenCashRegister<T extends { id?: number | string | null }>(
  register: (T & {
    stale?: boolean;
    blocking?: boolean;
    code?: string | null;
    status?: string | null;
  }) | null | undefined,
): T | null {
  if (!register || register.id == null || register.id === "") return null;
  if (register.status && register.status !== "OPEN") return null;
  if (isBlockingStaleCashRegister(register)) return null;
  return register;
}

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

export function cashRegisterChargeLabel(register: {
  station_name?: string | null;
  station_code?: string | null;
  id?: number | string | null;
} | null | undefined): string | null {
  if (!register) return null;
  const name = String(register.station_name || register.station_code || "").trim();
  if (name) return name;
  if (register.id != null && register.id !== "") return `Caja ${register.id}`;
  return null;
}

export function canConfirmOrderPay(input: {
  amount: number;
  remaining: number;
  methodId: string;
  requiresReference?: boolean;
  reference?: string | null;
  hasOpenCashRegister: boolean;
  isStaleCashRegister?: boolean;
}): boolean {
  if (input.isStaleCashRegister) return false;
  if (!input.hasOpenCashRegister) return false;
  if (!(input.amount > 0 && input.amount <= input.remaining + 0.009)) return false;
  if (!input.methodId) return false;
  if (input.requiresReference && !normalizePayText(input.reference)) return false;
  return true;
}
