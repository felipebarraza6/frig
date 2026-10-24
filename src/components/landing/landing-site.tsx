"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  Bike,
  Boxes,
  ChartColumn,
  Check,
  ChefHat,
  CreditCard,
  FileText,
  Kanban,
  LayoutDashboard,
  LayoutGrid,
  Leaf,
  LogIn,
  Menu,
  Monitor,
  QrCode,
  Rotate3d,
  ShieldCheck,
  Store,
  Truck,
  Warehouse,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

/* Marca oficial de GitHub (lucide ya no incluye íconos de marcas). */
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/lib/app-context";
import { useSessionStore, normalizeDashboardRoute } from "@/lib/store/session";
import { getToken } from "@/lib/api/session-storage";
import type { User } from "@/lib/types";
import {
  LANDING_FEATURES,
  LANDING_PLANS,
  LANDING_INTEGRATION_UF,
  LANDING_PRICING_NOTE,
  LANDING_PROOF,
  LANDING_STAGING,
  LANDING_STAGING_URL,
  LANDING_USE_CASES,
  LANDING_VALUE_PROP,
  DEMO_CONTACTS,
  type LandingPlan,
} from "@/content/landing";
import {
  fetchLandingConfig,
  type LandingConfig,
  type LandingHero,
  type LandingCta,
  type LandingNavItem,
  type LandingUseCaseItem,
  type LandingFeatureItem,
  type LandingFooterSocial,
} from "@/lib/api/checkout";
import { applyThemeConfig } from "@/lib/api/branches";
import { mediaUrl } from "@/lib/api/client";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { HeroPlexus } from "@/components/landing/hero-plexus";
import { FrigWordmarkMatrix } from "@/components/landing/frig-wordmark-matrix";
import { CheckoutModal } from "@/components/landing/checkout-modal";
import { ProductInteractivePreview } from "@/components/landing/product-interactive-preview";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Landing simple de FRIG: mensaje claro, módulos reales de la app,
 * el simulador del producto, demos operativas y precios. Nada más.
 */
/**
 * Solo acepta planes que vienen del API. El copy local (LANDING_PLANS) rellena
 * bajada/features cuando el plan_id coincide; nunca inventa un catálogo propio
 * (ids demo/pro rompían el checkout con 400).
 */
function resolvePlans(config: LandingConfig | undefined): {
  plans: LandingPlan[];
  integrationUf: number;
  unavailable: boolean;
} {
  const groupPlans = config?.plans;
  if (!groupPlans?.length) {
    return {
      plans: [],
      integrationUf: LANDING_INTEGRATION_UF,
      unavailable: true,
    };
  }
  const copyById = new Map(LANDING_PLANS.map((p) => [p.id, p]));
  const plans = groupPlans.map((gp) => {
    const copy = copyById.get(gp.plan_id);
    const features = Array.isArray(gp.features)
      ? gp.features.filter((f): f is string => typeof f === "string")
      : [];
    return {
      id: gp.plan_id,
      name: gp.display_name,
      tagline: gp.description || copy?.tagline || "",
      priceUf: gp.price_uf,
      resources: features.length ? features : (copy?.resources ?? []),
      highlighted: gp.highlighted || copy?.highlighted,
      badge: gp.badge ?? null,
    } satisfies LandingPlan;
  });
  return {
    plans,
    integrationUf: config?.group.integration_uf ?? LANDING_INTEGRATION_UF,
    unavailable: false,
  };
}

/* Paleta del logo: cobre sobre negro neutro. Un solo acento. */
const COPPER = "#c67d52";
const _COPPER_HOVER = "#d68c5f";

const NAV_LINKS = [
  { href: "#simulador", label: "Producto" },
  { href: "#producto", label: "Módulos" },
  { href: "#precios", label: "Planes" },
  { href: "#demos", label: "Demos" },
];

/** Quita anclas de secciones retiradas (p. ej. Novedades del CMS). */
function sanitizeNavLinks(links: LandingNavItem[] | null | undefined): LandingNavItem[] {
  const cleaned = (links ?? [])
    .filter((l) => {
      const href = (l.href || "").trim().toLowerCase();
      const label = (l.label || "").trim().toLowerCase();
      if (href === "#novedades" || href.includes("novedad")) return false;
      if (label === "novedades" || label.startsWith("novedad")) return false;
      return Boolean(l.href && l.label);
    })
    .map((l) => ({ href: l.href, label: l.label }));
  return cleaned.length > 0 ? cleaned : NAV_LINKS;
}

const GITHUB_URL = "https://github.com/FelipeBarraza6/frig";

type LandingBrand = {
  isFrig: boolean;
  name: string;
  logo: string | null;
  accent: string;
};

