/**
 * Negocios con sello de patrocinio (login_slug → patrocinador).
 *
 * Todas las sucursales de Michillan (org 27) llevan el sello Sercotec.
 * Se declaran aquí para poder sumar o cambiar slugs sin tocar la UI.
 */

import { getRememberedLoginSlug, normalizeLoginSlug } from "@/lib/login-slug";

export type SponsorId = "sercotec";

export const SPONSORED_SLUGS: Readonly<Record<string, SponsorId>> = {
  "revista-cobquecura": "sercotec",
  "arena-negra": "sercotec",
  "minimarket-buchupureo": "sercotec",
  "dimatteo": "sercotec",
  "hielo-olas-altas": "sercotec",
  "vignosi": "sercotec",
};

export const SPONSOR_COPY: Readonly<
  Record<SponsorId, { label: string; logoSrc: string }>
> = {
  sercotec: {
    label: "Apoyado por Sercotec",
    logoSrc: "/sponsors/sercotec.png",
  },
};

export function normalizeSponsorSlug(slug: string | null | undefined): string | null {
  const clean = normalizeLoginSlug(slug);
  return clean ? clean.toLowerCase() : null;
}

export function getSponsorForSlug(slug: string | null | undefined): SponsorId | null {
  const key = normalizeSponsorSlug(slug);
  if (!key) return null;
  return SPONSORED_SLUGS[key] ?? null;
}

/** Slug de login del negocio activo: sucursal, luego el slug recordado. */
export function resolveActiveLoginSlug(
  branch?: { login_slug?: string | null } | null,
): string | null {
  return normalizeSponsorSlug(branch?.login_slug) ?? normalizeSponsorSlug(getRememberedLoginSlug());
}

export function sponsorTicketLine(slug: string | null | undefined): string | null {
  const sponsor = getSponsorForSlug(slug);
  return sponsor ? SPONSOR_COPY[sponsor].label : null;
}
