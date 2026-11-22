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
  ChefHat,
  CreditCard,
  FileText,
  Kanban,
  LayoutDashboard,
  LayoutGrid,
  Leaf,
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
import { hasSession } from "@/lib/api/session-storage";
import type { User } from "@/lib/types";
import {
  LANDING_FEATURES,
  LANDING_PLANS,
  LANDING_INTEGRATION_UF,
  LANDING_PRICING_NOTE,
  LANDING_CYCLE,
  LANDING_MODULE_DOSSIERS,
  LANDING_ORIGIN,
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
import { publicAsset } from "@/lib/public-asset";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { HeroFriggReveal } from "@/components/landing/hero-frigg-reveal";
import { ModuleStage } from "@/components/landing/module-stage";
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
  { href: "#demos", label: "Casos de uso" },
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
    .map((l) => {
      const href = (l.href || "").trim();
      const label = (l.label || "").trim();
      if (href === "#demos" || label.toLowerCase() === "demos") {
        return { href: "#demos", label: "Casos de uso" };
      }
      return { href, label };
    });
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
    return { isFrig: true, name: "FRIG", logo: publicAsset("/brand/frig-symbol.png"), accent: COPPER };
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0a]">
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

          <div className="hidden items-center gap-5 sm:flex">
            {brand.isFrig && (
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub de Frig"
              className="text-zinc-500 transition-colors hover:text-[#e8b08a]"
            >
              <GithubIcon className="h-5 w-5" />
            </a>
            )}
            {savedUser ? (
              <Link
                href="/dashboard"
                className="btn-copper inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white"
              >
                <LayoutDashboard className="h-4 w-4" />
                Ir al panel
              </Link>
            ) : (
              <Link
                href="/login"
                target="_blank"
                rel="noreferrer"
                className="btn-copper inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white"
              >
                Entrar
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
                    className="btn-copper py-2.5 text-center rounded-full text-sm font-semibold text-white"
                  >
                    Entrar
                  </Link>
                )}
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


