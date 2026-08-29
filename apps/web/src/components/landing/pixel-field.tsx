"use client";

/**
 * Fondo pixel-art en solo verdes oscuros: cada cuadrito tiene relieve de
 * bloque (bisel pixel: luz arriba-izquierda + sombra abajo-derecha) y una
 * sombra proyectada, como los bloques de los juegos retro. Todo el fondo
 * es píxeles con sombra; las celdas son estáticas (consumo mínimo).
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

/**
 * Sombra pixel-art por celda: bisel interior (luz arriba-izq, sombra
 * abajo-der) + sombra exterior proyectada hacia abajo-derecha.
 */
function blockShadow(): string {
  return [
    "inset 3px 3px 0 0 rgba(169,216,191,0.24)", // luz (arriba-izq)
    "inset -3px -3px 0 0 rgba(0,0,0,0.48)", // sombra interior (abajo-der)
    "inset 0 0 0 1px rgba(0,0,0,0.28)", // contorno oscuro
    "1px 3px 0 0 rgba(0,0,0,0.38)", // sombra proyectada (bloque)
  ].join(", ");
}

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
            boxShadow: blockShadow(),
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
    </div>
  );
}
