"use client";

/**
 * Panel izquierdo del login: identidad FRIG (negro + cobre + red de energía).
 * Si la sucursal tiene marca propia, se muestra la de ella.
 */

import { LANDING_FEATURES, LANDING_VALUE_PROP } from "@/content/landing";
import { BrandLogo } from "@/components/brand-logo";
import { HeroPlexus } from "@/components/landing/hero-plexus";
import { useReducedMotion } from "framer-motion";

type LandingBrand = { name: string; logo?: string | null } | null;

export function LandingPanel({ brand }: { brand?: LandingBrand }) {
  const reduce = useReducedMotion();

  return (
    <div className="relative hidden h-full flex-col justify-center overflow-hidden bg-[#0a0a0a] px-10 font-sans text-white lg:flex lg:px-14">
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

      <div className="relative z-10 flex flex-col gap-8">
        {brand ? (
          <div className="flex items-center gap-3">
            <BrandLogo
              src={brand.logo ?? null}
              alt={brand.name}
              name={brand.name}
              className="h-10 w-10"
            />
            <div className="flex flex-col">
              <span className="text-lg font-semibold text-white">{brand.name}</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                powered by Frig
              </span>
            </div>
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

        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            {LANDING_VALUE_PROP.headline}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
            {LANDING_VALUE_PROP.subhead}
          </p>
        </div>

        <ul className="grid max-w-md grid-cols-1 gap-x-8 gap-y-2.5 text-sm text-zinc-300 sm:grid-cols-2">
          {LANDING_FEATURES.slice(0, 8).map((f) => (
            <li key={f.title} className="flex items-center gap-2.5">
              <span
                className="h-1 w-1 shrink-0 rotate-45"
                style={{ backgroundColor: "#c67d52" }}
                aria-hidden
              />
              {f.title}
            </li>
          ))}
        </ul>

        <p className="text-xs text-zinc-500">
          12 módulos incluidos · Boleta electrónica SII · Soporte en Chile
        </p>
      </div>
    </div>
  );
}
