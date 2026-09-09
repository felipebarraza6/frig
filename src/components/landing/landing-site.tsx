"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  Bike,
  Building2,
  ChartColumn,
  Check,
  ChefHat,
  CreditCard,
  ExternalLink,
  FileText,
  LayoutGrid,
  Package,
  Percent,
  Plug,
  QrCode,
  Receipt,
  ShieldCheck,
  Smartphone,
  Store,
  Truck,
  Users,
  Warehouse,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/lib/app-context";
import { useSessionStore, normalizeDashboardRoute } from "@/lib/store/session";
import { getToken } from "@/lib/api/session-storage";
import type { User } from "@/lib/types";
import {
  LANDING_FEATURES,
  LANDING_PLANS,
  LANDING_PRICING_NOTE,
  LANDING_INTEGRATION_UF,
  LANDING_USE_CASES,
  LANDING_VALUE_PROP,
  DEMO_CONTACTS,
  type LandingPlan,
} from "@/content/landing";
import {
  fetchLandingConfig,
  type LandingConfig,
  type LandingFeatureItem,
  type LandingHero,
} from "@/lib/api/checkout";
import { applyThemeConfig } from "@/lib/api/branches";
import { PixelClouds } from "@/components/landing/pixel-clouds";
import { PixelWind } from "@/components/landing/pixel-wind";
import { PixelVillage } from "@/components/landing/pixel-village";
import { PixelNightSky } from "@/components/landing/pixel-night-sky";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { PixelFoodMark } from "@/components/landing/pixel-food-mark";
import { CheckoutModal } from "@/components/landing/checkout-modal";
import { SectionTitle } from "@/components/landing/section-title";
import { motion } from "framer-motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Cruza la config viva de la landing (GET /public/landing-config/) con el
 * copy local: planes (precio, nombre, bajada, bullets, sello) y copy de
 * grupo vienen del sistema; `src/content/landing.ts` queda como fallback.
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

/** Botón chunky estilo juego (sombra dura, sin radios, se hunde al pulsar). */
const PIXEL_BTN =
  "pixel-btn font-pixel tracking-wider";

const CREAM = "#f5efdd";
const GOLD = "#e9bd4a";

/** Mapea las claves de icono del sistema a componentes lucide. */
const FEATURE_ICONS: Record<string, LucideIcon> = {
  zap: Zap,
  receipt: Receipt,
  users: Users,
  package: Package,
  "chef-hat": ChefHat,
  truck: Truck,
  "bar-chart": ChartColumn,
  percent: Percent,
  shield: ShieldCheck,
  smartphone: Smartphone,
  "building-2": Building2,
  plug: Plug,
  banknote: Banknote,
  bike: Bike,
  "layout-grid": LayoutGrid,
  warehouse: Warehouse,
  "credit-card": CreditCard,
  "file-text": FileText,
  "qr-code": QrCode,
  store: Store,
};
const DEFAULT_FEATURE_ICON = Store;

/**
 * Nombre corto para saludar a un usuario con sesión persistida. En landing
 * FRIG (sin tema de tenant) el saludo es solo cosmético: la sesión real se
 * valida al entrar a la app (el shell reacciona a un 401 limpiando todo y
 * volviendo a /login con aviso).
 */
function sessionDisplayName(user: User): string {
  const full = (
    user.full_name ??
    `${user.first_name ?? ""} ${user.last_name ?? ""}`
  ).trim();
  return full || user.username || user.email.split("@")[0] || "tu cuenta";
}

/** Props comunes del punto de reingreso con sesión persistida. */
interface ReenterProps {
  /** Usuario con sesión persistida (null → UI de siempre). */
  savedUser: User | null;
  /** True mientras se navega de vuelta a la app. */
  entering: boolean;
  /** Navega al home persistido de la sesión. */
  onReenter: () => void;
}

