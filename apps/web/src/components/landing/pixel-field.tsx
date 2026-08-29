"use client";

import { motion } from "framer-motion";

/**
 * Fondo pixel-art eficiente: grilla densa 12x8 de celdas ESTÁTICAS
 * (sin animación por celda — ahorra recursos) + pocos sprites que
 * parpadean con glow. Nunca genera scroll (absolute inset-0).
 */
const COLUMNS = 12;
const ROWS = 8;

/** Degradado diagonal (celdas): más claro arriba-izquierda. */
const TONES = [
  "#143524",
  "#102e1f",
  "#0d281b",
  "#0b2318",
  "#0a2016",
  "#091d14",
] as const;

/** Sprites tenues: solo estos parpadean (pocos → bajo consumo). */
const SPRITES: ReadonlyArray<readonly [number, number, string]> = [
  [1, 0, "#7f4626"], // tomate tenue
  [10, 1, "#8a7a33"], // masa tenue
  [1, 6, "#5b3a20"], // café tenue
  [8, 5, "#4e7a5e"], // hoja tenue
  [5, 3, "#6b3829"], // manzana tenue
];

export function PixelField() {
  const cells: React.ReactNode[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const sprite = SPRITES.find(([c, r]) => c === col && r === row);
      const tone = TONES[Math.min(5, col + row)] ?? TONES[5];
      // Celdas estáticas: un <span> plano, sin animación (barato).
      cells.push(
        <span
          key={`cell-${row}-${col}`}
          className="block h-full w-full"
          style={{
            backgroundColor: sprite ? sprite[2] : tone,
            boxShadow: sprite
              ? "inset 0 0 18px 2px rgba(141,196,163,0.25)"
              : "inset 0 0 0 1px rgba(141,196,163,0.04)",
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
      {/* Grilla estática */}
      {cells}

      {/* Capa de parpadeo solo sobre los sprites (5 elementos, baja carga). */}
      {SPRITES.map(([col, row], idx) => (
        <motion.span
          key={`blink-${row}-${col}`}
          className="pointer-events-none absolute block"
          style={{
            left: `${(col / COLUMNS) * 100}%`,
            top: `${(row / ROWS) * 100}%`,
            width: `${100 / COLUMNS}%`,
            height: `${100 / ROWS}%`,
            background:
              "radial-gradient(circle at 50% 50%, rgba(141,196,163,0.35), transparent 70%)",
          }}
          animate={{ opacity: [0.25, 0.8, 0.25] }}
          transition={{
            duration: 2.6 + idx * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: idx * 0.6,
          }}
        />
      ))}
    </div>
  );
}
