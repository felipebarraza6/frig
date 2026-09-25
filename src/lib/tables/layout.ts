import type { YggdraSchemas } from "@/lib/api/types";

type TableItem = YggdraSchemas["Table"];
type TableShape = NonNullable<TableItem["shape"]>;

export const TABLE_MAP_WIDTH = 1200;
export const TABLE_MAP_HEIGHT = 700;
/** Rejilla suave al soltar (el arrastre es libre). */
export const TABLE_SNAP = 8;
const PLACE_GAP = 12;

export function tableDimensions(capacity: number, shape?: TableShape | null) {
  const s = shape ?? "ROUND";
  if (s === "ROUND" || s === "SQUARE" || s === "OVAL") {
    if (capacity <= 2) return { width: 64, height: 64, shape: s };
    if (capacity <= 4) return { width: 88, height: 88, shape: s };
    if (capacity <= 6) return { width: 112, height: 112, shape: s };
    return { width: 136, height: 136, shape: s };
  }
  if (capacity <= 2) return { width: 80, height: 48, shape: s };
  if (capacity <= 4) return { width: 104, height: 56, shape: s };
  if (capacity <= 6) return { width: 128, height: 64, shape: s };
  return { width: 152, height: 72, shape: s };
}

export function hasUnsetPosition(table: Pick<TableItem, "x_position" | "y_position">) {
  return table.x_position == null || table.y_position == null;
}

/** Detecta si varias mesas comparten casi la misma coordenada (pisándose). */
export function hasStackedPositions(
  tables: Pick<TableItem, "id" | "x_position" | "y_position">[],
  tolerance = 12,
) {
  const placed = tables.filter((t) => !hasUnsetPosition(t));
  if (placed.length < 2) return false;
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const ax = placed[i].x_position ?? 0;
      const ay = placed[i].y_position ?? 0;
      const bx = placed[j].x_position ?? 0;
      const by = placed[j].y_position ?? 0;
      if (Math.abs(ax - bx) <= tolerance && Math.abs(ay - by) <= tolerance) {
        return true;
      }
    }
  }
  return false;
}

export function needsTableAutoLayout(
  tables: Pick<TableItem, "id" | "x_position" | "y_position">[],
) {
  if (tables.length === 0) return false;
  const unsetCount = tables.filter(hasUnsetPosition).length;
  if (unsetCount > 0) return true;
  return hasStackedPositions(tables);
}

export interface LayoutPoint {
  id: number;
  x: number;
  y: number;
}

/**
 * Distribuye mesas en rejilla por área, sin solaparse, dentro del plano.
 * Orden estable por número de mesa.
 */
export function layoutTables(
  tables: Pick<TableItem, "id" | "number" | "capacity" | "shape" | "area" | "x_position" | "y_position">[],
  canvasWidth = TABLE_MAP_WIDTH,
  canvasHeight = TABLE_MAP_HEIGHT,
): LayoutPoint[] {
  if (tables.length === 0) return [];

  const GAP = 40;
  const PADDING = 56;
  const AREA_GAP = 64;

  const sorted = [...tables].sort((a, b) =>
    String(a.number).localeCompare(String(b.number), "es", { numeric: true }),
  );

  const byArea = new Map<string, typeof sorted>();
  for (const t of sorted) {
    const key = (t.area?.trim() || "Salón");
    const list = byArea.get(key) ?? [];
    list.push(t);
    byArea.set(key, list);
  }

  const result: LayoutPoint[] = [];
  let cursorY = PADDING;

  for (const [, areaTables] of byArea) {
    let x = PADDING;
    let y = cursorY;
    let rowHeight = 0;
    let maxY = cursorY;

    for (const table of areaTables) {
      const dims = tableDimensions(table.capacity || 4, table.shape);
      const cellW = dims.width + GAP;
      const cellH = dims.height + GAP;

      if (x + dims.width > canvasWidth - PADDING && x > PADDING) {
        x = PADDING;
        y += rowHeight;
        rowHeight = 0;
      }

      // Si se sale del alto, apretar un poco en la misma fila (mejor que amontonar).
      if (y + dims.height > canvasHeight - PADDING) {
        y = Math.max(PADDING, canvasHeight - PADDING - dims.height);
      }

      result.push({ id: table.id, x, y });
      x += cellW;
      rowHeight = Math.max(rowHeight, cellH);
      maxY = Math.max(maxY, y + dims.height);
    }

    cursorY = maxY + AREA_GAP;
  }

  return result;
}