function Nav({ savedUser }: { savedUser: User | null }) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-[#241f1a] bg-[#14160f]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground">
            <PixelFoodMark className="h-5 w-5" />
          </span>
          <span className="font-pixel text-base font-semibold tracking-[0.2em] text-white">
            FRIG
          </span>
        </Link>
        <nav className="flex items-center gap-4 font-pixel text-xs tracking-widest text-emerald-100/70 sm:gap-6">
          <a href="#funciones" className="hidden transition-colors hover:text-white sm:inline">FUNCIONES</a>
          <a href="#planes" className="hidden transition-colors hover:text-white sm:inline">PLANES</a>
          <a href="#casos" className="hidden transition-colors hover:text-white sm:inline">DEMOS</a>
          {/* Sin sesión el acceso va acá; con sesión, el reingreso vive en el
              banner del hero (VOLVISTE → REINGRESAR), no repetido en el header. */}
          {!savedUser && (
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                PIXEL_BTN,
                "border-emerald-100/30 bg-transparent text-emerald-50 hover:bg-white/10 hover:text-white",
              )}
            >
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function Hero({
  plans,
  hero,
  onPickPlan,
  savedUser,
  entering,
  onReenter,
}: {
  plans: LandingPlan[];
  /** Copy del hero desde el sistema (null → fallback local). */
  hero: LandingHero | null;
  onPickPlan: (p: LandingPlan) => void;
} & ReenterProps) {
  const cta = plans[0];
  const ctaLabel =
    hero?.cta_label ??
    (cta?.priceUf != null ? `EMPEZAR POR ${cta.priceUf} UF` : "EMPEZAR AHORA");
  const headline = hero?.headline ?? LANDING_VALUE_PROP.headline;
  const subhead = hero?.subhead ?? LANDING_VALUE_PROP.subhead;
  // Acento dorado en la cola del titular (tras la última coma), como en el
  // copy histórico; sin coma, el titular completo queda en crema.
  const splitAt = headline.lastIndexOf(", ");
  const head = splitAt > 0 ? headline.slice(0, splitAt + 1) : headline;
  const tail = splitAt > 0 ? headline.slice(splitAt + 2) : null;
  return (
    <section className="pixel-sky-hero relative overflow-hidden min-h-[calc(100dvh-3.5rem)]">
      <PixelNightSky />
      <PixelClouds />
      <PixelWind />
      <PixelVillage />
      {/* Bruma nocturna sobre el mosaico */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(900px 420px at 50% -10%, rgba(233,189,74,0.10), transparent 60%), radial-gradient(720px 400px at 28% 46%, rgba(10,24,15,0.45), transparent 70%), linear-gradient(180deg, rgba(15,36,23,0.22), rgba(15,36,23,0.38))",
        }}
      />

      <div className="relative mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-6xl flex-col justify-start px-4 pt-[27vh] pb-[170px] sm:px-6 sm:justify-center sm:pt-12 sm:pb-[200px]">
        <div className="flex flex-col items-center gap-3 text-center sm:gap-6 lg:items-start lg:text-left">
          {savedUser && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.04, ease: "easeOut" }}
              className="flex w-full max-w-xl flex-col items-center gap-3 border-2 border-emerald-100/25 bg-[#08170f]/85 p-3 shadow-[5px_5px_0_0_rgba(0,0,0,0.45)] sm:flex-row sm:items-center sm:gap-4 sm:p-3.5 lg:w-fit lg:max-w-none lg:self-end"
            >
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center font-pixel text-base font-semibold text-emerald-950"
                style={{ backgroundColor: GOLD }}
              >
                {sessionDisplayName(savedUser).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 max-w-48 flex-1 text-center sm:text-left">
                <p className="font-pixel text-[10px] tracking-[0.2em] text-emerald-100/55">
                  VOLVISTE
                </p>
                <p className="truncate font-pixel text-sm font-semibold tracking-wider text-emerald-50">
                  {sessionDisplayName(savedUser)}
                </p>
              </div>
              <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row sm:gap-3">
                <Button
                  size="sm"
                  disabled={entering}
                  className={cn(PIXEL_BTN, "text-emerald-950")}
                  style={{ backgroundColor: GOLD }}
                  onClick={onReenter}
                >
                  {entering ? "ENTRANDO…" : "REINGRESAR"}
                </Button>
                <Link
                  href="/login"
                  className="font-pixel text-[10px] tracking-[0.14em] text-emerald-100/60 transition-colors hover:text-white"
                >
                  ¿NO ERES TÚ?
                </Link>
              </div>
            </motion.div>
          )}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
            className={cn(
              "max-w-xl font-pixel text-2xl font-semibold leading-snug tracking-wide sm:text-5xl",
              // Con sesión en móvil el hero lo encabeza el banner de
              // reingreso: el titular/CTA ya los conoce y rompen el fold.
              savedUser && "max-sm:hidden",
            )}
            style={{ color: CREAM, textShadow: "3px 3px 0 rgba(0,0,0,0.5)" }}
          >
            {head} {tail && <span style={{ color: GOLD }}>{tail}</span>}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.16, ease: "easeOut" }}
            className={cn(
              "max-w-lg text-pretty text-[13px] leading-relaxed text-emerald-100/85 sm:text-base",
              savedUser && "max-sm:hidden",
            )}
          >
            {subhead}{" "}
            <span className="font-semibold" style={{ color: GOLD }}>
              {cta?.priceUf != null
                ? `Desde ${cta.priceUf} UF mensual.`
                : "Precios a convenir según tu operación."}
            </span>
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.24, ease: "easeOut" }}
            className={cn(
              "flex flex-col gap-3 sm:flex-row",
              savedUser && "max-sm:hidden",
            )}
          >
            <Button
              size="lg"
              className={cn(PIXEL_BTN, "text-emerald-950")}
              style={{ backgroundColor: GOLD }}
              onClick={() => cta && onPickPlan(cta)}
            >
              {ctaLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <a
              href="#casos"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                PIXEL_BTN,
                "border-emerald-100/30 bg-transparent text-emerald-50 hover:bg-white/10 hover:text-white",
              )}
            >
              PROBAR UNA DEMO
            </a>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.34 }}
            className="hidden font-pixel text-[10px] tracking-[0.2em] text-emerald-100/50 sm:block"
          >
            TODOS LOS MÓDULOS · EN TODOS LOS PLANES · SIEMPRE
          </motion.p>
        </div>
      </div>
    </section>
  );
}

