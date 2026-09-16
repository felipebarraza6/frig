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
 * Favicon del tenant con cascada: favicon propio → logo del header →
 * nada (queda el de Frig). Reemplaza TODOS los link[rel=icon] existentes
 * (el layout define varios: icon.png, icon-192, apple-touch) para que el
 * navegador no siga mostrando uno viejo.
 */
export function setTenantFavicon(favicon: string | null | undefined, logo: string | null | undefined): void {
  const href = favicon || logo;
  if (!href) return;
  document
    .querySelectorAll<HTMLLinkElement>("link[rel='icon'], link[rel='apple-touch-icon'], link[rel='shortcut icon']")
    .forEach((link) => link.remove());
  const link = document.createElement("link");
  link.rel = "icon";
  link.href = href;
  document.head.appendChild(link);
}
