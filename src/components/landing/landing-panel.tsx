"use client";

/**
 * Panel izquierdo del login: identidad FRIG al mínimo — el logo solo,
 * sobre la energía (horizonte cálido + red de nodos).
 * Si la sucursal tiene marca propia, se muestra la de ella.
 */

import { BrandLogo } from "@/components/brand-logo";
import { HeroPlexus } from "@/components/landing/hero-plexus";
import { useReducedMotion } from "framer-motion";

type LandingBrand = { name: string; logo?: string | null } | null;

export function LandingPanel({ brand }: { brand?: LandingBrand }) {
  const reduce = useReducedMotion();

  return (
    <div className="relative hidden h-full overflow-hidden bg-[#0a0a0a] font-sans text-white lg:block">
      {/* Horizonte cálido + red de energía, como el hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%]"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 115%, rgba(240,162,106,0.2) 0%, rgba(157,182,143,0.06) 42%, transparent 70%)",
        }}
      />
      {!reduce && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            maskImage:
              "radial-gradient(90% 85% at 45% 50%, black 30%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(90% 85% at 45% 50%, black 30%, transparent 100%)",
          }}
        >
          <HeroPlexus className="h-full w-full" />
        </div>
      )}

      {/* El logo, solo, centrado verticalmente a la izquierda */}
      <div className="relative z-10 flex h-full items-center">
        <div className="pl-10 lg:pl-16">
          {brand ? (
            <div className="flex items-center gap-3">
              <BrandLogo
                src={brand.logo ?? null}
                alt={brand.name}
                name={brand.name}
                className="h-10 w-10"
              />
              <span className="text-lg font-semibold text-white">{brand.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <img
                src="/brand/frig-symbol.png"
                alt=""
                className="h-12 w-auto"
                style={{ filter: "drop-shadow(0 0 12px rgba(238,158,112,0.4))" }}
              />
              <img src="/brand/frig-wordmark.png" alt="Frig" className="h-6 w-auto" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
