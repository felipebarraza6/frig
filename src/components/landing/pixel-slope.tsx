/**
 * Divisor de terreno pixelado entre secciones de la landing: una cresta
 * escalonada (estilo 8-bit) en el color de la sección que introduce, con
 * una hilera de "pasto" iluminada en la cima. Convierte el cambio de fondo
 * en un paisaje continuo: el hero no termina en un borde, baja en loma.
 *
 * Uso: <section className="fondo-anterior">…</section>
 *      <PixelSlope fill="#0b110c" seed={0} />
 *      <section className="fondo-nuevo">…</section>
 */

const COLS = 72;
const ROWS = 8;

/** Perfil de cresta determinista (misma técnica de hash que el terreno).
    La silueta llena casi todo el strip (3..8 filas de 8): el "cielo" solo
    asoma en los valles, como una cordillera pixelada real. */
function crest(seed: number): number[] {
  return Array.from({ length: COLS }, (_, c) => {
    const rolling =
      Math.sin(c * 0.37 + seed * 1.7) * 1.3 + Math.sin(c * 0.13 + seed * 3.1) * 1.2;
    const peakA = Math.exp(-(((c - 16 - seed * 9) / 8) ** 2)) * 2.4;
    const peakB = Math.exp(-(((c - 48 - seed * 5) / 6.5) ** 2)) * 1.8;
    return Math.max(3, Math.min(ROWS, Math.round(4.6 + rolling + peakA + peakB)));
  });
}

export function PixelSlope({
  fill,
  highlight = "#3a5c40",
  from,
  seed = 0,
  flip = false,
  height = "clamp(32px, 5.5vw, 64px)",
}: {
  /** Color de la sección que viene DEBAJO (la silueta se pinta con él). */
  fill: string;
  /** Color de la hilera de cima (pasto iluminado). */
  highlight?: string;
  /** Color del borde inferior de la sección de ARRIBA. El fondo del
      divisor es un DEGRADADO dithered from→fill (mismo lenguaje que los
      fondos pixel-sky-*), así la onda continúa la textura del fondo
      anterior en vez de ser una franja plana que rompe el paisaje. */
  from: string;
  /** Varía el perfil de la cresta entre divisores. */
  seed?: number;
  /** Espeja el perfil horizontalmente. */
  flip?: boolean;
  height?: string;
}) {
  const heights = crest(seed);
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const h = heights[flip ? COLS - 1 - c : c];
      const surface = ROWS - h;
      let color = "transparent";
      if (r >= surface) color = r === surface ? highlight : fill;
      cells.push(<span key={`${c}-${r}`} style={{ backgroundColor: color }} />);
    }
  }
  return (
    <div
      aria-hidden
      className="pointer-events-none block w-full"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        height,
        backgroundColor: from,
        backgroundImage:
          "repeating-conic-gradient(rgba(255, 255, 255, 0.02) 0% 25%, transparent 0% 50%)," +
          "repeating-conic-gradient(rgba(141, 196, 163, 0.018) 0% 25%, transparent 0% 50%)," +
          `linear-gradient(180deg, ${from} 0%, ${fill} 100%)`,
        backgroundSize: "4px 4px, 16px 16px, 100% 100%",
        imageRendering: "pixelated",
      }}
    >
      {cells}
    </div>
  );
}
