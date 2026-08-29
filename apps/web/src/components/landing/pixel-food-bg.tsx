"use client";

import type { CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";

type ProductIcon = "pos" | "mesa" | "cocina" | "inventario" | "reportes";

type ProductSprite = {
  readonly id: string;
  readonly kind: ProductIcon;
  readonly left: string;
  readonly top: string;
  readonly size: number;
  readonly delay: string;
  readonly opacity: number;
};

const PRODUCT_SPRITES = [
  { id: "pos", kind: "pos", left: "12%", top: "8%", size: 32, delay: "0s", opacity: 0.35 },
  { id: "mesa", kind: "mesa", left: "30%", top: "4%", size: 28, delay: "0.8s", opacity: 0.3 },
  { id: "cocina", kind: "cocina", left: "50%", top: "6%", size: 30, delay: "1.6s", opacity: 0.32 },
  { id: "inventario", kind: "inventario", left: "70%", top: "5%", size: 28, delay: "2.4s", opacity: 0.28 },
  { id: "reportes", kind: "reportes", left: "86%", top: "9%", size: 26, delay: "3.2s", opacity: 0.25 },
] as const;

type WindParticle = {
  readonly id: string;
  readonly top: string;
  readonly size: number;
  readonly delay: string;
  readonly duration: string;
  readonly opacity: number;
};

const WIND_PARTICLES: WindParticle[] = [
  { id: "w1", top: "18%", size: 2, delay: "0s", duration: "8s", opacity: 0.12 },
  { id: "w2", top: "32%", size: 1, delay: "1.2s", duration: "10s", opacity: 0.08 },
  { id: "w3", top: "45%", size: 2, delay: "2.8s", duration: "9s", opacity: 0.1 },
  { id: "w4", top: "58%", size: 1, delay: "0.6s", duration: "11s", opacity: 0.07 },
  { id: "w5", top: "72%", size: 2, delay: "3.5s", duration: "7s", opacity: 0.09 },
  { id: "w6", top: "85%", size: 1, delay: "1.8s", duration: "12s", opacity: 0.06 },
  { id: "w7", top: "25%", size: 1, delay: "4s", duration: "9s", opacity: 0.05 },
  { id: "w8", top: "65%", size: 2, delay: "5s", duration: "8s", opacity: 0.08 },
];

function ProductSvg({ kind, size }: { kind: ProductIcon; size: number }) {
  const style = { width: size, height: size, imageRendering: "pixelated" } as const;

  switch (kind) {
    case "pos":
      return (
        <svg viewBox="0 0 12 12" style={style} shapeRendering="crispEdges">
          <path d="M2 2h8v1H2z" fill="var(--frig-text)" />
          <path d="M2 3h8v5H2z" fill="var(--frig-accent)" opacity=".6" />
          <path d="M3 4h2v1H3zm3 0h2v1H6zm-3 2h6v1H3z" fill="var(--frig-text)" opacity=".4" />
          <path d="M1 8h10v1H1zm1 1h8v1H2z" fill="var(--frig-text)" />
        </svg>
      );
    case "mesa":
      return (
        <svg viewBox="0 0 12 12" style={style} shapeRendering="crispEdges">
          <path d="M3 1h6v1H3z" fill="var(--frig-accent)" />
          <path d="M2 2h8v5H2z" fill="var(--frig-accent)" opacity=".5" />
          <path d="M3 3h2v3H3zm4 0h2v3H7z" fill="var(--frig-text)" opacity=".3" />
          <path d="M1 7h10v1H1z" fill="var(--frig-text)" />
          <path d="M3 8h1v3H3zm5 0h1v3H8z" fill="var(--frig-text)" opacity=".6" />
        </svg>
      );
    case "cocina":
      return (
        <svg viewBox="0 0 12 12" style={style} shapeRendering="crispEdges">
          <path d="M4 0h1v2H4zm3 0h1v2H7z" fill="var(--frig-text-muted)" />
          <path d="M2 3h8v1H2z" fill="var(--frig-accent)" />
          <path d="M2 4h8v5H2z" fill="var(--frig-tomato)" opacity=".5" />
          <path d="M3 5h2v3H3zm4 0h2v3H7z" fill="var(--frig-text)" opacity=".3" />
          <path d="M1 9h10v2H1z" fill="var(--frig-text)" />
        </svg>
      );
    case "inventario":
      return (
        <svg viewBox="0 0 12 12" style={style} shapeRendering="crispEdges">
          <path d="M2 1h8v1H2z" fill="var(--frig-text)" />
          <path d="M1 2h10v8H1z" fill="var(--frig-accent)" opacity=".4" />
          <path d="M2 3h3v3H2zm5 0h3v3H7zM2 7h3v2H2zm5 0h3v2H7z" fill="var(--frig-text)" opacity=".3" />
          <path d="M1 10h10v1H1z" fill="var(--frig-text)" />
        </svg>
      );
    case "reportes":
      return (
        <svg viewBox="0 0 12 12" style={style} shapeRendering="crispEdges">
          <path d="M2 1h8v10H2z" fill="var(--frig-text)" opacity=".3" />
          <path d="M3 2h2v8H3zm3-1h2v9H6zm3 3h2v5H9z" fill="var(--frig-accent)" />
          <path d="M2 1h8v1H2z" fill="var(--frig-text)" />
        </svg>
      );
  }
}

function WindParticle({ particle }: { particle: WindParticle }) {
  return (
    <span
      className="absolute landing-pixel-wind"
      style={{
        top: particle.top,
        left: "-4px",
        width: particle.size * 4,
        height: particle.size,
        backgroundColor: "var(--frig-accent)",
        opacity: particle.opacity,
        animationDelay: particle.delay,
        animationDuration: particle.duration,
      }}
    />
  );
}

export function PixelFoodBg() {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {reduceMotion ? null : (
        <>
          {WIND_PARTICLES.map((p) => (
            <WindParticle key={p.id} particle={p} />
          ))}
        </>
      )}

      <div className="absolute inset-x-0 top-0 flex justify-center pt-3">
        <div className="flex w-full max-w-2xl items-start justify-between px-6">
          {PRODUCT_SPRITES.map((sprite) => (
            <span
              key={sprite.id}
              className={reduceMotion ? "" : "landing-pixel-drift"}
              style={
                reduceMotion
                  ? { opacity: sprite.opacity }
                  : {
                      opacity: sprite.opacity,
                      animationDelay: `${sprite.delay}, ${sprite.delay}`,
                      animationDuration: "6s, 10s",
                    }
              }
            >
              <ProductSvg kind={sprite.kind} size={sprite.size} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
