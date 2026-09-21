import type { CSSProperties } from "react";

/**
 * Identidad visual Frig para las páginas de autenticación cuando NO hay
 * branding de tenant (localhost, dominios propios de Frig). Con un theme
 * de sucursal activo NO se aplica: la paleta la deriva applyThemeConfig
 * desde el primary del tenant (lo que el usuario eligió es lo que ve).
 */
export const FRIG_IDENTITY_STYLE = {
  "--brand-primary": "#c67d52",
  "--color-primary": "#c67d52",
  "--primary": "#c67d52",
  "--ring": "#c67d52",
  "--input": "#27272a",
  "--border": "#27272a",
  "--background": "#0a0a0a",
  "--card": "#141414",
  "--muted": "#1c1c1f",
  "--muted-foreground": "#a1a1aa",
  "--accent": "#1c1c1f",
  "--secondary": "#1c1c1f",
} as CSSProperties;

/** Repo público de Frig — atribución sutil en logins de tenants. */
export const FRIG_REPO_URL = "https://github.com/FelipeBarraza6/frig";

/**
 * Reemplaza TODOS los link[rel=icon] del head por uno nuevo. Necesario
 * porque el layout define varios (icon.png, icon-192, apple-touch...) y
 * cambiar solo el primero no garantiza que el navegador lo use.
 *
 * IMPORTANTE: los link de iconos los renderiza React (metadata del App
 * Router). Hay que actualizar su href EN SITIO, nunca removerlos: si se
 * eliminan por fuera, el commit de la siguiente navegación intenta borrar
 * nodos ya desmontados y React crashea con
 * "Cannot read properties of null (reading 'removeChild')", dejando la
 * página congelada justo después del login.
 */
export function setFaviconHref(href: string): void {
  const links = document.querySelectorAll<HTMLLinkElement>(
    "head link[rel='icon'], head link[rel='apple-touch-icon'], head link[rel='shortcut icon']",
  );
  if (links.length > 0) {
    links.forEach((link) => {
      link.href = href;
    });
    return;
  }
  // Sin links previos (caso extremo), crear uno es seguro: React no lo
  // conoce y nunca intentará removerlo.
  const link = document.createElement("link");
  link.rel = "icon";
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Favicon del tenant con cascada: favicon propio → logo del header →
 * nada (queda el de Frig).
 */
export function setTenantFavicon(
  favicon: string | null | undefined,
  logo: string | null | undefined,
): void {
  const href = favicon || logo;
  if (!href) return;
  setFaviconHref(href);
}
