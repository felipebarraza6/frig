"use client";

import { useEffect, useMemo, useState } from "react";
import { Map as MapIcon, LayoutGrid, Users, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { YggdraSchemas } from "@/lib/api/types";
import { TablesCanvas } from "@/components/tables/tables-canvas";
import {
  TableShapeIcon,
  tableShapeLabel,
  tableShapeRadiusClass,
  isWideTableShape,
} from "@/components/tables/table-shape-icon";

type TableItem = YggdraSchemas["Table"];

const STATUS_STYLES: Record<string, string> = {
  FREE: "border-success/50 text-success",
  OCCUPIED: "border-primary/50 text-primary",
  RESERVED: "border-warning/50 text-warning",
  CLEANING: "border-primary/40 text-primary",
  OUT_OF_SERVICE: "border-muted text-muted-foreground",
};

const STATUS_BADGE: Record<string, string> = {
  FREE: "bg-success/10 text-success",
  OCCUPIED: "bg-primary/10 text-primary",
  RESERVED: "bg-warning/10 text-warning",
  CLEANING: "bg-primary/10 text-primary",
  OUT_OF_SERVICE: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  FREE: "Libre",
  OCCUPIED: "Ocupada",
  RESERVED: "Reservada",
  CLEANING: "Limpieza",
  OUT_OF_SERVICE: "Fuera de servicio",
};

interface WaiterTablesViewProps {
  tables: TableItem[];
  onSelect: (table: TableItem) => void;
}

/**
 * Selector de mesas del POS (mesero / mapa).
 * Vista grid: cada tile refleja la forma real (como el mapa).
 * Vista mapa: reutiliza TablesCanvas.
 */
export function WaiterTablesView({ tables, onSelect }: WaiterTablesViewProps) {
  const [view, setView] = useState<"grid" | "map">("grid");
  const [areaFilter, setAreaFilter] = useState<string>("all");

  // En móvil siempre forzamos la vista de lista; el mapa no se ve bien en pantallas chicas.
  useEffect(() => {
    const check = () => {
      if (typeof window !== "undefined" && window.innerWidth < 640 && view === "map") {
        setView("grid");
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [view]);

  const areas = useMemo(() => {
    const set = new Set(tables.map((t) => t.area).filter(Boolean));
    return Array.from(set) as string[];
  }, [tables]);

  const filteredTables = useMemo(() => {
    if (areaFilter === "all") return tables;
    return tables.filter((t) => t.area === areaFilter);
  }, [tables, areaFilter]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">Mesas del restaurante</h2>
          <p className="text-xs text-muted-foreground">
            {tables.length} mesas · {tables.filter((t) => t.status === "FREE").length} libres
          </p>
        </div>
        <div className="flex items-center gap-2">
          {areas.length > 0 && (
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="h-8 rounded-lg border border-border/60 bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">Todas las áreas</option>
              {areas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setView(view === "grid" ? "map" : "grid")}
            className="hidden h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted sm:inline-flex"
          >
            {view === "grid" ? (
              <>
                <MapIcon className="h-3.5 w-3.5" /> Mapa
              </>
            ) : (
              <>
                <LayoutGrid className="h-3.5 w-3.5" /> Lista
              </>
            )}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-4">
        {view === "grid" ? (
          <div className="grid h-full grid-cols-2 content-start gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredTables.map((table) => {
              const status = table.status || "FREE";
              const isOccupied = status === "OCCUPIED";
              const disabled = status === "OUT_OF_SERVICE";
              const occupationMinutes = parseInt(table.occupation_time ?? "0", 10) || 0;
              const wide = isWideTableShape(table.shape);
              return (
                <button
                  key={table.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(table)}
                  title={`Mesa ${table.number} · ${tableShapeLabel(table.shape)} · ${STATUS_LABELS[status]}`}
                  className={cn(
                    "group relative flex flex-col items-center justify-center gap-2 border-2 bg-transparent p-3 text-center transition-all",
                    tableShapeRadiusClass(table.shape),
                    STATUS_STYLES[status] || STATUS_STYLES.FREE,
                    wide ? "min-h-[7.5rem]" : "min-h-[8rem] aspect-square",
                    disabled && "cursor-not-allowed opacity-50",
                    !disabled && "hover:bg-primary/5 hover:shadow-sm active:scale-[0.98]",
                  )}
                >
                  <TableShapeIcon
                    shape={table.shape}
                    capacity={table.capacity}
                    size="pos"
                    tone="primary"
                  />
                  <div className="min-w-0">
                    <span className="block text-base font-bold leading-none text-foreground">
                      Mesa {table.number}
                    </span>
                    <span
                      className={cn(
                        "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        STATUS_BADGE[status] || STATUS_BADGE.FREE,
                      )}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-0.5">
                      <Users className="h-2.5 w-2.5" />
                      {table.capacity ?? "—"}
                    </span>
                    <span>·</span>
                    <span className="font-medium text-primary">{tableShapeLabel(table.shape)}</span>
                    {table.area ? (
                      <>
                        <span>·</span>
                        <span className="truncate">{table.area}</span>
                      </>
                    ) : null}
                  </div>
                  {isOccupied && occupationMinutes > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary">
                      <Clock className="h-2.5 w-2.5" />
                      {occupationMinutes} min
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="h-full overflow-hidden rounded-xl border border-border/60">
            <TablesCanvas
              tables={filteredTables}
              mode="select"
              onSelect={(table) => onSelect(table)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
