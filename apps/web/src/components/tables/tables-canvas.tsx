"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Clock, AlertTriangle } from "lucide-react";
import { cn, formatCLP } from "@/lib/utils";
import { useElapsedTime } from "@/lib/hooks/useElapsedTime";
import { fetchOrder } from "@/lib/api/orders";
import type { YggdraSchemas } from "@/lib/api/types";

type TableItem = YggdraSchemas["Table"];

const STATUS_STYLES: Record<string, string> = {
  FREE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  OCCUPIED: "border-rose-500/40 bg-rose-500/10 text-rose-700",
  RESERVED: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  CLEANING: "border-blue-500/40 bg-blue-500/10 text-blue-700",
  OUT_OF_SERVICE: "border-slate-500/40 bg-slate-500/10 text-slate-700",
};

const STATUS_LABELS: Record<string, string> = {
  FREE: "Libre",
  OCCUPIED: "Ocupada",
  RESERVED: "Reservada",
  CLEANING: "Limpieza",
  OUT_OF_SERVICE: "Fuera de servicio",
};

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 700;

interface Size {
  width: number;
  height: number;
}

type TableShape = NonNullable<TableItem["shape"]>;

function radiusClass(shape?: TableShape | null) {
  if (shape === "ROUND" || shape === "OVAL") return "rounded-full";
  if (shape === "SQUARE") return "rounded-lg";
  return "rounded-2xl";
}

function tableDimensions(capacity: number, shape?: TableShape | null) {
  const s = shape ?? "ROUND";
  if (s === "ROUND" || s === "SQUARE" || s === "OVAL") {
    if (capacity <= 2) return { width: 64, height: 64, shape: s };
    if (capacity <= 4) return { width: 88, height: 88, shape: s };
    if (capacity <= 6) return { width: 112, height: 112, shape: s };
    return { width: 136, height: 136, shape: s };
  }
  // RECTANGLE
  if (capacity <= 2) return { width: 96, height: 56, shape: s };
  if (capacity <= 4) return { width: 128, height: 72, shape: s };
  if (capacity <= 6) return { width: 168, height: 80, shape: s };
  return { width: 208, height: 88, shape: s };
}

function seatPositions(
  capacity: number,
  width: number,
  height: number,
  shape?: TableShape | null,
) {
  const seats: { x: number; y: number }[] = [];
  const count = Math.max(1, capacity);
  const radius = 5;
  const offset = 4;
  const s = shape ?? "ROUND";

  if (s === "RECTANGLE" || (s === "OVAL" && width > height * 1.2)) {
    // Mesa rectangular/u ovalada alargada: distribuir en los lados largos
    const perLongSide = Math.ceil(count / 2);
    const stepX = width / (perLongSide + 1);
    for (let i = 0; i < count; i++) {
      const side = i % 2;
      const index = Math.floor(i / 2);
      if (side === 0) seats.push({ x: stepX * (index + 1), y: -offset - radius });
      else seats.push({ x: stepX * (index + 1), y: height + offset + radius });
    }
  } else {
    // Mesa cuadrada/redonda/ovalada compacta: distribuir en los 4 lados
    const perSide = Math.ceil(count / 4);
    const stepX = width / (perSide + 1);
    const stepY = height / (perSide + 1);
    for (let i = 0; i < count; i++) {
      const side = i % 4;
      const index = Math.floor(i / 4);
      if (side === 0) seats.push({ x: stepX * (index + 1), y: -offset - radius });
      else if (side === 1) seats.push({ x: width + offset + radius, y: stepY * (index + 1) });
      else if (side === 2) seats.push({ x: stepX * (index + 1), y: height + offset + radius });
      else seats.push({ x: -offset - radius, y: stepY * (index + 1) });
    }
  }

  return seats;
}

interface TablesCanvasProps {
  tables: TableItem[];
  mode?: "edit" | "select";
  selectedTableId?: number | null;
  onMove?: (id: number, x: number, y: number) => void;
  onSelect?: (table: TableItem) => void;
}

