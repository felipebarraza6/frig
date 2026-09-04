"use client";

import { useEffect, useMemo, useState } from "react";
import { Map as MapIcon, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import type { YggdraSchemas } from "@/lib/api/types";
import { TablesCanvas } from "@/components/tables/tables-canvas";

type TableItem = YggdraSchemas["Table"];

const STATUS_STYLES: Record<string, string> = {
  FREE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  OCCUPIED: "border-primary/40 bg-primary/10 text-primary",
  RESERVED: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  CLEANING: "border-primary/40 bg-primary/10 text-primary",
  OUT_OF_SERVICE: "border-slate-500/40 bg-slate-500/10 text-slate-700",
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
          <div className="grid h-full grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredTables.map((table) => {
              const status = table.status || "FREE";
              const isOccupied = status === "OCCUPIED";
              const disabled = status === "OUT_OF_SERVICE";
              const occupationMinutes = parseInt(table.occupation_time ?? "0", 10) || 0;
              return (
                <button
                  key={table.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(table)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-xl border p-4 text-center transition-colors",
                    STATUS_STYLES[status] || STATUS_STYLES.FREE,
                    disabled && "opacity-50 cursor-not-allowed",
                    !disabled && "hover:brightness-95",
                  )}
                >
                  <span className="text-lg font-semibold">Mesa {table.number}</span>
                  {table.area && <span className="text-xs opacity-80">{table.area}</span>}
                  <span className="text-[11px] font-medium">{STATUS_LABELS[status]}</span>
                  {isOccupied && occupationMinutes > 0 && (
                    <span className="text-[11px] font-medium opacity-90">
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
