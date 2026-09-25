"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { YggdraSchemas } from "@/lib/api/types";

type TableItem = YggdraSchemas["Table"];

const STATUS_STYLES: Record<string, string> = {
  FREE: "border-success/40 bg-success/5 hover:border-success/70",
  RESERVED: "border-warning/40 bg-warning/5 hover:border-warning/70",
  OCCUPIED: "border-primary/30 bg-primary/5",
  CLEANING: "border-primary/30 bg-primary/5",
  OUT_OF_SERVICE: "border-muted/40 bg-muted/20",
};

const STATUS_LABELS: Record<string, string> = {
  FREE: "Libre",
  RESERVED: "Reservada",
  OCCUPIED: "Ocupada",
  CLEANING: "Limpieza",
  OUT_OF_SERVICE: "Fuera",
};

interface CashierTableTilesProps {
  tables: TableItem[];
  selectedId: number | string | null;
  onSelect: (table: TableItem | null) => void;
  /** Altura máxima de la grilla (default 11rem). */
  maxHeightClass?: string;
  /** Oculta mesas no seleccionables (ocupadas/fuera de servicio). */
  hideUnavailable?: boolean;
}

/**
 * Fichas de mesa para el cajero: ve el estado de la sala de un vistazo
 * (libre/ocupada/reservada) y toca para asignar. "Sin mesa" siempre está
 * disponible para despejar la selección.
 */
export function CashierTableTiles({
  tables,
  selectedId,
  onSelect,
  maxHeightClass = "max-h-44",
  hideUnavailable = false,
}: CashierTableTilesProps) {
  const selectable = useMemo(
    () =>
      new Set(
        tables
          .filter((t) => t.status === "FREE" || t.status === "RESERVED")
          .map((t) => t.id),
      ),
    [tables],
  );

  const visible = useMemo(() => {
    if (hideUnavailable) return tables.filter((t) => selectable.has(t.id));
    return tables;
  }, [tables, selectable, hideUnavailable]);

  const freeCount = tables.filter((t) => t.status === "FREE").length;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
        <span>
          {tables.length} mesa{tables.length === 1 ? "" : "s"} · {freeCount} libre
          {freeCount === 1 ? "" : "s"}
        </span>
        <span>Estado en vivo</span>
      </div>
      <div className={cn("grid grid-cols-3 gap-1.5 overflow-y-auto pr-0.5", maxHeightClass)}>
        {/* Sin mesa */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-pressed={selectedId == null}
          className={cn(
            "flex h-11 flex-col items-center justify-center rounded-lg border text-[11px] font-medium transition-colors",
            selectedId == null
              ? "border-primary bg-primary/10 text-primary"
              : "border-dashed border-border text-muted-foreground hover:border-primary/50",
          )}
        >
          Sin mesa
        </button>

        {visible.map((t) => {
          const isSelectable = selectable.has(t.id);
          const isSelected = selectedId != null && String(t.id) === String(selectedId);
          const status = t.status || "FREE";
          return (
            <button
              key={t.id}
              type="button"
              disabled={!isSelectable && !isSelected}
              onClick={() => onSelect(isSelected ? null : t)}
              aria-pressed={isSelected}
              title={`Mesa ${t.number} · ${STATUS_LABELS[status] ?? status}${
                t.area ? ` · ${t.area}` : ""
              }`}
              className={cn(
                "flex h-11 flex-col items-center justify-center rounded-lg border transition-colors",
                STATUS_STYLES[status] ?? STATUS_STYLES.FREE,
                isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                !isSelectable && !isSelected && "cursor-not-allowed opacity-45",
                isSelectable && "hover:shadow-sm",
              )}
            >
              <span className="text-sm font-bold leading-none tabular-nums">{t.number}</span>
              <span className="mt-0.5 text-[9px] leading-none">
                {STATUS_LABELS[status] ?? status}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
