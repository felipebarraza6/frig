"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionStore, normalizeDashboardRoute } from "@/lib/store/session";
import { loginComplete, forgotPassword } from "@/lib/api/auth";
import { fetchFrontendConfig } from "@/lib/api/frontend-config";
import { fetchBranchTheme, applyThemeConfig } from "@/lib/api/branches";
import { setToken } from "@/lib/api/session-storage";
import { cn } from "@/lib/utils";
import { LandingPanel } from "@/components/landing/landing-panel";
import { PixelFoodMark } from "@/components/landing/pixel-food-mark";

type FoodKind = "tazon" | "helado" | "cafe" | "tallarines" | "bebida";

const FOOD_ICONS: readonly { label: string; kind: FoodKind }[] = [
  { label: "Tazón", kind: "tazon" },
  { label: "Helado", kind: "helado" },
  { label: "Café", kind: "cafe" },
  { label: "Tallarines", kind: "tallarines" },
  { label: "Bebida", kind: "bebida" },
] as const;

function FoodIcon({ kind }: { kind: FoodKind }) {
  const s = { width: 28, height: 28, imageRendering: "pixelated" } as const;
  switch (kind) {
    case "tazon":
      return (
        <svg viewBox="0 0 16 16" style={s} shapeRendering="crispEdges">
          <path d="M6 1h1v2H6zm4 0h1v2H6zm-3 0h1v1H7z" fill="#a9c9b8" />
          <path d="M2 5h12v2H2z" fill="#1a1d18" />
          <path d="M3 7h10v4H3z" fill="#f7f6f1" stroke="#1a1d18" strokeWidth={0} />
          <path d="M3 7h10v4H3z" fill="#ffffff" />
          <path d="M4 7h8v2H4z" fill="#d8783d" />
          <path d="M5 7h2v2H5zM8 7h2v2H8z" fill="#8a4f2b" opacity=".5" />
          <path d="M2 5h12v2H2z" fill="#1a1d18" />
          <path d="M5 11h6v2H5zM6 13h4v1H6z" fill="#1a1d18" />
        </svg>
      );
    case "helado":
      return (
        <svg viewBox="0 0 16 16" style={s} shapeRendering="crispEdges">
          <path d="M5 2h6v1H5zM4 3h8v1H4zM4 4h8v3H4z" fill="#f1d195" />
          <path d="M5 3h2v1H5z" fill="white" opacity=".6" />
          <path d="M6 7h4v1H6zM5 8h6v1H5zM5 9h6v1H5zM6 10h4v1H6zM6 11h4v1H6zM7 12h2v1H7zM7 13h2v1H7z" fill="#d8a45c" />
          <path d="M6 7h1v6H6z" fill="#b8893a" opacity=".5" />
          <path d="M10 4h1v2h-1z" fill="#e9a84a" opacity=".4" />
        </svg>
      );
    case "cafe":
      return (
        <svg viewBox="0 0 16 16" style={s} shapeRendering="crispEdges">
          <path d="M7 0h1v2H7zm3 1h1v2h-1z" fill="#a9c9b8" opacity=".9" />
          <path d="M3 5h8v1H3z" fill="#1a1d18" />
          <path d="M3 6h8v6H3z" fill="white" />
          <path d="M3 6h8v1H3z" fill="#f7f6f1" />
          <path d="M4 7h6v1H4z" fill="#8a4f2b" />
          <path d="M4 7h6v2H4z" fill="#6b3a1f" opacity=".15" />
          <path d="M11 6h2v6H11z" fill="white" />
          <path d="M12 7h1v4h-1z" fill="#1a1d18" opacity=".08" />
          <path d="M3 12h8v1H3z" fill="#1a1d18" />
          <path d="M4 4h1v1H4z" fill="#a9c9b8" opacity=".5" />
        </svg>
      );
    case "tallarines":
      return (
        <svg viewBox="0 0 16 16" style={s} shapeRendering="crispEdges">
          <path d="M7 0h1v2H7z" fill="#a9c9b8" />
          <path d="M2 5h12v2H2z" fill="#1a1d18" />
          <path d="M3 7h10v4H3z" fill="white" />
          <path d="M4 7h8v1H4z" fill="#e8c17a" />
          <path d="M4 8h8v1H4z" fill="#d8a45c" />
          <path d="M4 9h8v1H4z" fill="#e8c17a" />
          <path d="M5 7h1v3H5zM7 7h1v3H7zM9 7h1v3H9z" fill="#b8893a" opacity=".5" />
          <path d="M6 7h1v1H6zM9 9h1v1H9z" fill="#c95f4b" />
          <path d="M5 11h6v2H5zM6 13h4v1H6z" fill="#1a1d18" />
          <path d="M8 8h2v1H8z" fill="#8dc4a3" />
        </svg>
      );
    case "bebida":
      return (
        <svg viewBox="0 0 16 16" style={s} shapeRendering="crispEdges">
          <path d="M5 2h6v1H5z" fill="#1a1d18" />
          <path d="M4 3h8v1H4z" fill="white" />
          <path d="M4 4h8v8H4z" fill="#8dc4a3" />
          <path d="M4 4h8v2H4z" fill="#bfe7d0" />
          <path d="M5 6h1v4H5z" fill="white" opacity=".55" />
          <path d="M10 1h2v3h-2z" fill="#d8783d" />
          <path d="M11 1h1v4H11z" fill="#1a1d18" opacity=".12" />
          <path d="M4 12h8v1H4z" fill="#1a1d18" />
          <path d="M5 4h6v1H5z" fill="#2f6b3c" opacity=".2" />
        </svg>
      );
  }
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await loginComplete({ email, password });
      setToken(res.token);
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
        router.replace(getHomeRouteForUser(config.user, config.dashboard));
      } else {
        // Múltiples sucursales: guardar datos básicos y dejar que select-branch cargue frontend-config.
        setSession(res.user, res.branches, res.permissions ?? null);
        router.replace("/select-branch");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
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
      <section className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-10 lg:col-start-2 lg:row-start-1 lg:h-dvh lg:overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full max-w-sm font-pixel"
        >
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <div className="mb-2 flex items-center gap-3">
              {FOOD_ICONS.map((icon) => (
                <span key={icon.label} aria-label={icon.label} title={icon.label}>
                  <FoodIcon kind={icon.kind} />
                </span>
              ))}
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <PixelFoodMark className="h-9 w-9" title="FRIG" withEyes animated />
            </div>
            <div>
              <h1 className="font-pixel text-2xl font-semibold tracking-[0.16em]">FRIG</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Gestión comercial y gastronómica
              </p>
            </div>
          </div>

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
                <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" disabled={loading} className="mt-2">
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
        </motion.div>
      </section>

      <aside className="lg:col-start-1 lg:row-start-1 lg:h-dvh lg:overflow-hidden">
        <LandingPanel />
      </aside>
    </div>
  );
}
