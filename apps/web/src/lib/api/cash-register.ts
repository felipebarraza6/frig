import { apiFetch, apiFile, type ApiFileResult } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";
import type { Paginated } from "@/lib/types";

export type CashRegister = YggdraSchemas["CashRegister"];
export type CashRegisterOpenRequest = YggdraSchemas["CashRegisterOpenRequest"];
export type CashRegisterCloseRequest = YggdraSchemas["CashRegisterCloseRequest"];
export type CashRegisterSummary = YggdraSchemas["CashRegisterSummary"] & {
  cash_in?: string;
  cash_out?: string;
};

export type CashRegisterMovement = {
  id: number;
  cash_register: number;
  movement_type: "CASH_IN" | "CASH_OUT";
  amount: string;
  reason: string;
  notes?: string | null;
  created_by?: number | null;
  created_by_name?: string;
  created: string;
  modified: string;
};

export type CashMovementPayload = {
  amount: string;
  reason: string;
  notes?: string;
};

export async function getCurrentCashRegister(
  stationId?: number | string | null,
): Promise<CashRegister | null> {
  try {
    const qs = stationId ? `?station_id=${encodeURIComponent(stationId)}` : "";
    return await apiFetch<CashRegister>(`/finance/cash-registers/current/${qs}`);
  } catch (err) {
    // 404 significa que no hay caja abierta; lo tratamos como null.
    if (err && typeof err === "object" && "status" in err && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function openCashRegister(
  payload: CashRegisterOpenRequest,
): Promise<CashRegister> {
  return apiFetch<CashRegister>("/finance/cash-registers/open/", {
    method: "POST",
    body: payload,
  });
}

export async function closeCashRegister(
  id: number,
  payload: CashRegisterCloseRequest,
): Promise<CashRegister> {
  return apiFetch<CashRegister>(`/finance/cash-registers/${id}/close/`, {
    method: "POST",
    body: payload,
  });
}

export async function getDailySummary(
  stationId?: number | string | null,
  options?: { ignoreCashRegister?: boolean },
): Promise<CashRegisterSummary> {
  const qs = new URLSearchParams();
  if (stationId) qs.set("station_id", String(stationId));
  if (options?.ignoreCashRegister) qs.set("ignore_cash_register", "true");
  const q = qs.toString();
  return apiFetch<CashRegisterSummary>(`/finance/cash-registers/daily_summary/${q ? `?${q}` : ""}`);
}

export async function cashIn(
  id: number,
  payload: CashMovementPayload,
): Promise<CashRegisterMovement> {
  return apiFetch<CashRegisterMovement>(`/finance/cash-registers/${id}/cash_in/`, {
    method: "POST",
    body: payload,
  });
}

export async function cashOut(
  id: number,
  payload: CashMovementPayload,
): Promise<CashRegisterMovement> {
  return apiFetch<CashRegisterMovement>(`/finance/cash-registers/${id}/cash_out/`, {
    method: "POST",
    body: payload,
  });
}

export async function getMovements(id: number): Promise<CashRegisterMovement[]> {
  return apiFetch<CashRegisterMovement[]>(`/finance/cash-registers/${id}/movements/`);
}

export type CashRegisterFilter = {
  station?: number | string | null;
  status?: "OPEN" | "CLOSED" | "";
  date?: string;
  page?: number;
  page_size?: number;
};

export async function getCashRegisters(
  filter: CashRegisterFilter = {},
): Promise<Paginated<CashRegister>> {
  const qs = new URLSearchParams();
  if (filter.station) qs.set("station", String(filter.station));
  if (filter.status) qs.set("status", filter.status);
  if (filter.date) qs.set("date", filter.date);
  if (filter.page && filter.page > 1) qs.set("page", String(filter.page));
  if (filter.page_size) qs.set("page_size", String(filter.page_size));
  const q = qs.toString();
  return apiFetch<Paginated<CashRegister>>(`/finance/cash-registers/${q ? `?${q}` : ""}`);
}

export interface CashAudit {
  rol: string;
  nombre: string;
  periodo: string;
  sucursal: string;
  total_ordenes_pagadas?: number;
  total_recaudado?: number;
  ordenes_pendientes?: number;
  detalle_por_dia?: Array<{
    fecha: string;
    dia: string;
    ordenes?: number;
    monto?: number;
    mediciones?: number;
    ordenes_generadas?: number;
    consumo_total?: number;
  }>;
  total_mediciones?: number;
  total_ordenes_generadas?: number;
  total_monto_generado?: number;
  ordenes_pagadas_detalle?: Array<{
    id: string;
    order_number?: string | null;
    client_name?: string;
    total_amount: number | string;
    date: string;
    payment_status?: string;
    payment_methods?: Array<{
      type: string;
      name: string;
      amount: number | string;
    }>;
  }>;
}

export async function fetchCashAudit(
  date?: string,
  mode: "day" | "week" = "day",
  stationId?: number | string | null,
): Promise<CashAudit> {
  const qs = new URLSearchParams();
  if (date) qs.set("date", date);
  qs.set("mode", mode);
  if (stationId) qs.set("station_id", String(stationId));
  const q = qs.toString();
  return apiFetch<CashAudit>(`/sales/orders/arqueo/${q ? `?${q}` : ""}`);
}

export async function exportCashAudit(
  date?: string,
  mode: "day" | "week" = "day",
  stationId?: number | string | null,
): Promise<ApiFileResult> {
  const qs = new URLSearchParams();
  if (date) qs.set("date", date);
  qs.set("mode", mode);
  if (stationId) qs.set("station_id", String(stationId));
  const q = qs.toString();
  return apiFile(`/sales/orders/arqueo/export/${q ? `?${q}` : ""}`);
}

export async function exportCashAuditSimple(
  date?: string,
  mode: "day" | "week" = "day",
  stationId?: number | string | null,
): Promise<ApiFileResult> {
  const qs = new URLSearchParams();
  if (date) qs.set("date", date);
  qs.set("mode", mode);
  if (stationId) qs.set("station_id", String(stationId));
  const q = qs.toString();
  return apiFile(`/sales/orders/arqueo/export-simple/${q ? `?${q}` : ""}`);
}

export interface CashRegisterExportFilter {
  date_from?: string;
  date_to?: string;
  status?: string;
}

export async function exportCashRegisters(
  filter: CashRegisterExportFilter = {},
): Promise<ApiFileResult> {
  const qs = new URLSearchParams();
  if (filter.date_from) qs.set("date_from", filter.date_from);
  if (filter.date_to) qs.set("date_to", filter.date_to);
  if (filter.status) qs.set("status", filter.status);
  const q = qs.toString();
  return apiFile(`/finance/cash-registers/export/${q ? `?${q}` : ""}`);
}

export async function exportCashRegisterMovements(id: number): Promise<ApiFileResult> {
  return apiFile(`/finance/cash-registers/${id}/export-movements/`);
}

export async function exportCashRegisterMovementsSimple(id: number): Promise<ApiFileResult> {
  return apiFile(`/finance/cash-registers/${id}/export-movements-simple/`);
}
