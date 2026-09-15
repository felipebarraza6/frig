"use client";

/**
 * Panel izquierdo del login: solo el wordmark FRIG centrado.
 * El fondo de energía vive en la raíz de la página (sin divisiones).
 */

import { BrandLogo } from "@/components/brand-logo";

type LandingBrand = { name: string; logo?: string | null } | null;

export function LandingPanel({ brand }: { brand?: LandingBrand }) {
  return (
    <div className="relative flex h-full items-center">
      <div className="pl-16 lg:pl-24">
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
          <img
            src="/brand/frig-wordmark.png"
            alt="Frig"
            className="frig-flame h-10 w-auto"
          />
        )}
      </div>
    </div>
  );
}
