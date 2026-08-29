"use client";

import { motion } from "framer-motion";

/**
 * Fondo pixel-art: campo de celdas (grilla densa 10x7) en degradado
 * diagonal oscuro + sprites tenues con glow que parpadean. Sin scanline.
 * Nunca genera scroll (absolute inset-0).
 */
const COLUMNS = 10;
const ROWS = 7;

/** Degradado diagonal (bloques grandes): más claro arriba-izquierda. */
const TONES = [
  "#143524",
  "#102e1f",
  "#0d281b",
  "#0b2318",
  "#0a2016",
  "#091d14",
] as const;

const SPRITES: ReadonlyArray<readonly [number, number, string]> = [
  [1, 0, "#7f4626"], // tomate tenue
  [8, 1, "#8a7a33"], // masa tenue
  [1, 5, "#5b3a20"], // café tenue
  [7, 4, "#4e7a5e"], // hoja tenue
  [4, 3, "#6b3829"], // manzana tenue
];

export function PixelField() {
  const cells: React.ReactNode[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const sprite = SPRITES.find(([c, r]) => c === col && r === row);
      const idx = col + row * COLUMNS;
      const tone = TONES[Math.min(5, col + row)] ?? TONES[5];
      cells.push(
        <motion.span
          key={`cell-${row}-${col}`}
          animate={{ opacity: sprite ? [0.5, 1, 0.5] : [0.85, 1, 0.85] }}
          transition={{
            duration: sprite ? 2.4 + row * 0.4 : 7 + idx * 0.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: idx * 0.15,
          }}
          className="block h-full w-full"
          style={{
            backgroundColor: sprite ? sprite[2] : tone,
            boxShadow: sprite
              ? "inset 0 0 18px 2px rgba(141,196,163,0.28)"
              : "inset 0 0 0 1px rgba(141,196,163,0.05)",
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
