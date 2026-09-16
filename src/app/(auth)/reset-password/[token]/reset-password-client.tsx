"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPasswordConfirm } from "@/lib/api/auth";
import { fetchPublicLoginThemeByHost, applyThemeConfig } from "@/lib/api/branches";
import { BrandLogo } from "@/components/brand-logo";
import { FRIG_IDENTITY_STYLE, FRIG_REPO_URL } from "@/lib/frig-identity";
import type { BranchThemeConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

function extractTokenFromPath(): string {
  if (typeof window === "undefined") return "";
  const segments = window.location.pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  return last && last !== "__" ? last : "";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  // El token viene de la URL, no de React: se lee lazy en el primer render
  // (cliente) para no disparar un render en cascada desde un effect.
  const [token] = useState(() =>
    typeof window === "undefined" ? "" : extractTokenFromPath(),
  );

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // Branding público del tenant por dominio: el enlace llega por email y
  // abre directo en el dominio propio, sin sesión que re-aplique el tema.
  const [brandTheme, setBrandTheme] = useState<BranchThemeConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    document.title = "FRIG — Nueva contraseña";
    (async () => {
      const theme = await fetchPublicLoginThemeByHost();
      // Branding del propio Frig = identidad Frig (logo propio, cobre).
      if (cancelled || !theme || (theme.app_name ?? "").toLowerCase().includes("frig")) return;
      setBrandTheme(theme);
      applyThemeConfig(theme);
      // Favicon del tenant; sin favicon propio usa su logo del header.
      const fav = theme.favicon ?? theme.logo;
      if (fav) {
        let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.head.appendChild(link);
        }
        link.href = fav;
      }
      if (theme.app_name) document.title = `${theme.app_name} — Nueva contraseña`;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!token) {
      setError("El enlace de recuperación no es válido.");
      return;
    }

    setLoading(true);
    try {
      await resetPasswordConfirm({
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo restablecer la contraseña.",
      );
    } finally {
      setLoading(false);
    }
  }

  const isFrigIdentity = !brandTheme;

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-1 flex-col",
        isFrigIdentity ? "bg-[#0a0a0a]" : "bg-background text-foreground",
      )}
      style={isFrigIdentity ? FRIG_IDENTITY_STYLE : undefined}
    >
      <section className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-10">
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
                containerClassName="h-14 w-14 rounded-xl"
                className="h-14 w-14 rounded-xl object-contain"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <img src="/brand/frig-symbol.png" alt="Frig" className="h-9 w-9" />
              </div>
            )}
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                Nueva contraseña
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Define tu nueva clave de acceso
              </p>
            </div>
          </div>

          {done ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg bg-white/[0.04] px-3 py-3 text-sm text-zinc-200">
                <p className="font-medium">Contraseña actualizada</p>
                <p className="mt-1 opacity-90">
                  Ya puedes iniciar sesión con tu nueva contraseña.
                </p>
              </div>
              <Button
                size="lg"
                className="mt-2"
                onClick={() => router.push("/login")}
              >
                Ir al inicio de sesión
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

              {error && (
                <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" disabled={loading} className="mt-2">
                {loading ? "Guardando…" : "Restablecer contraseña"}
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