function resolveLandingBrand(theme: { app_name?: string; logo?: string | null; primary_color?: string } | null): LandingBrand {
  const app = theme?.app_name?.trim() ?? "";
  const isFrig = !app || app.toLowerCase().includes("frig");
  if (isFrig) {
    return { isFrig: true, name: "FRIG", logo: "/brand/frig-symbol.png", accent: COPPER };
  }
  return {
    isFrig: false,
    name: app,
    logo: mediaUrl(theme?.logo) ?? null,
    accent: theme?.primary_color?.trim() || COPPER,
  };
}

function BrandMark({
  brand,
  className,
  glow = true,
}: {
  brand: LandingBrand;
  className?: string;
  glow?: boolean;
}) {
  if (brand.logo) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={brand.logo}
          alt={brand.name}
          className={className}
          style={
            glow
              ? { filter: `drop-shadow(0 0 14px ${brand.accent}73)` }
              : undefined
          }
        />
      </>
    );
  }
  return (
    <span className={cn("font-display font-semibold tracking-tight text-white", className)}>
      {brand.name}
    </span>
  );
}

/* Separador de sección: energía que fluye de un extremo al otro. */
function SectionDivider() {
  return (
    <div className="relative mx-auto max-w-6xl px-4 sm:px-6" aria-hidden>
      <div className="flow-line" />
    </div>
  );
}

function sessionDisplayName(user: User): string {
  const full = (
    user.full_name ??
    `${user.first_name ?? ""} ${user.last_name ?? ""}`
  ).trim();
  return full || user.username || user.email.split("@")[0] || "tu cuenta";
}

function Nav({
  savedUser,
  links = NAV_LINKS,
  brand,
}: {
  savedUser: User | null;
  links?: LandingNavItem[];
  brand: LandingBrand;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [active, setActive] = useState<string>("");

  // Scrollspy: resalta la sección visible en el menú.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(`#${e.target.id}`);
        }
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    for (const link of links) {
      const el = document.getElementById(link.href.slice(1));
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [links]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0a0a0a]/85 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6 sm:px-8">
        <Link href="/" className="flex items-center gap-2 group">
          <BrandMark
            brand={brand}
            className="h-12 w-auto max-h-12 object-contain transition-transform group-hover:scale-105"
          />
        </Link>

        {/* Logo a la izquierda; todo lo demás agrupado a la derecha. */}
        <div className="flex items-center gap-7 lg:gap-9">
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            {links.map((link) => {
              const isActive = active === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative py-1 transition-colors",
                    isActive
                      ? "text-white"
                      : "text-zinc-400 hover:text-white",
                  )}
                >
                  {link.label}
                  {isActive && (
                    <span
                      className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rotate-45"
                      style={{ backgroundColor: brand.accent }}
                      aria-hidden
                    />
                  )}
                </a>
              );
            })}
          </nav>

          <div className="hidden sm:block h-5 w-px bg-white/10" aria-hidden />

          <div className="flex items-center gap-2 sm:gap-3">
            {brand.isFrig && (
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub de Frig"
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-white/25 hover:text-white"
            >
              <GithubIcon className="h-5 w-5" />
            </a>
            )}
            {savedUser ? (
              <Link
                href="/dashboard"
                className="btn-copper inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
              >
                <LayoutDashboard className="h-4 w-4" />
                Ir al panel
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/5"
                >
                  <LogIn className="h-4 w-4 text-zinc-400" />
                  Login
                </Link>
                <a
                  href="#precios"
                  className="btn-copper hidden items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white sm:inline-flex"
                >
                  Suscribirse
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </>
            )}
          </div>
        </div>

        <div className="flex sm:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-zinc-300 hover:bg-white/10"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="sm:hidden border-b border-white/10 bg-[#0a0a0a] px-4 py-4"
          >
            <div className="flex flex-col text-sm font-medium text-zinc-300">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 px-2 rounded-lg hover:bg-white/5 hover:text-white"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-2.5">
                {!savedUser && (
                  <Link
                    href="/login"
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-2 text-center rounded-lg border border-white/15 text-white"
                  >
                    Login
                  </Link>
                )}
                <a
                  href="#precios"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-copper inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Suscripción
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* Brasas y corrientes de viento del hero: el paisaje del logo. */
const EMBERS = [
  { left: "2%", size: 4, dur: "11s", delay: "0s", drift: "24px" },
  { left: "6%", size: 3, dur: "9s", delay: "1.4s", drift: "-18px" },
  { left: "10%", size: 5, dur: "12s", delay: "3s", drift: "30px" },
  { left: "14%", size: 4, dur: "8.5s", delay: "2.1s", drift: "-22px" },
  { left: "18%", size: 3, dur: "10s", delay: "4.6s", drift: "16px" },
  { left: "22%", size: 6, dur: "9.5s", delay: "0.8s", drift: "-26px" },
  { left: "27%", size: 4, dur: "11.5s", delay: "3.7s", drift: "20px" },
  { left: "31%", size: 5, dur: "8.8s", delay: "1.9s", drift: "-14px" },
  { left: "36%", size: 3, dur: "10.2s", delay: "5.2s", drift: "28px" },
  { left: "41%", size: 6, dur: "9.2s", delay: "2.6s", drift: "-20px" },
  { left: "46%", size: 4, dur: "12.5s", delay: "0.4s", drift: "18px" },
  { left: "51%", size: 3, dur: "9.8s", delay: "4.1s", drift: "-24px" },
  { left: "56%", size: 5, dur: "10.8s", delay: "1.1s", drift: "22px" },
  { left: "61%", size: 4, dur: "8.9s", delay: "3.3s", drift: "-16px" },
  { left: "66%", size: 6, dur: "11.8s", delay: "5.6s", drift: "26px" },
  { left: "71%", size: 3, dur: "9.4s", delay: "2.9s", drift: "-28px" },
  { left: "76%", size: 4, dur: "10.4s", delay: "0.2s", drift: "19px" },
  { left: "81%", size: 5, dur: "9.1s", delay: "4.8s", drift: "-21px" },
  { left: "86%", size: 4, dur: "12.2s", delay: "2.4s", drift: "27px" },
  { left: "90%", size: 3, dur: "9.6s", delay: "1.6s", drift: "-17px" },
  { left: "94%", size: 5, dur: "10.9s", delay: "3.9s", drift: "23px" },
  { left: "98%", size: 4, dur: "8.6s", delay: "5.0s", drift: "-25px" },
];


