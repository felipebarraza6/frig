"use client";

/**
 * Ráfagas de viento pixel cruzando el hero (estelas horizontales rápidas).
 * Reusan el keyframe landing-cloud (translateX con steps = avance a saltos).
 */

const GUSTS = [
  { id: "g1", top: "6%", width: 56, height: 2, duration: "7s", delay: "0s", opacity: 0.16 },
  { id: "g2", top: "13%", width: 34, height: 2, duration: "9s", delay: "-3s", opacity: 0.12 },
  { id: "g3", top: "24%", width: 72, height: 3, duration: "6s", delay: "-5s", opacity: 0.14 },
  { id: "g4", top: "38%", width: 40, height: 2, duration: "10s", delay: "-1.5s", opacity: 0.1 },
  { id: "g5", top: "52%", width: 60, height: 2, duration: "8s", delay: "-6s", opacity: 0.13 },
  { id: "g6", top: "64%", width: 30, height: 2, duration: "11s", delay: "-2s", opacity: 0.09 },
  { id: "g7", top: "76%", width: 66, height: 3, duration: "7.5s", delay: "-4.5s", opacity: 0.12 },
  { id: "g8", top: "88%", width: 44, height: 2, duration: "9.5s", delay: "-7s", opacity: 0.1 },
  { id: "g9", top: "45%", width: 26, height: 2, duration: "6.5s", delay: "-8s", opacity: 0.08 },
  { id: "g10", top: "30%", width: 50, height: 2, duration: "8.5s", delay: "-9s", opacity: 0.11 },
] as const;

export function PixelWind() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {GUSTS.map((gust) => (
        <span
          key={gust.id}
          className="landing-cloud absolute left-0 block"
          style={{
            top: gust.top,
            width: gust.width,
            height: gust.height,
            backgroundColor: "rgba(226, 236, 228, 0.9)",
            opacity: gust.opacity,
            animationDuration: gust.duration,
            animationDelay: gust.delay,
          }}
        />
      ))}
    </div>
  );
}
