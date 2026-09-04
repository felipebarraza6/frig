"use client";

import { motion } from "framer-motion";

/**
 * Fondo pixel-art verde tipo "mosaico 8-bit": grilla de cuadritos con
 * tonos verdes variados (determinista, hash por celda) + algunos destellos
 * verdes que parpadean suavemente. Estilo césped/tablero retro.
 * Celdas estáticas (DOM plano) → rendimiento mínimo.
 */
const COLUMNS = 16;
const ROWS = 9;

/** Paleta de verdes (oscuros → medios) para el mosaico. */
const GREEN_PALETTE = [
  "#0a2217",
  "#0d2b1c",
  "#103524",
  "#143e29",
  "#1a4a31",
  "#1c5436",
] as const;

/** Hash determinista por celda (0..1) para variar tono sin aleatoriedad real. */
function cellHash(col: number, row: number): number {
  const x = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function toneFor(col: number, row: number): string {
  // Degradado diagonal base + variación del hash.
  const base = Math.min(5, Math.round((col + row) / ((COLUMNS + ROWS) / 5)));
  const jitter = cellHash(col, row);
  const idx = Math.max(0, Math.min(5, Math.round(base + (jitter - 0.5) * 2.2)));
  return GREEN_PALETTE[idx];
}

/** Celdas con destello que parpadea (posiciones fijas deterministas). */
const BEACONS: ReadonlyArray<readonly [number, number]> = [
  [3, 1],
  [11, 2],
  [5, 5],
  [13, 6],
  [8, 3],
];

export function PixelField() {
  const cells: React.ReactNode[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      cells.push(
        <span
          key={`cell-${row}-${col}`}
          className="block h-full w-full"
          style={{
            backgroundColor: toneFor(col, row),
            // Borde sutil de "pixel": 1px oscuro en el contorno de cada cuadro.
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.18)",
            imageRendering: "pixelated",
          }}
        />,
      );
    }
  }

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
      {cells}

      {/* Oscurecimiento uniforme para legibilidad del contenido. */}
      <div className="pointer-events-none absolute inset-0 bg-black/25" />

      {/* Destellos verdes que parpadean suavemente (pocos, bajo consumo). */}
      {BEACONS.map(([col, row], idx) => (
        <motion.span
          key={`beacon-${row}-${col}`}
          className="pointer-events-none absolute block"
          style={{
            left: `${(col + 0.5) * (100 / COLUMNS)}%`,
            top: `${(row + 0.5) * (100 / ROWS)}%`,
            width: 0,
            height: 0,
            marginLeft: 8,
            marginTop: 8,
            background:
              "radial-gradient(circle, rgba(141,196,163,0.55) 0%, transparent 70%)",
          }}
          animate={{ opacity: [0.1, 0.85, 0.1] }}
          transition={{
            duration: 2.6 + idx * 0.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: idx * 0.55,
          }}
        />
      ))}
    </div>
  );
}
