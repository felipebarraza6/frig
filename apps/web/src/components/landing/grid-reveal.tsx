"use client";

import { motion } from "framer-motion";

/**
 * Overlay de revelación futurista tipo "matriz": el panel se cubre de
 * bloques oscuros que se encienden con glow y se descomponen en cascada
 * de izquierda a derecha, revelando el contenido nuevo como una pantalla
 * digital que se desmaterializa.
 */
const COLS = 10;
const ROWS = 7;

function stepEase(steps = 6) {
  return (value: number) => Math.round(value * steps) / steps;
}

export function GridReveal() {
  const blocks: React.ReactNode[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      blocks.push(
        <motion.span
          key={`${row}-${col}`}
          initial={{ opacity: 1, scale: 1 }}
          animate={{
            // Se enciende (glow) y se disuelve, barrido por columna.
            opacity: [1, 1, 0.4, 0],
            scale: [1, 1.04, 1.1, 1.16],
            backgroundColor: ["#08170f", "#143524", "#0a2016", "#0a2016"],
          }}
          transition={{
            duration: 0.7,
            times: [0, 0.18, 0.55, 1],
            delay: (col + row * 0.12) * 0.06,
            ease: stepEase(5),
          }}
          className="block h-full w-full"
          style={{
            outline: "1px solid rgba(141,196,163,0.25)",
            boxShadow: "inset 0 0 30px 2px rgba(141,196,163,0.25)",
            imageRendering: "pixelated",
          }}
        />,
      );
    }
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30 grid"
      style={{
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        imageRendering: "pixelated",
      }}
    >
      {blocks}

      {/* Flash central */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.55, 0] }}
        transition={{ duration: 0.7, times: [0, 0.25, 1], ease: "easeOut" }}
        style={{ background: "radial-gradient(circle at 50% 45%, rgba(141,196,163,0.35), transparent 62%)" }}
      />
    </div>
  );
}
