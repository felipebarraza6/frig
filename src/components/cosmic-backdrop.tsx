"use client";

import { useEffect, useRef } from "react";
import { HeroPlexus } from "@/components/landing/hero-plexus";

const EMBERS = [
  { left: "4%", size: 4, dur: "11s", delay: "0s", drift: "22px" },
  { left: "12%", size: 3, dur: "9s", delay: "1.4s", drift: "-16px" },
  { left: "22%", size: 5, dur: "12s", delay: "2.8s", drift: "28px" },
  { left: "34%", size: 4, dur: "8.5s", delay: "0.9s", drift: "-20px" },
  { left: "48%", size: 3, dur: "10s", delay: "3.6s", drift: "18px" },
  { left: "58%", size: 6, dur: "9.5s", delay: "1.8s", drift: "-24px" },
  { left: "70%", size: 4, dur: "11.5s", delay: "4.2s", drift: "20px" },
  { left: "82%", size: 5, dur: "8.8s", delay: "2.2s", drift: "-14px" },
  { left: "92%", size: 3, dur: "10.2s", delay: "5s", drift: "26px" },
];

/**
 * Universo de la landing (plexus + brasas) para montar experiencias
 * inmersivas como el mapa de mesas 3D.
 */
export function CosmicBackdrop({
  className,
  intensity = 0.7,
}: {
  className?: string;
  /** 0–1 opacidad del plexus */
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: number | undefined;
    function onMove() {
      ref.current?.classList.add("is-revealing");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => ref.current?.classList.remove("is-revealing"), 1400);
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={`cosmic-backdrop pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
    >
      <div
        className="absolute inset-0"
        style={{
          opacity: intensity,
          maskImage:
            "radial-gradient(90% 80% at 50% 45%, black 25%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(90% 80% at 50% 45%, black 25%, transparent 100%)",
        }}
      >
        <HeroPlexus className="h-full w-full" />
      </div>
      <div className="absolute inset-0 fade-on-idle opacity-80">
        {EMBERS.map((e, i) => (
          <span
            key={i}
            className={i % 5 === 2 ? "frig-ember frig-ember-hot" : "frig-ember"}
            style={
              {
                left: e.left,
                width: e.size,
                height: e.size,
                "--dur": e.dur,
                "--delay": e.delay,
                "--drift": e.drift,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      {/* Vignette suave para anclar el salón */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 55%, transparent 30%, color-mix(in srgb, var(--background) 55%, transparent) 100%)",
        }}
      />
    </div>
  );
}
