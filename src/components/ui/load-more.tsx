"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LoadMoreFooterProps {
  /** Filas actualmente en pantalla. */
  showing: number;
  /** Total real según el backend (envelope paginado). */
  total: number;
  isLoading?: boolean;
  onLoadMore: () => void;
  /** Sustantivo plural para el texto ("oportunidades", "acciones"...). */
  label?: string;
  className?: string;
}

/**
 * Estado honesto de listas: "Mostrando N de M" + cargar más incremental.
 * Evita el truncado silencioso de los page_size fijos.
 */
export function LoadMoreFooter({
  showing,
  total,
  isLoading = false,
  onLoadMore,
  label = "registros",
  className,
}: LoadMoreFooterProps) {
  if (total === 0) return null;
  const remaining = Math.max(0, total - showing);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="tabular-nums">
        Mostrando {showing} de {total} {label}
      </span>
      {remaining > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2.5 text-xs"
          onClick={onLoadMore}
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          Cargar más ({remaining})
        </Button>
      )}
    </div>
  );
}
