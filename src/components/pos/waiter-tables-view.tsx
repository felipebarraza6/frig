"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Map as MapIcon, LayoutGrid, Users, Clock, CircleCheck, CircleDot, CalendarClock, Sparkles, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { YggdraSchemas } from "@/lib/api/types";
import { Skeleton } from "@/components/ui/skeleton";

// three.js vive en tables-canvas. La grilla del POS no debe bajar ese chunk:
// el mapa lo pide solo cuando el mesero cambia a vista mapa.
const TablesCanvas = dynamic(
  () => import("@/components/tables/tables-canvas").then((m) => m.TablesCanvas),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
);
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

const STATUS_ICONS: Record<string, typeof CircleCheck> = {
  FREE: CircleCheck,
  OCCUPIED: CircleDot,
  RESERVED: CalendarClock,
  CLEANING: Sparkles,
  OUT_OF_SERVICE: Ban,
};

const STATUS_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "FREE", label: "Libres" },
  { value: "OCCUPIED", label: "Ocupadas" },
  { value: "RESERVED", label: "Reservadas" },
  { value: "CLEANING", label: "Limpieza" },
  { value: "OUT_OF_SERVICE", label: "Fuera de servicio" },
] as const;

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
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

  const areaTables = useMemo(
    () => areaFilter === "all" ? tables : tables.filter((table) => table.area === areaFilter),
    [tables, areaFilter],
  );

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const table of areaTables) {
      const status = table.status || "FREE";
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return counts;
  }, [areaTables]);

  const filteredTables = useMemo(
    () => areaTables.filter((table) => statusFilter === "all" || (table.status || "FREE") === statusFilter),
    [areaTables, statusFilter],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 flex-col gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Mesas del restaurante</h2>
            <p className="text-xs text-muted-foreground">{tables.length} mesas en total</p>
          </div>
          <div className="flex items-center gap-2">
            {areas.length > 0 && (
              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="h-10 max-w-36 rounded-lg border border-border/60 bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-none"
                aria-label="Filtrar por área"
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
              aria-pressed={view === "map"}
              className="hidden h-10 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
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

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Conteo de mesas por estado">
          {STATUS_FILTERS.slice(1).map(({ value, label }) => (
            <span key={value} className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground">
              {label} <strong className="ml-1 font-semibold text-foreground">{statusCounts.get(value) ?? 0}</strong>
            </span>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label="Filtrar mesas por estado">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={statusFilter === value}
              onClick={() => setStatusFilter(value)}
              className={cn(
                "min-h-10 shrink-0 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                statusFilter === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {label}{value !== "all" && <span className="ml-1 tabular-nums">{statusCounts.get(value) ?? 0}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
        {filteredTables.length === 0 ? (
          <div className="grid h-full place-items-center rounded-2xl border border-dashed border-border p-6 text-center">
            <div className="flex max-w-xs flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <MapIcon className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold">
                {tables.length === 0 ? "No hay mesas disponibles" : "No hay mesas para estos filtros"}
              </p>
              <p className="text-xs text-muted-foreground">
                {tables.length === 0 ? "Cuando se habiliten mesas aparecerán en esta vista." : "Prueba con otra área o estado para ver más mesas."}
              </p>
              {tables.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setAreaFilter("all"); setStatusFilter("all"); }}
                  className="mt-1 inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        ) : view === "grid" ? (
          <div className="grid h-full grid-cols-2 content-start gap-3 overflow-y-auto sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredTables.map((table) => {
              const status = table.status || "FREE";
              const isOccupied = status === "OCCUPIED";
              const disabled = status === "OUT_OF_SERVICE";
              const occupationMinutes = parseInt(table.occupation_time ?? "0", 10) || 0;
              const wide = isWideTableShape(table.shape);
              const StatusIcon = STATUS_ICONS[status] || CircleCheck;
              return (
                <button
                  key={table.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(table)}
                  aria-label={`Mesa ${table.number}, ${STATUS_LABELS[status] || "Estado desconocido"}${table.area ? `, área ${table.area}` : ""}${table.capacity ? `, capacidad ${table.capacity}` : ""}${isOccupied && occupationMinutes > 0 ? `, ocupada hace ${occupationMinutes} minutos` : ""}${disabled ? ", no disponible" : ", seleccionar mesa"}`}
                  title={`Mesa ${table.number} · ${tableShapeLabel(table.shape)} · ${STATUS_LABELS[status]}`}
                  className={cn(
                    "group relative flex min-h-40 flex-col items-center justify-center gap-2 border-2 bg-background p-3 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    tableShapeRadiusClass(table.shape),
                    STATUS_STYLES[status] || STATUS_STYLES.FREE,
                    wide && "sm:min-h-36",
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
                        "mt-1 inline-flex min-h-6 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        STATUS_BADGE[status] || STATUS_BADGE.FREE,
                      )}
                    >
                      <StatusIcon className="h-3 w-3" aria-hidden="true" />
                      {STATUS_LABELS[status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-0.5">
                      <Users className="h-2.5 w-2.5" />
                      {table.capacity ?? "—"}
                    </span>
                    <span>·</span>
                    <span className="font-medium text-foreground">{tableShapeLabel(table.shape)}</span>
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
