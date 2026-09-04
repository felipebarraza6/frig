import { apiFetch } from "./client";

export type ExternalApp = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category?: string;
  base_url?: string;
  auth_type?: string;
  is_active: boolean;
};

export type ExternalAppInstallation = {
  id: string;
  external_app: string | { id: string; name: string; slug: string };
  external_app_name?: string;
  external_app_category?: string;
  branch: number;
  label: string;
  description?: string;
  credentials?: Record<string, unknown>;
  config_override?: Record<string, unknown>;
  last_verified_at?: string;
  last_error?: string;
  is_active: boolean;
  created: string;
  modified: string;
};

export interface CreateExternalAppInstallationInput {
  external_app: string;
  branch?: number;
  label: string;
  description?: string;
  credentials?: Record<string, unknown>;
  config_override?: Record<string, unknown>;
  is_active?: boolean;
}

export async function fetchExternalApps(): Promise<ExternalApp[]> {
  const data = await apiFetch<{ results?: ExternalApp[] }>("/external-apps/external-apps/");
  return data.results ?? [];
}

export async function fetchExternalAppInstallations(
  branchId: number,
): Promise<ExternalAppInstallation[]> {
  const data = await apiFetch<{ results?: ExternalAppInstallation[] }>(
    `/external-apps/external-app-installations/?branch=${branchId}`,
  );
  return data.results ?? [];
}

export async function createExternalAppInstallation(
  payload: CreateExternalAppInstallationInput,
): Promise<ExternalAppInstallation> {
  return apiFetch<ExternalAppInstallation>(
    "/external-apps/external-app-installations/",
    {
      method: "POST",
      body: payload,
    },
  );
}

export async function updateExternalAppInstallation(
  id: number,
  payload: Partial<CreateExternalAppInstallationInput>,
): Promise<ExternalAppInstallation> {
  return apiFetch<ExternalAppInstallation>(
    `/external-apps/external-app-installations/${id}/`,
    {
      method: "PATCH",
      body: payload,
    },
  );
}

export async function deleteExternalAppInstallation(
  id: number,
): Promise<void> {
  return apiFetch<void>(`/external-apps/external-app-installations/${id}/`, {
    method: "DELETE",
  });
}
