import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shell de página (referencia: Dashboard).
 * Centra el contenido en `max-w-7xl` para que cabecera y cuerpo
 * compartan el mismo eje y no se estiren a full-width.
 */
export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex min-h-full w-full max-w-7xl flex-col", className)}>
      {children}
    </div>
  );
}

/**
 * Cuerpo bajo el PageHeader (referencia: Dashboard).
 * Padding `p-4 sm:p-6` y gap `gap-6`.
 */
export function PageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-1 flex-col gap-6 p-4 sm:p-6", className)}>
      {children}
    </div>
  );
}
