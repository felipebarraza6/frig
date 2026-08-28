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
 * Encabezado estándar de página. Reemplaza los h1 ad-hoc que tenían cada
 * pantalla (text-2xl/text-xl/text-4xl/font-bold/font-semibold…) y unifica
 * la jerarquía visual: título + subtítulo opcional a la izquierda, acciones
 * a la derecha. El icono se renderiza dentro de un cuadrado primary/10.
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
    <header className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {badge}
          </div>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
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
