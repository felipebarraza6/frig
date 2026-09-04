/**
 * Aldea vikinga del hero: terreno de colina + longhouse principal coronando
 * + cabañas pequeñas bajando por la ladera + sendero + pinos.
 *
 * TODO vive en el mismo espacio de coordenadas: la altura del terreno se
 * calcula por columna (hillHeight) y cada elemento se ancla con
 * bottom = altura(col)/ROWS, hundiéndose 2% dentro de la loma. Por eso
 * nada flota, en ningún viewport.
 */

import { PixelLonghouse } from "./pixel-longhouse";

const COLS = 100;
const ROWS = 28;

/** Altura de la colina por columna (en filas, 2..~22). */
function hillHeight(col: number): number {
  const rolling = Math.sin(col * 0.31) * 1.3 + Math.sin(col * 0.11 + 2) * 1.0;
  // Loma principal a la derecha (meseta ancha donde corona el longhouse).
  const bump = Math.exp(-(((col - 74) / 34) ** 2)) * 17;
  return Math.max(2, Math.round(3 + rolling + bump));
}

/** bottom CSS (en %) para anclar un elemento en la colina: el borde
    inferior queda `sinkPct`% POR DEBAJO de la superficie (embebido). */
function anchorBottom(col: number, sinkPct = 2): string {
  return `${(hillHeight(col) / ROWS) * 100 - sinkPct}%`;
}

/** Rango inclusivo como lista. */
function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/* Sendero de piedra bajando en zigzag desde la puerta del longhouse. */
const PATH = new Set([
  ...range(58, 61),
  ...range(51, 54),
  ...range(44, 47),
  ...range(37, 40),
  ...range(30, 33),
]);

/* Detalles sobre la superficie. */
const TUFTS = new Set([3, 12, 21, 35, 48, 63, 79, 84, 91, 97]);
const STONES = new Set([8, 27, 56, 70, 88]);
const FLOWERS = new Set([16, 42, 66, 76, 93]);

function depthColor(depth: number, onPath: boolean): string {
  if (depth === 0) return onPath ? "#8b8570" : "#3a5c40";
  if (depth <= 2) return "#2c4a31";
  if (depth <= 5) return "#234026";
  return "#182b1b";
}

/* ── Cabaña pequeña (bitmap 16x12: sodio con hileras y pasto, alero,
      ventana con marco, puerta con manija dorada, musgo en el muro y base
      de pasto más ancha) ────────────────────────────────────────────────── */
const CABIN = [
  "......rrrr......",
  ".....rrrrrr.....",
  "....rrGRRRrr....",
  "...rrRRRRRRrr...",
  "..rrRRRRGRRRrr..",
  "..oooooooooooo..",
  "..ppppdwwdpppp..",
  "..ppmpdwwdpmpp..",
  "..pmpppppppmpp..",
  "..pppgggggwppp..",
  "..pppgggggpppp..",
  ".GGGGGGGGGGGGGG.",
] as const;

const CABIN_COLORS: Record<string, string> = {
  r: "#6f6a58",
  R: "#565043",
  o: "#3f382c",
  p: "#7d7a63",
  m: "#5f6f4a",
  d: "#33281a",
  g: "#6b4a38",
  w: "#e9bd4a",
  G: "#3a5c40",
};

function Cabin({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${CABIN[0].length}, 1fr)`,
        imageRendering: "pixelated",
        aspectRatio: `${CABIN[0].length} / ${CABIN.length}`,
      }}
    >
      {CABIN.map((row, r) =>
        row.split("").map((cell, c) => (
          <span
            key={`${r}-${c}`}
            className={cell === "w" ? "house-window" : undefined}
            style={{
              aspectRatio: "1",
              backgroundColor: CABIN_COLORS[cell] ?? "transparent",
              animationDelay: cell === "w" ? `${(r + c) * 0.3}s` : undefined,
            }}
          />
        )),
      )}
    </div>
  );
}

/* Pino pixel (dos tonos + tronco). */
const PINE = [
  "...G...",
  "..GGg..",
  "..GGG..",
  ".GGGGg.",
  ".GGGGG.",
  "GGGGGGg",
  "...d...",
  "...d...",
] as const;

function Pine({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${PINE[0].length}, 1fr)`,
        imageRendering: "pixelated",
        aspectRatio: `${PINE[0].length} / ${PINE.length}`,
      }}
    >
      {PINE.map((row, r) =>
        row.split("").map((ch, c) => (
          <span
            key={`${r}-${c}`}
            style={{
              aspectRatio: "1",
              backgroundColor:
                ch === "G" ? "#2c4a31" : ch === "g" ? "#3a5c40" : ch === "d" ? "#3d2f1f" : "transparent",
            }}
          />
        )),
      )}
    </div>
  );
}

/* Cabañas bajando la ladera (columna de anclaje + ancho). */
const CABINS = [
  { id: "k1", col: 52, width: "clamp(48px, 7vw, 88px)" },
  { id: "k2", col: 34, width: "clamp(56px, 8vw, 96px)" },
  { id: "k3", col: 15, width: "clamp(44px, 6vw, 76px)" },
] as const;

const PINES = [
  { id: "p1", col: 6, width: "clamp(28px, 4vw, 49px)" },
  { id: "p2", col: 95, width: "clamp(36px, 5vw, 63px)" },
  { id: "p3", col: 45, width: "clamp(24px, 3.4vw, 42px)" },
] as const;

export function PixelVillage() {
  const cells: React.ReactNode[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const h = hillHeight(col);
      const surfaceRow = ROWS - h;
      let color = "transparent";
      if (row >= surfaceRow) {
        color = depthColor(row - surfaceRow, PATH.has(col));
      } else if (row === surfaceRow - 1) {
        if (TUFTS.has(col)) color = "#4a7a4f";
        else if (STONES.has(col)) color = "#8b8570";
        else if (FLOWERS.has(col)) color = "#e9bd4a";
      }
      cells.push(
        <span key={`${col}-${row}`} style={{ backgroundColor: color }} />,
      );
    }
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[220px] sm:h-[320px]"
    >
      {/* Terreno (grilla estirada a la altura de la escena). */}
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          imageRendering: "pixelated",
        }}
      >
        {cells}
      </div>

      {/* Pinos sobre la ladera. */}
      {PINES.map((pine) => (
        <div
          key={pine.id}
          className="absolute"
          style={{
            left: `${pine.col}%`,
            width: pine.width,
            bottom: anchorBottom(pine.col),
            transform: "translateX(-50%)",
          }}
        >
          <Pine className="opacity-90" />
        </div>
      ))}

      {/* Cabañas de la aldea (ocultas en móvil: no hay ladera suficiente). */}
      {CABINS.map((cabin) => (
        <div
          key={cabin.id}
          className="absolute hidden sm:block"
          style={{
            left: `${cabin.col}%`,
            width: cabin.width,
            bottom: anchorBottom(cabin.col),
            transform: "translateX(-50%)",
          }}
        >
          <Cabin />
        </div>
      ))}

      {/* Longhouse principal coronando la meseta (col 74: anclaje vertical y
          horizontal usan la MISMA columna, así nunca flota; angosto en
          pantallas chicas para no salirse del borde). */}
      <div
        className="absolute"
        style={{
          left: "74%",
          width: "clamp(140px, 30vw, 380px)",
          bottom: anchorBottom(74, 4),
          transform: "translateX(-50%)",
        }}
      >
        <PixelLonghouse className="w-full" />
      </div>
    </div>
  );
}
