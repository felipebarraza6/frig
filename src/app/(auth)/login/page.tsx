"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionStore, normalizeDashboardRoute } from "@/lib/store/session";
import { loginComplete, forgotPassword } from "@/lib/api/auth";
import { fetchFrontendConfig } from "@/lib/api/frontend-config";
import {
  fetchBranchTheme,
  fetchPublicLoginTheme,
  fetchPublicLoginThemeByHost,
  applyThemeConfig,
} from "@/lib/api/branches";
import type { BranchThemeConfig } from "@/lib/types";
import { setToken } from "@/lib/api/session-storage";
import { cn } from "@/lib/utils";
import { LandingPanel } from "@/components/landing/landing-panel";
import { PixelFoodMark } from "@/components/landing/pixel-food-mark";
import { BrandLogo } from "@/components/brand-logo";
import { LANDING_USE_CASES, LANDING_VALUE_PROP } from "@/content/landing";
import type { LandingUseCase } from "@/content/landing";
import { Clock, Copy, KeyRound } from "lucide-react";
import { FOOD_ICONS, FoodIcon } from "@/components/auth/pixel-food-icons";
import { PixelLoginBg } from "@/components/auth/pixel-login-bg";
import { PixelLoginSuccess } from "@/components/auth/pixel-login-success";

/** Easing de "frames" (efecto retro): arranca en 6 pasos discretos. */
function stepEase(steps = 6) {
  return (value: number) => Math.round(value * steps) / steps;
}


function getHomeRouteForUser(
  user: {
    is_superuser?: boolean;
    type_user?: string;
    branch_assignments?: { branch_id?: string | number; role_code?: string }[];
  } | null,
  dashboard?: string | null,
): string {
  const home = normalizeDashboardRoute(dashboard);
  if (home) return home;
  if (!user) return "/dashboard";
  if (user.is_superuser || user.type_user === "ADM") return "/dashboard";
  const assignments = user.branch_assignments ?? [];
  const firstRole = assignments[0]?.role_code?.trim().toUpperCase();
  if (firstRole === "OWNER") return "/dashboard";
  if (firstRole === "ADMIN_LOCAL") return "/pos";
  if (firstRole === "CAJERO") return "/pos/terminal";
  if (firstRole === "WAITER") return "/pos/terminal";
  return "/dashboard";
}

