"use client";

import type { CSSProperties } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { LANDING_FEATURES, LANDING_VALUE_PROP } from "@/content/landing";
import { DemoCta } from "@/components/landing/demo-form";
import { PixelFoodMark } from "@/components/landing/pixel-food-mark";
import { PixelField } from "@/components/landing/pixel-field";

type FrigScopeStyle = CSSProperties & {
  readonly "--frig-bg": string;
  readonly "--frig-bg-soft": string;
  readonly "--frig-text": string;
  readonly "--frig-text-muted": string;
  readonly "--frig-accent": string;
  readonly "--frig-accent-strong": string;
  readonly "--frig-line": string;
};

const FRIG_SCOPE_VARS: FrigScopeStyle = {
  "--frig-bg": "#0f2e1c",
  "--frig-bg-soft": "#163b24",
  "--frig-text": "#f3f7f4",
  "--frig-text-muted": "#c6d8cf",
  "--frig-accent": "#8dc4a3",
  "--frig-accent-strong": "#a9d8bf",
  "--frig-line": "rgba(141,196,163,0.18)",
};

/** Easing de frames (mismo estilo retro que el login/recuperar clave). */
function stepEase(steps = 6) {
  return (value: number) => Math.round(value * steps) / steps;
}

export function LandingPanel() {
  const reduceMotion = useReducedMotion();

  // Contenedor que anima a los hijos en cascada (aparición armónica).
  const container: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.14,
        delayChildren: reduceMotion ? 0 : 0.15,
      },
    },
  };

  // Cada elemento: entra con slide + fade usando stepEase (retro).
  const item: Variants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: stepEase(6) },
    },
  };

  return (
    <div
      style={FRIG_SCOPE_VARS}
      className="relative flex h-full min-h-0 flex-col justify-center overflow-hidden bg-[var(--frig-bg)] px-8 py-8 font-pixel text-[var(--frig-text)] lg:px-12 lg:py-10"
    >
      {/* Fondo pixel-art suave (capa absoluta, no genera scroll). */}
      <PixelField />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-col gap-6"
      >
        <motion.header variants={item} className="flex flex-col items-center gap-2 text-center">
          <motion.span
            variants={item}
            className="text-[var(--frig-accent)]"
          >
            <PixelFoodMark className="h-7 w-7" />
          </motion.span>
          <motion.span
            variants={item}
            className="font-pixel text-2xl font-semibold tracking-[0.3em] text-[var(--frig-text)]"
          >
            FRIG
          </motion.span>
          <motion.span
            variants={item}
            className="text-xs uppercase tracking-[0.18em] text-[var(--frig-text-muted)]"
          >
            Gestión comercial y gastronómica
          </motion.span>
        </motion.header>

        <motion.div
          variants={item}
          className="flex flex-col items-center justify-center gap-4 text-center"
        >
          <motion.p
            variants={item}
            className="max-w-md text-pretty text-[15px] leading-relaxed text-[var(--frig-text-muted)]"
          >
            {LANDING_VALUE_PROP.subhead}
          </motion.p>
          <motion.div variants={item} className="shrink-0">
            <DemoCta />
          </motion.div>
        </motion.div>

        <motion.ul
          variants={item}
          className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {LANDING_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.li
                key={feature.title}
                variants={item}
                className="group flex gap-2.5"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--frig-bg-soft)]">
                  <Icon
                    className="h-4 w-4 text-[var(--frig-accent)] transition-transform duration-150 group-hover:-translate-y-0.5"
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <p className="text-sm font-semibold leading-snug">{feature.title}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-[var(--frig-text-muted)]">
                    {feature.description}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </motion.ul>
      </motion.div>
    </div>
  );
}
