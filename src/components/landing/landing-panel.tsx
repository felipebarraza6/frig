"use client";

/**
 * Panel izquierdo del login: el wordmark FRIG grande, con el fuego del hero
 * (masas de brasa latiendo detrás). Fondo de energía a nivel raíz.
 * Si la sucursal tiene marca propia, se muestra la de ella.
 */

import { BrandLogo } from "@/components/brand-logo";

type LandingBrand = { name: string; logo?: string | null } | null;

export function LandingPanel({ brand }: { brand?: LandingBrand }) {
  return (
    <div className="relative flex h-full items-center overflow-hidden">
      {brand ? (
        <div className="pl-16 lg:pl-24">
          <div className="flex items-center gap-3">
            <BrandLogo
              src={brand.logo ?? null}
              alt={brand.name}
              name={brand.name}
              className="h-10 w-10"
            />
            <span className="text-lg font-semibold text-white">{brand.name}</span>
          </div>
        </div>
      ) : (
        /* Sin marca propia: el wordmark animado ya preside el formulario
           (centrado), el panel queda solo con su energía de fondo. */
        null
      )}
    </div>
  );
}
