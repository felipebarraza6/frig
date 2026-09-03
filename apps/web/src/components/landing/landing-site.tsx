"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink } from "lucide-react";
import {
  LANDING_FEATURES,
  LANDING_PLANS,
  LANDING_PRICING_NOTE,
  LANDING_INTEGRATION_UF,
  LANDING_USE_CASES,
  type LandingPlan,
} from "@/content/landing";
import { PixelFoodBg } from "@/components/landing/pixel-food-bg";
import { PixelCastle } from "@/components/landing/pixel-castle";
import { PixelFoodMark } from "@/components/landing/pixel-food-mark";
import { CheckoutModal } from "@/components/landing/checkout-modal";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Botón chunky estilo juego (sombra dura, sin radios, se hunde al pulsar). */
const PIXEL_BTN =
  "pixel-btn font-pixel tracking-wider";

const CREAM = "#f5efdd";
const GOLD = "#e9bd4a";

function SectionTitle({
  kicker,
  title,
  sub,
  dark = false,
}: {
  kicker: string;
  title: string;
  sub: string;
  dark?: boolean;
}) {
  return (
    <div className="mb-10 max-w-2xl">
      <p
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em]"
        style={{ color: dark ? GOLD : undefined }}
      >
        <span
          className="inline-block h-2 w-2"
          style={{ backgroundColor: dark ? GOLD : "var(--color-primary)" }}
          aria-hidden
        />
        <span className={dark ? undefined : "text-primary"}>{kicker}</span>
      </p>
      <h2
        className={cn(
          "mt-3 font-pixel text-2xl leading-snug tracking-wide sm:text-3xl",
          dark ? "text-white" : "text-foreground",
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          "mt-3 text-sm leading-relaxed sm:text-base",
          dark ? "text-emerald-100/80" : "text-muted-foreground",
        )}
      >
        {sub}
      </p>
    </div>
  );
}

function Nav() {
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
        <nav className="hidden items-center gap-6 font-pixel text-xs tracking-widest text-emerald-100/70 sm:flex">
          <a href="#funciones" className="transition-colors hover:text-white">FUNCIONES</a>
          <a href="#planes" className="transition-colors hover:text-white">PLANES</a>
          <a href="#casos" className="transition-colors hover:text-white">DEMOS</a>
        </nav>
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
      </div>
    </header>
  );
}

