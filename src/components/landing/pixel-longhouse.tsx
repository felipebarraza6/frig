/**
 * Longhouse vikingo pixel-art para el hero (estilo angrysnail / Valhalla).
 * Vista de frontón: vigas cruzadas en X sobre la cumbrera, techo de sodio
 * con textura de hileras, tablones musgosos, puerta tallada con luz cálida,
 * escudo redondo y sendero de piedra.
 *
 * El techo se genera por código (pendiente aritmética) y cada fila valida
 * su ancho en Row(): si el bitmap queda mal armado, el build falla aquí.
 */

const W = 50;

/** Une segmentos y exige ancho exacto de fila. */
function Row(...parts: string[]): string {
  const s = parts.join("");
  if (s.length !== W) throw new Error(`fila longhouse con ancho ${s.length}`);
  return s;
}

/* ── Vigas cruzadas (X) + asta de la cumbrera ─────────────────────────── */
const BEAMS = [
  Row(".".repeat(19), "xx", ".".repeat(8), "xx", ".".repeat(19)),
  Row(".".repeat(21), "xx", ".".repeat(4), "xx", ".".repeat(21)),
  Row(".".repeat(23), "xxxx", ".".repeat(23)),
  Row(".".repeat(23), "xxxx", ".".repeat(23)),
  Row(".".repeat(21), "xx", ".".repeat(4), "xx", ".".repeat(21)),
  Row(".".repeat(24), "dd", ".".repeat(24)),
];

/* ── Techo de sodio: triángulo que crece 2 celdas por fila, con borde de
      viga rojiza y asta central atravesando. El relleno mezcla sodio con
      sombras irregulares y matitas de pasto (techo turba vikingo). ─────── */
const ROOF_ROWS = 10;
const roof: string[] = [];
for (let i = 0; i < ROOF_ROWS; i++) {
  const half = 7 + i; // media-anchura desde el centro (col 25)
  const start = 25 - half;
  const width = half * 2;
  const inner = width - 2;
  let fill = "";
  for (let j = 0; j < inner; j++) {
    const h = (i * 31 + j * 17) % 23;
    fill += h < 3 ? "R" : h === 9 && i > 1 ? "G" : "r";
  }
  let cells = ("x" + fill + "x").split("");
  // Asta central ('dd' en cols 24-25) por encima de la paja.
  cells[24 - start] = "d";
  cells[25 - start] = "d";
  roof.push(Row(".".repeat(start), cells.join(""), ".".repeat(W - start - width)));
}

/* ── Muro (32 celdas entre col 9 y 40) ────────────────────────────────── */
function wall(mid: string): string {
  if (mid.length !== 32) throw new Error(`muro longhouse con ancho ${mid.length}`);
  return Row(".".repeat(9), mid, ".".repeat(9));
}

/** Textura de tablones: juntas en filas impares, musgo disperso y postes
    de esquina. Solo toca 'p': puerta, ventanas y escudo quedan intactos. */
function texturePlanks(mid: string, i: number): string {
  return mid
    .split("")
    .map((ch, j) => {
      if (ch !== "p") return ch;
      if (j === 0 || j === 31) return "o";
      const h = (i * 13 + j * 7) % 29;
      if (i % 2 === 1 && h < 2) return "P";
      if (h === 11) return "m";
      return "p";
    })
    .join("");
}

const DOOR_GLOW = "dggggd";
const DOOR_HANDLE = "dggwgd";

const WALL = [
  // dintel con antorchas a los lados
  wall(texturePlanks("p".repeat(11) + "t" + "p" + "dddddd" + "p" + "t" + "p".repeat(11), 0)),
  // ventanas cálidas (respiran) + parte alta de la puerta
  wall(texturePlanks("ppppppwpppppp" + DOOR_GLOW + "ppppppppwpppp", 1)),
  // escudo: aro superior
  wall(texturePlanks("ppppPppppppPp" + DOOR_GLOW + "pp" + "..ss.." + "ppppp", 2)),
  // escudo: centro rojo
  wall(texturePlanks("p".repeat(13) + DOOR_GLOW + "pp" + ".sSSs." + "ppppp", 3)),
  // escudo: aro inferior + manija dorada
  wall(texturePlanks("ppppPppppppPp" + DOOR_HANDLE + "pp" + "..ss.." + "ppppp", 4)),
  // puerta baja
  wall(texturePlanks("ppppPppppppPp" + DOOR_GLOW + "ppppppPpppppP", 5)),
  wall(texturePlanks("p".repeat(13) + DOOR_GLOW + "p".repeat(13), 6)),
  // viga base
  wall("o".repeat(32)),
];

const EAVE = Row(".".repeat(8), "o".repeat(34), ".".repeat(8));

/** Relleno sólido con sobreescrituras por índice (para la falda de tierra). */
function fill(width: number, ch: string, over: Record<number, string>): string {
  const arr = ch.repeat(width).split("");
  for (const [k, v] of Object.entries(over)) arr[Number(k)] = v;
  return arr.join("");
}

/** {from..to: ch} → overrides por índice. */
function span(from: number, to: number, ch: string): Record<number, string> {
  const o: Record<number, string> = {};
  for (let i = from; i <= to; i++) o[i] = ch;
  return o;
}

