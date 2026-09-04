import { apiFetch } from "./client";
import type { YggdraSchemas } from "./types";

export type CashRegisterStation = YggdraSchemas["CashRegisterStation"];
export type CashRegisterStationRequest = YggdraSchemas["CashRegisterStationRequest"];
export type PaginatedCashRegisterStationList = YggdraSchemas["PaginatedCashRegisterStationList"];

export async function fetchCashRegisterStations(): Promise<CashRegisterStation[]> {
  const data = await apiFetch<PaginatedCashRegisterStationList>("/finance/cash-register-stations/");
  return data.results;
}

export async function fetchCashRegisterStation(id: number): Promise<CashRegisterStation> {
  return apiFetch<CashRegisterStation>(`/finance/cash-register-stations/${id}/`);
}

export async function createCashRegisterStation(
  payload: CashRegisterStationRequest,
): Promise<CashRegisterStation> {
  return apiFetch<CashRegisterStation>("/finance/cash-register-stations/", {
    method: "POST",
    body: payload,
  });
}

export async function updateCashRegisterStation(
  id: number,
  payload: Partial<CashRegisterStationRequest>,
): Promise<CashRegisterStation> {
  return apiFetch<CashRegisterStation>(`/finance/cash-register-stations/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteCashRegisterStation(id: number): Promise<void> {
  await apiFetch(`/finance/cash-register-stations/${id}/`, { method: "DELETE" });
}