/** Última palabra del titular en cobre. El resto queda en blanco. */
function splitLastWord(text: string): { lead: string; accent: string } {
  const trimmed = text.trim();
  const space = trimmed.lastIndexOf(" ");
  if (space <= 0) return { lead: trimmed, accent: "" };
  return { lead: trimmed.slice(0, space), accent: trimmed.slice(space + 1) };
}

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
  const headline = brand.isFrig
    ? LANDING_VALUE_PROP.headline
    : hero?.headline || LANDING_VALUE_PROP.headline;
  const narrative = brand.isFrig
    ? LANDING_VALUE_PROP.subhead
    : hero?.subhead || LANDING_VALUE_PROP.subhead;
  const continuation = brand.isFrig ? LANDING_VALUE_PROP.continuation : "";
  const primaryHref = brand.isFrig ? "#demos" : (ctas?.primary?.href ?? "#precios");
  const primaryLabel = brand.isFrig ? "Casos de uso" : (ctas?.primary?.label ?? "Ver planes");
  const secondaryHref = brand.isFrig ? "#producto" : (ctas?.secondary?.href ?? "#simulador");
  const secondaryLabel = brand.isFrig ? "Ver los módulos" : (ctas?.secondary?.label ?? "Probar el producto");
  const { lead, accent } = splitLastWord(headline);

  // Sin fundido ligado al scroll: la capa compositada de opacity+transform
  // producía una costura de 1px en el borde del hero con escala de Windows
  // no entera. El contenido del hero queda estático (el fondo ya se mueve).

  return (
    <section id="inicio" className="relative z-10 min-h-[calc(100dvh-4.5rem)]">
      {brand.isFrig && (
        <HeroFriggReveal
          src={publicAsset(LANDING_ORIGIN.image)}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      )}
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-4xl flex-col items-center justify-center px-4 py-12 text-center sm:px-6">
        {savedUser && (
          <div className="mb-8 flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-4">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: brand.accent }}
            >
              {sessionDisplayName(savedUser).charAt(0).toUpperCase()}
            </span>
            <span className="text-sm text-zinc-300">{sessionDisplayName(savedUser)}</span>
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
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em]"
          style={{ color: brand.accent }}
        >
          <span className="h-px w-8" style={{ backgroundColor: brand.accent }} aria-hidden />
          {brand.isFrig ? "Gestión comercial" : hero?.badge || "POS + cocina + caja, en el navegador"}
          <span className="h-px w-8" style={{ backgroundColor: brand.accent }} aria-hidden />
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.06, ease: "easeOut" }}
          className="font-display mt-6 max-w-3xl text-5xl font-semibold leading-[0.95] tracking-tight text-white [text-shadow:0_2px_22px_rgba(0,0,0,0.85)] sm:text-6xl lg:text-7xl"
        >
          {lead}
          {accent ? (
            <>
              {" "}
              <span className="hero-accent">{accent}</span>
            </>
          ) : null}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12, ease: "easeOut" }}
          className={cn(
            "mt-6 max-w-2xl text-base leading-relaxed sm:text-lg",
            brand.isFrig ? "text-zinc-300" : "text-zinc-500",
          )}
        >
          {narrative}
        </motion.p>
        {continuation ? (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16, ease: "easeOut" }}
            className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base"
          >
            {continuation}
          </motion.p>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18, ease: "easeOut" }}
          className="mt-7 flex flex-wrap items-center justify-center gap-3"
        >
          <a
            href={primaryHref}
            className="btn-copper btn-ember inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white"
          >
            {primaryLabel}
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href={secondaryHref}
            className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:text-white"
          >
            {secondaryLabel}
          </a>
        </motion.div>

        <div className="mt-8 opacity-80">
          {brand.isFrig ? (
            <FrigWordmarkMatrix className="mx-auto h-6 w-auto" />
          ) : (
            <BrandMark brand={brand} className="mx-auto h-6 w-auto max-h-6 object-contain" glow={false} />
          )}
        </div>
        {brand.isFrig && (
          <p className="mt-6 max-w-md text-[11px] leading-relaxed text-zinc-500">
            {LANDING_ORIGIN.caption}{" "}
            <a
              href={LANDING_ORIGIN.sourceHref}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-white/20 underline-offset-2 hover:text-zinc-300"
            >
              {LANDING_ORIGIN.sourceLabel}
            </a>
          </p>
        )}
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
    <div id="precios" className="scroll-mt-24">
      <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#c67d52]">
        <span className="inline-block h-2 w-2 rotate-45 bg-[#c67d52]" aria-hidden />
        El plan
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        La gestión entra completa. El precio es del negocio, no de cada módulo.
      </p>
      <div className="mt-5">
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
        <div className="flex flex-col gap-4">
          {plans.map((p, i) => (
            <ScrollReveal key={p.id} delay={i * 0.08} className="w-full">
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
                  Tomar el plan
                </button>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </div>
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

function UseCases({
  items,
  brand,
  plan,
}: {
  items?: LandingUseCaseItem[];
  brand: LandingBrand;
  plan?: React.ReactNode;
}) {
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
    <section id="demos" className="relative z-10 scroll-mt-20 py-12 sm:py-16">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div className="max-w-2xl lg:col-start-1">
          <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#c67d52]">
            <span className="inline-block h-2 w-2 rotate-45 bg-[#c67d52]" aria-hidden />
            Casos de uso
          </p>
          <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            La gestión, según el negocio
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Cada caso es un negocio con su venta, su cocina y su cierre. Entras sin registro y recorres cómo se lleva ese rubro en {brand.name}.
          </p>
        </div>

        {plan ? (
          <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <div className="lg:sticky lg:top-24">{plan}</div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:col-start-1">
          {cases.map((useCase) => (
            <Link
              key={useCase.slug}
              href={`/login/${useCase.slug}`}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3 rounded-xl border border-white/10 bg-[#101010] px-3 py-2.5 transition-colors hover:border-[#c67d52]/40"
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white"
                style={{ backgroundColor: useCase.brandColor }}
                aria-hidden
              >
                {demoMonogram(useCase.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{useCase.name}</span>
                <span className="mt-0.5 block truncate text-xs text-zinc-400">
                  {useCase.rubro}
                  <span className="text-zinc-600"> · </span>
                  {useCase.highlight}
                </span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#c67d52] opacity-50 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Link>
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
        className="plexus-layer absolute inset-0"
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
  "CRM comercial": "Gestión",
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
  const [active, setActive] = useState(0);
  const current = feats[Math.min(active, Math.max(feats.length - 1, 0))];
  const scope = current ? (MODULE_SCOPES[current.title] ?? "Frig") : "Frig";
  const dossier = current ? LANDING_MODULE_DOSSIERS[current.title] : undefined;

  return (
    <section id="producto" className="relative z-10 scroll-mt-20 pt-8 pb-20 sm:pt-10 sm:pb-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            La gestión, módulo por módulo
          </h2>
          <p className="text-sm text-zinc-500">
            <span className="font-display text-lg font-semibold text-white">{feats.length}</span>
            {" "}en la misma cuenta
          </p>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">
          Frig no es una lista de programas sueltos. Es la gestión comercial del negocio y, con el tiempo, su ERP. Cada módulo toma un tramo del día y le entrega el dato al que sigue. El recorrido de abajo es esa cadena. En cada ficha está el oficio del módulo y con quién trabaja.
        </p>
        <nav
          className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
          aria-label="Recorrido de la gestión"
        >
          {LANDING_CYCLE.map((stage, index) => {
            const target = feats.findIndex((feature) => feature.title === stage.module);
            const onStage = current?.title === stage.module;
            return (
              <button
                key={stage.module}
                type="button"
                disabled={target < 0}
                onClick={() => target >= 0 && setActive(target)}
                aria-current={onStage ? "true" : undefined}
                className={cn(
                  "relative z-10 flex h-full flex-col rounded-lg border bg-[#101010] px-2.5 py-2.5 text-left transition-colors",
                  onStage
                    ? "border-[#c67d52]"
                    : "border-white/10 hover:border-[#c67d52]/50",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-semibold",
                      onStage ? "bg-[#c67d52] text-black" : "bg-white/10 text-zinc-300",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className={cn("text-sm font-semibold", onStage ? "text-white" : "text-zinc-100")}>
                    {stage.label}
                  </span>
                </span>
                <span className="mt-1.5 text-xs leading-snug text-zinc-400">{stage.detail}</span>
              </button>
            );
          })}
        </nav>

        <div
          role="tablist"
          aria-label="Módulos de FRIG"
          className="mt-4 flex flex-wrap gap-x-1 gap-y-1"
        >
          {feats.map((feature, i) => {
            const selected = i === active;
            return (
              <button
                key={feature.title}
                type="button"
                role="tab"
                id={`modulo-tab-${i}`}
                aria-selected={selected}
                aria-controls="modulo-panel"
                onClick={() => setActive(i)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-left text-sm transition-colors",
                  selected ? "bg-white text-black" : "text-zinc-400 hover:text-white",
                )}
              >
                {feature.title}
              </button>
            );
          })}
        </div>

        {current ? (
          <div
            role="tabpanel"
            id="modulo-panel"
            aria-labelledby={`modulo-tab-${active}`}
            className="mt-8 border-t border-white/10 pt-8"
          >
            <div className="flex items-baseline gap-3">
              <h3 className="font-display text-2xl font-semibold tracking-tight text-white">{current.title}</h3>
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c67d52]">{scope}</span>
            </div>
            {dossier ? (
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300 sm:text-base">{dossier.role}</p>
            ) : (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">{current.description}</p>
            )}
            {dossier ? <ModuleStage title={current.title} /> : null}
            {dossier && (
              <div className="mt-5">
                <p className="max-w-3xl text-sm leading-relaxed text-zinc-500">{dossier.method}</p>
                <p className="mt-3 text-sm text-zinc-400">{dossier.traits.join(" · ")}</p>
                {dossier.links.length > 0 && (
                  <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <span className="text-zinc-500">Sigue en</span>
                    {dossier.links.map((name) => {
                      const index = feats.findIndex((feature) => feature.title === name);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => index >= 0 && setActive(index)}
                          className="text-zinc-200 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white hover:decoration-[#c67d52]"
                        >
                          {name}
                        </button>
                      );
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("inicio");
    if (!hero) return;
    const obs = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0.2 },
    );
    obs.observe(hero);
    return () => obs.disconnect();
  }, []);
  if (!show) return null;
  return (
    <a
      href="#inicio"
      className="fixed bottom-5 right-4 z-40 rounded-full border border-white/15 bg-[#101010]/90 px-3.5 py-2 text-sm font-medium text-zinc-200 backdrop-blur-sm transition-colors hover:border-[#c67d52]/50 hover:text-white"
    >
      ↑ Volver
    </a>
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
                ? "Gestión comercial del negocio · Chile"
                : brand.name}
            </span>
          </div>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <a href="#inicio" className="transition-colors hover:text-white">Inicio</a>
          <a href="#producto" className="transition-colors hover:text-white">Módulos</a>
          {LANDING_STAGING_URL ? (
            <a
              href={LANDING_STAGING_URL}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white"
            >
              Staging
            </a>
          ) : null}
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
  const savedUser = hasHydrated && sessionUser && hasSession() ? sessionUser : null;
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
        <UseCases
          items={content?.use_cases}
          brand={brand}
          plan={
            <PricingSection
              plans={plans}
              integrationUf={integrationUf}
              pricingNote={pricingNote}
              unavailable={plansMissing}
              contactEmail={contactEmail}
              onPickPlan={setPlan}
            />
          }
        />
        <Features items={content?.features} />
      </main>
      <Footer
        contactEmail={contactEmail}
        demoSubject={demoSubject}
        social={content?.footer?.social}
        brand={brand}
      />
      <BackToTop />
      <CheckoutModal
        plan={plan}
        integrationUf={integrationUf}
        contactEmail={contactEmail}
        onClose={() => setPlan(null)}
      />
    </div>
  );
}
