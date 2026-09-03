"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { getRoleLabel } from "@/lib/roles";
import { fetchBranchUsers } from "@/lib/api/branches";
import { branchName } from "@/lib/types";
import type { Branch } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BranchUsersDialogProps {
  branch: Branch;
  onClose: () => void;
}

export function BranchUsersDialog({ branch, onClose }: BranchUsersDialogProps) {
  const { data: users, isLoading } = useQuery({
    queryKey: ["branches", branch.branch_id, "users"],
    queryFn: () => fetchBranchUsers(branch.branch_id),
  });

  const roleCounts = useMemo(() => {
    const map = new Map<string, { code: string; label: string; count: number }>();
    for (const u of users ?? []) {
      const code = u.role_code || "—";
      const label = getRoleLabel(code) ?? u.role_name ?? code;
      const existing = map.get(code);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(code, { code, label, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [users]);

  const activeCount = useMemo(
    () => (users ?? []).filter((u) => u.is_active).length,
    [users]
  );

  return (
    <AnimatedOverlay
      open={true}
      onClose={onClose}
      panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
    >
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-xl md:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Usuarios de {branchName(branch)}</h2>
            <p className="text-xs text-muted-foreground">
              {users?.length ?? 0} usuario(s) asignado(s) · {activeCount} activo(s)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {isLoading ? (
            <div className="grid flex-1 place-items-center py-8">
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          ) : roleCounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
              <Users className="h-8 w-8" />
              <p className="text-sm font-medium">No hay usuarios asignados</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Distribución por rol
              </p>
              <div className="flex flex-wrap gap-2">
                {roleCounts.map(({ code, label, count }) => (
                  <span
                    key={code}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium",
                      code === "OWNER"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-muted text-foreground"
                    )}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background text-xs font-semibold">
                      {count}
                    </span>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AnimatedOverlay>
  );
}
