"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionStore, normalizeDashboardRoute } from "@/lib/store/session";
import { loginComplete, forgotPassword, setInitialPassword } from "@/lib/api/auth";
import { fetchMagicLogin } from "@/lib/api/checkout";
import { fetchFrontendConfig } from "@/lib/api/frontend-config";
import {
  fetchBranchTheme,
  fetchPublicLoginTheme,
  fetchPublicLoginThemeByHost,
  applyThemeConfig,
} from "@/lib/api/branches";
import type { BranchThemeConfig } from "@/lib/types";
import { setToken } from "@/lib/api/session-storage";
import { pickDefaultBranchId } from "@/lib/branch-session";
import { cn } from "@/lib/utils";
import { FRIG_IDENTITY_STYLE, FRIG_REPO_URL } from "@/lib/frig-identity";
import { FrigWordmarkMatrix } from "@/components/landing/frig-wordmark-matrix";
import { HeroPlexus } from "@/components/landing/hero-plexus";
import { BrandLogo } from "@/components/brand-logo";
import { LANDING_USE_CASES } from "@/content/landing";
import type { LandingUseCase } from "@/content/landing";
import type { LoginCompleteResponse } from "@/lib/types";
import { Clock, Copy, KeyRound } from "lucide-react";


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
  if (user.is_superuser || user.type_user === "ADM") return "/organization";
  const assignments = user.branch_assignments ?? [];
  const firstRole = assignments[0]?.role_code?.trim().toUpperCase();
  if (firstRole === "OWNER") return "/dashboard";
  if (firstRole === "ADMIN_LOCAL") return "/pos";
  if (firstRole === "CAJERO") return "/pos/terminal";
  if (firstRole === "WAITER") return "/pos/terminal";
  return "/dashboard";
}

