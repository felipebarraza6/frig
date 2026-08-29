"use client";

import { motion } from "framer-motion";

/**
 * Fondo pixel-art ultra denso en SOLO verdes oscuros.
 * MILLARES de cuadritos pintados con patrones de fondo CSS
 * (repeating-linear-gradient en X e Y), costo DOM cero: ningún span por
 * celda, solo 2 capas de background + unos pocos faros de parpadeo.
 */
const CELL = 18; // tamaño en px de cada cuadrito (entre más chico, más cuadros)

export function PixelField() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 z-0 overflow-hidden"
      style={{
        // Base: degradado diagonal de verdes oscuros.
        backgroundColor: "#0a2217",
        backgroundImage: [
          // Cuadrícula vertical: líneas finas cada CELL px.
          `repeating-linear-gradient(0deg, rgba(141,196,163,0.10) 0 1px, transparent 1px ${CELL}px)`,
          // Cuadrícula horizontal: idem.
          `repeating-linear-gradient(90deg, rgba(141,196,163,0.08) 0 1px, transparent 1px ${CELL}px)`,
          // Degradado diagonal en verdes oscuros (más claro arriba-izquierda).
          "linear-gradient(135deg, #143a26 0%, #0e2b1c 45%, #0a2217 100%)",
        ].join(", "),
        imageRendering: "pixelated",
      }}
    >
      {/* Faros de parpadeo abstracto (pocos, posición fija determinista). */}
      {(
        [
          [18, 20],
          [70, 38],
          [42, 60],
          [86, 72],
          [58, 26],
        ] as const
      ).map(([left, top], idx) => (
        <motion.span
          key={`beacon-${left}-${top}`}
          className="pointer-events-none absolute block"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: CELL + 6,
            height: CELL + 6,
            background:
              "radial-gradient(circle at 50% 50%, rgba(141,196,163,0.5), rgba(141,196,163,0.10) 60%, transparent 80%)",
          }}
          animate={{ opacity: [0.2, 0.9, 0.2] }}
          transition={{
            duration: 2.6 + idx * 0.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: idx * 0.5,
          }}
        />
      ))}
    </div>
  );
}
