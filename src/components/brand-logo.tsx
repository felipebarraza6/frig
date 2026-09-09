"use client";

import { useState } from "react";
import { Store } from "lucide-react";
import { mediaUrl } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  src?: string | null;
  alt?: string;
  className?: string;
  /** Nombre de la tienda/sucursal para fallback con iniciales. */
  name?: string | null;
  /** Clase del contenedor del fallback (ícono/iniciales). */
  containerClassName?: string;
  /** Color de fondo del fallback de iniciales (ej. tema de la sucursal). */
  fallbackColor?: string;
}

function getInitials(name?: string | null): string {
  if (!name) return "";
  const ignored = new Set(["de", "del", "la", "el", "los", "las", "y", "e", "o", "u"]);
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !ignored.has(w.toLowerCase()));
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Logo de la sucursal (theme.logo) con fallback a iniciales de la tienda y,
 * en último caso, a un ícono genérico. Usa <img>: el dominio del backend es
 * dinámico en multi-tenant, no es configurable en next.config.
 */
export function BrandLogo({
  src,
  alt = "Logo",
  name,
  className,
  containerClassName,
  fallbackColor,
}: BrandLogoProps) {
  const [error, setError] = useState(false);
  const initials = getInitials(name);
  const resolvedSrc = mediaUrl(src);

  if (!resolvedSrc || error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg bg-primary text-white font-semibold",
          containerClassName ?? "h-9 w-9",
        )}
        style={fallbackColor ? { backgroundColor: fallbackColor } : undefined}
        title={name ?? alt}
      >
        {initials ? (
          <span className="select-none">{initials}</span>
        ) : (
          <Store className="h-5 w-5" />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-lg bg-white",
        containerClassName ?? "h-9 w-9",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolvedSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setError(true)}
        className={cn("object-contain", className ?? "h-full w-full p-1")}
      />
    </div>
  );
}
