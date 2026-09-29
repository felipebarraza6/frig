import { apiFetch } from "./client";

export type DeviceType =
  | "WELL"
  | "SURFACE"
  | "WEATHER"
  | "TANK"
  | "FLOW"
  | "LEVEL"
  | "CUSTOM";

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  WELL: "Pozo",
  SURFACE: "Captación superficial",
  WEATHER: "Estación meteorológica",
  TANK: "Estanque / Tanque",
  FLOW: "Medidor de flujo",
  LEVEL: "Medidor de nivel",
  CUSTOM: "Personalizado",
};

export type VariableType =
  | "FLOW"
  | "LEVEL"
  | "TOTAL"
  | "FLOW_AVG"
  | "TEMPERATURE"
  | "PRESSURE"
  | "HUMIDITY"
  | "RAIN"
  | "WIND_SPEED"
  | "WIND_DIRECTION"
  | "SOLAR_RADIATION"
  | "BATTERY"
  | "SIGNAL"
  | "CUSTOM";

export const VARIABLE_TYPE_LABELS: Record<VariableType, string> = {
  FLOW: "Caudal",
  LEVEL: "Nivel",
  TOTAL: "Totalizado",
  FLOW_AVG: "Caudal promedio",
  TEMPERATURE: "Temperatura",
  PRESSURE: "Presión",
  HUMIDITY: "Humedad",
  RAIN: "Precipitación",
  WIND_SPEED: "Velocidad viento",
  WIND_DIRECTION: "Dirección viento",
  SOLAR_RADIATION: "Radiación solar",
  BATTERY: "Batería",
  SIGNAL: "Señal",
  CUSTOM: "Personalizado",
};

export const COMMON_VARIABLE_UNITS: Record<VariableType, string> = {
  FLOW: "lt/s",
  LEVEL: "m",
  TOTAL: "m³",
  FLOW_AVG: "lt/s",
  TEMPERATURE: "°C",
  PRESSURE: "PSI",
  HUMIDITY: "%",
  RAIN: "mm",
  WIND_SPEED: "km/h",
  WIND_DIRECTION: "°",
  SOLAR_RADIATION: "W/m²",
  BATTERY: "%",
  SIGNAL: "dBm",
  CUSTOM: "",
};

export type TelemetryProject = {
  id: string;
  name: string;
  code_internal?: string | null;
  description?: string | null;
  branch: number;
  is_active: boolean;
  device_count?: number;
  created: string;
  modified: string;
};

export type TelemetryProvider = {
  id: string;
  name: string;
  protocol: "HTTP_REST" | "HTTP_GET" | "MQTT" | "WEBSOCKET" | "CUSTOM";
  base_url?: string;
  endpoint_template?: string;
  auth_type: "NONE" | "BASIC" | "BEARER" | "API_KEY_HEADER" | "QUERY_PARAM";
  auth_username?: string;
  auth_token?: string;
  auth_header_name?: string;
  handler_name: "generic_json" | "tdata" | "thethings" | "tago";
  parser_config?: Record<string, unknown>;
  is_active?: boolean;
};

export type TelemetryVariable = {
  id: string;
  device: string;
  name: string;
  variable_type: VariableType;
  provider_variable_id?: string | null;
  unit: string;
  conversion_factor: number | string;
  conversion_offset: number | string;
  min_value?: number | string | null;
  max_value?: number | string | null;
  is_counter: boolean;
  is_visible?: boolean;
  display_order?: number;
  branch: number;
  is_active: boolean;
  created?: string;
  modified?: string;
};

export type TelemetryReading = {
  id: string;
  device: string;
  variable?: string | null;
  variable_name?: string;
  reading_at: string;
  received_at?: string;
  raw_value: number | string;
  processed_value: number | string;
  unit: string;
  is_online?: boolean;
  minutes_offline?: number;
  is_error?: boolean;
  error_message?: string | null;
  is_validated?: boolean;
  send_dga?: boolean;
  dga_sent_at?: string | null;
  dga_response?: string | null;
  branch: number;
};

export type DeviceConfig = {
  id?: string;
  device: string;
  depth?: number | string;
  pump_position?: number | string;
  level_position?: number | string;
  pump_diameter_inches?: number | string;
  flowmeter_diameter_inches?: number | string;
  level_offset?: number | string;
  flow_initial?: number | string;
  replicate_on_missing?: boolean;
  max_diff_m3_per_hour?: number | string;
  max_flow_ls?: number | string;
  max_time_gap_hours?: number | string;
  reconnection_threshold_hours?: number | string;
};