export function TablesCanvas({
  tables,
  mode = "select",
  selectedTableId,
  onMove,
  onSelect,
}: TablesCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [hoveredTable, setHoveredTable] = useState<TableItem | null>(null);
  const [containerSize, setContainerSize] = useState<Size>({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  });

  // Escala automática: el plano completo cabe dentro del contenedor sin scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setContainerSize({ width: rect.width, height: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = useMemo(
    () =>
      Math.min(
        containerSize.width / CANVAS_WIDTH,
        containerSize.height / CANVAS_HEIGHT,
        1,
      ),
    [containerSize],
  );
  const offsetX = useMemo(
    () => (containerSize.width - CANVAS_WIDTH * scale) / 2,
    [containerSize, scale],
  );
  const offsetY = useMemo(
    () => (containerSize.height - CANVAS_HEIGHT * scale) / 2,
    [containerSize, scale],
  );

  const positionedTables = useMemo(() => {
    return tables.map((t) => ({
      ...t,
      x: t.x_position ?? 0,
      y: t.y_position ?? 0,
    }));
  }, [tables]);

  // Centrar todo el contenido (mesas) dentro del plano virtual.
  const contentOffset = useMemo(() => {
    if (positionedTables.length === 0) return { x: 0, y: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const t of positionedTables) {
      const dims = tableDimensions(t.capacity || 1, t.shape);
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + dims.width);
      maxY = Math.max(maxY, t.y + dims.height);
    }
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    return {
      x: (CANVAS_WIDTH - contentWidth) / 2 - minX,
      y: (CANVAS_HEIGHT - contentHeight) / 2 - minY,
    };
  }, [positionedTables]);

  interface AreaGroup {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    tables: typeof positionedTables;
  }

  const areaGroups = useMemo<AreaGroup[]>(() => {
    const map = new Map<
      string,
      {
        tables: typeof positionedTables;
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
      }
    >();
    for (const t of positionedTables) {
      if (!t.area) continue;
      const dims = tableDimensions(t.capacity || 1, t.shape);
      const existing = map.get(t.area);
      const group = existing || {
        tables: [],
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
      };
      const cx = t.x + contentOffset.x;
      const cy = t.y + contentOffset.y;
      group.tables.push(t);
      group.minX = Math.min(group.minX, cx);
      group.minY = Math.min(group.minY, cy);
      group.maxX = Math.max(group.maxX, cx + dims.width);
      group.maxY = Math.max(group.maxY, cy + dims.height);
      if (!existing) map.set(t.area, group);
    }
    const padding = 40;
    return Array.from(map.entries()).map(([name, g]) => ({
      name,
      ...g,
      x: Math.max(0, g.minX - padding),
      y: Math.max(0, g.minY - padding),
      width: g.maxX - g.minX + padding * 2,
      height: g.maxY - g.minY + padding * 2,
    }));
  }, [positionedTables, contentOffset]);

  const hasMultipleAreas = areaGroups.length > 1;

  const hoveredElapsed = useElapsedTime(
    hoveredTable?.occupied_since,
    { enabled: hoveredTable?.status === "OCCUPIED" },
  );

  function handleDragEnd(
    event: MouseEvent | TouchEvent | PointerEvent,
    table: TableItem,
  ) {
    const el = event.target as HTMLElement;
    const node = el.closest("[data-table-id]") as HTMLElement | null;
    if (!node || !containerRef.current) return;

    const parentRect = containerRef.current.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    // Convertir de píxeles en pantalla (escalados y centrados) a coordenadas del plano.
    const x = Math.max(
      0,
      (nodeRect.left - parentRect.left - offsetX) / scale - contentOffset.x,
    );
    const y = Math.max(
      0,
      (nodeRect.top - parentRect.top - offsetY) / scale - contentOffset.y,
    );

    onMove?.(table.id, x, y);
    setDraggingId(null);
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full min-h-[280px] overflow-hidden"
    >
      <div
        className="absolute"
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* Grid de fondo sutil */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Áreas / salas */}
        {hasMultipleAreas &&
          areaGroups.map((group) => (
            <div
              key={group.name}
              className="pointer-events-none absolute rounded-2xl border border-dashed border-primary/15 bg-primary/[0.015]"
              style={{
                left: group.x,
                top: group.y,
                width: group.width,
                height: group.height,
              }}
            >
              <span className="absolute -top-3 left-4 rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
                {group.name}
              </span>
            </div>
          ))}

        {/* Leyenda */}
        <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-3 rounded-lg border border-border/60 bg-background/95 p-2.5 shadow-sm">
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-3.5 w-3.5 rounded-full border",
                  STATUS_STYLES[status]?.split(" ")[0] ?? "border-border bg-card",
                )}
              />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {positionedTables.map((table) => {
          const isSelected = selectedTableId === table.id;
          const isOccupied = table.status === "OCCUPIED";
          const capacity = table.capacity || 1;
          const dims = tableDimensions(capacity, table.shape);
          const seats = seatPositions(capacity, dims.width, dims.height, table.shape);
          const occupationMinutes = parseInt(table.occupation_time ?? "0", 10) || 0;
          const tableRadius = radiusClass(dims.shape);

          return (
            <motion.div
              key={table.id}
              data-table-id={table.id}
              drag={mode === "edit"}
              dragMomentum={false}
              dragConstraints={containerRef}
              onDragStart={() => setDraggingId(table.id)}
              onDragEnd={(event) => handleDragEnd(event, table)}
              onMouseEnter={() => setHoveredTable(table)}
              onMouseLeave={() => setHoveredTable((prev) => (prev?.id === table.id ? null : prev))}
              onClick={() => {
                if (draggingId === table.id || mode !== "select") return;
                onSelect?.(table);
              }}
              initial={false}
              animate={{
                x: table.x + contentOffset.x,
                y: table.y + contentOffset.y,
              }}
              whileHover={mode === "select" ? { scale: 1.03 } : undefined}
              whileDrag={{ scale: 1.05, zIndex: 50 }}
              style={{
                position: "absolute",
                width: dims.width,
                height: dims.height,
                cursor: mode === "edit" ? "grab" : "pointer",
              }}
              className={cn(
                "flex flex-col items-center justify-center border text-center shadow-none transition-colors",
                tableRadius,
                STATUS_STYLES[table.status ?? "FREE"] ?? "border-border bg-card",
                isSelected && "ring-2 ring-primary ring-offset-2",
                !table.is_active && "opacity-50",
              )}
              title={`Mesa ${table.number} · ${STATUS_LABELS[table.status ?? "FREE"]} · ${capacity} puestos`}
            >
              {seats.map((seat, idx) => (
                <span
                  key={idx}
                  className="absolute h-2.5 w-2.5 rounded-full bg-current opacity-40"
                  style={{ left: seat.x - 5, top: seat.y - 5 }}
                />
              ))}
              {isOccupied && (
                <motion.span
                  className={cn(
                    "pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-rose-500/60",
                  )}
                  animate={{
                    opacity: [0.45, 0.85, 0.45],
                    scale: [1, 1.06, 1],
                  }}
                  transition={{
                    duration: 3.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
              <span className="text-base font-bold leading-none">{table.number}</span>
              {isOccupied && occupationMinutes > 0 && (
                <span className="mt-0.5 flex items-center gap-0.5 text-[10px] font-medium leading-none opacity-90">
                  <Clock className="h-2.5 w-2.5" />
                  {occupationMinutes}m
                </span>
              )}
              {table.is_overdue && (
                <AlertTriangle className="absolute -right-1 -top-1 h-4 w-4 text-amber-600" />
              )}
            </motion.div>
          );
        })}

        {/* Tooltip de mesa ocupada */}
        {hoveredTable && hoveredTable.status === "OCCUPIED" && (
          <TableTooltip
            table={hoveredTable}
            elapsedText={hoveredElapsed.text}
            contentOffset={contentOffset}
          />
        )}
      </div>
    </div>
  );
}

function TableTooltip({
  table,
  elapsedText,
  contentOffset,
}: {
  table: TableItem;
  elapsedText: string;
  contentOffset: { x: number; y: number };
}) {
  const dims = tableDimensions(table.capacity || 1, table.shape);
  const x = (table.x_position ?? 0) + contentOffset.x + dims.width / 2;
  const y = (table.y_position ?? 0) + contentOffset.y - 8;
  const orderId = table.current_order_id || null;

  const { data: order } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder(orderId as string),
    enabled: Boolean(orderId),
    staleTime: 30_000,
  });

  const total = order ? parseFloat(order.total_amount ?? "0") : 0;

  return (
    <div
      className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs shadow-lg"
      style={{ left: x, top: y }}
    >
      <p className="font-semibold">Mesa {table.number}</p>
      <p className="text-muted-foreground">{table.area || "Sin área"}</p>
      <p className="mt-1 flex items-center gap-1 font-medium text-rose-700">
        <Clock className="h-3 w-3" />
        {elapsedText} en consumo
      </p>
      {order && (
        <p className="mt-1 font-bold tabular-nums text-emerald-700">
          {formatCLP(total)} consumidos
        </p>
      )}
    </div>
  );
}

export { CANVAS_WIDTH, CANVAS_HEIGHT };
