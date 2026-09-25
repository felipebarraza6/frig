import type { ReactNode } from "react";
import { statusBadge, statusChip, statusDot } from "@/lib/status-styles";
import { cn } from "@/lib/utils";

/**
 * Chip/badge genérico. No redefine estilos: envuelve `statusBadge` /
 * `statusChip` / `statusDot` de `@/lib/status-styles` mapeando el tono a un
 * estado canónico, para que badge y tablas compartan la misma fuente de verdad.
 */

export type BadgeTone = "success" | "danger" | "warning" | "primary" | "muted";

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  /** Punto de color a la izquierda (usa `statusDot`). */
  dot?: boolean;
  /** Variante sólida (`statusChip`) en vez del soft con borde. */
  solid?: boolean;
  className?: string;
}

/** Estado canónico que representa cada tono en status-styles. */
const TONE_STATUS: Record<BadgeTone, string | null> = {
  success: "ACTIVE",
  danger: "CANCELLED",
  warning: "PENDING",
  // primary y muted no tienen equivalente en status-styles: se resuelven acá.
  primary: null,
  muted: null,
};

export function Badge({ tone = "muted", children, dot = false, solid = false, className }: BadgeProps) {
  const status = TONE_STATUS[tone];
  const toneStyles =
    tone === "primary"
      ? solid
        ? "border-transparent bg-primary text-primary-foreground"
        : "bg-primary/10 text-primary border-primary/20"
      : solid
        ? cn("border-transparent", statusChip(status))
        : statusBadge(status);
  const dotClass = tone === "primary" ? "bg-primary" : statusDot(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneStyles,
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} aria-hidden />}
      {children}
    </span>
  );
}
