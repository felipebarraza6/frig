import { API_BASE } from "./base";

let pending: Promise<string> | null = null;

/** Token enmascarado para `X-CSRFToken` (la cookie csrftoken es HttpOnly). */
export function getCsrfToken(): Promise<string> {
  pending ??= fetch(`${API_BASE}/accounts/csrf/`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`CSRF ${res.status}`);
      const data = (await res.json()) as { csrfToken?: string };
      return data.csrfToken ?? "";
    })
    .catch((err: unknown) => {
      pending = null;
      throw err;
    });
  return pending;
}

export function resetCsrfToken(): void {
  pending = null;
}

export function isCsrfFailure(status: number, detail: unknown): boolean {
  if (status !== 403 || !detail || typeof detail !== "object") return false;
  const message = (detail as { detail?: unknown }).detail;
  return typeof message === "string" && message.startsWith("CSRF Failed");
}

export const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