export type ComplianceConfig = {
  id?: string;
  device: string;
  send_dga?: boolean;
  standard?: string;
  type_dga?: string;
  code_dga?: string | null;
  flow_granted_ls?: number | string;
  total_granted_m3?: number | null;
  shac?: string | null;
  region_dga?: string | null;
  date_start_compliance?: string | null;
  informant_name?: string;
  informant_rut?: string;
  provider_installation?: string | null;
  send_endpoint?: string | null;
  send_sma?: boolean;
  sma_device_id?: string | null;
  aggregate_device_ids?: string[];
};

export type TelemetryDevice = {
  id: string;
  name: string;
  device_type: DeviceType;
  project?: string | null;
  project_name?: string | null;
  telemetry_provider?: string | null;
  provider_name?: string | null;
  device_token?: string | null;
  reading_frequency: number;
  lat?: number | string | null;
  lon?: number | string | null;
  address?: string | null;
  is_active: boolean;
  is_online?: boolean;
  last_reading_at?: string | null;
  minutes_offline?: number | null;
  variables_count?: number;
  product?: number | null;
  product_name?: string | null;
  branch: number;
  metadata?: Record<string, unknown>;
  created?: string;
  modified?: string;
};

export type TelemetryDeviceDetail = TelemetryDevice & {
  config?: DeviceConfig | null;
  compliance_config?: ComplianceConfig | null;
  variables?: TelemetryVariable[];
  latest_readings?: TelemetryReading[];
};

export type TelemetryReadingStats = {
  device_id?: string;
  variable_id?: string;
  count: number;
  avg_value: number;
  min_value: number;
  max_value: number;
  first_reading?: string | null;
  last_reading?: string | null;
  error_count: number;
};

function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as { results?: T[] }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

// ── Dispositivos ─────────────────────────────────────────────────────────────

export async function fetchTelemetryDevices(params?: {
  branch?: number;
  project?: string;
  device_type?: string;
  is_online?: boolean;
  search?: string;
  page_size?: number;
}): Promise<TelemetryDevice[]> {
  const qs = new URLSearchParams();
  if (params?.branch) qs.set("branch", String(params.branch));
  if (params?.project) qs.set("project", params.project);
  if (params?.device_type) qs.set("device_type", params.device_type);
  if (params?.is_online !== undefined) qs.set("is_online", String(params.is_online));
  if (params?.search) qs.set("search", params.search);
  qs.set("page_size", String(params?.page_size ?? 100));

  const data = await apiFetch<unknown>(`/iot-telemetry/devices/?${qs.toString()}`);
  return asList<TelemetryDevice>(data);
}

export async function fetchTelemetryDeviceDetail(id: string): Promise<TelemetryDeviceDetail> {
  return apiFetch<TelemetryDeviceDetail>(`/iot-telemetry/devices/${id}/`);
}

export async function createTelemetryDevice(payload: {
  name: string;
  device_type: DeviceType;
  project?: string | null;
  telemetry_provider?: string | null;
  device_token?: string | null;
  reading_frequency?: number;
  lat?: number | string | null;
  lon?: number | string | null;
  address?: string | null;
  product?: number | null;
  branch?: number;
  metadata?: Record<string, unknown>;
}): Promise<TelemetryDevice> {
  return apiFetch<TelemetryDevice>("/iot-telemetry/devices/", {
    method: "POST",
    body: payload,
  });
}

