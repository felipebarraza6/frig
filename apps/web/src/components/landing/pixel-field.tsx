"use client";

import { motion } from "framer-motion";

/**
 * Fondo pixel-art en solo verdes oscuros:
 *  - Grilla densa de cuadritos (patrón CSS, DOM cero) con RELIEVE sutil:
 *    luz de 1px arriba de cada celda (bevel) — una sola capa limpia.
 *  - Haces de energía con estela que viajan POR LOS BORDES divisorios
 *    horizontales (filas) en cascada, con giro de pasos (no lineal).
 * Sin capas superpuestas que se cancelen; leve y legible.
 */
const CELL = 18; // px por cuadrito

function stepEase(steps = 6) {
  return (value: number) => Math.round(value * steps) / steps;
}

/** Filas divisorias donde viaja la energía (como % del alto). */
const ROW_PCTS: ReadonlyArray<number> = [16, 29, 42, 55, 68, 81];

export function PixelField() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 z-0 overflow-hidden"
      style={{
        backgroundColor: "#0a2217",
        backgroundImage: [
          // Relieve: luz superior (2px) + sombra inferior (2px) marcadas.
          `repeating-linear-gradient(0deg, rgba(169,216,191,0.34) 0 2px, transparent 2px ${
            CELL - 3
          }px, rgba(0,0,0,0.55) ${CELL - 3}px ${CELL}px)`,
          // Línea divisoria horizontal (borde entre filas).
          `repeating-linear-gradient(0deg, rgba(0,0,0,0.20) 0 1px, transparent 1px ${CELL}px)`,
          // Relieve lateral: luz izquierda (1px) en cada columna.
          `repeating-linear-gradient(90deg, rgba(169,216,191,0.20) 0 1px, transparent 1px ${
            CELL - 1
          }px, rgba(0,0,0,0.30) ${CELL - 1}px ${CELL}px)`,
          // Base oscura diagonal.
          "linear-gradient(135deg, #153a27 0%, #0f2c1d 48%, #0a2116 100%)",
        ].join(", "),
        imageRendering: "pixelated",
      }}
    >
      {/* Energía viajando por los bordes horizontales (estela corta). */}
      {ROW_PCTS.map((topPct, idx) => (
        <motion.span
          key={`energy-${topPct}`}
          className="pointer-events-none absolute block"
          style={{
            top: `${topPct}%`,
            left: 0,
            height: 2,
            width: 120,
            background:
              "linear-gradient(to right, transparent, rgba(141,196,163,0.70), rgba(169,216,191,1), rgba(141,196,163,0.35), transparent)",
            filter: "drop-shadow(0 0 4px rgba(141,196,163,0.5))",
            imageRendering: "pixelated",
          }}
          initial={{ x: "-10%" }}
          animate={{ x: ["-10%", "112%", "-10%"] }}
          transition={{
            duration: 5.5,
            repeat: Infinity,
            ease: stepEase(4),
            delay: idx * 0.9,
          }}
        />
      ))}
    </div>
  );
}