export default function LoginPage() {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const setFrontendConfig = useSessionStore((s) => s.setFrontendConfig);
  const setTheme = useSessionStore((s) => s.setTheme);

  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    // Aviso persistido por client.ts cuando una sesión expira (p. ej. demo).
    const notice = window.sessionStorage.getItem("frig.auth_notice");
    if (notice) window.sessionStorage.removeItem("frig.auth_notice");
    return notice;
  });
  const [loading, setLoading] = useState(false);
  // Animación de éxito (estrella pixel + monedas) antes de navegar.
  const [success, setSuccess] = useState(false);
  // Remonta el mensaje de error para re-disparar el shake en cada intento.
  const [errorKey, setErrorKey] = useState(0);

  function celebrateThen(callback: () => void) {
    setSuccess(true);
    window.setTimeout(callback, 1150);
  }

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Login personalizado por sucursal: branding público según el dominio
  // (by-host) o según ?branch=<slug>. Sin branding (p. ej. localhost) se
  // mantiene la marca FRIG por defecto.
  const [brandTheme, setBrandTheme] = useState<BranchThemeConfig | null>(null);
  // Demo activa según ?branch=<slug>: muestra credenciales de acceso y aviso de 1 hora.
  // Se calcula una sola vez (lazy init) — no necesita effect.
  const [demoCase] = useState<LandingUseCase | null>(() => {
    if (typeof window === "undefined") return null;
    const slug = new URLSearchParams(window.location.search).get("branch");
    return LANDING_USE_CASES.find((u) => u.slug === slug) ?? null;
  });
  const [copied, setCopied] = useState<string | null>(null);

  async function copyCredential(kind: "user" | "password", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard no disponible: el texto igual es seleccionable
    }
  }

  function useDemoCredentials() {
    if (!demoCase) return;
    setEmail(demoCase.demoUser);
    setPassword(demoCase.demoPassword);
    setError(null);
  }
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const slug = new URLSearchParams(window.location.search).get("branch");
      const theme = slug
        ? await fetchPublicLoginTheme(slug)
        : await fetchPublicLoginThemeByHost();
      if (cancelled || !theme) return;
      setBrandTheme(theme);
      applyThemeConfig(theme);
      if (theme.favicon) {
        let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.head.appendChild(link);
        }
        link.href = theme.favicon;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await loginComplete({ email, password });
      setToken(res.token);
      // Sesión demo: guardar expiración (1h) para avisos/cuenta regresiva.
      if (res.demo_expires_at) {
        window.localStorage.setItem("frig.demo_expires_at", res.demo_expires_at);
      } else {
        window.localStorage.removeItem("frig.demo_expires_at");
      }
      if (res.branches.length === 1) {
        const branchId = Number(res.branches[0].branch_id);
        const config = await fetchFrontendConfig(branchId);
        setFrontendConfig(config, String(branchId));
        try {
          const branchTheme = await fetchBranchTheme(String(branchId));
          if (branchTheme) {
            setTheme(branchTheme);
            applyThemeConfig(branchTheme);
          }
        } catch {
          // tema no crítico
        }
        celebrateThen(() =>
          router.replace(getHomeRouteForUser(config.user, config.dashboard)),
        );
      } else {
        // Múltiples sucursales: guardar datos básicos y dejar que select-branch cargue frontend-config.
        setSession(res.user, res.branches, res.permissions ?? null);
        celebrateThen(() => router.replace("/select-branch"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
      setErrorKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);
    try {
      // Respuesta genérica del backend (anti-enumeración): el mensaje es el
      // mismo exista o no el email.
      await forgotPassword({ email: forgotEmail });
      setForgotSent(true);
    } catch (err) {
      setForgotError(
        err instanceof Error ? err.message : "No se pudo enviar la solicitud.",
      );
    } finally {
      setForgotLoading(false);
    }
  }

  function backToLogin() {
    setMode("login");
    setForgotSent(false);
    setForgotError(null);
    setForgotEmail("");
    setError(null);
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)] lg:overflow-hidden">
      <section className="relative flex flex-1 flex-col items-center justify-center bg-background px-4 py-10 lg:col-start-2 lg:row-start-1 lg:h-dvh lg:overflow-hidden">
        <PixelLoginBg />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative flex w-full max-w-sm flex-col overflow-hidden px-1 font-pixel lg:h-[600px] lg:justify-center"
        >
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            {!brandTheme && (
              <div className="mb-2 flex items-center gap-3">
                {FOOD_ICONS.map((icon) => (
                  <span key={icon.label} aria-label={icon.label} title={icon.label}>
                    <FoodIcon kind={icon.kind} />
                  </span>
                ))}
              </div>
            )}
            {brandTheme?.logo ? (
              <BrandLogo
                src={brandTheme.logo}
                alt={brandTheme.app_name ?? "Logo"}
                name={brandTheme.app_name}
                containerClassName="h-16 w-16 rounded-xl shadow-sm"
                className="max-h-14 max-w-14 p-1.5"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <PixelFoodMark className="h-9 w-9" title="FRIG" withEyes animated />
              </div>
            )}
            <div>
              <h1
                className={cn(
                  "text-2xl font-semibold",
                  !brandTheme && "font-pixel tracking-[0.16em]",
                )}
              >
                {brandTheme?.app_name ?? "FRIG"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {brandTheme?.login_welcome_message ||
                  brandTheme?.tagline ||
                  LANDING_VALUE_PROP.headline}
              </p>
            </div>
          </div>

          {demoCase && mode === "login" && (
            <div
              className="mb-6 rounded-lg border-2 bg-card/60 p-3"
              style={{ borderColor: demoCase.brandColor }}
            >
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" style={{ color: demoCase.brandColor }} />
                Acceso demo — {demoCase.name}
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {(
                  [
                    { kind: "user" as const, label: "Usuario", value: demoCase.demoUser },
                    { kind: "password" as const, label: "Clave", value: demoCase.demoPassword },
                  ]
                ).map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    onClick={() => copyCredential(item.kind, item.value)}
                    title="Clic para copiar"
                    className="flex cursor-pointer items-center justify-between gap-2 rounded border border-border bg-background/80 px-2 py-1.5 text-left font-pixel text-xs transition-colors hover:border-foreground/40"
                  >
                    <span className="truncate">
                      <span className="text-muted-foreground">{item.label}: </span>
                      <span className="font-medium">{item.value}</span>
                    </span>
                    {copied === item.kind ? (
                      <span className="shrink-0 text-[10px] text-emerald-600">¡Copiado!</span>
                    ) : (
                      <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={useDemoCredentials}
                className="mt-2 w-full cursor-pointer rounded border border-dashed px-2 py-1.5 text-xs font-medium transition-colors hover:bg-foreground/5"
                style={{ borderColor: demoCase.brandColor, color: demoCase.brandColor }}
              >
                Usar estas credenciales
              </button>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                La sesión demo dura 1 hora. Juega, prueba y revienta el sistema.
              </p>
            </div>
          )}

          {mode === "forgot" ? (
            forgotSent ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg bg-emerald-500/10 px-3 py-3 text-sm text-emerald-700">
                  <p className="font-medium">Revisa tu correo</p>
                  <p className="mt-1 opacity-90">
                    Si el email existe en nuestro sistema, recibirás un enlace
                    para recuperar tu contraseña (válido por 24 horas).
                  </p>
                </div>
                <Button type="button" size="lg" className="mt-2" onClick={backToLogin}>
                  Volver al inicio de sesión
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="forgot-email" className="text-sm font-medium">
                    Correo
                  </label>
                  <Input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="tu@negocio.cl"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ingresa el correo con el que ingresas a FRIG.
                  </p>
                </div>

                {forgotError && (
                  <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                    {forgotError}
                  </p>
                )}

                <Button type="submit" size="lg" disabled={forgotLoading} className="mt-2">
                  {forgotLoading ? "Enviando…" : "Enviar correo de recuperación"}
                </Button>

                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={backToLogin}
                    className="cursor-pointer text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  >
                    Volver al inicio de sesión
                  </button>
                </div>
              </form>
            )
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Correo
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@negocio.cl"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Contraseña
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p
                  key={errorKey}
                  className="login-shake rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" disabled={loading} className="mt-2 active:scale-[0.97] transition-transform">
                {loading ? "Ingresando…" : "Ingresar"}
              </Button>

              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError(null);
                  }}
                  className="cursor-pointer text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  ¿Olvidaste tu contraseña? Recupérala aquí
                </button>
              </div>
            </form>
          )}

          <p className={cn("mt-8 text-center text-xs text-muted-foreground")}>
            Gestión comercial y gastronómica por FRIG
          </p>

          {/* Cortina retro pixel: base oscura + cuadrícula de bloques (checkerboard) + degradado derecho.
              La cuadrícula con separación visible evita el rectángulo liso: siempre se leen cuadros. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
            {/* Base oscura: oculta el contenido y da las "líneas" entre cuadros. */}
            <motion.div
              key={`curtain-cover-${mode}-${forgotSent}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.9, times: [0, 0.15, 0.85, 1], ease: "easeOut" }}
              className="absolute inset-0"
              style={{ backgroundColor: "color-mix(in srgb, var(--color-primary) 30%, #0b3b22)" }}
            />

            {/* Cuadrícula de bloques pixel con separación, aparece en cascada. */}
            <div className="absolute inset-0 grid grid-cols-6 grid-rows-5 gap-1 p-1">
              {Array.from({ length: 30 }).map((_, i) => (
                <motion.span
                  key={`curtain-${mode}-${forgotSent}-${i}`}
                  initial={{ scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: [0, 1, 1, 0], opacity: [0, 1, 1, 0] }}
                  transition={{
                    duration: 0.9,
                    times: [0, 0.25, 0.85, 1],
                    delay: (i % 6) * 0.03 + Math.floor(i / 6) * 0.04,
                    ease: stepEase(6),
                  }}
                  className="h-full w-full"
                  style={{
                    backgroundColor:
                      i % 2 === 0 ? "var(--color-primary)" : "color-mix(in srgb, var(--color-primary) 70%, #0b3b22)",
                  }}
                />
              ))}
            </div>

            {/* Degradado en el borde derecho (efecto scan, bien visible). */}
            <motion.div
              key={`curtain-degrade-${mode}-${forgotSent}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ duration: 0.9, times: [0, 0.25, 0.85, 1], ease: "easeOut" }}
              className="absolute inset-y-0 right-0 w-1/3"
              style={{
                background:
                  "linear-gradient(to left, #06230f 0%, color-mix(in srgb, var(--color-primary) 45%, #0b3b22) 45%, transparent 100%)",
                boxShadow: "inset -6px 0 0 rgba(0,0,0,0.25)",
              }}
            />
          </div>
        </motion.div>

        {success && (
          <PixelLoginSuccess brandName={brandTheme?.app_name ?? null} />
        )}
      </section>

      <aside className="hidden lg:col-start-1 lg:row-start-1 lg:block lg:h-dvh lg:overflow-hidden">
        <LandingPanel
          brand={
            brandTheme
              ? { name: brandTheme.app_name ?? "FRIG", logo: brandTheme.logo }
              : null
          }
        />
      </aside>
    </div>
  );
}