function Hero({
  hero,
  ctas,
  savedUser,
  entering,
  onReenter,
  brand,
}: {
  hero: LandingHero | null;
  ctas?: { primary?: LandingCta; secondary?: LandingCta };
  savedUser: User | null;
  entering: boolean;
  onReenter: () => void;
  brand: LandingBrand;
}) {
  // Contenido dinámico: el endpoint manda; el copy local es solo fallback.
  const headline = hero?.headline || LANDING_VALUE_PROP.headline;
  const narrative = hero?.subhead || LANDING_VALUE_PROP.subhead;
  const points =
    hero?.points && hero.points.length > 0 ? hero.points : LANDING_VALUE_PROP.points;

  // Sin fundido ligado al scroll: la capa compositada de opacity+transform
  // producía una costura de 1px en el borde del hero con escala de Windows
  // no entera. El contenido del hero queda estático (el fondo ya se mueve).

  return (
    <section id="inicio" className="relative z-10">
      {/* Sin atmósfera local: la capa cósmica global (nebulosas, plexus,
          brasas, glow del cursor) da toda la energía sin costuras. */}

      <div className="relative mx-auto flex min-h-[calc(100dvh-5rem)] max-w-6xl flex-col justify-center px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
          <div className="flex flex-col items-start text-left">
            {savedUser && (
              <div className="mb-6 flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-4">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: brand.accent }}
                >
                  {sessionDisplayName(savedUser).charAt(0).toUpperCase()}
                </span>
                <span className="text-sm text-zinc-300">
                  {sessionDisplayName(savedUser)}
                </span>
                <button
                  type="button"
                  disabled={entering}
                  onClick={onReenter}
                  className={cn(
                    "text-sm font-medium disabled:opacity-60",
                    !entering && "hover:text-white",
                  )}
                  style={{ color: brand.accent }}
                >
                  {entering ? "Cargando tu panel…" : "Reingresar →"}
                </button>
              </div>
            )}

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em]"
              style={{ color: brand.accent }}
            >
              <span
                className="inline-block h-2 w-2 rotate-45"
                style={{ backgroundColor: brand.accent }}
                aria-hidden
              />
              {hero?.badge || "POS + cocina + caja, en el navegador"}
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
              className="font-display mt-5 max-w-xl text-[2.6rem] font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-[4.25rem]"
            >
              {headline}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.16, ease: "easeOut" }}
              className="mt-5 max-w-lg text-base leading-relaxed text-zinc-300 sm:text-lg"
            >
              {narrative}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.24, ease: "easeOut" }}
              className="mt-7 flex flex-wrap items-center gap-3"
            >
              <a
                href={ctas?.primary?.href ?? "#precios"}
                className="btn-copper inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-white"
              >
                {ctas?.primary?.label ?? "Ver planes"}
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href={ctas?.secondary?.href ?? "#simulador"}
                className="rounded-lg border border-white/15 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-white/5"
              >
                {ctas?.secondary?.label ?? "Probar el producto"}
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.28, ease: "easeOut" }}
              className="mt-6"
            >
              {LANDING_STAGING_URL ? (
                <a
                  href={LANDING_STAGING_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: brand.accent }}
                    aria-hidden
                  />
                  Versión de staging para revisar
                  <ArrowRight className="h-3 w-3" />
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: brand.accent }}
                    aria-hidden
                  />
                  Versión de staging para revisar
                </span>
              )}
            </motion.div>

            <motion.ul
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.36, ease: "easeOut" }}
              className="mt-6 grid max-w-lg grid-cols-1 gap-x-6 gap-y-2.5 text-sm text-zinc-300 sm:grid-cols-2"
            >
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: brand.accent }} />
                  <span>{point}</span>
                </li>
              ))}
            </motion.ul>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: "easeOut" }}
            className="relative mx-auto w-full max-w-md lg:max-w-none"
          >
            <div
              aria-hidden
              className="absolute -inset-8 rounded-full opacity-70 blur-3xl"
              style={{
                background: `radial-gradient(circle, ${brand.accent}33 0%, transparent 68%)`,
              }}
            />
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#101010]/80 p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  <span className="relative flex h-2 w-2">
                    <span
                      className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                      style={{ backgroundColor: brand.accent }}
                    />
                    <span
                      className="relative inline-flex h-2 w-2 rounded-full"
                      style={{ backgroundColor: brand.accent }}
                    />
                  </span>
                  Turno en vivo
                </span>
                <span className="text-[11px] font-medium text-zinc-500">Hoy · 19:42</span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  ["$186.400", "caja"],
                  ["12", "mesas"],
                  ["4", "en cocina"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-3">
                    <p className="font-display text-lg font-semibold tabular-nums text-white sm:text-xl">{value}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wider text-zinc-500">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-2">
                {[
                  { table: "Mesa 4", item: "Lomo a lo pobre ×2", state: "En plancha", tone: brand.accent },
                  { table: "Barra", item: "Negroni + tabla", state: "Lista", tone: "#9db68f" },
                  { table: "Retiro", item: "Combo familiar", state: "Por cobrar", tone: "#e8c07a" },
                ].map((row) => (
                  <div
                    key={row.table}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/30 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{row.table}</p>
                      <p className="truncate text-xs text-zinc-500">{row.item}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: row.tone, borderColor: `${row.tone}55` }}
                    >
                      {row.state}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-4">
                {brand.isFrig ? (
                  <FrigWordmarkMatrix className="h-7 w-auto opacity-90" />
                ) : (
                  <BrandMark brand={brand} className="h-7 w-auto max-h-7 object-contain" glow={false} />
                )}
                <span className="text-xs text-zinc-500">Sin instaladores</span>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.dl
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
          className="mt-12 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:mt-16"
        >
          {LANDING_PROOF.map((item) => (
            <div key={item.label} className="bg-[#0c0c0c]/90 px-3 py-4 text-center sm:px-6 sm:py-5">
              <dt className="font-display text-2xl font-semibold text-white sm:text-3xl">{item.value}</dt>
              <dd className="mt-1 text-[11px] leading-snug text-zinc-500 sm:text-sm">{item.label}</dd>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
}

function PricingSection({
  plans,
  unavailable,
  contactEmail,
  onPickPlan,
}: {
  plans: LandingPlan[];
  integrationUf: number;
  pricingNote?: string;
  unavailable?: boolean;
  contactEmail?: string;
  onPickPlan: (p: LandingPlan) => void;
}) {
  return (
    <section id="precios" className="relative z-10 pt-10 pb-28 sm:pt-14 sm:pb-44">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {unavailable || plans.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#101010] px-6 py-10 text-center">
            <p className="text-base font-semibold text-white">No pudimos cargar los planes</p>
            <p className="mt-2 text-sm text-zinc-400">
              En unos minutos vuelve a intentar, o escríbenos y te armamos la contratación a mano.
            </p>
            {contactEmail && (
              <a
                href={`mailto:${contactEmail}?subject=${encodeURIComponent("Contratación")}`}
                className="mt-5 inline-flex rounded-lg border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/5"
              >
                Escribir a {contactEmail}
              </a>
            )}
          </div>
        ) : null}
        {/* Flex centrado: con 1, 2 o 3 planes (dinámicos a futuro) todo
            se acomoda perfecto al medio. */}
        <div className="flex flex-col items-stretch justify-center gap-4 md:flex-row md:flex-wrap md:items-center">
          {plans.map((p, i) => (
            <ScrollReveal
              key={p.id}
              delay={i * 0.08}
              className="w-full max-w-sm md:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-1.334rem)]"
            >
              <div
                className={cn(
                  "demo-card relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 transition-colors sm:p-7",
                  p.highlighted || p.badge
                    ? "border-[#c67d52]/40 bg-[#131313]"
                    : "dim border-white/10 bg-[#101010] hover:border-white/20",
                )}
                style={
                  {
                    "--brand": COPPER,
                    "--energy-dur": `${7.5 + i * 1.4}s`,
                    "--energy-delay": `${i * -2.3}s`,
                    "--energy-spin-dur": `${2.4 + i * 0.5}s`,
                  } as React.CSSProperties
                }
              >
                <span className="plan-texture" aria-hidden />
                <div className="relative mb-5 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{p.name}</h3>
                  {p.badge && (
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#c67d52]">
                      {p.badge}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-semibold tracking-tight text-white tabular-nums">
                    {p.priceUf === 0 ? "0" : p.priceUf}
                  </span>
                  <span className="text-sm text-zinc-500">
                    {p.priceUf === 0 ? "UF · gratis" : "UF / mes"}
                  </span>
                </div>

                <p className="mt-2 text-sm text-zinc-500">{p.tagline}</p>

                <div className="my-5 h-px bg-white/[0.06]" />

                <ul className="flex-1 space-y-2.5 text-sm text-zinc-300">
                  {(p.resources?.length
                    ? p.resources
                    : ["POS táctil", "Inventario y recetas", "Soporte incluido"]
                  ).map((res, j) => (
                    <li key={j} className="flex items-center gap-2.5">
                      <span
                        className="h-1 w-1 shrink-0 rotate-45"
                        style={{ backgroundColor: COPPER }}
                        aria-hidden
                      />
                      {res}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => onPickPlan(p)}
                  className={cn(
                    "mt-7 w-full rounded-lg py-2.5 text-sm font-semibold transition-colors",
                    p.highlighted || p.badge
                      ? "btn-copper text-white"
                      : "border border-white/15 text-white hover:bg-white/5",
                  )}
                >
                  {p.priceUf === 0 ? "Comenzar gratis" : "Suscribirse"}
                </button>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );

}

function SimuladorSection() {
  return (
    <section
      id="simulador"
      className="relative z-10 pt-6 pb-20 sm:pt-8 sm:pb-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#c67d52]">
              <span className="inline-block h-2 w-2 rotate-45 bg-[#c67d52]" aria-hidden />
              Producto
            </p>
            <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Recorre el turno como si ya fuera tuyo
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-zinc-500">
            Cambia de rol y abre caja, cocina, mesas o informes. Es el mismo sistema, no un mock de marketing.
          </p>
        </div>
        <ProductInteractivePreview />
      </div>
    </section>
  );
}

/* Monograma de la demo (máx. 2 iniciales) para la tarjeta. */
function demoMonogram(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /[a-záéíóúñ]/i.test(w[0] ?? ""))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function UseCases({ items, brand }: { items?: LandingUseCaseItem[]; brand: LandingBrand }) {
  // Endpoint manda (orden + activos); fallback local si no viene nada.
  const cases = items
    ? items
        .filter((u) => u.active)
        .sort((a, b) => a.order - b.order)
        .map((u) => ({
          slug: u.slug,
          name: u.name,
          rubro: u.rubro,
          brandColor: u.brand_color,
          highlight: u.highlight,
        }))
    : LANDING_USE_CASES;
  return (
    <section id="demos" className="relative z-10 pt-10 pb-28 sm:pt-14 sm:pb-44">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-12 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#c67d52]">
              <span
                className="inline-block h-2 w-2 rotate-45"
                style={{ backgroundColor: COPPER }}
                aria-hidden
              />
              Demos en vivo
            </p>
            <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Mira nuestras demos
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              Una demo operativa por cada rubro, con datos y flujos reales.
              Accede libremente y evalúa {brand.name} en primera persona.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 self-start rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 sm:self-auto">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ backgroundColor: COPPER }}
              />
              <span
                className="relative inline-flex h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COPPER }}
              />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              {cases.length} demos activas
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((useCase, i) => (
            <ScrollReveal key={useCase.slug} delay={(i % 3) * 0.05} className="h-full">
              <Link
                href={`/login/${useCase.slug}`}
                target="_blank"
                rel="noreferrer"
                className="demo-card group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101010] p-5"
                style={
                  {
                    "--brand": useCase.brandColor,
                    // Fase y ritmo propios: las 9 tarjetas nunca laten al unísono.
                    "--energy-dur": `${7 + (i % 4) * 1.7}s`,
                    "--energy-delay": `${(i % 5) * -1.9}s`,
                    "--energy-spin-dur": `${2.2 + (i % 3) * 0.7}s`,
                  } as React.CSSProperties
                }
              >
                <div className="relative flex items-center gap-3">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
                    style={{ backgroundColor: useCase.brandColor }}
                    aria-hidden
                  >
                    {demoMonogram(useCase.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-white">
                      {useCase.name}
                    </h3>
                    <p className="truncate text-xs text-zinc-500">{useCase.rubro}</p>
                  </div>
                  <span className="relative flex h-2 w-2 shrink-0" title="Demo en vivo">
                    <span
                      className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50"
                      style={{ backgroundColor: useCase.brandColor }}
                      aria-hidden
                    />
                    <span
                      className="relative inline-flex h-2 w-2 rounded-full"
                      style={{ backgroundColor: useCase.brandColor }}
                      aria-hidden
                    />
                  </span>
                </div>

                <p className="relative mt-3.5 text-sm leading-relaxed text-zinc-400">
                  {useCase.highlight}
                </p>

                <div className="relative mt-auto flex items-center gap-1.5 pt-4 text-sm font-medium text-[#c67d52]">
                  <span>Abrir demo</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Capa cósmica fija al viewport (plexus + brasas): primera capa de la
 * página, SIEMPRE por debajo del contenido (nav z-40, secciones z-10).
 * Los efectos nunca interrumpen las tarjetas.
 */
function CosmicBackdrop() {
  // Cuando el cursor está revelando nodos, nebulosas y brasas se apartan;
  // al quedar inactivo, regresan. Nunca se reinician: solo se desvanecen.
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
      className="cosmic-backdrop pointer-events-none fixed inset-0 z-0"
    >
      {/* Red abstracta de energía: nodos que fluyen y se conectan */}
      <div
        className="absolute inset-0"
        style={{
          maskImage:
            "radial-gradient(85% 75% at 50% 45%, black 35%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(85% 75% at 50% 45%, black 35%, transparent 100%)",
        }}
      >
        <HeroPlexus className="h-full w-full" />
      </div>
      {/* Brasas que suben desde el horizonte (solo en reposo) */}
      <div className="absolute inset-0 fade-on-idle">
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
    </div>
  );
}

/* Alcance de cada módulo: a qué ámbito del negocio aporta. */
const MODULE_SCOPES: Record<string, string> = {
  "Punto de venta táctil": "Venta",
  "Caja y arqueo": "Dinero",
  "Salón digital 3D": "Salón",
  "Mesas y salón": "Salón",
  "Delivery y retiro": "Canales",
  "Cocina y KDS": "Operación",
  "Inventario y recetas": "Bodega",
  "Bodegas visuales": "Bodega",
  "Informes y finanzas": "Dinero",
  "Facturación electrónica": "SII",
  "Menú QR y pedidos": "Canales",
  "Etiquetas nutricionales": "Producto",
  "Medios de pago": "Dinero",
  "Multi-sucursal": "Gestión",
  "Proveedores y compras": "Bodega",
  "Roles y permisos": "Gestión",
};

/* Mapa de tokens de ícono del endpoint → componentes Lucide. */
const ICON_MAP: Record<string, LucideIcon> = {
  zap: Zap,
  banknote: Banknote,
  "layout-grid": LayoutGrid,
  bike: Bike,
  "chef-hat": ChefHat,
  warehouse: Warehouse,
  "file-text": FileText,
  "qr-code": QrCode,
  "credit-card": CreditCard,
  store: Store,
  truck: Truck,
  "shield-check": ShieldCheck,
  "rotate-3d": Rotate3d,
  boxes: Boxes,
  "chart-column": ChartColumn,
  leaf: Leaf,
  monitor: Monitor,
  kanban: Kanban,
};

function Features({ items }: { items?: LandingFeatureItem[] }) {
  // Endpoint manda (token de ícono → Lucide, fallback si es desconocido);
  // sin contenido del endpoint, se usa el copy local. Los módulos nuevos que
  // el backend aún no conoce se agregan al final (mismo criterio que los
  // planes en resolvePlans: lo local solo rellena huecos).
  const feats = useMemo(() => {
    if (!items?.length) return LANDING_FEATURES;
    const merged = items.map((f) => ({
      icon: ICON_MAP[f.icon] ?? LayoutGrid,
      title: f.title,
      description: f.description,
    }));
    const known = new Set(merged.map((f) => f.title.trim()));
    for (const local of LANDING_FEATURES) {
      if (!known.has(local.title)) merged.push(local);
    }
    return merged;
  }, [items]);
  return (
    <section id="producto" className="relative z-10 pt-10 pb-28 sm:pt-14 sm:pb-36">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#c67d52]">
              <span className="inline-block h-2 w-2 rotate-45 bg-[#c67d52]" aria-hidden />
              Módulos
            </p>
            <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Todo el local, sin menús de más
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
              Cada plan incluye el sistema completo. Enciendes lo que tu operación usa y el resto no estorba.
            </p>
          </div>
          <p className="shrink-0 text-sm text-zinc-500">
            <span className="font-display text-2xl font-semibold text-white">{feats.length}</span>{" "}
            módulos listos
          </p>
        </div>

        {/* Tabla flexible: columnas en desktop, filas apiladas en móvil.
            Fondo sólido: las líneas de energía quedan fuera de la tabla. */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#101010]">
          <div className="hidden md:grid grid-cols-[1.1fr_1.6fr_auto] gap-6 border-b border-white/[0.06] px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            <span>Módulo</span>
            <span>Qué hace</span>
            <span className="text-right">Ámbito</span>
          </div>

          {feats.map((feature, i) => {
            const Icon = feature.icon;
            const scope = MODULE_SCOPES[feature.title] ?? "Frig";
            return (
              <div
                key={feature.title}
                className={cn(
                  "grid grid-cols-1 gap-2 px-5 py-5 transition-colors hover:bg-[#161616] md:grid-cols-[1.1fr_1.6fr_auto] md:items-center md:gap-6 md:px-6",
                  i !== feats.length - 1 &&
                    "border-b border-white/[0.05]",
                )}
              >
                <div className="flex items-center gap-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#c67d52]/25 bg-[#c67d52]/[0.07]">
                    <Icon className="h-4 w-4" style={{ color: COPPER }} />
                  </span>
                  <h3 className="text-sm font-semibold text-white">
                    {feature.title}
                  </h3>
                </div>

                <p className="text-sm leading-relaxed text-zinc-400 md:pr-4">
                  {feature.description}
                </p>

                <div className="md:text-right">
                  <span className="inline-block rounded-full border border-[#c67d52]/25 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#c67d52]">
                    {scope}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Footer({
  contactEmail,
  demoSubject,
  social = [],
  brand,
}: {
  contactEmail: string;
  demoSubject?: string;
  social?: LandingFooterSocial[];
  brand: LandingBrand;
}) {
  return (
    <footer className="relative z-10 overflow-hidden py-14">
      {/* Energía de cierre: red de nodos + horizonte cálido, como el hero */}
      <SectionDivider />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%]"
        style={{
          background:
            "radial-gradient(110% 100% at 50% 130%, rgba(240,162,106,0.14) 0%, rgba(157,182,143,0.04) 45%, transparent 72%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          maskImage:
            "radial-gradient(90% 120% at 50% 100%, black 30%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(90% 120% at 50% 100%, black 30%, transparent 100%)",
        }}
      >
        <HeroPlexus className="h-full w-full" />
      </div>
      <ScrollReveal className="relative mx-auto mt-12 flex max-w-6xl flex-col items-center justify-between gap-6 px-6 text-sm text-zinc-500 sm:flex-row sm:px-8">
        <div className="flex items-center gap-3">
          <BrandMark brand={brand} className="h-10 w-auto max-h-10 object-contain" />
          <div className="flex flex-col">
            <span className="font-semibold text-zinc-300">{brand.isFrig ? "Frig" : brand.name}</span>
            <span className="text-xs">
              {brand.isFrig
                ? "Tu negocio completo, en una sola pantalla · Chile"
                : brand.name}
            </span>
          </div>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <a href="#producto" className="transition-colors hover:text-white">Módulos</a>
          <a href="#precios" className="transition-colors hover:text-white">Precios</a>
          <Link href="/politicas" className="transition-colors hover:text-white">Privacidad</Link>
          <a
            href={`mailto:${contactEmail}${demoSubject ? `?subject=${encodeURIComponent(demoSubject)}` : ""}`}
            className="transition-colors hover:text-white"
            style={{ color: brand.accent }}
          >
            {contactEmail}
          </a>
          {brand.isFrig
            ? social.map((s) =>
                s.network === "github" ? (
                  <a
                    key={s.href}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="GitHub"
                    className="transition-colors hover:text-white"
                  >
                    <GithubIcon className="h-4 w-4" />
                  </a>
                ) : null,
              )
            : null}
        </nav>
      </ScrollReveal>
    </footer>
  );
}

export function LandingSite() {
  const router = useRouter();
  const [plan, setPlan] = useState<LandingPlan | null>(null);
  const { status, theme, checkoutGroup } = useApp();

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const brand = resolveLandingBrand(theme);
  const hostReady = status !== "checking";

  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const sessionUser = useSessionStore((s) => s.user);
  const dashboard = useSessionStore((s) => s.dashboard);
  const [entering, setEntering] = useState(false);
  const savedUser = hasHydrated && sessionUser && getToken() ? sessionUser : null;
  const homeRoute = normalizeDashboardRoute(dashboard) ?? "/dashboard";

  function handleReenter() {
    if (entering) return;
    setEntering(true);
    router.push(homeRoute);
    // Red de seguridad tardía: si la SPA no navega en 8s (conexión lenta),
    // recarga dura al panel. Antes (4s) reiniciaba la carga a mitad.
    window.setTimeout(() => {
      if (window.location.pathname.startsWith("/login")) {
        window.location.href = homeRoute;
      }
    }, 8000);
  }

  const configQuery = useQuery({
    queryKey: ["landing-config", checkoutGroup],
    queryFn: () => fetchLandingConfig(checkoutGroup),
    staleTime: 10 * 60 * 1000,
    retry: 1,
    enabled: mounted && hostReady,
  });

  const { plans, integrationUf, unavailable: plansUnavailable } = useMemo(
    () => resolvePlans(configQuery.data),
    [configQuery.data],
  );
  const plansMissing =
    plansUnavailable || configQuery.isError || (configQuery.isSuccess && plans.length === 0);

  const group = configQuery.data?.group;
  const content = configQuery.data?.content ?? null;
  const heroCopy = group?.hero ?? null;
  const contactEmail =
    content?.contact?.email || group?.contact_email || DEMO_CONTACTS.to;
  const demoSubject = content?.contact?.demo_subject || DEMO_CONTACTS.subject;
  const pricingNote =
    content?.pricing_note || group?.pricing_note || LANDING_PRICING_NOTE;

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    if (brand.isFrig) {
      applyThemeConfig(null);
      return;
    }
    if (brand.accent) {
      document.documentElement.style.setProperty("--color-primary", brand.accent);
      document.documentElement.style.setProperty("--brand-primary", brand.accent);
      window.dispatchEvent(new CustomEvent("frig:theme-changed"));
    }
  }, [brand.isFrig, brand.accent]);

  if (!mounted || !hostReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0a0a0a]" aria-hidden>
        <BrandMark brand={brand} className="h-10 w-auto max-h-10 object-contain opacity-60" glow={false} />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#0a0a0a] font-sans">
      <CosmicBackdrop />
      <Nav savedUser={savedUser} links={sanitizeNavLinks(content?.nav)} brand={brand} />
      <main>
        <Hero
          hero={heroCopy}
          ctas={content?.hero ? { primary: content.hero.cta_primary, secondary: content.hero.cta_secondary } : undefined}
          savedUser={savedUser}
          entering={entering}
          onReenter={handleReenter}
          brand={brand}
        />
        <SimuladorSection />
        <Features items={content?.features} />
        <PricingSection
          plans={plans}
          integrationUf={integrationUf}
          pricingNote={pricingNote}
          unavailable={plansMissing}
          contactEmail={contactEmail}
          onPickPlan={setPlan}
        />
        <UseCases items={content?.use_cases} brand={brand} />
        <section className="relative z-10 pb-20 sm:pb-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ScrollReveal>
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#101010] px-6 py-10 sm:px-10 sm:py-12">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl"
                style={{ background: `${brand.accent}2e` }}
              />
              <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-xl">
                  <p
                    className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em]"
                    style={{ color: brand.accent }}
                  >
                    <span
                      className="inline-block h-2 w-2 rotate-45"
                      style={{ backgroundColor: brand.accent }}
                      aria-hidden
                    />
                    Empieza hoy
                  </p>
                  <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    Prueba un local real, o arma el tuyo.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
                    Entra a una demo sin registro, o elige un plan y deja la operación corriendo esta semana.
                    {pricingNote ? ` ${pricingNote}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="#precios"
                    className="btn-copper inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white"
                  >
                    Ver planes
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <a
                    href="#demos"
                    className="rounded-lg border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/5"
                  >
                    Abrir una demo
                  </a>
                  <a
                    href={`mailto:${contactEmail}?subject=${encodeURIComponent(demoSubject)}`}
                    className="inline-flex items-center px-2 py-3 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
                  >
                    Escribir a {contactEmail}
                  </a>
                </div>
              </div>

              <div className="relative mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-xl">
                  <p className="text-sm font-semibold text-white">{LANDING_STAGING.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-500">{LANDING_STAGING.body}</p>
                </div>
                {LANDING_STAGING_URL ? (
                  <a
                    href={LANDING_STAGING_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/5"
                  >
                    Abrir staging
                    <ArrowRight className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: brand.accent }}
                      aria-hidden
                    />
                    Ambiente de revisión
                  </span>
                )}
              </div>
            </div>
          </ScrollReveal>
        </div>
        </section>
      </main>
      <Footer
        contactEmail={contactEmail}
        demoSubject={demoSubject}
        social={content?.footer?.social}
        brand={brand}
      />
      <CheckoutModal
        plan={plan}
        integrationUf={integrationUf}
        contactEmail={contactEmail}
        onClose={() => setPlan(null)}
      />
    </div>
  );
}
