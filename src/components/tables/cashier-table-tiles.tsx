"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { YggdraSchemas } from "@/lib/api/types";
import { TableShapeIcon, tableShapeLabel } from "@/components/tables/table-shape-icon";

type TableItem = YggdraSchemas["Table"];

interface CashierTableTilesProps {
  tables: TableItem[];
  selectedId: number | string | null;
  onSelect: (table: TableItem | null) => void;
  maxHeightClass?: string;
  hideUnavailable?: boolean;
  allowEmpty?: boolean;
  variant?: "compact" | "pos";
}

const POS_STATUS_LABELS: Record<string, string> = {
  FREE: "Libre",
  RESERVED: "Reservada",
  OCCUPIED: "Ocupada",
  CLEANING: "Limpieza",
  OUT_OF_SERVICE: "Fuera de servicio",
};

function tableNum(t: TableItem): string {
  return String(t.number ?? "").replace(/^mesa\s+/i, "").trim() || "·";
}

/** Grilla compacta: solo mesas libres, figura + número. */
export function CashierTableTiles({
  tables,
  selectedId,
  onSelect,
  maxHeightClass = "max-h-40",
  hideUnavailable = true,
  allowEmpty = true,
  variant = "compact",
}: CashierTableTilesProps) {
  const visible = useMemo(() => {
    const free = tables.filter(
      (t) =>
        t.status === "FREE" ||
        t.status === "RESERVED" ||
        (variant === "pos" && String(t.id) === String(selectedId)),
    );
    return hideUnavailable ? free : tables;
  }, [tables, hideUnavailable, selectedId, variant]);

  if (variant === "pos") {
    return (
      <div className={cn("grid min-w-0 grid-cols-2 gap-2 overflow-y-auto", maxHeightClass)}>
        {allowEmpty && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-pressed={selectedId == null}
            className={cn(
              "flex min-h-16 items-center justify-center rounded-xl border px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              selectedId == null
                ? "border-primary bg-primary/10 text-primary"
                : "border-dashed border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/50",
            )}
          >
            Sin mesa
          </button>
        )}
        {visible.map((table) => {
          const isSelected = selectedId != null && String(table.id) === String(selectedId);
          const status = table.status || "FREE";
          return (
            <button
              key={table.id}
              type="button"
              onClick={() => onSelect(table)}
              aria-pressed={isSelected}
              aria-label={`Mesa ${tableNum(table)}, ${POS_STATUS_LABELS[status] ?? status}${table.area ? `, área ${table.area}` : ""}${table.capacity ? `, capacidad ${table.capacity}` : ""}`}
              title={`Mesa ${tableNum(table)} · ${tableShapeLabel(table.shape)} · ${POS_STATUS_LABELS[status] ?? status}`}
              className={cn(
                "flex min-h-16 min-w-0 items-center gap-2 rounded-xl border px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                isSelected
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border/70 bg-background hover:border-primary/40 hover:bg-muted/40",
              )}
            >
              <TableShapeIcon shape={table.shape} capacity={table.capacity} size="md" className="scale-90" />
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-foreground">Mesa {tableNum(table)}</span>
                <span className="block truncate text-[10px] font-medium text-muted-foreground">{POS_STATUS_LABELS[status] ?? status}</span>
                {(table.area || table.capacity != null) && (
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {[table.area, table.capacity != null ? `${table.capacity} pers.` : null].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
            </button>
          );
        })}
        {visible.length === 0 && !allowEmpty && (
          <p className="col-span-2 rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            No hay mesas disponibles.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1.5 overflow-y-auto", maxHeightClass)}>
      {allowEmpty && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-pressed={selectedId == null}
          className={cn(
            "flex h-9 shrink-0 items-center rounded-lg border border-dashed px-2 text-[11px] font-medium",
            selectedId == null
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground",
          )}
        >
          Sin mesa
        </button>
      )}
      {visible.map((t) => {
        const isSelected = selectedId != null && String(t.id) === String(selectedId);
        const round = t.shape === "ROUND" || t.shape === "OVAL";
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(isSelected ? null : t)}
            aria-pressed={isSelected}
            title={`Mesa ${tableNum(t)}`}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center border-2 text-xs font-bold tabular-nums",
              round ? "rounded-full" : "rounded-lg",
              isSelected
                ? "border-primary bg-primary/15 text-primary"
                : "border-success/40 bg-success/10 hover:border-primary/50",
            )}
          >
            {tableNum(t)}
          </button>
        );
      })}
    </div>
  );
}
