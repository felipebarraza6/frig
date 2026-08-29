"use client";

import { motion } from "framer-motion";

/**
 * Fondo pixel-art en solo verdes oscuros: grilla 12x8 estática + "energía"
 * que viaja por los bordes de las filas del retículo (corriente retro a lo
 * largo de las líneas). Los haces son pocos (bajo consumo) y desfilan en
 * cascada de arriba a abajo, con un par de columnas cruzando en vertical.
 */
const COLUMNS = 12;
const ROWS = 8;

/** Degradado diagonal en verdes oscuros (más claro arriba-izquierda). */
const GREEN_TONES = [
  "#143a26",
  "#123524",
  "#10301f",
  "#0e2b1c",
  "#0c271a",
  "#0a2217",
] as const;

export function PixelField() {
  const cells: React.ReactNode[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const tone = GREEN_TONES[Math.min(5, col + row)] ?? GREEN_TONES[5];
      cells.push(
        <span
          key={`cell-${row}-${col}`}
          className="block h-full w-full"
          style={{
            backgroundColor: tone,
            boxShadow: "inset 0 0 0 1px rgba(141,196,163,0.10)",
            imageRendering: "pixelated",
          }}
        />,
      );
    }
  }

  /** Haces horizontales: energía viajando por cada fila del grid. */
  const rowBeams = Array.from({ length: ROWS }).map((_, row) => (
    <motion.span
      key={`row-beam-${row}`}
      className="pointer-events-none absolute block"
      style={{
        left: 0,
        top: `${(row / ROWS) * 100}%`,
        width: 16,
        height: `${100 / ROWS}%`,
        background:
          "linear-gradient(to right, transparent, rgba(141,196,163,0.45), rgba(169,216,191,0.8), transparent)",
        boxShadow: "0 0 12px 2px rgba(141,196,163,0.35)",
        imageRendering: "pixelated",
      }}
      initial={{ x: "-20%" }}
      animate={{ x: "calc(100vw)" }}
      transition={{
        duration: 2.6,
        repeat: Infinity,
        ease: "linear",
        delay: row * 0.32,
      }}
    />
  ));

  /** Haces verticales: cruzan en el sentido opuesto (circuito). */
  const colBeams = [2, 7].map((col, idx) => (
    <motion.span
      key={`col-beam-${col}`}
      className="pointer-events-none absolute block"
      style={{
        left: `${(col / COLUMNS) * 100}%`,
        top: 0,
        width: `${100 / COLUMNS}%`,
        height: 16,
        background:
          "linear-gradient(to bottom, transparent, rgba(141,196,163,0.35), rgba(169,216,191,0.6), transparent)",
        boxShadow: "0 0 12px 2px rgba(141,196,163,0.25)",
        imageRendering: "pixelated",
      }}
      initial={{ y: "-20%" }}
      animate={{ y: "calc(100vh)" }}
      transition={{
        duration: 3.4,
        repeat: Infinity,
        ease: "linear",
        delay: 0.6 + idx * 1.1,
      }}
    />
  ));

  return (
    <div
      aria-hidden
      className="absolute inset-0 z-0 grid overflow-hidden"
      style={{
        gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
        gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        imageRendering: "pixelated",
      }}
    >
      {/* Grilla verde estática */}
      {cells}
      {/* Energía viajando por los bordes del retículo */}
      {rowBeams}
      {colBeams}
    </div>
  );
}
