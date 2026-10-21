import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

type YggdraOrder = YggdraSchemas["Order"];

export interface AvailableDriver {
  id: number;
  user_id: number;
  name: string;
  email?: string | null;
  is_available: boolean;
  estimated_fee?: number | null;
  vehicle_plate?: string | null;
  pricing?: { total_fee?: number };
}

export interface AvailableDriversResponse {
  branch_id: number;
  branch_name?: string;
  available_drivers: AvailableDriver[];
}

export async function fetchAvailableDrivers(): Promise<AvailableDriver[]> {
  const data = await apiFetch<AvailableDriversResponse>(
    "/logistics/delivery-pricing/available-drivers/",
  );
  return data.available_drivers ?? [];
}

export async function assignOrderDriver(
  orderId: string,
  payload: { driver_user_id: number; driver_fee?: string | number | null },
): Promise<YggdraOrder> {
  return apiFetch<YggdraOrder>(`/sales/orders/${orderId}/assign-driver/`, {
    method: "POST",
    body: payload,
  });
}