function Hero({ onPickPlan }: { onPickPlan: (p: LandingPlan) => void }) {
  return (
    <section className="relative overflow-hidden border-b-2 border-[#241f1a] bg-[#0f2417]">
      <div className="absolute inset-0" aria-hidden>
        <PixelFoodBg />
      </div>
      {/* Bruma nocturna sobre el mosaico */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(900px 420px at 50% -10%, rgba(233,189,74,0.10), transparent 60%), linear-gradient(180deg, rgba(15,36,23,0.55), rgba(15,36,23,0.88))",
        }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
          <span
            className="inline-flex items-center gap-2 border-2 border-[#3d453a] bg-black/40 px-3 py-1 font-pixel text-[10px] tracking-[0.18em] text-emerald-100"
            style={{ boxShadow: "3px 3px 0 0 rgba(0,0,0,0.5)" }}
          >
            <span className="inline-block h-2 w-2" style={{ backgroundColor: GOLD }} aria-hidden />
            PUNTO DE VENTA · COCINA · FINANZAS
          </span>
          <h1
            className="max-w-xl font-pixel text-3xl font-semibold leading-snug tracking-wide sm:text-5xl"
            style={{ color: CREAM, textShadow: "3px 3px 0 rgba(0,0,0,0.5)" }}
          >
            Gestión comercial y gastronómica,{" "}
            <span style={{ color: GOLD }}>todo incluido.</span>
          </h1>
          <p className="max-w-lg text-pretty text-sm leading-relaxed text-emerald-100/85 sm:text-base">
            Una sola app para cobrar, atender mesas, ver la cocina en vivo, llevar tu
            inventario y ordenar tus finanzas.{" "}
            <span className="font-semibold" style={{ color: GOLD }}>
              Desde 1 UF mensual.
            </span>
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className={cn(PIXEL_BTN, "text-emerald-950")}
              style={{ backgroundColor: GOLD }}
              onClick={() => onPickPlan(LANDING_PLANS[0])}
            >
              EMPEZAR POR 1 UF
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
          </div>
          <p className="font-pixel text-[10px] tracking-[0.2em] text-emerald-100/50">
            TODOS LOS MÓDULOS · EN TODOS LOS PLANES · SIEMPRE
          </p>
        </div>

        <PixelCastle className="mx-auto w-full max-w-[320px] sm:max-w-[380px] lg:max-w-none" />
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="funciones" className="scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionTitle
          kicker="Funciones"
          title="Todo lo que tu local necesita, sin pagar módulo por módulo"
          sub="FRIG no es una herramienta más: es el sistema completo. Todo lo que ves abajo viene incluido en cualquier plan."
        />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <li key={feature.title} className="pixel-frame flex gap-3.5 p-4">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center bg-primary/10 text-primary">
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
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Pricing({ onPickPlan }: { onPickPlan: (p: LandingPlan) => void }) {
  return (
    <section
      id="planes"
      className="scroll-mt-16 border-y-2 border-[#241f1a]"
      style={{ backgroundColor: "#17201a" }}
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionTitle
          dark
          kicker="Planes"
          title="Crece con tu negocio, no con tus funciones"
          sub={LANDING_PRICING_NOTE}
        />
        <p className="mb-10 max-w-2xl font-pixel text-[11px] tracking-[0.16em] text-emerald-100/60">
          + {LANDING_INTEGRATION_UF} UF ÚNICA DE INTEGRACIÓN — DEJAMOS TU LOCAL OPERANDO CON SU MARCA
        </p>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5 lg:items-stretch">
          {LANDING_PLANS.map((plan) => (
            <article
              key={plan.id}
              className={cn("pixel-frame flex flex-col p-5")}
              style={
                plan.highlighted
                  ? {
                      borderColor: GOLD,
                      boxShadow: `6px 6px 0 0 rgba(0,0,0,0.45), inset 0 0 0 1px ${GOLD}55`,
                    }
                  : undefined
              }
            >
              {plan.highlighted && (
                <span
                  className="mb-3 inline-flex w-fit items-center px-2 py-0.5 font-pixel text-[10px] tracking-[0.14em] text-[#241f1a]"
                  style={{ backgroundColor: GOLD }}
                >
                  EL MÁS ELEGIDO
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
    <section id="casos" className="scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionTitle
          kicker="Casos de uso"
          title="FRIG se adapta a tu rubro — con tu marca"
          sub="Estas demos ya están operativas. Entra a cualquiera y mira el sistema funcionando con el logo y color de cada negocio."
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_USE_CASES.map((useCase) => (
            <Link
              key={useCase.slug}
              href={`/login/${useCase.slug}`}
              className="pixel-frame group flex flex-col gap-3 p-5 transition-transform hover:-translate-y-1"
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
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ onPickPlan }: { onPickPlan: (p: LandingPlan) => void }) {
  return (
    <section className="border-t-2 border-[#241f1a]" style={{ backgroundColor: "#0f2417" }}>
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6 sm:py-20">
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
          onClick={() => onPickPlan(LANDING_PLANS[0])}
        >
          EMPEZAR POR 1 UF
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t-2 border-[#241f1a] bg-[#14160f]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 font-pixel text-[10px] tracking-[0.18em] text-emerald-100/50 sm:flex-row sm:px-6">
        <span className="flex items-center gap-2">
          <PixelFoodMark className="h-4 w-4" />
          FRIG — GESTIÓN COMERCIAL Y GASTRONÓMICA
        </span>
        <span>
          CONTACTO:{" "}
          <a href="mailto:frig@yggdra.cl" className="text-emerald-100 hover:text-white">
            frig@yggdra.cl
          </a>
        </span>
      </div>
    </footer>
  );
}

/**
 * Sitio público de FRIG en `/`. Estilo juego medieval pixel-art: fondos en
 * mosaico oscuro, castillo en bitmap, marcos chunky con sombra dura y
 * tipografía pixel en los títulos. El login queda en /login.
 */
export function LandingSite() {
  const [plan, setPlan] = useState<LandingPlan | null>(null);

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background font-sans">
      <Nav />
      <main>
        <Hero onPickPlan={setPlan} />
        <Features />
        <Pricing onPickPlan={setPlan} />
        <UseCases />
        <FinalCta onPickPlan={setPlan} />
      </main>
      <Footer />
      <CheckoutModal plan={plan} onClose={() => setPlan(null)} />
    </div>
  );
}
