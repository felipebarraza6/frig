"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  Bike,
  Check,
  ChefHat,
  CreditCard,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  LogIn,
  Menu,
  QrCode,
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
function resolvePlans(config: LandingConfig | undefined): {
  plans: LandingPlan[];
  integrationUf: number;
} {
  const groupPlans = config?.plans;
  if (!groupPlans?.length) {
    return { plans: LANDING_PLANS, integrationUf: LANDING_INTEGRATION_UF };
  }
  const copyById = new Map(LANDING_PLANS.map((p) => [p.id, p]));
  const plans = groupPlans.map((gp) => {
    const copy = copyById.get(gp.plan_id);
    return {
      id: gp.plan_id,
      name: gp.display_name,
      tagline: gp.description || copy?.tagline || "",
      priceUf: gp.price_uf,
      resources: gp.features?.length ? gp.features : (copy?.resources ?? []),
      highlighted: gp.highlighted || copy?.highlighted,
      badge: gp.badge ?? null,
    } satisfies LandingPlan;
  });
  return {
    plans,
    integrationUf: config?.group.integration_uf ?? LANDING_INTEGRATION_UF,
  };
}

/* Paleta del logo: cobre sobre negro neutro. Un solo acento. */
const COPPER = "#c67d52";
const COPPER_HOVER = "#d68c5f";

const NAV_LINKS = [
  { href: "#demos", label: "Casos de uso" },
  { href: "#producto", label: "Módulos" },
];

