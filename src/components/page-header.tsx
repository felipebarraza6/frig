import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

/**
 * Encabezado estándar (referencia: Dashboard).
 * - Borde inferior + padding `px-4 py-3 sm:px-6`
 * - Título display + subtítulo muted
 * - Icono con tokens de marca (`bg-primary/10 text-primary`)
 * Sin margen inferior: el cuerpo (`PageBody`) aporta el gap.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-0 flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-2 sm:shrink-0">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
