"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Power, Loader2, Store, Users, Palette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useSessionStore,
  useCanViewBranches,
  useCanManageBranches,
} from "@/lib/store/session";
import { branchName } from "@/lib/types";
import { fetchBranches, updateBranch } from "@/lib/api/branches";
import { BranchForm } from "@/components/branches/branch-form";
import { BranchUsersDialog } from "@/components/branches/branch-users-dialog";
import { BranchThemeDialog } from "@/components/branches/branch-theme-dialog";
import type { Branch } from "@/lib/types";
import type { BranchesFilter } from "@/lib/api/branches";

export default function BranchesPage() {
  const queryClient = useQueryClient();
  const user = useSessionStore((s) => s.user);
  const canView = useCanViewBranches();
  const canManage = useCanManageBranches();
  const isSuperAdmin = Boolean(user?.is_superuser || user?.type_user === "ADM");

  const [search, setSearch] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [viewingUsers, setViewingUsers] = useState<Branch | null>(null);
  const [editingTheme, setEditingTheme] = useState<Branch | null>(null);

  const filter = useMemo<BranchesFilter>(() => {
    const base: BranchesFilter = {};
    if (search) base.search = search;
    return { ...base, ...pageUrl };
  }, [search, pageUrl]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["branches", "manage", filter],
    queryFn: () => fetchBranches(filter),
    enabled: canView,
  });

  const branches = data?.results ?? [];
  const totalBranches = data?.count ?? 0;

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      updateBranch(id, { is_active: isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branches"] }),
  });

  if (!canView) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-6 text-center">
        <Store className="h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-semibold">Sin acceso</h1>
        <p className="text-sm text-muted-foreground">
          No tienes permisos para ver sucursales.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Sucursales</h1>
          <p className="text-xs text-muted-foreground">
            {isSuperAdmin
              ? "Gestiona todas las sucursales"
              : "Gestiona tus sucursales"}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Nueva sucursal
          </Button>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageUrl({});
            }}
            placeholder="Buscar por nombre, RUT o email…"
            className="pl-9"
            aria-label="Buscar sucursal"
          />
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudieron cargar las sucursales.</p>
        ) : isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Sucursal</th>
                    <th className="px-4 py-3">Teléfono</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3 text-center">Usuarios</th>
                    <th className="px-4 py-3 text-center">Activa</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b, index) => {
                    const manageable = isSuperAdmin || b.can_manage;
                    const rowKey = String(b.branch_id ?? b.id ?? index);
                    return (
                      <tr key={rowKey} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-foreground">
                              <Store className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{branchName(b)}</p>
                              {b.commercial_business && (
                                <p className="text-xs text-muted-foreground">{b.commercial_business}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{b.phone ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{b.email ?? "—"}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">
                          {b.users_count ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {manageable ? (
                            <button
                              onClick={() =>
                                toggleActive.mutate({ id: Number(b.branch_id), isActive: !b.is_active })
                              }
                              disabled={toggleActive.isPending}
                              aria-label={`${b.is_active ? "Desactivar" : "Activar"} ${branchName(b)}`}
                              className={
                                b.is_active
                                  ? "text-emerald-600 hover:text-emerald-700"
                                  : "text-muted-foreground hover:text-danger"
                              }
                            >
                              <Power className="h-4 w-4" />
                            </button>
                          ) : (
                            <span
                              className={
                                b.is_active
                                  ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                                  : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                              }
                            >
                              {b.is_active ? "Sí" : "No"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingUsers(b)}
                            >
                              <Users className="h-3.5 w-3.5" />
                              Usuarios
                            </Button>
                            {manageable && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditing(b)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Editar
                              </Button>
                            )}
                            {manageable && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingTheme(b)}
                              >
                                <Palette className="h-3.5 w-3.5" />
                                Tema
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                {totalBranches} sucursal{totalBranches === 1 ? "" : "es"} en total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ previous: data?.previous })}
                  disabled={!data?.previous}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ next: data?.next })}
                  disabled={!data?.next}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {(creating || editing) && (
        <BranchForm
          branch={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSuccess={() => {
            setCreating(false);
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: ["branches"] });
          }}
        />
      )}

      {viewingUsers && (
        <BranchUsersDialog
          branch={viewingUsers}
          onClose={() => setViewingUsers(null)}
        />
      )}

      {editingTheme && (
        <BranchThemeDialog
          branch={editingTheme}
          onClose={() => setEditingTheme(null)}
        />
      )}
    </div>
  );
}
