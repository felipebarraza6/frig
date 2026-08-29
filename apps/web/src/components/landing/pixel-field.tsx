"use client";

import { motion } from "framer-motion";

/**
 * Fondo pixel-art: campo de bloques con degradado diagonal hecho de celdas
 * (gradiente "pixelado", nunca suave) + sprites de comida que parpadean.
 * Llena su contenedor sin crear scroll (absolute inset-0, grid 1fr).
 */
const COLUMNS = 12;
const ROWS = 8;

/** Verde por fila: degradado vertical hecho de bloques (más claro arriba). */
const ROW_TONES = [
  "#173c29",
  "#153624",
  "#133221",
  "#112e1e",
  "#0f2a1c",
  "#0d271a",
  "#0c2418",
  "#0b2217",
] as const;

/** Sprites dispersos: [col, row, color]. Fijo → determinista, sin SSR mismatch. */
const SPRITES: ReadonlyArray<readonly [number, number, string]> = [
  [2, 1, "#8a4f2b"], // tomate apagado
  [8, 1, "#a9843f"], // masa apagada
  [1, 5, "#6b3a1f"], // café apagado
  [9, 4, "#5f8f70"], // hoja apagada
  [5, 6, "#7c4033"], // manzana apagada
  [10, 2, "#9c8232"], // moneda apagada
  [3, 3, "#9c7842"], // pan apagado
] as const;

function toneAt(col: number, row: number): string {
  const rowTone = ROW_TONES[row] ?? ROW_TONES[ROWS - 1];
  const t = (col + row) / (COLUMNS + ROWS);
  if (t > 0.62) return "#0a2016";
  if (t > 0.42) return rowTone;
  return "#1a412e";
}

export function PixelField() {
  const cells: React.ReactNode[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const sprite = SPRITES.find(([c, r]) => c === col && r === row);
      const isSprite = Boolean(sprite);
      cells.push(
        <motion.span
          key={`cell-${row}-${col}`}
          animate={
            isSprite
              ? { opacity: [0.75, 1, 0.75] }
              : { opacity: [0.9, 1, 0.9] }
          }
          transition={{
            duration: isSprite ? 2 + row * 0.2 : 6 + col * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: col * 0.12 + row * 0.18,
          }}
          className="block h-full w-full"
          style={{
            backgroundColor: sprite ? sprite[2] : toneAt(col, row),
            opacity: sprite ? 0.32 : 1,
            imageRendering: "pixelated",
          }}
        />,
      );
    }
  }

  return (
    <div
      aria-hidden
      className="absolute inset-0 z-0 grid"
      style={{
        gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
        gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        imageRendering: "pixelated",
      }}
    >
      {cells}
    </div>
  );
}