/* Transición de entrada: el wordmark atraviesa un portal antes de navegar. */
function DimensionExit({ brandName }: { brandName: string | null }) {
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0a0a0a]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/3"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 115%, rgba(240,162,106,0.5) 0%, rgba(240,162,106,0.14) 45%, transparent 70%)",
        }}
      />
      <div className="relative flex flex-col items-center gap-8">
        {!brandName && (
          <img
            src="/brand/frig-symbol.png"
            alt=""
            className="h-16 w-auto"
            style={{ filter: "drop-shadow(0 0 16px rgba(238,158,112,0.5))" }}
          />
        )}
        <img
          src="/brand/frig-wordmark.png"
          alt="Frig"
          className="frig-dimension-loop relative h-16 w-auto sm:h-24"
        />
        <p className="text-sm text-zinc-400">Entrando…</p>
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const setOwnedOrganizations = useSessionStore((s) => s.setOwnedOrganizations);
  const setFrontendConfig = useSessionStore((s) => s.setFrontendConfig);
  const setTheme = useSessionStore((s) => s.setTheme);

  const [mode, setMode] = useState<"login" | "forgot" | "set_password">("login");
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

  // El fondo participa en cada cambio de modo: los nodos hacen una ola
  // que cubre la pantalla y decae revelando el nuevo formulario.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("frig:matrix-sweep"));
  }, [mode, forgotSent]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setPasswordError, setSetPasswordError] = useState<string | null>(null);
  const [setPasswordLoading, setSetPasswordLoading] = useState(false);
  const [magicLoginResult, setMagicLoginResult] = useState<LoginCompleteResponse | null>(null);

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
      let theme = slug
        ? await fetchPublicLoginTheme(slug)
        : await fetchPublicLoginThemeByHost();
      // El branding del PROPIO Frig (frig.yggdra.cl, slug "frig") se trata
      // como identidad Frig: logo de cuadritos + cobre, nunca como tenant.
      const isFrigBranding =
        !!theme && (theme.app_name ?? "").toLowerCase().includes("frig");
      if (isFrigBranding) theme = null;
      if (cancelled) return;
      if (theme) {
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
      }
      // Título del documento con la marca resuelta (tenant o Frig).
      const name = isFrigBranding ? "FRIG" : theme?.app_name ?? "FRIG";
      document.title = `${name} — Iniciar sesión`;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pulso de energía al intentar ingresar: la fogata responde.
  const [pulse, setPulse] = useState(false);
  function firePulse() {
    setPulse(true);
    window.setTimeout(() => setPulse(false), 750);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    firePulse();
    try {
      const res = await loginComplete({ email, password });
      await completeLogin(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
      setErrorKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Flujo común tras obtener un payload de sesión (login con clave o canje
   * del magic-link de contratación): persistir token, cargar config/tema de
   * la sucursal y navegar al home que corresponda al rol.
   */
  const completeLogin = useCallback(
    async (res: LoginCompleteResponse) => {
      setToken(res.token);
      // Organizaciones que el usuario posee: alimentan el guard de /organization.
      setOwnedOrganizations(res.owned_organizations ?? null);
      // Sesión demo: guardar expiración (1h) para avisos/cuenta regresiva.
      if (res.demo_expires_at) {
        window.localStorage.setItem("frig.demo_expires_at", res.demo_expires_at);
      } else {
        window.localStorage.removeItem("frig.demo_expires_at");
      }
      // Activa la sucursal por defecto (o la única) y entra directo: el cambio
      // de sucursal dentro de la app lo hace el switcher del sidebar.
      const target = pickDefaultBranchId(res.user, res.branches);
      if (target) {
        try {
          const config = await fetchFrontendConfig(Number(target));
          setFrontendConfig(config, target);
          // Super admin: black puro, sin tema de ninguna sucursal/org.
          if (!(res.user.is_superuser || res.user.type_user === "ADM")) {
            try {
              const branchTheme = await fetchBranchTheme(target);
              if (branchTheme) {
                setTheme(branchTheme);
                applyThemeConfig(branchTheme);
              }
            } catch {
              // tema no crítico
            }
          }
          celebrateThen(() =>
            router.replace(getHomeRouteForUser(config.user, config.dashboard)),
          );
          return;
        } catch {
          // Falló frontend-config: el layout reactivará la sucursal por defecto.
        }
      }
      setSession(res.user, res.branches, res.permissions ?? null);
      celebrateThen(() => router.replace("/dashboard"));
    },
    [router, setFrontendConfig, setSession, setOwnedOrganizations, setTheme],
  );

  // Canje del magic-link de contratación: /login/<slug>?token=… llega aquí
  // como ?branch=<slug>&token=<token>. Si el canje falla (expirado/inválido)
  // se muestra el error y queda disponible el login normal con clave.
  const [magicToken] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("token"),
  );

  useEffect(() => {
    if (!magicToken) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchMagicLogin(magicToken);
        if (cancelled) return;
        if (res.must_set_password) {
          setMagicLoginResult(res);
          setMode("set_password");
        } else {
          await completeLogin(res);
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Enlace inválido o expirado.",
        );
        setErrorKey((k) => k + 1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [magicToken, completeLogin]);

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

  async function handleSetPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setSetPasswordError(null);
    if (newPassword.length < 8) {
      setSetPasswordError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setSetPasswordError("Las contraseñas no coinciden.");
      return;
    }
    setSetPasswordLoading(true);
    try {
      await setInitialPassword({ new_password: newPassword, confirm_password: confirmPassword });
      if (magicLoginResult) {
        await completeLogin(magicLoginResult);
      }
    } catch (err) {
      setSetPasswordError(
        err instanceof Error ? err.message : "No se pudo definir la contraseña.",
      );
    } finally {
      setSetPasswordLoading(false);
    }
  }

  // Identidad Frig SOLO sin tenant: con branding de sucursal la paleta la
  // deriva applyThemeConfig desde su primary (lo que eligió es lo que ve).
  const isFrigIdentity = !brandTheme;
  const darkSection = isFrigIdentity || brandTheme?.algorithm === "dark";

  return (
    <div
      className={cn("relative flex min-h-dvh flex-1 flex-col", isFrigIdentity ? "bg-[#0a0a0a]" : "bg-background text-foreground")}
      style={isFrigIdentity ? FRIG_IDENTITY_STYLE : undefined}
    >
      {/* Fondo único de identidad: horizonte cálido + red que reacciona al mouse */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 115%, rgba(240,162,106,0.16), transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-70"
          style={{
            maskImage:
              "radial-gradient(140% 140% at 50% 50%, black 55%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(140% 140% at 50% 50%, black 55%, transparent 100%)",
          }}
        >
          <HeroPlexus className="h-full w-full" />
        </div>
      </div>
      <section
        style={isFrigIdentity ? { "--input": "#27272a", "--border": "#27272a", "--muted": "#1c1c1f", "--muted-foreground": "#a1a1aa", "--accent": "#1c1c1f", "--background": "#0a0a0a", "--card": "#141414" } as React.CSSProperties : undefined}
        className={cn(
          "relative flex min-h-dvh flex-1 flex-col items-center justify-center px-4 py-10",
          darkSection ? "dark text-white" : "text-foreground",
        )}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative flex w-full max-w-sm flex-col overflow-hidden px-1 font-sans lg:min-h-[600px] lg:justify-center"
        >
          {/* Fade marcado entre modos: el contenido se desvanece con blur
              mientras la ola de nodos cubre el fondo y trae el siguiente. */}
          <AnimatePresence mode="wait">
          <motion.div
            key={`${mode}-${forgotSent}`}
            initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(8px)", transition: { duration: 0.25, ease: "easeIn" } }}
            // El contenido ESPERA a que la ola de nodos cubra todo (0.45s)
            // y recién emerge: primero el fondo, después el formulario.
            transition={{ duration: 0.65, delay: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
            className="flex w-full flex-col"
            style={{ textShadow: "0 2px 18px rgba(0,0,0,0.75)" }}
          >
          {/* El wordmark de la marca presidiendo el formulario */}
          {/* Marca que preside el formulario: la del tenant si hay branding
              por host/slug; si no, el wordmark animado de Frig. */}
          {brandTheme ? (
            <div className="mb-8 flex flex-col items-center gap-3 text-center">
              <BrandLogo
                src={brandTheme.logo}
                alt={brandTheme.app_name ?? "Logo"}
                name={brandTheme.app_name}
                containerClassName="h-14 w-14 rounded-xl"
                className="h-14 w-14 rounded-xl object-contain"
              />
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight">
                  {brandTheme.login_welcome_message ?? brandTheme.app_name ?? "Bienvenido"}
                </h1>
                {brandTheme.tagline && (
                  <p className="mt-1 text-sm text-muted-foreground">{brandTheme.tagline}</p>
                )}
              </div>
            </div>
          ) : (
            <FrigWordmarkMatrix className="mb-8 h-12 w-auto self-center" />
          )}
          {demoCase && mode === "login" && (
            <div
              className="mb-6 rounded-lg border-2 bg-card/60 p-3"
              style={{ borderColor: demoCase.brandColor }}
            >
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
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
                    className="flex cursor-pointer items-center justify-between gap-2 rounded border border-border bg-background/80 px-2 py-1.5 text-left font-sans text-xs transition-colors hover:border-foreground/40"
                  >
                    <span className="truncate">
                      <span className="text-muted-foreground">{item.label}: </span>
                      <span className="font-medium">{item.value}</span>
                    </span>
                    {copied === item.kind ? (
                      <span className="shrink-0 text-[10px] text-[#c67d52]">¡Copiado!</span>
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

          {mode === "set_password" ? (
            <form onSubmit={handleSetPasswordSubmit} className="flex flex-col gap-4">
              <div className="rounded-lg bg-primary/10 px-3 py-3 text-sm text-primary">
                <p className="font-medium">Define tu contraseña</p>
                <p className="mt-1 opacity-90">
                  Es tu primer ingreso. Crea una contraseña para acceder a tu cuenta.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="new_password" className="text-sm font-medium">
                  Nueva contraseña
                </label>
                <Input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <p className="text-xs text-muted-foreground">
                  Mínimo 8 caracteres.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="confirm_password" className="text-sm font-medium">
                  Confirmar contraseña
                </label>
                <Input
                  id="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              {setPasswordError && (
                <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                  {setPasswordError}
                </p>
              )}
              <Button type="submit" size="lg" disabled={setPasswordLoading} className="btn-copper mt-2 rounded-lg text-white">
                {setPasswordLoading ? "Guardando…" : "Definir contraseña"}
              </Button>
            </form>
          ) : mode === "forgot" ? (
            forgotSent ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg bg-white/[0.04] px-3 py-3 text-sm text-zinc-200">
                  <p className="font-medium">Revisa tu correo</p>
                  <p className="mt-1 opacity-90">
                    Si el email existe en nuestro sistema, recibirás un enlace
                    para recuperar tu contraseña (válido por 24 horas).
                  </p>
                </div>
                <Button type="button" size="lg" className="btn-copper mt-2 rounded-lg text-white" onClick={backToLogin}>
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

                <Button type="submit" size="lg" disabled={forgotLoading} className="btn-copper mt-2 rounded-lg text-white">
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

              <Button
                type="submit"
                size="lg"
                disabled={loading}
                onClick={firePulse}
                className="btn-copper mt-2 rounded-lg text-white active:scale-[0.97] transition-transform"
              >
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

          {/* Atribución: el login del tenant solo menciona sutilmente a Frig. */}
          {brandTheme ? (
            <p className="mt-8 text-center text-xs text-muted-foreground">
              by{" "}
              <a
                href={FRIG_REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                FRIG
              </a>
            </p>
          ) : (
            <p className={cn("mt-8 text-center text-xs text-muted-foreground")}>
              Gestión comercial y gastronómica por FRIG
            </p>
          )}
          </motion.div>
          </AnimatePresence>
        </motion.div>

        {success && (
          <DimensionExit brandName={brandTheme?.app_name ?? null} />
        )}
      </section>

      {/* Pulso de energía al ingresar */}
      <AnimatePresence>
        {pulse && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-50"
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            style={{
              background:
                "radial-gradient(120% 120% at 50% 100%, rgba(240,162,106,0.4), transparent 60%)",
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
