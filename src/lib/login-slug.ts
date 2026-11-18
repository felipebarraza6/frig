/**
 * Persistencia del slug de login white-label.
 *
 * Sin esto, un 401 o logout manda a `/login` genérico y se pierde la marca
 * del tenant (`/login/<slug>` o `/login?branch=<slug>`).
 */

export const LOGIN_SLUG_STORAGE_KEY = "frig.login_slug";

/**
 * Recupera un slug de login usable.
 *
 * Corta en el primer punto (Django rechaza puntos) y, si se pasan slugs
 * conocidos, se queda con el prefijo más largo (`arena-negra-…` → `arena-negra`).
 */
export function recoverLoginSlug(
  slug: string | null | undefined,
  knownSlugs?: readonly string[],
): string | null {
  if (!slug) return null;
  let clean = slug.trim().replace(/^\/+|\/+$/g, "").toLowerCase();
  clean = clean.split("?")[0].split("#")[0];
  if (clean.includes("/") || clean.includes("\\") || clean.includes("..")) return null;
  const dot = clean.indexOf(".");
  if (dot >= 0) clean = clean.slice(0, dot);
  clean = clean.replace(/[^a-z0-9_-]/g, "").replace(/_+/g, "_").replace(/-+/g, "-");
  clean = clean.replace(/^[-_]+|[-_]+$/g, "");
  if (!clean || clean === "login") return null;
  if (clean.length > 64) clean = clean.slice(0, 64).replace(/[-_]+$/g, "");

  if (knownSlugs?.length) {
    const sorted = [...knownSlugs]
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    for (const key of sorted) {
      if (clean === key || clean.startsWith(`${key}-`) || clean.startsWith(`${key}_`)) {
        return key;
      }
    }
  }

  if (!/^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/.test(clean) && clean.length !== 1) {
    return null;
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(clean)) return null;
  return clean;
}

/** Normaliza un slug de login (sin barras, puntos ni espacios). */
export function normalizeLoginSlug(slug: string | null | undefined): string | null {
  return recoverLoginSlug(slug);
}

/** Cuerpo de forgot_password: incluye login_slug solo si el portal lo trae. */
export function forgotPasswordBody(
  email: string,
  branchParam?: string | null,
  knownSlugs?: readonly string[],
): { email: string; login_slug?: string } {
  const login_slug = recoverLoginSlug(branchParam, knownSlugs) ?? undefined;
  return login_slug ? { email, login_slug } : { email };
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
