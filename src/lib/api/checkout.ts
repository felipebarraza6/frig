import { apiFetch } from "./client";
import type { LoginCompleteResponse } from "@/lib/types";

export interface CheckoutRequest {
  plan_id: string;
  business_name: string;
  contact_name: string;
  email: string;
  website?: string;
}

export interface CheckoutResponse {
  checkout_id: string;
  payment_url: string;
  status: string;
}

export interface CheckoutStatus {
  status: string;
  payment_url?: string;
}

export function checkoutPath(group = "frig"): string {
  return `/public/${group}-checkout/`;
}

export function fetchCheckout(p: CheckoutRequest, group = "frig", signal?: AbortSignal) {
  return apiFetch<CheckoutResponse>(checkoutPath(group), {
    method: "POST",
    body: p,
    auth: "none",
    branch: "none",
    signal,
  });
}

export function fetchCheckoutStatus(id: string, group = "frig") {
  return apiFetch<CheckoutStatus>(`${checkoutPath(group)}${id}/`, {
    auth: "none",
    branch: "none",
  });
}

// ── Catálogo público de planes (landing) ─────────────────────────────────────

/** Plan de un grupo expuesto públicamente (precio en UF, null = a convenir). */
export interface GroupPlanPublic {
  plan_id: string;
  display_name: string;
  /** Bajada corta del plan (fallback al copy local). */
  description: string;
  /** Bullets del plan (fallback a los recursos del copy local). */
  features: string[];
  /** Límites del plan (ej: usuarios, sucursales, POS). */
  limits: Record<string, unknown>;
  price_uf: number | null;
  sort_order: number;
  /** Plan destacado en la landing (sello configurable vía `badge`). */
  highlighted: boolean;
  badge: string | null;
}

/** Grupo de planes con su catálogo activo: GET /public/<grupo>-plans/. */
export interface PlanGroupPublic {
  /** Slug del grupo (ej: "frig"). */
  name: string;
  display_name: string;
  description: string;
  /** UF cobrada una vez, sumada al precio del plan. */
  integration_uf: number;
  plans: GroupPlanPublic[];
}

export function fetchPlans(group = "frig") {
  return apiFetch<PlanGroupPublic>(`/public/${group}-plans/`, {
    auth: "none",
    branch: "none",
  });
}

// ── Config pública de landing (white-label, una sola llamada) ────────────────

export interface LandingHero {
  headline: string;
  subhead: string;
  cta_label: string;
}

export interface LandingFeatureItem {
  /** Clave de icono; el front la mapea a su librería (fallback si es desconocida). */
  icon: string;
  title: string;
  description: string;
}

export interface LandingGroupConfig {
  slug: string;
  display_name: string;
  description: string;
  integration_uf: number;
  frontend_url: string;
  contact_email: string;
  pricing_note: string;
  /** null si el grupo no tiene copy de hero (el front usa su fallback). */
  hero: LandingHero | null;
  features: LandingFeatureItem[];
}

/** Marca resuelta por dominio; null = la web usa su marca propia. */
export interface LandingBrand {
  app_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  color_mode: string;
  tagline: string;
}

export interface LandingConfig {
  group: LandingGroupConfig;
  brand: LandingBrand | null;
  plans: GroupPlanPublic[];
}

/**
 * GET /public/landing-config/ — config completa de la landing (grupo + copy
 * + planes en una llamada). Resolución en el back: ?group > ?slug > Host.
 * Sin resolución → 404 (el front usa su fallback local).
 */
export function fetchLandingConfig(group?: string, slug?: string) {
  const qs = new URLSearchParams();
  if (group) qs.set("group", group);
  if (slug) qs.set("slug", slug);
  const query = qs.toString();
  return apiFetch<LandingConfig>(`/public/landing-config/${query ? `?${query}` : ""}`, {
    auth: "none",
    branch: "none",
  });
}

// ── Canje del magic-link de acceso post-pago ─────────────────────────────────

/**
 * POST /public/checkout/magic-login/ — canjea el token firmado del correo.
 * Devuelve el mismo payload que login_complete (token + user + branches).
 */
export function fetchMagicLogin(token: string) {
  return apiFetch<LoginCompleteResponse>("/public/checkout/magic-login/", {
    method: "POST",
    body: { token },
    auth: "none",
    branch: "none",
  });
}
