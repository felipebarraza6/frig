"use client";

/**
 * Reveal al hacer scroll: fade + slide-up una sola vez, con delay escalonable.
 * Con prefers-reduced-motion renderiza el contenido sin animar.
 */

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

export function ScrollReveal({
  children,
  className,
  delay = 0,
  y = 12,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      /* rootMargin positivo hacia abajo: el reveal se dispara ANTES de que
         el contenido entre en pantalla, así una sección nunca se ve vacía
         "popeando" al llegar por ancla o scroll. */
      viewport={{ once: true, margin: "0px 0px 18% 0px" }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
