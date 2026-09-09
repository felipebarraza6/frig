import { apiFetch } from "./client";
import type { YggdraSchemas } from "./types";

export type CashRegisterStation = YggdraSchemas["CashRegisterStation"];
export type CashRegisterStationRequest = YggdraSchemas["CashRegisterStationRequest"];
export type PaginatedCashRegisterStationList = YggdraSchemas["PaginatedCashRegisterStationList"];

export async function fetchCashRegisterStations(): Promise<CashRegisterStation[]> {
  const data = await apiFetch<PaginatedCashRegisterStationList>("/finance/cash-register-stations/");
  // El backend no filtra por sucursal a superadmins (ven todas), así que
  // restringimos al branch activo (header X-Branch-ID, misma fuente que
  // client.ts). Sin esto, un superadmin sin estación asignada termina
  // usando la primera estación de OTRA sucursal y al abrir caja el
  // backend responde 404 "Estación de caja no encontrada".
  const branchId =
    typeof window !== "undefined" ? window.localStorage.getItem("frig.branch_id") : null;
  if (!branchId) return data.results;
  return data.results.filter((s) => String(s.branch) === String(branchId));
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
