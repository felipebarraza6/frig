"use client";

import { useState } from "react";
import { Store } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  src?: string | null;
  alt?: string;
  className?: string;
  /** Clase del contenedor del fallback (ícono). */
  containerClassName?: string;
}

/**
 * Logo de la sucursal (theme.logo) con fallback a ícono genérico si no hay
 * logo o falla la carga. Usa <img>: el dominio del backend es dinámico en
 * multi-tenant, no es configurable en next.config.
 */
export function BrandLogo({ src, alt = "Logo", className, containerClassName }: BrandLogoProps) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg bg-primary text-white",
          containerClassName ?? "h-9 w-9",
        )}
      >
        <Store className="h-5 w-5" />
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
        src={src}
        alt={alt}
        onError={() => setError(true)}
        className={cn("object-contain", className ?? "h-full w-full p-1")}
      />
    </div>
  );
}
