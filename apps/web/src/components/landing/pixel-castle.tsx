/**
 * Castillo pixel-art para el hero de la landing (estilo juego medieval).
 * Arte dibujado como bitmap: cada string es una fila, cada caracter una celda.
 * Render: grilla de divs cuadrados (estático, cero JS de animación).
 *
 * Paleta:
 *   s = piedra        w = ventana dorada   g = portón oscuro
 *   f = bandera FRIG  t = antorcha         d = asta / piedra oscura
 */
const ART = [
  ".....................dff......................",
  ".....................dff......................",
  ".....................d........................",
  "..................s.s.s.s.....................",
  "..........dff.....ssssssss......dff...........",
  "..........dff.....ssssssss......dff...........",
  "..........d.......ssssssss.......d............",
  "........s.s.s.....ssssssss......s.s.s.........",
  "........ssssss....swwswwss......ssssss........",
  "........sswwss....swwswwss......sswwss........",
  "........ssssss....ssssssss......ssssss........",
  "........ssssss....swwswwss......ssssss........",
  "........ssssss....ssssssss......ssssss........",
  "........ssssssssssssssssssssssssssssss........",
  "........ssssssssssssssssssssssssssssss........",
  "........ssssssssssssssssssssssssssssss........",
  "........ssssssssstssggggstssssssssssss........",
  "........ssssssssssssggggssssssssssssss........",
  "........ssssssssssssggggssssssssssssss........",
  "........ssssssssssssggggssssssssssssss........",
  "........ssssssssssssggggssssssssssssss........",
] as const;

const COLORS: Record<string, string> = {
  s: "#8b937f",
  w: "#e9bd4a",
  g: "#2b2620",
  f: "#3f8f52",
  t: "#d8783d",
  d: "#4a5244",
};

const COLS = ART[0].length;

export function PixelCastle({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        imageRendering: "pixelated",
      }}
    >
      {ART.map((row, r) =>
        row.split("").map((cell, c) => (
          <span
            key={`${r}-${c}`}
            style={{
              aspectRatio: "1",
              backgroundColor: COLORS[cell] ?? "transparent",
            }}
          />
        )),
      )}
    </div>
  );
}
