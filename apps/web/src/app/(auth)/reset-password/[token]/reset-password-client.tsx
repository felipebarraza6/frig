"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPasswordConfirm } from "@/lib/api/auth";
import { LandingPanel } from "@/components/landing/landing-panel";
import { PixelFoodMark } from "@/components/landing/pixel-food-mark";
import { cn } from "@/lib/utils";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <PixelFoodMark className="h-9 w-9" title="FRIG" withEyes animated />
            </div>
            <div>
              <h1 className="font-pixel text-2xl font-semibold tracking-[0.16em]">
                Nueva contraseña
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Define tu nueva clave de acceso
              </p>
            </div>
          </div>

          {done ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg bg-emerald-500/10 px-3 py-3 text-sm text-emerald-700">
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
