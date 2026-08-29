"use client";

import type { CSSProperties } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { LANDING_FEATURES, LANDING_VALUE_PROP } from "@/content/landing";
import { DemoCta } from "@/components/landing/demo-form";
import { PixelFoodMark } from "@/components/landing/pixel-food-mark";

type FrigScopeStyle = CSSProperties & {
  readonly "--frig-bg": string;
  readonly "--frig-bg-soft": string;
  readonly "--frig-text": string;
  readonly "--frig-text-muted": string;
  readonly "--frig-accent": string;
  readonly "--frig-accent-strong": string;
  readonly "--frig-line": string;
  readonly "--frig-coin": string;
  readonly "--frig-dough": string;
  readonly "--frig-tomato": string;
  readonly "--frig-coffee": string;
  readonly "--frig-meat": string;
  readonly "--frig-apple": string;
  readonly "--frig-bread": string;
  readonly "--frig-bread-light": string;
};

const FRIG_SCOPE_VARS: FrigScopeStyle = {
  "--frig-bg": "#0f2e1c",
  "--frig-bg-soft": "#163b24",
  "--frig-text": "#f3f7f4",
  "--frig-text-muted": "#a9c9b8",
  "--frig-accent": "#8dc4a3",
  "--frig-accent-strong": "#a9d8bf",
  "--frig-line": "rgba(141,196,163,0.18)",
  "--frig-coin": "#e9bd4a",
  "--frig-dough": "#e8c17a",
  "--frig-tomato": "#d8783d",
  "--frig-coffee": "#8a4f2b",
  "--frig-meat": "#9f442f",
  "--frig-apple": "#c95f4b",
  "--frig-bread": "#d8a45c",
  "--frig-bread-light": "#f1d195",
};

export function LandingPanel() {
  const reduceMotion = useReducedMotion();

  const container: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduceMotion ? 0 : 0.07 },
    },
  };

  const item: Variants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" } },
  };

  return (
    <div
      style={{
        ...FRIG_SCOPE_VARS,
        backgroundImage:
          "radial-gradient(900px 420px at 8% -10%, rgba(141,196,163,0.18), transparent 58%)",
      }}
      className="relative flex h-full flex-col justify-center overflow-hidden bg-[var(--frig-bg)] px-8 py-8 font-pixel text-[var(--frig-text)] lg:px-12 lg:py-10"
    >
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex flex-col gap-6"
      >
        <motion.header variants={item} className="flex flex-col items-center gap-2 text-center">
          <motion.span
            initial={reduceMotion ? false : { opacity: 0, rotate: -8, scale: 0.8 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="text-[var(--frig-accent)]"
          >
            <PixelFoodMark className="h-7 w-7" />
          </motion.span>
          <motion.span
            className="font-pixel text-2xl font-semibold tracking-[0.3em] text-[var(--frig-text)]"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
          >
            FRIG
          </motion.span>
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--frig-text-muted)]">
            Gestión comercial y gastronómica
          </span>
        </motion.header>

        <motion.div variants={item} className="flex flex-col items-center justify-center gap-4 text-center lg:flex-row lg:gap-6">
          <p className="max-w-md text-pretty text-[15px] leading-relaxed text-[var(--frig-text-muted)] lg:text-left">
            {LANDING_VALUE_PROP.subhead}
          </p>
          <div className="shrink-0">
            <DemoCta />
          </div>
        </motion.div>

        <motion.ul
          variants={item}
          className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3 place-content-center"
        >
          {LANDING_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <li key={feature.title} className="group flex gap-3">
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
              </li>
            );
          })}
        </motion.ul>
      </motion.div>
    </div>
  );
}