export async function updateTelemetryDevice(
  id: string,
  payload: Partial<TelemetryDevice>,
): Promise<TelemetryDevice> {
  return apiFetch<TelemetryDevice>(`/iot-telemetry/devices/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteTelemetryDevice(id: string): Promise<void> {
  return apiFetch<void>(`/iot-telemetry/devices/${id}/`, {
    method: "DELETE",
  });
}

export async function syncDeviceReadings(deviceId: string): Promise<{ message: string; device_id: string }> {
  return apiFetch<{ message: string; device_id: string }>(
    `/iot-telemetry/devices/${deviceId}/sync_readings/`,
    { method: "POST" },
  );
}

export async function fetchDeviceStatus(deviceId: string): Promise<{
  id: string;
  name: string;
  is_online: boolean;
  is_disconnected: boolean;
  last_reading_at?: string | null;
  minutes_since_last_reading?: number | null;
}> {
  return apiFetch(`/iot-telemetry/devices/${deviceId}/status/`);
}

// ── Variables ────────────────────────────────────────────────────────────────

export async function fetchTelemetryVariables(params?: {
  device?: string;
  variable_type?: string;
  is_active?: boolean;
}): Promise<TelemetryVariable[]> {
  const qs = new URLSearchParams();
  if (params?.device) qs.set("device", params.device);
  if (params?.variable_type) qs.set("variable_type", params.variable_type);
  qs.set("page_size", "100");

  const data = await apiFetch<unknown>(`/iot-telemetry/variables/?${qs.toString()}`);
  return asList<TelemetryVariable>(data);
}

export async function createTelemetryVariable(payload: {
  device: string;
  name: string;
  variable_type: VariableType;
  provider_variable_id?: string | null;
  unit: string;
  conversion_factor?: number | string;
  conversion_offset?: number | string;
  min_value?: number | string | null;
  max_value?: number | string | null;
  is_counter?: boolean;
  is_visible?: boolean;
  display_order?: number;
  branch?: number;
}): Promise<TelemetryVariable> {
  return apiFetch<TelemetryVariable>("/iot-telemetry/variables/", {
    method: "POST",
    body: payload,
  });
}

export async function updateTelemetryVariable(
  id: string,
  payload: Partial<TelemetryVariable>,
): Promise<TelemetryVariable> {
  return apiFetch<TelemetryVariable>(`/iot-telemetry/variables/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteTelemetryVariable(id: string): Promise<void> {
  return apiFetch<void>(`/iot-telemetry/variables/${id}/`, {
    method: "DELETE",
  });
}

// ── Lecturas / Mediciones ───────────────────────────────────────────────────

export async function fetchTelemetryReadings(params?: {
  device?: string;
  variable?: string;
  is_error?: boolean;
  is_online?: boolean;
  page_size?: number;
}): Promise<TelemetryReading[]> {
  const qs = new URLSearchParams();
  if (params?.device) qs.set("device", params.device);
  if (params?.variable) qs.set("variable", params.variable);
  if (params?.is_error !== undefined) qs.set("is_error", String(params.is_error));
  if (params?.is_online !== undefined) qs.set("is_online", String(params.is_online));
  qs.set("page_size", String(params?.page_size ?? 100));

  const data = await apiFetch<unknown>(`/iot-telemetry/readings/?${qs.toString()}`);
  return asList<TelemetryReading>(data);
}

export async function createTelemetryReading(payload: {
  device: string;
  variable?: string | null;
  reading_at: string;
  raw_value: number | string;
  processed_value: number | string;
  unit: string;
  is_online?: boolean;
  is_error?: boolean;
  error_message?: string | null;
  send_dga?: boolean;
  branch?: number;
}): Promise<TelemetryReading> {
  return apiFetch<TelemetryReading>("/iot-telemetry/readings/", {
    method: "POST",
    body: payload,
  });
}

export async function fetchTelemetryReadingStats(params: {
  device?: string;
  variable?: string;
}): Promise<TelemetryReadingStats> {
  const qs = new URLSearchParams();
  if (params.device) qs.set("device", params.device);
  if (params.variable) qs.set("variable", params.variable);
  return apiFetch<TelemetryReadingStats>(`/iot-telemetry/readings/stats/?${qs.toString()}`);
}

// ── Proveedores & Proyectos ─────────────────────────────────────────────────

export async function fetchTelemetryProviders(): Promise<TelemetryProvider[]> {
  const data = await apiFetch<unknown>("/iot-telemetry/providers/?page_size=100");
  return asList<TelemetryProvider>(data);
}

export async function createTelemetryProvider(payload: Partial<TelemetryProvider>): Promise<TelemetryProvider> {
  return apiFetch<TelemetryProvider>("/iot-telemetry/providers/", {
    method: "POST",
    body: payload,
  });
}

export async function fetchTelemetryProjects(branchId?: number): Promise<TelemetryProject[]> {
  const qs = new URLSearchParams();
  if (branchId) qs.set("branch", String(branchId));
  qs.set("page_size", "100");
  const data = await apiFetch<unknown>(`/iot-telemetry/projects/?${qs.toString()}`);
  return asList<TelemetryProject>(data);
}

export async function createTelemetryProject(payload: {
  name: string;
  code_internal?: string;
  description?: string;
  branch?: number;
}): Promise<TelemetryProject> {
  return apiFetch<TelemetryProject>("/iot-telemetry/projects/", {
    method: "POST",
    body: payload,
  });
}
