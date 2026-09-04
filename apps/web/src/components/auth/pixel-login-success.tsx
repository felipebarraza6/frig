"use client";

/**
 * Overlay de éxito del login: estrella pixel con pop, halo y monedas saltando.
 * Se muestra ~1.15s antes de navegar (el padre controla el tiempo).
 */

import type { CSSProperties } from "react";

const COINS: { tx: string; ty: string; delay: string; size: number }[] = [
  { tx: "-52px", ty: "-48px", delay: "0.12s", size: 14 },
  { tx: "48px", ty: "-58px", delay: "0.2s", size: 12 },
  { tx: "-20px", ty: "-70px", delay: "0.28s", size: 16 },
  { tx: "20px", ty: "-40px", delay: "0.34s", size: 10 },
  { tx: "60px", ty: "-24px", delay: "0.42s", size: 12 },
  { tx: "-62px", ty: "-20px", delay: "0.48s", size: 10 },
];

function PixelStar({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      style={{ imageRendering: "pixelated" }}
      shapeRendering="crispEdges"
    >
      <path d="M7 0h2v4H7zM0 7h4v2H0zM12 7h4v2h-4zM7 12h2v4H7z" fill="#f1d195" />
      <path d="M6 6h4v4H6z" fill="#e9a84a" />
      <path d="M7 7h2v2H7z" fill="#fff7e0" />
      <path d="M4 4h2v2H4zM10 4h2v2h-2zM4 10h2v2H4zM10 10h2v2h-2z" fill="#d8a45c" opacity=".6" />
    </svg>
  );
}

function PixelCoin({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 8 8"
      width={size}
      height={size}
      style={{ imageRendering: "pixelated" }}
      shapeRendering="crispEdges"
    >
      <path d="M2 0h4v1H2zM1 1h6v1H1zM0 2h8v4H0zM1 7h6v1H1zM2 8h4v-1H2z" fill="#d8a45c" />
      <path d="M2 2h4v1H2zM2 3h1v3H2z" fill="#f1d195" />
    </svg>
  );
}

export function PixelLoginSuccess({ brandName }: { brandName?: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
      style={{ backgroundColor: "color-mix(in srgb, #0b3b22 82%, transparent)" }}
    >
      {/* Halo que se expande detrás de la estrella. */}
      <div
        className="absolute h-24 w-24"
        style={{
          backgroundImage:
            "repeating-conic-gradient(color-mix(in srgb, var(--color-primary) 55%, transparent) 0% 25%, transparent 0% 50%)",
          backgroundSize: "10px 10px",
          animation: "login-success-halo 0.8s ease-out 0.15s forwards",
          opacity: 0,
        }}
      />

      {/* Estrella central con pop. */}
      <div style={{ animation: "login-success-pop 0.5s steps(5) forwards", transform: "scale(0)" }}>
        <PixelStar size={72} />
      </div>

      {/* Monedas saltando alrededor. */}
      {COINS.map((coin, i) => (
        <span
          key={i}
          className="absolute"
          style={
            {
              "--tx": coin.tx,
              "--ty": coin.ty,
              animation: "login-coin-pop 0.9s ease-out forwards",
              animationDelay: coin.delay,
              opacity: 0,
            } as CSSProperties
          }
        >
          <PixelCoin size={coin.size} />
        </span>
      ))}

      <p className="font-pixel absolute mt-32 text-center text-lg tracking-[0.2em] text-white">
        ¡BIENVENIDO!
        {brandName ? <span className="mt-1 block text-xs opacity-80">{brandName}</span> : null}
      </p>
    </div>
  );
}
