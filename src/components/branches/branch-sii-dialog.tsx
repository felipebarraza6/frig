"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, X, Loader2 } from "lucide-react";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { setBranchApiScope } from "@/lib/api/branch-scope";
import {
  fetchBranchFinanceConfigByBranch,
  updateBranchFinanceConfig,
} from "@/lib/api/branch-finance-config";
import { SiiSection } from "@/app/(app)/finance/settings/page";
import { branchName, type Branch } from "@/lib/types";

interface BranchSiiDialogProps {
  branch: Branch;
  invoicesEnabled?: boolean;
  onClose: () => void;
}

/**
 * Facturación SII de una sucursal concreta, en el listado de sucursales.
 * No cambia la sucursal de sesión: las llamadas van con X-Branch-ID de esta card.
 */
export function BranchSiiDialog({ branch, invoicesEnabled = true, onClose }: BranchSiiDialogProps) {
  const queryClient = useQueryClient();
  const branchId = Number(branch.branch_id);

  useEffect(() => {
    setBranchApiScope(branchId);
    return () => setBranchApiScope(null);
  }, [branchId]);

  const { data: config, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["branch-finance-configs", branchId, "dialog"],
    queryFn: () => fetchBranchFinanceConfigByBranch(branchId),
    enabled: Number.isFinite(branchId) && branchId > 0,
  });

  const updateMut = useMutation({
    mutationFn: (payload: Parameters<typeof updateBranchFinanceConfig>[1]) => {
      if (!config) throw new Error("Sin configuración financiera");
      return updateBranchFinanceConfig(config.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-finance-configs", branchId] });
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });

  return (
    <AnimatedOverlay
      open
      onClose={onClose}
      panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
    >
      <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-background shadow-lg md:max-h-[90vh] md:max-w-5xl md:rounded-xl md:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <h2 className="truncate text-base font-semibold">Facturación — {branchName(branch)}</h2>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              App, funciones, resolución y CAF de esta sucursal. No cambia la sucursal que tienes elegida.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando configuración…
            </div>
          ) : isError || !config ? (
            <p className="py-8 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "No se pudo cargar la configuración de esta sucursal."}{" "}
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => refetch()}>
                Reintentar
              </button>
            </p>
          ) : (
            <SiiSection
              config={config}
              onUpdate={(payload) => updateMut.mutate(payload)}
              isPending={updateMut.isPending}
              embedded
              invoicesEnabled={invoicesEnabled}
            />
          )}
        </div>
      </div>
    </AnimatedOverlay>
  );
}