/** Posición sugerida para una mesa nueva, evitando las ya colocadas. */
export function nextFreeTablePosition(
  existing: Pick<TableItem, "id" | "number" | "capacity" | "shape" | "area" | "x_position" | "y_position">[],
  capacity = 4,
  shape?: TableShape | null,
  area?: string | null,
) {
  const GAP = 40;
  const PADDING = 56;
  const dims = tableDimensions(capacity, shape);
  const placed = existing.filter((t) => !hasUnsetPosition(t));

  if (placed.length === 0) {
    const laid = layoutTables([
      {
        id: -1,
        number: "1",
        capacity,
        shape: shape ?? "ROUND",
        area: area ?? null,
        x_position: null,
        y_position: null,
      },
    ]);
    return laid[0] ?? { x: PADDING, y: PADDING };
  }

  // Buscar hueco en rejilla: izquierda→derecha, arriba→abajo.
  const candidates: { x: number; y: number }[] = [];
  for (let y = PADDING; y < TABLE_MAP_HEIGHT - dims.height - PADDING; y += Math.max(dims.height, 80) + GAP) {
    for (let x = PADDING; x < TABLE_MAP_WIDTH - dims.width - PADDING; x += Math.max(dims.width, 80) + GAP) {
      candidates.push({ x, y });
    }
  }

  const overlaps = (x: number, y: number) =>
    placed.some((t) => {
      const d = tableDimensions(t.capacity || 4, t.shape);
      const tx = t.x_position as number;
      const ty = t.y_position as number;
      return !(
        x + dims.width + GAP / 2 < tx ||
        tx + d.width + GAP / 2 < x ||
        y + dims.height + GAP / 2 < ty ||
        ty + d.height + GAP / 2 < y
      );
    });

  for (const c of candidates) {
    if (!overlaps(c.x, c.y)) return c;
  }

  // Fallback: debajo del bloque ocupado.
  const maxY = Math.max(
    ...placed.map((t) => (t.y_position as number) + tableDimensions(t.capacity || 4, t.shape).height),
  );
  return { x: PADDING, y: Math.min(maxY + GAP, TABLE_MAP_HEIGHT - dims.height - PADDING) };
}

export type TableRect = { x: number; y: number; w: number; h: number };

export function snapCoord(n: number, step = TABLE_SNAP) {
  return Math.round(n / step) * step;
}

/** Solo límites del mapa, sin snap ni colisiones. */
export type MapBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** Rectángulo del salón en coords de mapa, con margen interno (paredes / sillas). */
export function salonMapBounds(
  originX: number,
  originY: number,
  roomW: number,
  roomH: number,
  inset = 40,
): MapBounds {
  return {
    minX: Math.max(0, originX - roomW / 2 + inset),
    minY: Math.max(0, originY - roomH / 2 + inset),
    maxX: Math.min(TABLE_MAP_WIDTH, originX + roomW / 2 - inset),
    maxY: Math.min(TABLE_MAP_HEIGHT, originY + roomH / 2 - inset),
  };
}

export function clampTablePosFree(
  x: number,
  y: number,
  w: number,
  h: number,
  bounds?: MapBounds | null,
) {
  const minX = bounds?.minX ?? 0;
  const minY = bounds?.minY ?? 0;
  const maxX = Math.max(minX, (bounds?.maxX ?? TABLE_MAP_WIDTH) - w);
  const maxY = Math.max(minY, (bounds?.maxY ?? TABLE_MAP_HEIGHT) - h);
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

export function clampTablePos(
  x: number,
  y: number,
  w: number,
  h: number,
  bounds?: MapBounds | null,
) {
  return clampTablePosFree(snapCoord(x), snapCoord(y), w, h, bounds);
}

/** Posición libre con snap suave al soltar (no empuja lejos de otras mesas). */
export function softPlaceTable(
  x: number,
  y: number,
  w: number,
  h: number,
  bounds?: MapBounds | null,
) {
  return clampTablePos(x, y, w, h, bounds);
}

function rectsOverlap(a: TableRect, b: TableRect, gap = PLACE_GAP) {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}

/** Amarra la mesa a la celda libre más cercana (sin pisar otras). */
export function resolveTablePlacement(
  x: number,
  y: number,
  w: number,
  h: number,
  others: TableRect[],
): { x: number; y: number } {
  const fits = (px: number, py: number) => {
    const p = clampTablePos(px, py, w, h);
    const self = { x: p.x, y: p.y, w, h };
    if (others.some((o) => rectsOverlap(self, o))) return null;
    return p;
  };

  const direct = fits(x, y);
  if (direct) return direct;

  for (let r = 1; r <= 14; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const found = fits(x + dx * TABLE_SNAP, y + dy * TABLE_SNAP);
        if (found) return found;
      }
    }
  }
  return clampTablePos(x, y, w, h);
}

export function tableRect(
  table: Pick<TableItem, "id" | "capacity" | "shape" | "x_position" | "y_position">,
  pos?: { x: number; y: number } | null,
): TableRect {
  const d = tableDimensions(table.capacity || 4, table.shape);
  return {
    x: pos?.x ?? table.x_position ?? 0,
    y: pos?.y ?? table.y_position ?? 0,
    w: d.width,
    h: d.height,
  };
}

/** 0 = vacío, 1 = tapado. */
export function occupiedAreaRatio(
  tables: Pick<TableItem, "capacity" | "shape">[],
) {
  const area = tables.reduce((sum, t) => {
    const d = tableDimensions(t.capacity || 4, t.shape);
    return sum + d.width * d.height;
  }, 0);
  return area / (TABLE_MAP_WIDTH * TABLE_MAP_HEIGHT);
}

/**
 * Si hay más del 50% libre las mesas crecen; si el salón está apretado, se achican.
 */
export function densityFitScale(occupiedRatio: number) {
  const free = 1 - occupiedRatio;
  if (free >= 0.5) return 1.1;
  if (free <= 0.2) return 0.76;
  return 0.76 + ((free - 0.2) / 0.3) * (1.1 - 0.76);
}
