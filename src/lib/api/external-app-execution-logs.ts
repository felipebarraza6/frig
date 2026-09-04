import { apiFetch } from "./client";

export type ExternalAppExecutionLog = {
  id: number;
  installation: number;
  installation_label?: string;
  endpoint?: number;
  endpoint_name?: string;
  request_method?: string;
  request_url?: string;
  request_headers?: Record<string, unknown>;
  request_body?: Record<string, unknown>;
  response_status?: number;
  response_body?: Record<string, unknown> | string;
  response_time_ms?: number;
  triggered_by?: string;
  triggered_by_id?: string;
  success: boolean;
  error_message?: string;
  created: string;
};

export async function fetchExternalAppExecutionLogs(
  installationId?: string,
): Promise<ExternalAppExecutionLog[]> {
  const qs = installationId ? `?installation=${installationId}` : "";
  const data = await apiFetch<{ results?: ExternalAppExecutionLog[] }>(
    `/external-apps/external-app-execution-logs/${qs}`,
  );
  return data.results ?? [];
}
