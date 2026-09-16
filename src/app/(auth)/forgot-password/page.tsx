"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPassword } from "@/lib/api/auth";
import { fetchPublicLoginThemeByHost, applyThemeConfig } from "@/lib/api/branches";
import { BrandLogo } from "@/components/brand-logo";
import { FRIG_IDENTITY_STYLE, FRIG_REPO_URL } from "@/lib/frig-identity";
import type { BranchThemeConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  // Branding público del tenant por dominio (carga directa, sin sesión).
  const [brandTheme, setBrandTheme] = useState<BranchThemeConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const theme = await fetchPublicLoginThemeByHost();
      if (cancelled || !theme) return;
      setBrandTheme(theme);
      applyThemeConfig(theme);
    })();
    const name = "FRIG";
    document.title = `${name} — Recuperar contraseña`;
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Respuesta genérica del backend (anti-enumeración): no sabremos
      // si el email existe; mostramos el mismo mensaje a todos.
      await forgotPassword({ email });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo enviar la solicitud.",
      );
    } finally {
      setLoading(false);
    }
  }

  const isFrigIdentity = !brandTheme;

  return (
    <div
      className={cn(
        "relative flex min-h-dvh flex-1 flex-col",
        isFrigIdentity ? "bg-[#0a0a0a]" : "bg-background text-foreground",
      )}
      style={isFrigIdentity ? FRIG_IDENTITY_STYLE : undefined}
    >
      {/* Fondo de identidad: horizonte cálido */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 115%, rgba(240,162,106,0.16), transparent 70%)",
          }}
        />
      </div>
      <section
        style={isFrigIdentity ? { "--input": "#27272a", "--border": "#27272a", "--muted": "#1c1c1f", "--muted-foreground": "#a1a1aa", "--accent": "#1c1c1f", "--background": "#0a0a0a", "--card": "#141414" } as React.CSSProperties : undefined}
        className={cn(
          "relative flex flex-1 flex-col items-center justify-center px-4 py-10",
          isFrigIdentity || brandTheme?.algorithm === "dark" ? "dark text-white" : "text-foreground",
        )}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full max-w-sm font-sans"
        >
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            {brandTheme ? (
              <BrandLogo
                src={brandTheme.logo}
                alt={brandTheme.app_name ?? "Logo"}
                name={brandTheme.app_name}
                containerClassName="h-12 w-12 rounded-xl"
                className="h-12 w-12 rounded-xl object-contain"
              />
            ) : (
              <img
                src="/brand/frig-wordmark.png"
                alt="Frig"
                className="frig-flame h-10 w-auto"
              />
            )}
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                Recuperar contraseña
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Te enviaremos un correo con instrucciones
              </p>
            </div>
          </div>

          {sent ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg bg-white/[0.04] px-3 py-3 text-sm text-zinc-200">
                <p className="font-medium">Revisa tu correo</p>
                <p className="mt-1 opacity-90">
                  Si el email existe en nuestro sistema, recibirás un enlace
                  para recuperar tu contraseña (válido por 24 horas).
                </p>
              </div>
              <Link
                href="/login"
                className={cn(buttonVariants({ size: "lg" }), "btn-copper mt-2 rounded-lg text-white")}
              >
                Volver al inicio de sesión
              </Link>
            </div>
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
                <p className="text-xs text-muted-foreground">
                  Ingresa el correo con el que ingresas a FRIG.
                </p>
              </div>

              {error && (
                <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" disabled={loading} className="mt-2">
                {loading ? "Enviando…" : "Enviar correo de recuperación"}
              </Button>

              <div className="mt-3 text-center">
                <Link
                  href="/login"
                  className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  Volver al inicio de sesión
                </Link>
              </div>
            </form>
          )}

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
      </section>
    </div>
  );
}
