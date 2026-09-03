/**
 * Cliente HTTP minimalista contra la API Yggdra.
 *
 * Convenciones de Yggdra (ver docs/api-map.md):
 * - Auth: header `Authorization: Token <key>` (DRF Token)
 * - Sucursal: header `X-Branch-ID`
 * - Multi-tenant automático en backend (via middleware + BranchModelApi)
 * - Soft-delete: `is_active=True` por defecto, `?show_inactive=true` para ver más
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_YGGDRA_API_BASE ?? "http://localhost:8000/api";

export class ApiError extends Error {
  status: number;
  detail?: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/** Token de sesión (persistido en localStorage por el store de auth). */
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("frig.token");
}

function getBranchId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("frig.branch_id");
}

function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  // Limpiar la sesión persistida: si no, el localStorage queda con token y
  // datos de sucursal stale hasta que un nuevo login los sobrescriba.
  window.localStorage.removeItem("frig.token");
  window.localStorage.removeItem("frig.branch_id");
  window.localStorage.removeItem("frig.session");
  window.location.assign(`${window.location.origin}/login`);
}

type ApiOptions = {
  method?: string;
  /** Si es objeto se serializa a JSON. */
  body?: unknown;
  headers?: Record<string, string>;
  /** auto = salta si no hay token (para endpoints públicos), required = lanza. */
  auth?: "auto" | "required" | "none";
  branch?: "auto" | "none";
  /** Señal de cancelación opcional. */
  signal?: AbortSignal;
  /** Tiempo máximo de espera en milisegundos (por defecto 30.000 ms). */
  timeoutMs?: number;
};

function createRequestSignal(
  timeoutMs = 30_000,
  userSignal?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  if (timeoutMs > 0) {
    timer = setTimeout(() => {
      controller.abort(new ApiError(408, "Tiempo de espera agotado al conectar con el servidor"));
    }, timeoutMs);
  }

  if (userSignal) {
    if (userSignal.aborted) {
      controller.abort(userSignal.reason);
    } else {
      userSignal.addEventListener(
        "abort",
        () => controller.abort(userSignal.reason),
        { once: true },
      );
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timer) clearTimeout(timer);
    },
  };
}

export async function apiFetch<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    headers = {},
    auth = "required",
    branch = "auto",
    signal,
    timeoutMs,
  } = opts;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const token = getToken();
  if (auth === "required" && !token) {
    redirectToLogin();
    throw new ApiError(401, "No autenticado");
  }
  if (token && auth !== "none") {
    finalHeaders["Authorization"] = `Token ${token}`;
  }

  const branchId = getBranchId();
  if (branch === "auto" && branchId) {
    finalHeaders["X-Branch-ID"] = branchId;
  }

  const { signal: requestSignal, cleanup } = createRequestSignal(
    timeoutMs ?? 30_000,
    signal,
  );

  try {
    // credentials: "include" para la cookie HttpOnly de auth_token
    const url = /^https?:\/\//i.test(path) ? path : `${API_BASE}${path}`;
    const res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "include",
      signal: requestSignal,
    });

    if (res.status === 401 && auth === "required") {
      redirectToLogin();
      throw new ApiError(401, "Sesión expirada");
    }

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        // respuesta no JSON (ej: PDF) ─ se devuelve tal cual
      }
    }

    if (!res.ok) {
      const detail = data;
      const message = formatErrorDetail(detail) || `Error ${res.status}`;
      const error = new ApiError(res.status, message, detail);
      if (res.status === 403 && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("api:forbidden", { detail: error }));
      }
      throw error;
    }

    return data as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      if (requestSignal.reason instanceof ApiError) {
        throw requestSignal.reason;
      }
      throw new ApiError(408, "Petición cancelada o tiempo de espera agotado");
    }
    throw err;
  } finally {
    cleanup();
  }
}

function formatErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      const sub = Object.values(first as Record<string, unknown>)[0];
      return formatErrorDetail(sub);
    }
  }
  if (detail && typeof detail === "object") {
    const record = detail as Record<string, unknown>;
    for (const key of ["detail", "non_field_errors", "error"]) {
      if (key in record) {
        const value = formatErrorDetail(record[key]);
        if (value) return value;
      }
    }
    const first = Object.values(record)[0];
    if (first !== undefined) return formatErrorDetail(first);
  }
  return "";
}

export interface ApiFileResult {
  blob: Blob;
  filename?: string;
}

function extractFilename(headers: Headers): string | undefined {
  const disposition = headers.get("content-disposition");
  if (!disposition) return undefined;

  const filenameStar = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (filenameStar) {
    return decodeURIComponent(filenameStar[1].replace(/['"]/g, ""));
  }

  const filename = disposition.match(/filename=['"]?([^'";]+)['"]?/i);
  if (filename) {
    return filename[1];
  }

  return undefined;
}

/**
 * Helper para descargar archivos binarios (PDF, XLSX, PNG).
 * Por defecto envía Accept: cualquier tipo MIME para evitar que DRF devuelva
 * 406 cuando los viewsets no registran un renderer para application/pdf o
 * application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.
 */
export async function apiFile(
  path: string,
  opts: ApiOptions = {},
): Promise<ApiFileResult> {
  const {
    method = "GET",
    body,
    headers = {},
    auth = "required",
    branch = "auto",
    signal,
    timeoutMs,
  } = opts;

  const finalHeaders: Record<string, string> = {
    Accept: "*/*",
    ...headers,
  };
  if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const token = getToken();
  if (auth === "required" && !token) {
    redirectToLogin();
    throw new ApiError(401, "No autenticado");
  }
  if (token && auth !== "none") {
    finalHeaders["Authorization"] = `Token ${token}`;
  }

  const branchId = getBranchId();
  if (branch === "auto" && branchId) {
    finalHeaders["X-Branch-ID"] = branchId;
  }

  const { signal: requestSignal, cleanup } = createRequestSignal(
    timeoutMs ?? 60_000, // Archivos pueden demorar más (60s)
    signal,
  );

  try {
    const url = /^https?:\/\//i.test(path) ? path : `${API_BASE}${path}`;
    const res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "include",
      signal: requestSignal,
    });

    if (res.status === 401 && auth === "required") {
      redirectToLogin();
      throw new ApiError(401, "Sesión expirada");
    }

    if (!res.ok) {
      const text = await res.text();
      let detail: unknown = text;
      try {
        detail = JSON.parse(text);
      } catch {
        // respuesta no JSON: conservamos el texto crudo
      }
      const message = formatErrorDetail(detail) || `Error ${res.status} al descargar archivo`;
      throw new ApiError(res.status, message, detail);
    }

    return { blob: await res.blob(), filename: extractFilename(res.headers) };
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      if (requestSignal.reason instanceof ApiError) {
        throw requestSignal.reason;
      }
      throw new ApiError(408, "Petición cancelada o tiempo de espera agotado al descargar archivo");
    }
    throw err;
  } finally {
    cleanup();
  }
}