function Features({ items }: { items: LandingFeatureItem[] }) {
  const features = items.length
    ? items.map((f) => ({
        icon: FEATURE_ICONS[f.icon] ?? DEFAULT_FEATURE_ICON,
        title: f.title,
        description: f.description,
      }))
    : LANDING_FEATURES;
  return (
    <section id="funciones" className="pixel-sky-forest scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <ScrollReveal>
          <SectionTitle
            dark
            kicker="Funciones"
            title="Todo lo que tu local necesita, sin pagar módulo por módulo"
            sub="FRIG no es una herramienta más: es el sistema completo. Todo lo que ves abajo viene incluido en cualquier plan."
          />
        </ScrollReveal>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <ScrollReveal key={feature.title} delay={(i % 3) * 0.07} className="h-full">
                <li className="pixel-frame flex h-full gap-3.5 p-4 transition-transform hover:-translate-y-0.5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center bg-primary/20 text-primary">
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <div>
                    <p className="font-pixel text-[13px] font-semibold tracking-wider leading-snug">
                      {feature.title}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </li>
              </ScrollReveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Pricing({
  plans,
  integrationUf,
  pricingNote,
  onPickPlan,
}: {
  plans: LandingPlan[];
  integrationUf: number;
  pricingNote: string;
  onPickPlan: (p: LandingPlan) => void;
}) {
  return (
    <section
      id="planes"
      className="pixel-sky-deep scroll-mt-16"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <ScrollReveal>
          <SectionTitle
            dark
            kicker="Planes"
            title="Crece con tu negocio, no con tus funciones"
            sub={pricingNote}
          />
        </ScrollReveal>
        <p className="mb-10 max-w-2xl font-pixel text-[11px] tracking-[0.16em] text-emerald-100/60">
          + {integrationUf} UF ÚNICA DE INTEGRACIÓN — DEJAMOS TU LOCAL OPERANDO CON SU MARCA
        </p>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5 lg:items-stretch">
          {plans.map((plan, i) => (
            <ScrollReveal key={plan.id} delay={i * 0.06} className="h-full">
              <article
                className={cn(
                  "pixel-frame flex h-full flex-col p-5 transition-transform hover:-translate-y-1",
                  plan.highlighted && "plan-glow",
                )}
                style={
                  plan.highlighted
                    ? {
                        borderColor: GOLD,
                      }
                    : undefined
                }
              >
                {plan.highlighted && (
                  <span
                    className="landing-pixel-glow mb-3 inline-flex w-fit items-center px-2 py-0.5 font-pixel text-[10px] tracking-[0.14em] text-[#241f1a]"
                    style={{ backgroundColor: GOLD }}
                  >
                    {plan.badge ?? "EL MÁS ELEGIDO"}
                  </span>
                )}
                <h3 className="font-pixel text-sm font-semibold tracking-wider">{plan.name}</h3>
                <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{plan.tagline}</p>
                <p className="mt-4">
                  <span className="font-pixel text-xl font-bold tabular-nums">
                    {plan.priceUf !== null ? `${plan.priceUf} UF` : "A convenir"}
                  </span>
                  {plan.priceUf !== null && (
                    <span className="text-xs text-muted-foreground"> /mes</span>
                  )}
                </p>
                <ul className="mt-4 flex flex-col gap-1.5">
                  {plan.resources.map((r) => (
                    <li key={r} className="flex items-start gap-1.5 text-[13px] text-muted-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {r}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.highlighted ? "default" : "outline"}
                  className={cn(PIXEL_BTN, "mt-5 w-full")}
                  onClick={() => onPickPlan(plan)}
                >
                  {plan.priceUf !== null ? "CONTRATAR" : "HABLEMOS"}
                </Button>
              </article>
            </ScrollReveal>
          ))}
        </div>
        <p className="mt-8 text-center font-pixel text-[10px] tracking-[0.2em] text-emerald-100/40">
          VALORES EN UF + IVA · SIN PERMANENCIA MÍNIMA
        </p>
      </div>
    </section>
  );
}

function UseCases() {
  return (
    <section id="casos" className="pixel-sky-forest scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <ScrollReveal>
          <SectionTitle
            dark
            kicker="Casos de uso"
            title="FRIG se adapta a tu rubro — con tu marca"
            sub="Estas demos ya están operativas. Entra a cualquiera y mira el sistema funcionando con el logo y color de cada negocio."
          />
        </ScrollReveal>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_USE_CASES.map((useCase, i) => (
            <ScrollReveal key={useCase.slug} delay={(i % 3) * 0.07} className="h-full">
              <Link
                href={`/login/${useCase.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="pixel-frame group flex h-full flex-col gap-3 p-5 transition-transform hover:-translate-y-1"
                style={{
                  borderColor: useCase.brandColor,
                  boxShadow: `5px 5px 0 0 ${useCase.brandColor}55`,
                }}
              >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center text-white"
                  style={{ backgroundColor: useCase.brandColor }}
                >
                  <PixelFoodMark className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-pixel text-[13px] font-semibold tracking-wider">
                    {useCase.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{useCase.rubro}</p>
                </div>
              </div>
              <p className="text-[13px] text-muted-foreground">{useCase.highlight}</p>
              <span className="mt-auto inline-flex items-center gap-1 font-pixel text-[11px] tracking-[0.14em] text-primary">
                ENTRAR A LA DEMO
                <ExternalLink className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({
  plans,
  onPickPlan,
}: {
  plans: LandingPlan[];
  onPickPlan: (p: LandingPlan) => void;
}) {
  const cta = plans[0];
  const ctaLabel =
    cta?.priceUf != null ? `EMPEZAR POR ${cta.priceUf} UF` : "EMPEZAR AHORA";
  return (
    <section className="pixel-sky-hero relative overflow-hidden">
      {/* Estrellas pixel titilando sobre el CTA final. */}
      {[12, 30, 48, 66, 84].map((left, i) => (
        <span
          key={left}
          aria-hidden
          className="login-twinkle absolute"
          style={{
            left: `${left}%`,
            top: `${12 + i * 9}%`,
            width: 3,
            height: 3,
            backgroundColor: GOLD,
            animationDelay: `${i * 0.7}s`,
            animationDuration: `${2.6 + i * 0.4}s`,
          }}
        />
      ))}
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6 sm:py-20">
        <ScrollReveal className="flex flex-col items-center gap-5">
          <h2
            className="max-w-xl font-pixel text-2xl leading-snug tracking-wide sm:text-3xl"
            style={{ color: CREAM, textShadow: "3px 3px 0 rgba(0,0,0,0.5)" }}
          >
            Tu local funcionando con FRIG <span style={{ color: GOLD }}>esta semana</span>
          </h2>
          <p className="max-w-md text-sm text-emerald-100/80 sm:text-base">
            Elige tu plan, paga la integración y recibe tu código de acceso por correo.
            Sin letra chica: todos los módulos, siempre.
          </p>
          <Button
            size="lg"
            className={cn(PIXEL_BTN, "text-emerald-950")}
            style={{ backgroundColor: GOLD }}
            onClick={() => cta && onPickPlan(cta)}
          >
            {ctaLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </ScrollReveal>
      </div>
    </section>
  );
}

function Footer({ contactEmail }: { contactEmail: string }) {
  return (
    <footer className="bg-[#14160f]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 font-pixel text-[10px] tracking-[0.18em] text-emerald-100/50 sm:flex-row sm:px-6">
        <span className="flex items-center gap-2">
          <PixelFoodMark className="h-4 w-4" />
          FRIG — GESTIÓN COMERCIAL Y GASTRONÓMICA
        </span>
        <nav className="flex items-center gap-5">
          <Link href="/politicas" className="transition-colors hover:text-white">
            POLÍTICA DE PRIVACIDAD
          </Link>
          <a href={`mailto:${contactEmail}`} className="text-emerald-100 hover:text-white">
            CONTACTO: {contactEmail}
          </a>
        </nav>
      </div>
    </footer>
  );
}

/**
 * Sitio público de FRIG en `/`. Estilo juego medieval pixel-art: fondos en
 * mosaico oscuro, castillo en bitmap, marcos chunky con sombra dura y
 * tipografía pixel en los títulos. El login queda en /login.
 *
 * Gate by-host (splash-first): la exportación estática no puede detectar el
 * host en el servidor, así que el primer paint (SSR incluido) es SIEMPRE una
 * pantalla oscura mínima y la landing solo se monta tras resolver el host en
 * cliente. En dominio de tenant (by-host) se redirige a /login sin que la
 * landing llegue a pintarse jamás — un flash de landing rompe el contexto del
 * producto white-label. En dominio propio/desarrollo la splash cede paso a la
 * landing (las animaciones de entrada la hacen ver intencional).
 *
 * Reingreso: si hay una sesión persistida (frig.token + frig.session), la
 * animación de entrada muestra al usuario con un botón que vuelve directo al
 * home persistido. La validez real del token la confirma el shell de la app
 * (un 401 limpia la sesión y vuelve a /login con aviso).
 *
 * Todo el contenido de la landing viene de GET /public/landing-config/
 * (grupo según checkoutGroup): hero, funciones, nota de pricing, contacto,
 * UF de integración y planes. `src/content/landing.ts` queda solo como
 * fallback ante 404/error del backend.
 */
export function LandingSite() {
  const router = useRouter();
  const [plan, setPlan] = useState<LandingPlan | null>(null);
  const { status, theme, checkoutGroup } = useApp();
  // Primer paint del cliente: el SSR sirve la splash, pero el render inicial
  // hidratado aún no ha resuelto el host — se vuelve a la splash hasta tener
  // el veredicto (mounted && status !== "checking"). useSyncExternalStore da
  // ese gate sin setState en effect (regla react-hooks/set-state-in-effect).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const byHost = status === "checking" ? "checking" : theme ? "tenant" : "landing";

  // Sesión persistida de un ingreso anterior: solo se expone después de que
  // el store hidrató (hasHydrated) para no pelear con el SSR/hidratación.
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
  }

  // Config viva de la landing (una sola llamada: copy + planes). Solo cuando
  // el host quedó resuelto como landing: en tenant ni se pide.
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
  const heroCopy = group?.hero ?? null;
  const featureItems = group?.features ?? [];
  const pricingNote = group?.pricing_note || LANDING_PRICING_NOTE;
  const contactEmail = group?.contact_email || DEMO_CONTACTS.to;

  useEffect(() => {
    if (byHost === "tenant") window.location.replace("/login");
  }, [byHost]);

  // La landing fija la identidad FRIG (ver docs/tasks landing-login): un
  // tema de tenant persistido en :root por un login previo (misma cookie de
  // dominio) mancha las secciones pixel que usan tokens de tema (var(--card),
  // var(--muted-foreground), …). Se limpia al montar.
  useEffect(() => {
    applyThemeConfig(null);
    document.documentElement.classList.remove("dark");
  }, []);

  // Splash mínima mientras no hay veredicto de host (SSR, primer paint e
  // identificación del tenant): la landing nunca se pinta en dominios
  // by-branch — de haber branding se sale directo a /login.
  if (!mounted || byHost !== "landing") {
    return (
      <div
        className="flex min-h-dvh items-center justify-center"
        style={{ background: "#0b110c" }}
        aria-hidden
      >
        <PixelFoodMark className="h-10 w-10 text-emerald-100/60" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background font-sans">
      <Nav savedUser={savedUser} />
      <main>
        <Hero plans={plans} hero={heroCopy} onPickPlan={setPlan} savedUser={savedUser} entering={entering} onReenter={handleReenter} />
        <Features items={featureItems} />
        <Pricing plans={plans} integrationUf={integrationUf} pricingNote={pricingNote} onPickPlan={setPlan} />
        <UseCases />
        <FinalCta plans={plans} onPickPlan={setPlan} />
      </main>
      {/* Contacto fijo de la marca; el checkout sigue usando el correo del
          grupo configurado en el backend. */}
      <Footer contactEmail={DEMO_CONTACTS.to} />
      <CheckoutModal plan={plan} integrationUf={integrationUf} contactEmail={contactEmail} onClose={() => setPlan(null)} />
    </div>
  );
}
