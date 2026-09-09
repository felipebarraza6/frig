/**
 * Divisor de terreno pixelado entre secciones de la landing: una cresta
 * escalonada (estilo 8-bit) que ES el límite entre dos secciones. El strip
 * es transparente y se superpone ±height/2 al borde (márgenes negativos):
 * los fondos se adaptan a la onda en ambos sentidos — el color de la
 * sección de abajo sube en los picos y el de la sección de arriba baja en
 * los valles. Sobre la línea de cresta siempre se ve la hilera de pasto.
 *
 * Las dos capas de relleno usan la misma receta de textura que los fondos
 * pixel-sky-* (color plano + dither fino), recortadas por máscaras SVG que
 * siguen la onda. La capa del color inferior lleva la fase del dither
 * anclada al origen de esa sección, así la unión bajo el strip es
 * invisible (no hay borde recto ni franja de tono distinto).
 *
 * Uso: <section className="fondo-anterior">…</section>
 *      <PixelSlope from="#122217" fill="#0b110c" seed={0} />
 *      <section className="fondo-nuevo">…</section>
 */

const COLS = 72;
const ROWS = 8;
/** Fila del centro del strip: la frontera recta entre las dos secciones. */
const MID = ROWS / 2;

/** Perfil de cresta determinista (misma técnica de hash que el terreno).
    La línea ondula ±4 filas alrededor del borde: los picos suben terreno
    nuevo y los valles dejan bajar el terreno anterior. */
function crest(seed: number): number[] {
  return Array.from({ length: COLS }, (_, c) => {
    const rolling =
      Math.sin(c * 0.37 + seed * 1.7) * 1.3 + Math.sin(c * 0.13 + seed * 3.1) * 1.2;
    const peakA = Math.exp(-(((c - 16 - seed * 9) / 8) ** 2)) * 2.4;
    const peakB = Math.exp(-(((c - 48 - seed * 5) / 6.5) ** 2)) * 1.8;
    return Math.max(2, Math.min(ROWS, Math.round(4.6 + rolling + peakA + peakB)));
  });
}

/** Dither fino de los fondos pixel-sky-*: misma receta para que los
    rellenos sean indistinguibles de las secciones que tocan. */
const DITHER =
  "repeating-conic-gradient(rgba(255, 255, 255, 0.02) 0% 25%, transparent 0% 50%)," +
  "repeating-conic-gradient(rgba(141, 196, 163, 0.018) 0% 25%, transparent 0% 50%)";

/** Máscara SVG a partir de rectángulos por columna (coords en celdas). */
function svgMask(rects: string): string {
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${COLS} ${ROWS}' preserveAspectRatio='none'><g fill='#fff'>${rects}</g></svg>`,
  )}")`;
}

export function PixelSlope({
  from,
  fill,
  highlight = "#3a5c40",
  seed = 0,
  flip = false,
  height = "clamp(32px, 5.5vw, 64px)",
}: {
  /** Color del borde inferior de la sección de ARRIBA: baja en lenguas
      por los valles de la onda (p. ej. #122217 en pixel-sky-forest). */
  from: string;
  /** Color con que ARRANCA la sección de abajo: sube en los picos. Debe
      ser su color plano inicial (p. ej. #0b110c en pixel-sky-*). */
  fill: string;
  /** Color de la hilera de cima (pasto iluminado). */
  highlight?: string;
  /** Varía el perfil de la cresta entre divisores. */
  seed?: number;
  /** Espeja el perfil horizontalmente. */
  flip?: boolean;
  /** Alto total del strip: la línea ondula ±height/2 alrededor del borde. */
  height?: string;
}) {
  const heights = crest(seed);
  const x = (c: number) => (flip ? COLS - 1 - c : c);

  // Capa oscura: todo lo que queda bajo la línea de cresta (terreno nuevo
  // que sube por los picos y continúa la sección inferior).
  const fillRects = heights
    .map((h, c) => {
      const s = ROWS - h;
      return `<rect x='${x(c)}' y='${s}' width='1' height='${ROWS - s}'/>`;
    })
    .join("");

  // Capa verde: entre el borde recto y la línea de cresta, solo donde la
  // onda cae (superficie bajo el centro): el terreno anterior que baja
  // por los valles.
  const fromRects = heights
    .map((h, c) => {
      const s = ROWS - h;
      if (s <= MID) return "";
      return `<rect x='${x(c)}' y='${MID}' width='1' height='${s - MID}'/>`;
    })
    .join("");

  // Hilera de pasto: una celda pintada en la fila de superficie de cada columna.
  const grass: React.ReactNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      grass.push(
        <span
          key={`${c}-${r}`}
          style={{
            backgroundColor: r === ROWS - heights[x(c)] ? highlight : undefined,
          }}
        />,
      );
    }
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none relative block w-full"
      style={{
        height,
        // Se reparte a mitades sobre cada sección: la línea queda centrada
        // en el borde y los fondos se adaptan a la onda a ambos lados.
        marginTop: `calc((${height}) / -2)`,
        marginBottom: `calc((${height}) / -2)`,
      }}
    >
      {/* Terreno nuevo (color de la sección inferior): bajo la ola, con la
          fase del dither anclada al origen de esa sección —el centro del
          strip— para que la unión bajo el strip sea invisible. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: fill,
          backgroundImage: DITHER,
          backgroundSize: "4px 4px, 16px 16px",
          backgroundPosition: `0 calc((${height}) / 2)`,
          maskImage: svgMask(fillRects),
          maskSize: "100% 100%",
          WebkitMaskImage: svgMask(fillRects),
          WebkitMaskSize: "100% 100%",
        }}
      />
      {/* Terreno anterior (color de la sección superior): lenguas que bajan
          por los valles; vive solo dentro de la zona de la sección
          inferior, sin tocar la unión, así su fase de dither es libre. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: from,
          backgroundImage: DITHER,
          backgroundSize: "4px 4px, 16px 16px",
          maskImage: svgMask(fromRects),
          maskSize: "100% 100%",
          WebkitMaskImage: svgMask(fromRects),
          WebkitMaskSize: "100% 100%",
        }}
      />
      {/* Pasto: la línea de cima, una celda por columna. */}
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          imageRendering: "pixelated",
        }}
      >
        {grass}
      </div>
    </div>
  );
}
