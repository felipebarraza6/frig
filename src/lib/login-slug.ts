/**
 * Persistencia del slug de login white-label.
 *
 * Sin esto, un 401 o logout manda a `/login` genérico y se pierde la marca
 * del tenant (`/login/<slug>` o `/login?branch=<slug>`).
 */

export const LOGIN_SLUG_STORAGE_KEY = "frig.login_slug";

/** Normaliza un slug de login (sin barras ni espacios). */
export function normalizeLoginSlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const clean = slug.trim().replace(/^\/+|\/+$/g, "");
  if (!clean || clean.toLowerCase() === "login") return null;
  // Evitar valores basura / inyección de path.
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(clean)) return null;
  return clean;
}

/** Guarda el slug de la sesión de login (localStorage). */
export function rememberLoginSlug(slug: string | null | undefined): void {
  if (typeof window === "undefined") return;
  const clean = normalizeLoginSlug(slug);
  if (!clean) return;
  window.localStorage.setItem(LOGIN_SLUG_STORAGE_KEY, clean);
}

/** Lee el slug recordado, o null. */
export function getRememberedLoginSlug(): string | null {
  if (typeof window === "undefined") return null;
  return normalizeLoginSlug(window.localStorage.getItem(LOGIN_SLUG_STORAGE_KEY));
}

/** Ruta de login con marca: `/login/<slug>` o `/login`. */
export function loginPath(slug?: string | null): string {
  const resolved = normalizeLoginSlug(slug) ?? getRememberedLoginSlug();
  if (resolved) return `/login/${encodeURIComponent(resolved)}`;
  return "/login";
}

/** URL absoluta de login (401 / logout). */
export function loginRedirectUrl(origin?: string, slug?: string | null): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${loginPath(slug)}`;
}
