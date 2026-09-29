import { apiFetch } from "./client";

export type EquipmentStatus = "AVAILABLE" | "IN_USE" | "MAINTENANCE" | "OUT_OF_SERVICE";

export type MeasurementType =
  | "temperature"
  | "pressure"
  | "hours"
  | "voltage"
  | "current"
  | "vibration"
  | "humidity"
  | "flow"
  | "other";

export type EquipmentProfile = {
  id: number;
  branch: number;
  product: number;
  product_name: string;
  product_sku?: string | null;
  warehouse?: number | null;
  warehouse_name?: string | null;
  equipment_status: EquipmentStatus;
  status_display?: string;
  manufacturer?: string;
  model_number?: string;
  serial_number?: string;
  purchase_date?: string | null;
  last_maintenance_date?: string | null;
  next_maintenance_date?: string | null;
  maintenance_interval_days?: number;
  requires_measurements?: boolean;
  measurement_types?: string[];
  measurement_unit?: string;
  notes?: string;
  created?: string;
  modified?: string;
};

export type EquipmentMeasurement = {
  id: number;
  branch: number;
  product: number;
  product_name: string;
  measurement_type: MeasurementType | string;
  value: number | string;
  unit: string;
  measurement_date: string;
  measured_by?: number | null;
  measured_by_name?: string | null;
  notes?: string;
  is_normal: boolean;
  min_value?: number | string | null;
  max_value?: number | string | null;
};

function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as { results?: T[] }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

export async function fetchEquipmentProfiles(): Promise<EquipmentProfile[]> {
  const data = await apiFetch<unknown>("/equipment/profiles/?page_size=100");
  return asList<EquipmentProfile>(data);
}

export async function createEquipmentProfile(payload: {
  product: number;
  branch?: number;
  warehouse?: number | null;
  equipment_status?: EquipmentStatus;
  manufacturer?: string;
  model_number?: string;
  serial_number?: string;
  requires_measurements?: boolean;
  measurement_types?: string[];
  measurement_unit?: string;
  notes?: string;
}): Promise<EquipmentProfile> {
  return apiFetch<EquipmentProfile>("/equipment/profiles/", {
    method: "POST",
    body: payload,
  });
}

export async function updateEquipmentProfile(
  id: number,
  payload: Partial<EquipmentProfile>,
): Promise<EquipmentProfile> {
  return apiFetch<EquipmentProfile>(`/equipment/profiles/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function fetchEquipmentMeasurements(params?: {
  product?: number;
  measurement_type?: string;
  is_normal?: boolean;
}): Promise<EquipmentMeasurement[]> {
  const qs = new URLSearchParams();
  qs.set("page_size", "100");
  if (params?.product) qs.set("product", String(params.product));
  if (params?.measurement_type) qs.set("measurement_type", params.measurement_type);
  if (params?.is_normal !== undefined) qs.set("is_normal", String(params.is_normal));
  const data = await apiFetch<unknown>(`/equipment/measurements/?${qs.toString()}`);
  return asList<EquipmentMeasurement>(data);
}

export async function createEquipmentMeasurement(payload: {
  product: number;
  measurement_type: string;
  value: number;
  unit: string;
  min_value?: number;
  max_value?: number;
  notes?: string;
}): Promise<EquipmentMeasurement> {
  return apiFetch<EquipmentMeasurement>("/equipment/measurements/", {
    method: "POST",
    body: payload,
  });
}

export const MEASUREMENT_TYPE_LABELS: Record<string, string> = {
  temperature: "Temperatura",
  pressure: "Presión",
  hours: "Horas de uso",
  voltage: "Voltaje",
  current: "Corriente",
  vibration: "Vibración",
  humidity: "Humedad",
  flow: "Flujo",
  other: "Otro",
};

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  AVAILABLE: "Disponible",
  IN_USE: "En uso",
  MAINTENANCE: "Mantenimiento",
  OUT_OF_SERVICE: "Fuera de servicio",
};
