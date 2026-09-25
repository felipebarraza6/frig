"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tarjeta KPI única de la app.
 * Tonos vía tokens semánticos del tema (nunca paletas hardcodeadas).
 * Estilo glass lite: sin gradientes, borde suave, blur, acento de tono.
 *
 * Variantes:
 * - `default`:   tarjeta glass independiente.
 * - `compact`:   igual pero más densa (informes).
 * - `embedded`:  celda sin borde propio, para grids con `divide-x/divide-y`.
 */

export type StatTone = "success" | "danger" | "warning" | "primary" | "muted";

export type StatCardVariant = "default" | "compact" | "embedded";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  /** Texto secundario bajo el valor (hint, contexto, unidad). */
  sub?: string;
  /** Chip de variación (▲/▼ PoP, sparkline, etc.). */
  delta?: React.ReactNode;
  tone?: StatTone;
  href?: string;
  onClick?: () => void;
  variant?: StatCardVariant;
  className?: string;
}

const TONE_CHIP: Record<StatTone, string> = {
  success: "bg-success/12 text-success",
  danger: "bg-danger/12 text-danger",
  warning: "bg-warning/12 text-warning",
  primary: "bg-primary/10 text-primary",
  muted: "bg-muted text-muted-foreground",
};

const TONE_ACCENT: Record<StatTone, string> = {
  success: "border-l-success/45",
  danger: "border-l-danger/45",
  warning: "border-l-warning/45",
  primary: "border-l-primary/45",
  muted: "border-l-border",
};

const TONE_VALUE: Record<StatTone, string> = {
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  primary: "text-primary",
  muted: "text-foreground",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  delta,
  tone = "muted",
  href,
  onClick,
  variant = "default",
  className,
}: StatCardProps) {
  const embedded = variant === "embedded";
  const compact = variant === "compact";

  const content = embedded ? (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {Icon && (
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", TONE_CHIP[tone])}>
              <Icon className="h-3 w-3" strokeWidth={2} />
            </span>
          )}
          {label}
        </span>
        {delta}
      </div>
      <span className={cn("text-2xl font-semibold tabular-nums tracking-tight", TONE_VALUE[tone])}>
        {value}
      </span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </>
  ) : (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg",
              compact ? "h-7 w-7" : "h-8 w-8",
              TONE_CHIP[tone],
            )}
          >
            <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span
          className={cn(
            "font-semibold tabular-nums tracking-tight",
            TONE_VALUE[tone],
            compact ? "text-xl" : "text-2xl",
          )}
        >
          {value}
        </span>
        {delta}
      </div>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </>
  );

  const baseClassName = cn(
    embedded
      ? "flex h-full flex-col gap-2 p-4 sm:p-5"
      : cn(
          "group relative flex h-full flex-col overflow-hidden rounded-2xl border-l-[3px] glass transition-colors",
          "hover:brightness-[1.02]",
          TONE_ACCENT[tone],
          compact ? "gap-1.5 p-3.5" : "gap-2 p-5",
        ),
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(baseClassName, "block cursor-pointer")}
        onClick={
          onClick
            ? (e) => {
                e.preventDefault();
                onClick();
              }
            : undefined
        }
      >
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(baseClassName, "w-full cursor-pointer text-left")}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClassName}>{content}</div>;
}
