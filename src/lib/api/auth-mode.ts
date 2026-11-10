function siteOf(hostname: string): string {
  return hostname.toLowerCase().split(".").slice(-2).join(".");
}

/**
 * La sesión vive en la cookie HttpOnly `auth_token` solo cuando la página y
 * la API son del mismo sitio (frig.yggdra.cl ↔ api.yggdra.cl). En otro
 * dominio (intranets de clientes, staging en github.io) el backend emite
 * las cookies con SameSite=Lax y el navegador no las manda: ahí sigue el
 * header `Authorization: Token`.
 */
export function isCookieSessionHost(
  page: { protocol: string; hostname: string },
  apiBase: string,
): boolean {
  if (page.protocol !== "https:") return false;
  let api: URL;
  try {
    api = new URL(apiBase);
  } catch {
    return false;
  }
  if (api.protocol !== "https:") return false;
  return siteOf(page.hostname) === siteOf(api.hostname);
}
