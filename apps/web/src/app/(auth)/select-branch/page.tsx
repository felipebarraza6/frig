"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Store, Building2 } from "lucide-react";
import { useSessionStore, useIsPosFirstRole } from "@/lib/store/session";
import { fetchFrontendConfig } from "@/lib/api/frontend-config";
import { fetchBranchTheme, applyThemeConfig } from "@/lib/api/branches";
import { branchName } from "@/lib/types";

/**
 * Selector de sucursal (multi-tenant): el usuario elige la sucursal a operar.
 * Se guarda como sucursal activa, se carga la configuración completa del
 * frontend y se aplica/refresca su tema.
 */
export default function SelectBranchPage() {
  const router = useRouter();
  const branches = useSessionStore((s) => s.branches);
  const user = useSessionStore((s) => s.user);
  const setFrontendConfig = useSessionStore((s) => s.setFrontendConfig);
  const setTheme = useSessionStore((s) => s.setTheme);
  const isPosFirst = useIsPosFirstRole();

  async function handleSelect(branchId: string) {
    try {
      const config = await fetchFrontendConfig(Number(branchId));
      setFrontendConfig(config, branchId);
      try {
        const theme = await fetchBranchTheme();
        if (theme) {
          setTheme(theme);
          applyThemeConfig(theme);
        }
      } catch {
        // tema no crítico
      }
      const dashboard = config.dashboard;
      if (dashboard) {
        router.replace(dashboard);
      } else {
        router.replace(isPosFirst ? "/pos" : "/dashboard");
      }
    } catch {
      // Si frontend-config falla, mantener comportamiento anterior como fallback.
      router.replace(isPosFirst ? "/pos" : "/dashboard");
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-white">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Selecciona tu sucursal</h1>
          <p className="text-sm text-muted-foreground">
            {user?.first_name ? `Hola, ${user.first_name}. ` : ""}¿Dónde vas a operar hoy?
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {branches.map((branch, i) => (
            <motion.button
              key={String(branch.branch_id)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i, duration: 0.2, ease: "easeOut" }}
              onClick={() => handleSelect(String(branch.branch_id))}
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-[transform,background-color,border-color] duration-150 hover:border-primary hover:bg-muted"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{branchName(branch)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {branch.commercial_business}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}