"use client";

/**
 * Fondo pixel-art vivo para la pantalla de login.
 *
 * Capas (todas CSS, cero JS por frame):
 * - Cielo con gradiente que respira (login-sky).
 * - Estrellas pixel que titilan (login-twinkle).
 * - Sprites de comida flotando en los bordes (login-float).
 * - Vapor subiendo desde el suelo (login-steam).
 * - Suelo tipo checkerboard en el borde inferior.
 *
 * Respeta prefers-reduced-motion (vía clases en globals.css y useReducedMotion).
 */

import { useReducedMotion } from "framer-motion";
import { FoodIcon, type FoodKind } from "./pixel-food-icons";

type FloatSprite = {
  readonly id: string;
  readonly kind: FoodKind;
  readonly left: string;
  readonly top: string;
  readonly size: number;
  readonly duration: string;
  readonly delay: string;
  readonly opacity: number;
};

const FLOAT_SPRITES: FloatSprite[] = [
  { id: "f1", kind: "tazon", left: "6%", top: "12%", size: 34, duration: "7s", delay: "0s", opacity: 0.4 },
  { id: "f2", kind: "helado", left: "86%", top: "18%", size: 30, duration: "8s", delay: "1.1s", opacity: 0.35 },
  { id: "f3", kind: "cafe", left: "10%", top: "62%", size: 30, duration: "9s", delay: "0.6s", opacity: 0.32 },
  { id: "f4", kind: "tallarines", left: "84%", top: "70%", size: 32, duration: "7.5s", delay: "2s", opacity: 0.3 },
  { id: "f5", kind: "bebida", left: "14%", top: "86%", size: 28, duration: "8.5s", delay: "1.6s", opacity: 0.28 },
  { id: "f6", kind: "helado", left: "80%", top: "88%", size: 26, duration: "10s", delay: "0.3s", opacity: 0.24 },
];

type Star = {
  readonly id: string;
  readonly left: string;
  readonly top: string;
  readonly size: number;
  readonly delay: string;
  readonly duration: string;
};

const STARS: Star[] = [
  { id: "s1", left: "22%", top: "6%", size: 3, delay: "0s", duration: "3.2s" },
  { id: "s2", left: "46%", top: "10%", size: 2, delay: "0.7s", duration: "2.6s" },
  { id: "s3", left: "68%", top: "5%", size: 3, delay: "1.3s", duration: "3.8s" },
  { id: "s4", left: "92%", top: "42%", size: 2, delay: "0.4s", duration: "2.9s" },
  { id: "s5", left: "3%", top: "38%", size: 2, delay: "1.8s", duration: "3.4s" },
  { id: "s6", left: "30%", top: "48%", size: 2, delay: "2.2s", duration: "3s" },
  { id: "s7", left: "60%", top: "56%", size: 3, delay: "1s", duration: "4s" },
  { id: "s8", left: "38%", top: "82%", size: 2, delay: "0.2s", duration: "2.7s" },
  { id: "s9", left: "55%", top: "90%", size: 2, delay: "1.5s", duration: "3.6s" },
  { id: "s10", left: "94%", top: "60%", size: 2, delay: "2.6s", duration: "3.1s" },
];

type SteamPuff = {
  readonly id: string;
  readonly left: string;
  readonly delay: string;
  readonly duration: string;
};

const STEAM_PUFFS: SteamPuff[] = [
  { id: "p1", left: "18%", delay: "0s", duration: "5s" },
  { id: "p2", left: "45%", delay: "1.7s", duration: "6s" },
  { id: "p3", left: "72%", delay: "0.9s", duration: "5.4s" },
  { id: "p4", left: "90%", delay: "2.4s", duration: "6.5s" },
];

export function PixelLoginBg() {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Cielo: gradiente suave que respira desde el primary. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(140deg, color-mix(in srgb, var(--color-primary) 7%, transparent) 0%, transparent 45%, color-mix(in srgb, var(--color-primary) 12%, transparent) 100%)",
          backgroundSize: "200% 200%",
          animation: reduceMotion ? undefined : "login-sky 18s ease-in-out infinite",
        }}
      />

      {/* Estrellas pixel titilantes. */}
      {STARS.map((star) => (
        <span
          key={star.id}
          className={reduceMotion ? "absolute" : "login-twinkle absolute"}
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            backgroundColor: "var(--color-primary)",
            opacity: 0.35,
            animationDelay: star.delay,
            animationDuration: star.duration,
          }}
        />
      ))}

      {/* Sprites de comida flotando en los bordes (lejos del formulario). */}
      {FLOAT_SPRITES.map((sprite) => (
        <span
          key={sprite.id}
          className={reduceMotion ? "absolute" : "login-float absolute"}
          style={{
            left: sprite.left,
            top: sprite.top,
            opacity: sprite.opacity,
            animationDelay: sprite.delay,
            animationDuration: sprite.duration,
          }}
        >
          <FoodIcon kind={sprite.kind} size={sprite.size} />
        </span>
      ))}

      {/* Vapor subiendo desde el suelo. */}
      {STEAM_PUFFS.map((puff) => (
        <span
          key={puff.id}
          className={reduceMotion ? "absolute" : "login-steam-anim absolute"}
          style={{
            left: puff.left,
            bottom: "26px",
            width: 10,
            height: 6,
            backgroundColor: "var(--color-primary)",
            opacity: 0,
            animationDelay: puff.delay,
            animationDuration: puff.duration,
          }}
        />
      ))}

      {/* Suelo: checkerboard pixel en el borde inferior. */}
      <div
        className="absolute inset-x-0 bottom-0 h-6"
        style={{
          backgroundImage:
            "repeating-conic-gradient(color-mix(in srgb, var(--color-primary) 38%, transparent) 0% 25%, transparent 0% 50%)",
          backgroundSize: "16px 16px",
          opacity: 0.45,
          maskImage: "linear-gradient(to top, black 30%, transparent 100%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-6 h-px"
        style={{ backgroundColor: "color-mix(in srgb, var(--color-primary) 30%, transparent)" }}
      />
    </div>
  );
}
