"use client";

import { useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { LANDING_FEATURES, LANDING_VALUE_PROP } from "@/content/landing";
import { DemoCta } from "@/components/landing/demo-form";
import { PixelFoodMark } from "@/components/landing/pixel-food-mark";
import { PixelField } from "@/components/landing/pixel-field";
import { FlowDiagram } from "@/components/landing/flow-diagram";
import { cn } from "@/lib/utils";

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
  "--frig-text-muted": "#a9c9b8",
  "--frig-accent": "#8dc4a3",
  "--frig-accent-strong": "#a9d8bf",
  "--frig-line": "rgba(141,196,163,0.18)",
};

/** Easing de frames (efecto retro) para el toggle de vistas. */
function stepEase(steps = 6) {
  return (value: number) => Math.round(value * steps) / steps;
}

export function LandingPanel() {
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<"info" | "flow">("info");

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
      }}
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[var(--frig-bg)] px-8 py-6 font-pixel text-[var(--frig-text)] lg:px-12 lg:py-8"
    >
      {/* Fondo pixel-art (capa absoluta, no genera scroll). */}
      <PixelField />

      {/* Toggle INFO / FLUJO (pixel-art, retro). */}
      <div className="relative z-10 mb-5 flex items-center justify-between gap-3">
        <motion.span
          initial={reduceMotion ? false : { opacity: 0, rotate: -8, scale: 0.8 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="text-[var(--frig-accent)]"
        >
          <PixelFoodMark className="h-6 w-6" />
        </motion.span>

        <div
          role="tablist"
          aria-label="Selecciona la vista del panel"
          className="flex overflow-hidden rounded-md border-2 border-[var(--frig-line)] bg-[var(--frig-bg-soft)] p-0.5"
        >
          {(
            [
              { key: "info", label: "INFO" },
              { key: "flow", label: "FLUJO" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={view === tab.key}
              onClick={() => setView(tab.key)}
              className={cn(
                "cursor-pointer px-3 py-1 text-[11px] tracking-[0.14em] transition-colors",
                view === tab.key
                  ? "bg-[var(--frig-accent)] text-[#0f2e1c]"
                  : "text-[var(--frig-text-muted)] hover:text-[var(--frig-text)]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido: nunca scrolleable, altura contenida. */}
      <div className="relative z-10 min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {view === "info" ? (
            <motion.div
              key="info"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -14 }}
              transition={{ duration: 0.28, ease: stepEase(6) }}
              className="flex h-full min-h-0 flex-col justify-center gap-5"
            >
              <motion.header
                variants={container}
                initial="hidden"
                animate="show"
                className="flex flex-col items-center gap-2 text-center"
              >
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
                variants={container}
                initial="hidden"
                animate="show"
                className="flex flex-col items-center gap-4"
              >
                <motion.p
                  variants={item}
                  className="max-w-md text-pretty text-[15px] leading-relaxed text-[var(--frig-text-muted)] text-center"
                >
                  {LANDING_VALUE_PROP.subhead}
                </motion.p>
                <motion.div variants={item} className="shrink-0">
                  <DemoCta />
                </motion.div>
              </motion.div>

              <motion.ul
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 gap-x-6 gap-y-3 overflow-hidden xl:grid-cols-3"
              >
                {LANDING_FEATURES.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <motion.li key={feature.title} className="group flex gap-2">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[var(--frig-bg-soft)]">
                        <Icon
                          className="h-3.5 w-3.5 text-[var(--frig-accent)] transition-transform duration-150 group-hover:-translate-y-0.5"
                          aria-hidden="true"
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold leading-snug">{feature.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[var(--frig-text-muted)]">
                          {feature.description}
                        </p>
                      </div>
                    </motion.li>
                  );
                })}
              </motion.ul>
            </motion.div>
          ) : (
            <motion.div
              key="flow"
              initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.96 }}
              transition={{ duration: 0.28, ease: stepEase(6) }}
              className="flex h-full min-h-0 flex-col items-center justify-center gap-4"
            >
              <p className="text-center text-xs uppercase tracking-[0.18em] text-[var(--frig-text-muted)]">
                Flujo de procesos
              </p>
              <div className="flex w-full max-w-xl flex-1 items-center justify-center overflow-hidden">
                <FlowDiagram />
              </div>
              <p className="max-w-sm text-center text-xs leading-relaxed text-[var(--frig-text-muted)]">
                Desde el ingreso hasta las finanzas, todo vive en la misma
                sucursal y en el mismo sistema.
              </p>
              <button
                type="button"
                onClick={() => setView("info")}
                className="cursor-pointer rounded-md border-2 border-[var(--frig-line)] bg-[var(--frig-bg-soft)] px-3 py-1 text-[11px] tracking-[0.14em] text-[var(--frig-text-muted)] transition-colors hover:text-[var(--frig-text)]"
              >
                ← Volver a la información
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
