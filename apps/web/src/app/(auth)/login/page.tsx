"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSessionStore } from "@/lib/store/session";
import { loginComplete } from "@/lib/api/auth";
import { setToken } from "@/lib/api/session-storage";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";

export default function LoginPage() {
  const router = useRouter();
  const theme = useSessionStore((s) => s.theme);
  const setSession = useSessionStore((s) => s.setSession);
  const setCurrentBranch = useSessionStore((s) => s.setCurrentBranch);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await loginComplete({ email, password });
      setToken(res.token);
      setSession(res.user, res.branches);
      if (res.branches.length === 1) {
        setCurrentBranch(String(res.branches[0].branch_id));
        router.replace("/pos");
      } else {
        router.replace("/select-branch");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  const appName = theme?.app_name ?? "FRIG";
  const welcome = theme?.login_welcome_message ?? "Inicia sesión para operar tu punto de venta";

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <BrandLogo
            src={theme?.logo}
            alt={appName}
            containerClassName="h-14 w-14"
            className="h-10 w-10"
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{appName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{welcome}</p>
          </div>
        </div>

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
        </form>

        <p className={cn("mt-8 text-center text-xs text-muted-foreground")}>
          Punto de venta gastronómico por FRIG
        </p>
      </motion.div>
    </div>
  );
}