import { ApiError, apiFetch } from "./client";
import type { FrontendConfigResponse } from "@/lib/api/types/modules";

const ETAG_STORAGE_PREFIX = "frig.frontend-config.etag.";
const BODY_STORAGE_PREFIX = "frig.frontend-config.body.";

function cacheKey(branchId?: number): string {
  return branchId != null && branchId > 0 ? String(branchId) : "default";
}

function readCached(key: string): FrontendConfigResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(BODY_STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as FrontendConfigResponse) : null;
  } catch {
    return null;
  }
}

function remember(key: string, res: Response, data: FrontendConfigResponse | null): void {
  if (typeof window === "undefined") return;
  try {
    const etag = res.headers.get("ETag");
    if (etag) window.sessionStorage.setItem(ETAG_STORAGE_PREFIX + key, etag);
    if (data) {
      window.sessionStorage.setItem(BODY_STORAGE_PREFIX + key, JSON.stringify(data));
    }
  } catch {
    /* quota: se sigue sin caché condicional */
  }
}

/**
 * GET /api/shared/frontend-config/
 *
 * Punto de entrada único para inicializar el frontend. Devuelve usuario,
 * sucursales, rol, menú ya filtrado, módulos habilitados, dashboard y
 * feature flags.
 *
 * El backend responde ETag. Si el payload no cambió, el 304 se resuelve con
 * la copia de esta pestaña: no se vuelve a bajar el JSON grande.
 */
export async function fetchFrontendConfig(branchId?: number): Promise<FrontendConfigResponse> {
  const qs = new URLSearchParams();
  if (branchId != null && Number.isFinite(branchId) && branchId > 0) {
    qs.set("branch_id", String(branchId));
  }
  const query = qs.toString();
  const key = cacheKey(branchId);
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const etag = window.sessionStorage.getItem(ETAG_STORAGE_PREFIX + key);
    if (etag) headers["If-None-Match"] = etag;
  }

  try {
    let response: Response | null = null;
    const data = await apiFetch<FrontendConfigResponse>(
      `/shared/frontend-config/${query ? `?${query}` : ""}`,
      {
        headers,
        onResponse: (res) => {
          response = res;
        },
      },
    );
    if (response) remember(key, response, data);
    return data;
  } catch (err) {
    const cached = readCached(key);
    if (err instanceof ApiError && err.status === 304 && cached) return cached;
    throw err;
  }
}
