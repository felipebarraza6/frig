import { cn } from "@/lib/utils";

export type TableShape = "ROUND" | "SQUARE" | "RECTANGLE" | "OVAL";

const SHAPE_LABELS: Record<TableShape, string> = {
  ROUND: "Redonda",
  SQUARE: "Cuadrada",
  RECTANGLE: "Rectangular",
  OVAL: "Ovalada",
};

export function normalizeTableShape(shape?: string | null): TableShape {
  if (shape === "SQUARE" || shape === "RECTANGLE" || shape === "OVAL" || shape === "ROUND") {
    return shape;
  }
  return "ROUND";
}

export function tableShapeLabel(shape?: string | null): string {
  return SHAPE_LABELS[normalizeTableShape(shape)];
}

/** Misma lógica de radio que el mapa (`tables-canvas`). */
export function tableShapeRadiusClass(shape?: string | null): string {
  const s = normalizeTableShape(shape);
  if (s === "ROUND" || s === "OVAL") return "rounded-full";
  if (s === "SQUARE") return "rounded-lg";
  return "rounded-2xl";
}

export function isWideTableShape(shape?: string | null): boolean {
  const s = normalizeTableShape(shape);
  return s === "RECTANGLE" || s === "OVAL";
}

/**
 * Silueta de mesa (sin fondo gris): solo la forma en color primary
 * para que destaque sobre el listado / POS, alineada al mapa.
 */
export function TableShapeIcon({
  shape,
  capacity = 4,
  className,
  tone = "primary",
  size = "md",
}: {
  shape?: string | null;
  capacity?: number | null;
  className?: string;
  /** Por defecto `primary` (marca). `muted` solo si hace falta bajar contraste. */
  tone?: "muted" | "primary";
  /** `md` listado; `lg` formulario; `pos` tile POS. */
  size?: "md" | "lg" | "pos";
}) {
  const s = normalizeTableShape(shape);
  const seats = Math.min(8, Math.max(2, capacity ?? 4));
  const fill =
    tone === "primary"
      ? "border-2 border-primary bg-primary/20 text-primary"
      : "border border-border bg-transparent text-muted-foreground";
  const seatDot = tone === "primary" ? "bg-primary" : "bg-muted-foreground/50";

  const isWide = isWideTableShape(s);
  const large = size === "lg" || size === "pos";
  const pos = size === "pos";
  const tableClass = cn(
    fill,
    s === "ROUND" && (pos ? "h-11 w-11 rounded-full" : large ? "h-9 w-9 rounded-full" : "h-5 w-5 rounded-full"),
    s === "SQUARE" && (pos ? "h-11 w-11 rounded-lg" : large ? "h-9 w-9 rounded-md" : "h-5 w-5 rounded-[3px]"),
    s === "RECTANGLE" && (pos ? "h-9 w-16 rounded-xl" : large ? "h-7 w-12 rounded-md" : "h-3.5 w-6 rounded-[3px]"),
    s === "OVAL" && (pos ? "h-10 w-16 rounded-full" : large ? "h-8 w-12 rounded-full" : "h-4 w-6 rounded-full"),
  );

  const seatPositions = isWide
    ? Array.from({ length: seats }, (_, i) => {
        const top = i % 2 === 0;
        const col = Math.floor(i / 2);
        const cols = Math.ceil(seats / 2);
        const x = ((col + 1) / (cols + 1)) * 100;
        return { left: `${x}%`, top: top ? "6%" : "94%" };
      })
    : Array.from({ length: seats }, (_, i) => {
        const angle = (i / seats) * Math.PI * 2 - Math.PI / 2;
        const r = pos ? 44 : large ? 42 : 40;
        return {
          left: `${50 + Math.cos(angle) * r}%`,
          top: `${50 + Math.sin(angle) * r}%`,
        };
      });

  return (
    <span
      title={tableShapeLabel(s)}
      aria-label={`Forma ${tableShapeLabel(s).toLowerCase()}`}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center bg-transparent",
        pos ? "h-[4.5rem] w-[5.5rem]" : large ? "h-16 w-16" : "h-9 w-9",
        className,
      )}
    >
      {seatPositions.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2 rounded-full",
            pos || large ? "h-1.5 w-1.5" : "h-1 w-1",
            seatDot,
          )}
          style={{ left: p.left, top: p.top }}
        />
      ))}
      <span aria-hidden className={tableClass} />
    </span>
  );
}