const GITHUB_URL = "https://github.com/FelipeBarraza6/frig";

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
}: {
  savedUser: User | null;
  links?: LandingNavItem[];
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
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0a0a0a]/85 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6 sm:px-8">
        <Link href="/" className="flex items-center group">
          <img
            src="/brand/frig-symbol.png"
            alt="FRIG"
            className="h-12 w-auto transition-transform group-hover:scale-105"
            style={{
              filter: "drop-shadow(0 0 14px rgba(238,158,112,0.45))",
            }}
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
                      style={{ backgroundColor: COPPER }}
                      aria-hidden
                    />
                  )}
                </a>
              );
            })}
          </nav>

          <div className="hidden sm:block h-5 w-px bg-white/10" aria-hidden />

          <div className="flex items-center gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub de Frig"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-white/25 hover:text-white"
            >
              <GithubIcon className="h-5 w-5" />
            </a>
            {savedUser ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/5"
              >
                <LayoutDashboard className="h-4 w-4 text-zinc-400" />
                Ir al panel
              </Link>
            ) : (
              <Link
                href="/login"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/5"
              >
                <LogIn className="h-4 w-4 text-zinc-400" />
                Login
              </Link>
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
}: {
  hero: LandingHero | null;
  ctas?: { primary?: LandingCta; secondary?: LandingCta };
  savedUser: User | null;
  entering: boolean;
  onReenter: () => void;
}) {
  // Contenido dinámico: el endpoint manda; el copy local es solo fallback.
  const headline = hero?.headline || LANDING_VALUE_PROP.headline;
  const narrative = hero?.subhead || LANDING_VALUE_PROP.subhead;

  // Sin fundido ligado al scroll: la capa compositada de opacity+transform
  // producía una costura de 1px en el borde del hero con escala de Windows
  // no entera. El contenido del hero queda estático (el fondo ya se mueve).

  return (
    <section id="inicio" className="relative z-10">
      {/* Sin atmósfera local: la capa cósmica global (nebulosas, plexus,
          brasas, glow del cursor) da toda la energía sin costuras. */}

      <div
        className="relative mx-auto flex min-h-[calc(100dvh-5rem)] max-w-6xl flex-col items-center justify-center px-4 py-12 sm:px-6"
      >
        <div className="flex flex-col items-center text-center gap-5">
          {savedUser && (
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-4">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: COPPER }}
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
                style={{ color: COPPER }}
              >
                {entering ? "Cargando tu panel…" : "Reingresar →"}
              </button>
            </div>
          )}

          {/* Wordmark como matriz de datos: cuadritos que titilan y hacen
              glitch, mismo lenguaje que los nodos del fondo. Autónomo. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.86, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative"
          >
            <FrigWordmarkMatrix className="h-16 w-auto sm:h-24" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.22, ease: "easeOut" }}
            className="font-display max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-6xl"
          >
            {headline}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.3, ease: "easeOut" }}
            className="max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg"
          >
            {narrative}
          </motion.p>

          {hero?.points && hero.points.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.38, ease: "easeOut" }}
              className="grid max-w-2xl grid-cols-1 gap-x-8 gap-y-2.5 text-sm text-zinc-300 sm:grid-cols-2"
            >
              {hero.points.map((point) => (
                <span key={point} className="flex items-center justify-center gap-2.5 sm:justify-start">
                  <Check className="h-4 w-4 shrink-0" style={{ color: COPPER }} />
                  <span className="text-left">{point}</span>
                </span>
              ))}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.46, ease: "easeOut" }}
            className="flex flex-wrap items-center justify-center gap-4 pt-1"
          >
            <a
              href={ctas?.primary?.href ?? "#precios"}
              className="btn-copper inline-flex items-center gap-2 rounded-lg px-7 py-3 text-base font-semibold text-white"
            >
              {ctas?.primary?.label ?? "Suscripción"}
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={ctas?.secondary?.href ?? "#simulador"}
              className="rounded-lg border border-white/15 px-7 py-3 text-base font-semibold text-white transition-colors hover:bg-white/5"
            >
              {ctas?.secondary?.label ?? "Ver cómo funciona"}
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function PricingSection({
  plans,
  integrationUf,
  pricingNote,
  onPickPlan,
}: {
  plans: LandingPlan[];
  integrationUf: number;
  pricingNote?: string;
  onPickPlan: (p: LandingPlan) => void;
}) {
  return (
    <section id="precios" className="relative z-10 pt-10 pb-28 sm:pt-14 sm:pb-44">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
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
      className="relative z-10 pt-10 pb-28 sm:pt-14 sm:pb-44"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
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

function UseCases({ items }: { items?: LandingUseCaseItem[] }) {
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
              Accede libremente y evalúa Frig en primera persona.
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
  "Mesas y salón": "Salón",
  "Delivery y retiro": "Canales",
  "Cocina y KDS": "Operación",
  "Inventario y recetas": "Bodega",
  "Facturación electrónica": "SII",
  "Menú QR y pedidos": "Canales",
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
};

function Features({ items }: { items?: LandingFeatureItem[] }) {
  // Endpoint manda (token de ícono → Lucide, fallback si es desconocido);
  // sin contenido del endpoint, se usa el copy local.
  const feats = items?.length
    ? items.map((f) => ({
        icon: ICON_MAP[f.icon] ?? LayoutGrid,
        title: f.title,
        description: f.description,
      }))
    : LANDING_FEATURES;
  return (
    <section id="producto" className="relative z-10 pt-10 pb-28 sm:pt-14 sm:pb-44">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
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
                  i !== LANDING_FEATURES.length - 1 &&
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
}: {
  contactEmail: string;
  demoSubject?: string;
  social?: LandingFooterSocial[];
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
          <img
            src="/brand/frig-symbol.png"
            alt="FRIG"
            className="h-10 w-auto"
            style={{ filter: "drop-shadow(0 0 10px rgba(238,158,112,0.35))" }}
          />
          <div className="flex flex-col">
            <span className="font-semibold text-zinc-300">Frig</span>
            <span className="text-xs">Tu negocio completo, en una sola pantalla · Chile</span>
          </div>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <a href="#producto" className="transition-colors hover:text-white">Módulos</a>
          <a href="#precios" className="transition-colors hover:text-white">Precios</a>
          <Link href="/politicas" className="transition-colors hover:text-white">Privacidad</Link>
          <a
            href={`mailto:${contactEmail}${demoSubject ? `?subject=${encodeURIComponent(demoSubject)}` : ""}`}
            className="transition-colors hover:text-white"
            style={{ color: COPPER }}
          >
            {contactEmail}
          </a>
          {social.map((s) =>
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
          )}
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

  const isFrigTheme = theme?.app_name?.toLowerCase().includes("frig") ?? false;
  const byHost = status === "checking" ? "checking" : (theme && !isFrigTheme) ? "tenant" : "landing";

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
    // Red de seguridad: si la SPA no navega en 4s, recarga dura al panel.
    window.setTimeout(() => {
      if (window.location.pathname.startsWith("/login")) {
        window.location.href = homeRoute;
      }
    }, 4000);
  }

  const configQuery = useQuery({
    queryKey: ["landing-config", checkoutGroup],
    queryFn: () => fetchLandingConfig(checkoutGroup),
    staleTime: 10 * 60 * 1000,
    retry: 1,
    enabled: mounted && byHost === "landing",
  });

  const { plans, integrationUf } = useMemo(
    () => resolvePlans(configQuery.data),
    [configQuery.data],
  );

  const group = configQuery.data?.group;
  const content = configQuery.data?.content ?? null;
  const heroCopy = group?.hero ?? null;
  const contactEmail =
    content?.contact?.email || group?.contact_email || DEMO_CONTACTS.to;
  const demoSubject = content?.contact?.demo_subject || DEMO_CONTACTS.subject;
  const pricingNote =
    content?.pricing_note || group?.pricing_note || LANDING_PRICING_NOTE;

  useEffect(() => {
    if (byHost === "tenant") window.location.replace("/login");
  }, [byHost]);

  useEffect(() => {
    applyThemeConfig(null);
    document.documentElement.classList.remove("dark");
  }, []);

  if (!mounted || byHost !== "landing") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0a0a0a]" aria-hidden>
        <img src="/brand/frig-symbol.png" alt="" className="h-10 w-10 opacity-60" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#0a0a0a] font-sans">
      <CosmicBackdrop />
      <Nav savedUser={savedUser} links={content?.nav} />
      <main>
        <Hero
          hero={heroCopy}
          ctas={content?.hero ? { primary: content.hero.cta_primary, secondary: content.hero.cta_secondary } : undefined}
          savedUser={savedUser}
          entering={entering}
          onReenter={handleReenter}
        />
        <SimuladorSection />
        <PricingSection
          plans={plans}
          integrationUf={integrationUf}
          pricingNote={pricingNote}
          onPickPlan={setPlan}
        />
        <UseCases items={content?.use_cases} />
        <Features items={content?.features} />
      </main>
      <Footer
        contactEmail={contactEmail}
        demoSubject={demoSubject}
        social={content?.footer?.social}
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
