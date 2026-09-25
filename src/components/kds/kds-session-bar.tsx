"use client";

import { Monitor } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { PosProfileButton } from "@/components/pos/pos-profile-button";
import { useCurrentBranch, useCurrentBranchRole, useSessionStore } from "@/lib/store/session";
import { branchName } from "@/lib/types";
import { getRoleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";

/**
 * Barra de sesión tipo POS para pantallas KDS: marca, sucursal, rol y perfil
 * (usuario + cerrar sesión). Pensada para el rol Cocinero en equipos compartidos.
 */
export function KdsSessionBar({
  stationName,
  className,
  dense,
}: {
  stationName?: string | null;
  className?: string;
  /** Compacto para cabeceras ya densas. */
  dense?: boolean;
}) {
  const branch = useCurrentBranch();
  const role = useCurrentBranchRole();
  const theme = useSessionStore((s) => s.theme ?? s.organizationTheme);
  const logoSrc =
    branch?.logo ?? branch?.theme_config?.logo ?? theme?.logo ?? null;
  const title = branch ? branchName(branch) : "Sin sucursal";
  const roleLabel = getRoleLabel(role);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-3 backdrop-blur",
        dense ? "h-11" : "h-12 sm:h-12",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <BrandLogo
          src={logoSrc}
          name={title}
          containerClassName="h-8 w-8 shrink-0 rounded-lg"
          className="h-full w-full p-0.5"
        />
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:hidden">
          <Monitor className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">
            {stationName || "KDS"}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {title}
            {roleLabel ? <span className="text-primary"> · {roleLabel}</span> : null}
          </p>
        </div>
      </div>
      <PosProfileButton />
    </div>
  );
}
