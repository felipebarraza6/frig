/**
 * Cielo nocturno del hero: luna pixel-art (procedural, con cráteres y
 * sombra circular) + halo pulsante + campo de estrellas titilantes.
 * Todo determinista y CSS-only por frame.
 */

/* ── Luna 16x16: disco circular, sombra inferior-derecha, cráteres ──────── */
const MOON_SIZE = 16;

const CRATERS: ReadonlyArray<readonly [number, number]> = [
  [4, 4], [5, 4], [4, 5],
  [10, 5], [11, 6],
  [6, 11], [8, 10],
];

function buildMoon(): string[] {
  const craterSet = new Set(CRATERS.map(([r, c]) => `${r}-${c}`));
  const rows: string[] = [];
  for (let r = 0; r < MOON_SIZE; r++) {
    let row = "";
    for (let c = 0; c < MOON_SIZE; c++) {
      const dx = c - 7.5;
      const dy = r - 7.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let ch = ".";
      if (dist <= 7.2) ch = "m";
      // Sombra circular inferior-derecha (terminador de la luna).
      if (ch === "m" && (c - 10.8) ** 2 + (r - 10.2) ** 2 <= 34 && dist > 3.6) {
        ch = "s";
      }
      if (ch === "m" && craterSet.has(`${r}-${c}`)) ch = "c";
      row += ch;
    }
    rows.push(row);
  }
  return rows;
}

const MOON = buildMoon();

const MOON_COLORS: Record<string, string> = {
  m: "#ece7d4", // cara iluminada
  s: "#c9c2a8", // terminador
  c: "#b3ab90", // cráter
};

function Moon({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${MOON_SIZE}, 1fr)`,
        imageRendering: "pixelated",
        aspectRatio: "1",
      }}
    >
      {MOON.map((row, r) =>
        row.split("").map((cell, c) => (
          <span
            key={`${r}-${c}`}
            style={{ aspectRatio: "1", backgroundColor: MOON_COLORS[cell] ?? "transparent" }}
          />
        )),
      )}
    </div>
  );
}

/* ── Estrellas: distribución irregular por hash senoidal (no retícula) ── */
const STAR_COUNT = 72;

/** Hash determinista 0..1 (misma técnica que el terreno). */
function rnd(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function starField() {
  return Array.from({ length: STAR_COUNT }, (_, i) => {
    const a = rnd(i * 2 + 1);
    const b = rnd(i * 2 + 2);
    const c = rnd(i * 5 + 3);
    return {
      id: `st${i}`,
      left: `${(a * 97).toFixed(2)}%`,
      // Más densas arriba, algunas bajan hasta la mitad del cielo.
      top: `${(b * b * 46).toFixed(2)}%`,
      size: c > 0.85 ? 3 : c > 0.4 ? 2 : 1,
      delay: `${(rnd(i * 3 + 5) * 3.4).toFixed(2)}s`,
      duration: `${(2.2 + rnd(i * 7 + 9) * 2.8).toFixed(2)}s`,
      color: c > 0.9 ? "#e9bd4a" : c > 0.55 ? "#ece7d4" : "#b8c4b4",
    };
  });
}

const STARS = starField();

export function PixelNightSky() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Estrellas titilantes en la mitad superior del cielo. */}
      {STARS.map((star) => (
        <span
          key={star.id}
          className="login-twinkle absolute"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            backgroundColor: star.color,
            animationDelay: star.delay,
            animationDuration: star.duration,
          }}
        />
      ))}

      {/* Luna con halo pulsante, arriba a la derecha (sobre la aldea). */}
      <div
        className="absolute"
        style={{ left: "76%", top: "5%", width: "clamp(56px, 8vw, 104px)" }}
      >
        <span
          className="moon-halo absolute"
          style={{
            inset: "-45%",
            background:
              "radial-gradient(circle, rgba(236,231,212,0.30) 0%, rgba(233,189,74,0.12) 45%, transparent 70%)",
          }}
        />
        <Moon className="relative" />
      </div>
    </div>
  );
}