/* ── Fogata + cerco + sendero + falda de tierra ───────────────────────────
   El bloque bajo la casa es tierra SÓLIDA (sin filas transparentes): la
   llama se dibuja encima del suelo y la fogata queda plantada por delante.
   La falda es angosta y escalonada (34→38→40→36→30→24) con pasto en los
   bordes, para leerse como un morón natural fundido con la colina y no como
   un bloque rectangular cortado. */
const FIRE = [
  // Terraza: pasto en el borde quebra la línea dura contra la ladera.
  Row(
    ".".repeat(8),
    fill(34, "M", {
      0: "G",
      7: "G",
      26: "G",
      33: "G",
      ...span(11, 18, "n"), // sendero frente a la puerta
    }),
    ".".repeat(8),
  ),
  // fogata baja sobre suelo sólido: llama dibujada encima de la tierra
  Row(
    ".".repeat(6),
    fill(38, "M", { ...span(13, 20, "n"), ...span(25, 27, "F"), 26: "e" }),
    ".".repeat(6),
  ),
  Row(
    ".".repeat(5),
    fill(40, "M", { ...span(14, 21, "n"), ...span(25, 29, "F"), 27: "e" }),
    ".".repeat(5),
  ),
  // plataforma: riel del cerco + leños/piedras de la fogata + sendero
  Row(
    ".".repeat(5),
    fill(40, "M", {
      ...span(0, 8, "d"), // riel del cerco (izquierda)
      ...span(14, 21, "n"), // sendero
      26: "n",
      ...span(27, 31, "l"), // leños de la fogata
      32: "n",
      39: "G",
    }),
    ".".repeat(5),
  ),
  // falda media: estacas del cerco + sendero + pasto en el borde
  Row(
    ".".repeat(7),
    fill(36, "M", {
      0: "d",
      3: "d",
      6: "d", // estacas bajo el riel
      ...span(13, 18, "n"),
      35: "G",
    }),
    ".".repeat(7),
  ),
  // falda profunda (se funde con la colina)
  Row(
    ".".repeat(10),
    fill(30, "D", { 0: "G", 11: "n", 12: "n", 29: "G" }),
    ".".repeat(10),
  ),
  Row(
    ".".repeat(13),
    fill(24, "D", { 0: "G", 23: "G" }),
    ".".repeat(13),
  ),
];

// La colina la dibuja pixel-village.tsx: este bitmap es la casa + fogata +
// cerco + falda de tierra, anclada (sink) sobre el terreno.
const SCENE = [...BEAMS, ...roof, EAVE, ...WALL, ...FIRE];

const COLORS: Record<string, string> = {
  x: "#8a4f3d", // viga rojiza
  r: "#6f6a58", // sodio
  R: "#565043", // hilera de sodio (sombra)
  o: "#3f382c", // viga oscura
  d: "#33281a", // asta / marco de puerta
  p: "#7d7a63", // tablón musgoso
  P: "#54523f", // junta de tablón
  m: "#5f6f4a", // musgo
  g: "#6b4a38", // madera de la puerta
  w: "#e9bd4a", // luz cálida
  t: "#d8783d", // antorcha
  s: "#b8b0a0", // aro del escudo
  S: "#a0522d", // centro del escudo
  G: "#3a5c40", // pasto
  M: "#2c4a31", // loma media
  D: "#234026", // loma profunda
  n: "#8b8570", // sendero de piedra / piedras de fogata
  F: "#d8783d", // llama
  e: "#f1d195", // núcleo de la llama
  l: "#5c4529", // leños
};

const COLS = SCENE[0].length;

/** Clase de animación por tipo de celda (ver globals.css). */
const ANIM: Record<string, string> = {
  t: "house-torch",
  w: "house-window",
  F: "house-torch",
  e: "house-torch",
};

export function PixelLonghouse({ className }: { className?: string }) {
  return (
    <div aria-hidden className={className} style={{ position: "relative" }}>
      {/* Resplandor cálido de la fogata (calidez FRIG), pulsando suave. */}
      <span
        className="moon-halo"
        style={{
          position: "absolute",
          left: "58%",
          bottom: "-4%",
          width: "26%",
          aspectRatio: "1",
          background:
            "radial-gradient(circle, rgba(233,189,74,0.35) 0%, rgba(216,120,61,0.14) 45%, transparent 70%)",
        }}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          imageRendering: "pixelated",
        }}
      >
      {SCENE.map((row, r) =>
        row.split("").map((cell, c) => (
          <span
            key={`${r}-${c}`}
            className={ANIM[cell]}
            style={{
              aspectRatio: "1",
              backgroundColor: COLORS[cell] ?? "transparent",
              animationDelay:
                cell === "w"
                  ? `${(r + c) * 0.35}s`
                  : cell === "t"
                    ? `${(r + c) * 0.09}s`
                    : cell === "F" || cell === "e"
                      ? `${(r * 7 + c) * 0.07}s`
                      : undefined,
            }}
          />
        )),
      )}
      </div>

      {/* Humo de la fogata subiendo (columna sobre la llama, col ~32/50). */}
      {[0, 1, 2].map((i) => (
        <span
          key={`smoke-${i}`}
          className="login-steam-anim"
          style={{
            position: "absolute",
            left: `${62 + i * 2}%`,
            bottom: "14%",
            width: "4%",
            aspectRatio: "1",
            backgroundColor: "#c8cec4",
            opacity: 0,
            animationDelay: `${i * 0.9}s`,
            animationDuration: `${3.2 + i * 0.6}s`,
          }}
        />
      ))}
    </div>
  );
}
