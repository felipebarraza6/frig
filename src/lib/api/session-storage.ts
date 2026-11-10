import { API_BASE } from "./base";
import { isCookieSessionHost } from "./auth-mode";

const TOKEN_KEY = "frig.token";
const COOKIE_SESSION_KEY = "frig.cookie_session";
const BRANCH_KEY = "frig.branch_id";
const SALON_DEMO_TOKEN = "salon-demo-dummy";

export function usesCookieSession(): boolean {
  if (typeof window === "undefined") return false;
  return isCookieSessionHost(window.location, API_BASE);
}

// Sesiones abiertas antes del modo cookie: el login de entonces ya dejó la
// cookie, así que basta con marcar la sesión y borrar el token legible.
function migrateLegacyToken(): void {
  const legacy = window.localStorage.getItem(TOKEN_KEY);
  if (!legacy || legacy === SALON_DEMO_TOKEN) return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.setItem(COOKIE_SESSION_KEY, "1");
}

/** Token para `Authorization`; null cuando la sesión va en la cookie HttpOnly. */
export const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  if (usesCookieSession()) {
    migrateLegacyToken();
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
};

/** Hay una sesión iniciada en este navegador (token o cookie). */
export const hasSession = (): boolean => {
  if (typeof window === "undefined") return false;
  if (usesCookieSession()) {
    migrateLegacyToken();
    return window.localStorage.getItem(COOKIE_SESSION_KEY) === "1";
  }
  return Boolean(window.localStorage.getItem(TOKEN_KEY));
};

export const saveSession = (token: string): void => {
  if (usesCookieSession()) {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.setItem(COOKIE_SESSION_KEY, "1");
    return;
  }
  window.localStorage.setItem(TOKEN_KEY, token);
};

export const clearStoredSession = (): void => {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(COOKIE_SESSION_KEY);
};

export const getBranchId = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(BRANCH_KEY);
};

export const setBranchId = (id: string | number): void => {
  window.localStorage.setItem(BRANCH_KEY, String(id));
};

export const clearBranchId = (): void => {
  window.localStorage.removeItem(BRANCH_KEY);
};
