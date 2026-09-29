"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { YggdraSchemas } from "@/lib/api/types";

type TableItem = YggdraSchemas["Table"];

interface CashierTableTilesProps {
  tables: TableItem[];
  selectedId: number | string | null;
  onSelect: (table: TableItem | null) => void;
  maxHeightClass?: string;
  hideUnavailable?: boolean;
  allowEmpty?: boolean;
}

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
}: CashierTableTilesProps) {
  const visible = useMemo(() => {
    const free = tables.filter((t) => t.status === "FREE" || t.status === "RESERVED");
    return hideUnavailable ? free : tables;
  }, [tables, hideUnavailable]);

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
