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

export type MaintenanceType = "PREVENTIVE" | "CORRECTIVE" | "EMERGENCY";

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

export type EquipmentMaintenance = {
  id: number;
  branch: number;
  branch_name?: string;
  product: number;
  product_name?: string;
  product_sku?: string;
  maintenance_type: MaintenanceType;
  maintenance_date: string;
  description: string;
  cost?: number | null;
  performed_by?: string;
  notes?: string;
  created?: string;
  modified?: string;
};

export type CreateEquipmentMeasurementPayload = {
  /** Requerido por la API en el body (el header X-Branch-ID no basta). */
  branch: number;
  product: number;
  measurement_type: string;
  value: number;
  unit: string;
  measurement_date?: string;
  min_value?: number | null;
  max_value?: number | null;
  notes?: string;
};

export type UpdateEquipmentMeasurementPayload = Partial<
  Omit<CreateEquipmentMeasurementPayload, "branch">
> & {
  branch?: number;
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
  purchase_date?: string | null;
  last_maintenance_date?: string | null;
  next_maintenance_date?: string | null;
  maintenance_interval_days?: number;
}): Promise<EquipmentProfile> {
  return apiFetch<EquipmentProfile>("/equipment/profiles/", {
    method: "POST",
    body: payload,
  });
}

export async function updateEquipmentProfile(
  id: number,
  payload: Partial<{
    branch: number;
    product: number;
    warehouse: number | null;
    equipment_status: EquipmentStatus;
    manufacturer: string;
    model_number: string;
    serial_number: string;
    requires_measurements: boolean;
    measurement_types: string[];
    measurement_unit: string;
    notes: string;
    purchase_date: string | null;
    last_maintenance_date: string | null;
    next_maintenance_date: string | null;
    maintenance_interval_days: number;
  }>,
): Promise<EquipmentProfile> {
  return apiFetch<EquipmentProfile>(`/equipment/profiles/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteEquipmentProfile(id: number): Promise<void> {
  return apiFetch<void>(`/equipment/profiles/${id}/`, {
    method: "DELETE",
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

export async function createEquipmentMeasurement(
  payload: CreateEquipmentMeasurementPayload,
): Promise<EquipmentMeasurement> {
  return apiFetch<EquipmentMeasurement>("/equipment/measurements/", {
    method: "POST",
    body: payload,
  });
}

export async function updateEquipmentMeasurement(
  id: number,
  payload: UpdateEquipmentMeasurementPayload,
): Promise<EquipmentMeasurement> {
  return apiFetch<EquipmentMeasurement>(`/equipment/measurements/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteEquipmentMeasurement(id: number): Promise<void> {
  return apiFetch<void>(`/equipment/measurements/${id}/`, {
    method: "DELETE",
  });
}

export async function fetchEquipmentMaintenances(params?: {
  product?: number;
  maintenance_type?: MaintenanceType;
}): Promise<EquipmentMaintenance[]> {
  const qs = new URLSearchParams();
  qs.set("page_size", "100");
  if (params?.product) qs.set("product", String(params.product));
  if (params?.maintenance_type) qs.set("maintenance_type", params.maintenance_type);
  const data = await apiFetch<unknown>(`/equipment/maintenances/?${qs.toString()}`);
  return asList<EquipmentMaintenance>(data);
}

export async function createEquipmentMaintenance(payload: {
  branch: number;
  product: number;
  maintenance_type: MaintenanceType;
  maintenance_date: string;
  description: string;
  cost?: number | null;
  performed_by?: string;
  notes?: string;
}): Promise<EquipmentMaintenance> {
  return apiFetch<EquipmentMaintenance>("/equipment/maintenances/", {
    method: "POST",
    body: payload,
  });
}

export async function updateEquipmentMaintenance(
  id: number,
  payload: Partial<{
    branch: number;
    product: number;
    maintenance_type: MaintenanceType;
    maintenance_date: string;
    description: string;
    cost: number | null;
    performed_by: string;
    notes: string;
  }>,
): Promise<EquipmentMaintenance> {
  return apiFetch<EquipmentMaintenance>(`/equipment/maintenances/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteEquipmentMaintenance(id: number): Promise<void> {
  return apiFetch<void>(`/equipment/maintenances/${id}/`, {
    method: "DELETE",
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

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  PREVENTIVE: "Preventivo",
  CORRECTIVE: "Correctivo",
  EMERGENCY: "Emergencia",
};
