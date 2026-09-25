import { apiFetch } from "./client";
import type { YggdraSchemas } from "./types";

export type CashRegisterStation = YggdraSchemas["CashRegisterStation"];
export type CashRegisterStationRequest = YggdraSchemas["CashRegisterStationRequest"];
export type PaginatedCashRegisterStationList = YggdraSchemas["PaginatedCashRegisterStationList"];

export async function fetchCashRegisterStations(): Promise<CashRegisterStation[]> {
  const branchId =
    typeof window !== "undefined" ? window.localStorage.getItem("frig.branch_id") : null;
  // El backend no filtra por sucursal a superadmins (ven todas), así que se
  // pide el filtro server-side (?branch=, misma fuente que el header
  // X-Branch-ID de client.ts). Filtrar solo client-side sobre la página 1
  // dejaba fuera estaciones de la sucursal activa: el endpoint pagina por
  // defecto a 10 y la página 1 puede estar llena de estaciones de otras
  // sucursales (un superadmin sin estación asignada terminaba usando la
  // primera estación de OTRA sucursal y al abrir caja el backend responde
  // 404 "Estación de caja no encontrada"). El filtro local se conserva como
  // red de seguridad.
  const query = branchId
    ? `?branch=${encodeURIComponent(branchId)}&page_size=100`
    : "?page_size=100";
  const data = await apiFetch<PaginatedCashRegisterStationList>(`/finance/cash-register-stations/${query}`);
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
