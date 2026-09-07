"use client";

import { useEffect } from "react";

/**
 * /login/<slug> → /login?branch=<slug> (preservando ?token= del magic-link).
 * Lee el slug real de la URL en el cliente (la exportación estática genera
 * una sola instancia del placeholder "__" y .htaccess reescribe todos los
 * slugs a ella, por lo que el redirect no puede resolverse en build).
 */
export function LoginSlugRedirect() {
  useEffect(() => {
    const match = window.location.pathname.match(/^\/login\/([^/]+)\/?$/);
    if (!match) {
      window.location.replace("/login");
      return;
    }
    const token = new URLSearchParams(window.location.search).get("token");
    const target = `/login?branch=${encodeURIComponent(match[1])}` +
      (token ? `&token=${encodeURIComponent(token)}` : "");
    window.location.replace(target);
  }, []);

  return (
    <div className="flex min-h-dvh flex-1 items-center justify-center bg-background">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}
