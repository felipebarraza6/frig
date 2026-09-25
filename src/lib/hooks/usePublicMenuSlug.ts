"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

/**
 * Resuelve el slug del menú público en tres fuentes (en orden):
 * 1. `?slug=` (ruta estática /menu/view y /menu/totem — funciona en next:dev
 *    con `output: "export"`).
 * 2. Pathname real `/menu/<slug>` (Apache .htaccess sirve __.html pero la URL
 *    del navegador conserva el slug).
 * 3. `useParams().slug` si no es el placeholder `__`.
 */
export function usePublicMenuSlug(explicit?: string | null): string {
  const params = useParams<{ slug?: string }>();
  const search = useSearchParams();
  const querySlug = search.get("slug");
  const paramSlug = params?.slug;

  const [slug, setSlug] = useState(() => {
    if (explicit) return explicit;
    if (querySlug) return querySlug;
    if (paramSlug && paramSlug !== "__") return paramSlug;
    return "";
  });

  useEffect(() => {
    if (explicit) {
      setSlug(explicit);
      return;
    }
    if (querySlug) {
      setSlug(querySlug);
      return;
    }
    if (typeof window !== "undefined") {
      const match = window.location.pathname.match(
        /^\/menu\/([^/]+)(?:\/totem)?\/?$/i,
      );
      const fromPath = match?.[1] ? decodeURIComponent(match[1]) : "";
      if (fromPath && fromPath !== "__" && fromPath !== "view" && fromPath !== "totem") {
        setSlug(fromPath);
        return;
      }
    }
    if (paramSlug && paramSlug !== "__") {
      setSlug(paramSlug);
    }
  }, [explicit, querySlug, paramSlug]);

  return slug;
}
