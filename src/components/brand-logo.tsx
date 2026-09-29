"use client";

import { useEffect, useState } from "react";
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

/** JPG/BMP no tienen alfa: un plato blanco evita el “hueco”. PNG/SVG se ven sobre el fondo real. */
function isOpaqueImage(src: string): boolean {
  const path = src.split("?")[0].split("#")[0].toLowerCase();
  return /\.(jpe?g|jfif|bmp)$/.test(path);
}

function LogoFrame({
  src,
  alt,
  className,
  containerClassName,
  onError,
}: {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  onError?: () => void;
}) {
  const opaque = isOpaqueImage(src);
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-lg",
        containerClassName ?? "h-9 w-9",
        opaque ? "bg-white" : "bg-transparent",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={onError}
        className={cn("object-contain", className ?? "h-full w-full p-0.5")}
      />
    </div>
  );
}

/**
 * Logo de marca: PNG con transparencia sobre el fondo de la UI;
 * JPG sobre blanco. Usa <img> porque el dominio del backend es dinámico.
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

  useEffect(() => {
    setError(false);
  }, [src]);

  const useFrigMark =
    !resolvedSrc || error
      ? !name || name.trim().toLowerCase() === "frig"
      : false;

  if (!resolvedSrc || error) {
    if (useFrigMark) {
      return (
        <LogoFrame
          src="/brand/frig-symbol.png"
          alt={alt || "Logo"}
          className={className}
          containerClassName={containerClassName}
        />
      );
    }
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
    <LogoFrame
      src={resolvedSrc}
      alt={alt}
      className={className}
      containerClassName={containerClassName}
      onError={() => setError(true)}
    />
  );
}
