"use client";

/**
 * Nubes pixel-art que cruzan el cielo del hero (loop CSS, cero JS por frame).
 * Cada nube es un bitmap de divs cuadrados con bordes duros.
 */

const CLOUD_ART = [
  "..XXXX...",
  ".XXXXXX..",
  "XXXXXXXX.",
  ".XXXXXXX.",
] as const;

const COLS = CLOUD_ART[0].length;

function Cloud({ size, dense, className }: { size: number; dense?: boolean; className?: string }) {
  const cell = size / COLS;
  return (
    <div
      className={className}
      style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, ${cell}px)`, imageRendering: "pixelated" }}
    >
      {CLOUD_ART.map((row, r) =>
        row.split("").map((ch, c) => (
          <span
            key={`${r}-${c}`}
            style={{
              width: cell,
              height: cell,
              backgroundColor:
                ch === "X"
                  ? r >= 2
                    ? dense
                      ? "rgba(178,194,184,0.92)"
                      : "rgba(200,214,205,0.5)"
                    : dense
                      ? "rgba(218,230,222,0.98)"
                      : "rgba(226,236,228,0.62)"
                  : "transparent",
            }}
          />
        )),
      )}
    </div>
  );
}

/* dense = nube de la banda alta: al cruzar la luna la OCULTA de verdad
   (la luna queda detrás, en el espacio). */
const CLOUDS = [
  { id: "c1", top: "7%", size: 96, duration: "85s", delay: "0s", opacity: 0.8, dense: true },
  { id: "c2", top: "16%", size: 64, duration: "65s", delay: "-28s", opacity: 0.38 },
  { id: "c3", top: "3%", size: 48, duration: "100s", delay: "-55s", opacity: 0.75, dense: true },
  { id: "c4", top: "12%", size: 72, duration: "75s", delay: "-12s", opacity: 0.42 },
  { id: "c5", top: "21%", size: 56, duration: "92s", delay: "-70s", opacity: 0.3 },
  { id: "c6", top: "5%", size: 40, duration: "110s", delay: "-40s", opacity: 0.7, dense: true },
  { id: "c7", top: "11%", size: 88, duration: "70s", delay: "-45s", opacity: 0.36 },
  { id: "c8", top: "25%", size: 52, duration: "80s", delay: "-20s", opacity: 0.28 },
  { id: "c9", top: "30%", size: 36, duration: "95s", delay: "-62s", opacity: 0.22 },
] as ReadonlyArray<{
  id: string;
  top: string;
  size: number;
  duration: string;
  delay: string;
  opacity: number;
  dense?: boolean;
}>;

export function PixelClouds() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {CLOUDS.map((cloud) => (
        <div
          key={cloud.id}
          className="landing-cloud absolute left-0"
          style={{ top: cloud.top, opacity: cloud.opacity, animationDuration: cloud.duration, animationDelay: cloud.delay }}
        >
          <Cloud size={cloud.size} dense={cloud.dense} />
        </div>
      ))}
    </div>
  );
}
