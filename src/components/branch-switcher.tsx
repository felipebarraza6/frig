"use client";

import { useState } from "react";
import { ChevronsUpDown, Store } from "lucide-react";
import { BranchSwitcherModal } from "@/components/branch-switcher-modal";
import { useSessionStore, useCurrentBranch, useCanSwitchBranch } from "@/lib/store/session";
import { branchName } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BranchSwitcherProps {
  appName: string;
  /** Modo sidebar colapsado: solo ícono. */
  collapsed?: boolean;
}

/**
 * Switcher rápido de sucursal para usuarios multi-branch.
 * Cambia la sucursal activa de TODA la app vía activateBranch(), abriendo
 * un modal con el detalle de cada sucursal.
 */
export function BranchSwitcher({ appName, collapsed }: BranchSwitcherProps) {
  const branches = useSessionStore((s) => s.branches);
  const branch = useCurrentBranch();
  const canSwitch = useCanSwitchBranch();
  const [open, setOpen] = useState(false);

  if (!canSwitch || branches.length < 2) {
    if (collapsed) return null;
    // Sin multi-branch se muestra el nombre estático de siempre.
    return (
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">
          {branch ? branchName(branch) : appName}
        </p>
        {branch && branchName(branch) !== appName && (
          <p className="truncate text-xs text-white/70">{appName}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", collapsed ? "shrink-0" : "flex-1")}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Cambiar sucursal"
        className={cn(
          "flex w-full items-center gap-1 rounded-lg text-left transition-colors hover:bg-white/10",
          collapsed ? "justify-center p-1.5" : "px-2 py-1",
        )}
      >
        {collapsed ? (
          <Store className="h-4 w-4 shrink-0 text-white" />
        ) : (
          <>
            <span className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {branch ? branchName(branch) : appName}
              </p>
              {branch && branchName(branch) !== appName && (
                <p className="truncate text-xs text-white/70">{appName}</p>
              )}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-white/70" />
          </>
        )}
      </button>
      <BranchSwitcherModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
