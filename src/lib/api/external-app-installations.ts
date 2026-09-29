import { apiFetch } from "./client";

export type ExternalApp = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category?: string;
  base_url?: string;
  auth_type?: string;
  required_credential_keys?: string[] | unknown;
  icon_url?: string;
  documentation_url?: string;
  usage_contexts?: string[];
  is_active: boolean;
};

export type ExternalAppEndpoint = {
  id: string;
  external_app: string;
  name: string;
  slug: string;
  description?: string;
  method?: string;
  path: string;
  body_schema?: unknown;
  response_mapping?: unknown;
  is_active?: boolean;
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
  credentials_configured?: boolean;
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

export async function fetchExternalApps(filter: {
  category?: string;
  usage_context?: string;
  page_size?: number;
} = {}): Promise<ExternalApp[]> {
  const qs = new URLSearchParams();
  if (filter.category) qs.set("category", filter.category);
  if (filter.usage_context) qs.set("usage_context", filter.usage_context);
  qs.set("page_size", String(filter.page_size ?? 50));
  qs.set("is_active", "true");
  const data = await apiFetch<{ results?: ExternalApp[] } | ExternalApp[]>(
    `/external-apps/external-apps/?${qs.toString()}`,
  );
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export async function fetchExternalAppEndpoints(
  appId: string,
): Promise<ExternalAppEndpoint[]> {
  const qs = new URLSearchParams();
  qs.set("external_app", appId);
  qs.set("page_size", "50");
  const data = await apiFetch<{ results?: ExternalAppEndpoint[] } | ExternalAppEndpoint[]>(
    `/external-apps/external-app-endpoints/?${qs.toString()}`,
  );
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export function credentialKeysForApp(app: ExternalApp): string[] {
  const required = Array.isArray(app.required_credential_keys)
    ? (app.required_credential_keys as string[]).filter(Boolean)
    : [];
  if (required.length > 0) return required;
  switch (app.auth_type) {
    case "api_key":
      return ["api_key"];
    case "bearer":
      return ["token"];
    case "basic":
      return ["username", "password"];
    case "oauth2":
      return ["client_id", "client_secret"];
    default:
      return ["api_key"];
  }
}

export function credentialFieldLabel(key: string): string {
  const labels: Record<string, string> = {
    api_key: "Clave API",
    secret_key: "Clave secreta",
    token: "Token",
    bearer_token: "Token",
    username: "Usuario",
    password: "Contraseña",
    client_id: "ID de cliente",
    client_secret: "Secreto de cliente",
    rut: "RUT emisor",
  };
  return labels[key] ?? key.replace(/_/g, " ");
}

export function isSecretCredentialKey(key: string): boolean {
  const k = key.toLowerCase();
  if (k === "username" || k === "rut" || k === "client_id" || k.endsWith("_email") || k === "from_email") {
    return false;
  }
  return /password|secret|token|key|api_key/.test(k);
}

export function authTypeHint(app: Pick<ExternalApp, "auth_type" | "required_credential_keys"> | null): string {
  if (!app) return "";
  switch (app.auth_type) {
    case "none":
      return "Esta app no pide credenciales.";
    case "basic":
      return "Esta app pide usuario y contraseña.";
    case "bearer":
      return "Esta app pide un token Bearer.";
    case "api_key":
      return "Esta app pide una clave API.";
    case "oauth2":
      return "Esta app pide ID y secreto de cliente.";
    default:
      return credentialKeysForApp(app as ExternalApp).length
        ? "Los campos salen de lo que declara la app."
        : "";
  }
}

export function isSiiBillingApp(app: Pick<ExternalApp, "category" | "usage_contexts">): boolean {
  if (app.category === "sii") return true;
  return (app.usage_contexts ?? []).includes("invoicing");
}

export async function fetchExternalAppInstallations(
  branchId: number,
  filter: { category?: string } = {},
): Promise<ExternalAppInstallation[]> {
  const qs = new URLSearchParams();
  qs.set("branch", String(branchId));
  if (filter.category) qs.set("external_app__category", filter.category);
  qs.set("page_size", "50");
  const data = await apiFetch<{ results?: ExternalAppInstallation[] }>(
    `/external-apps/external-app-installations/?${qs.toString()}`,
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
  id: string,
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

export async function revealInstallationCredentials(
  id: string,
): Promise<Record<string, string>> {
  const data = await apiFetch<{ credentials?: Record<string, string> }>(
    `/external-apps/external-app-installations/${id}/reveal_credentials/`,
    { method: "POST" },
  );
  const creds = data.credentials ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(creds)) {
    out[k] = v == null ? "" : String(v);
  }
  return out;
}

export async function testExternalAppInstallation(
  id: string,
): Promise<{ success: boolean; message?: string }> {
  return apiFetch(`/external-apps/external-app-installations/${id}/test_connection/`, {
    method: "POST",
  });
}

export async function deleteExternalAppInstallation(id: string): Promise<void> {
  return apiFetch<void>(`/external-apps/external-app-installations/${id}/`, {
    method: "DELETE",
  });
}
