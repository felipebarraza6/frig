"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Power, Store, Users, Palette, Phone, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeleton";
import {
  useSessionStore,
  useCanViewBranches,
  useCanManageBranches,
} from "@/lib/store/session";
import { branchName } from "@/lib/types";
import { fetchBranches, updateBranch } from "@/lib/api/branches";
import { getRoleLabel } from "@/lib/roles";
import { BranchForm } from "@/components/branches/branch-form";
import { BranchUsersDialog } from "@/components/branches/branch-users-dialog";
import { BranchThemeDialog } from "@/components/branches/branch-theme-dialog";
import type { Branch } from "@/lib/types";
import type { BranchesFilter } from "@/lib/api/branches";

/** Cantidad de usuarios por rol de la sucursal, ordenada de mayor a menor. */
function roleEntriesOf(branch: Branch): [string, number][] {
  const raw = branch.users_by_role;
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw)
    .map(([code, count]) => [code, Number(count) || 0] as [string, number])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
}

export default function BranchesPage() {
  const queryClient = useQueryClient();
  const user = useSessionStore((s) => s.user);
  const canView = useCanViewBranches();
  const canManage = useCanManageBranches();
  const isSuperAdmin = Boolean(user?.is_superuser || user?.type_user === "ADM");
  const canCreateBranch = isSuperAdmin || user?.is_multi_branch;

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
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Sucursales</h1>
          <p className="text-xs text-muted-foreground">
            {isSuperAdmin
              ? "Gestiona todas las sucursales"
              : "Gestiona tus sucursales"}
          </p>
        </div>
        {canCreateBranch && (
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              onClick={() => setCreating(true)}
              className="sm:hidden"
              title="Nueva sucursal"
              aria-label="Nueva sucursal"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button onClick={() => setCreating(true)} className="hidden sm:flex">
              <Plus className="mr-2 h-4 w-4" />
              Nueva sucursal
            </Button>
          </div>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="relative w-full sm:max-w-sm">
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
          <TableSkeleton rows={5} columns={4} />
        ) : branches.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <Store className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No se encontraron sucursales</p>
              <p className="text-xs text-muted-foreground">
                Prueba con otros términos o agrega una nueva sucursal.
              </p>
              {canCreateBranch && (
                <Button className="mt-4" size="sm" onClick={() => setCreating(true)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Nueva sucursal
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Vista desktop */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
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
                    const roleEntries = roleEntriesOf(b);
                    const activeBadgeClass = b.is_active
                      ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                      : "bg-danger/10 text-danger hover:bg-danger/20";
                    return (
                      <tr key={rowKey} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{branchName(b)}</p>
                            {b.commercial_business && (
                              <p className="text-xs text-muted-foreground">{b.commercial_business}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{b.phone ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{b.email ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setViewingUsers(b)}
                            title="Ver usuarios por tipo"
                            className="group inline-flex max-w-[240px] flex-wrap items-center justify-center gap-1"
                          >
                            {roleEntries.length > 0 ? (
                              roleEntries.map(([code, count]) => (
                                <span
                                  key={code}
                                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors group-hover:bg-primary/10"
                                >
                                  <span className="font-semibold tabular-nums">{count}</span>
                                  {getRoleLabel(code)}
                                </span>
                              ))
                            ) : (
                              <span className="text-muted-foreground">{b.users_count ?? 0}</span>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {manageable ? (
                            <button
                              onClick={() =>
                                toggleActive.mutate({ id: Number(b.branch_id), isActive: !b.is_active })
                              }
                              disabled={toggleActive.isPending}
                              aria-label={`${b.is_active ? "Desactivar" : "Activar"} ${branchName(b)}`}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${activeBadgeClass}`}
                            >
                              <Power className="h-3 w-3" />
                              {b.is_active ? "Sí" : "No"}
                            </button>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${activeBadgeClass}`}
                            >
                              <Power className="h-3 w-3" />
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
                              <Users className="mr-1.5 h-3.5 w-3.5" />
                              Usuarios
                            </Button>
                            {manageable && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditing(b)}
                              >
                                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                Editar
                              </Button>
                            )}
                            {manageable && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingTheme(b)}
                              >
                                <Palette className="mr-1.5 h-3.5 w-3.5" />
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

            {/* Vista móvil */}
            <div className="grid gap-3 md:hidden">
              {branches.map((b, index) => {
                const manageable = isSuperAdmin || b.can_manage;
                const rowKey = String(b.branch_id ?? b.id ?? index);
                const roleEntries = roleEntriesOf(b);
                return (
                  <div
                    key={rowKey}
                    className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{branchName(b)}</p>
                        {b.commercial_business && (
                          <p className="text-xs text-muted-foreground">{b.commercial_business}</p>
                        )}
                        <span
                          className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            b.is_active
                              ? "bg-emerald-500/10 text-emerald-700"
                              : "bg-danger/10 text-danger"
                          }`}
                        >
                          <Power className="h-3 w-3" />
                          {b.is_active ? "Activa" : "Inactiva"}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Usuarios"
                          aria-label="Usuarios"
                          onClick={() => setViewingUsers(b)}
                        >
                          <Users className="h-3.5 w-3.5" />
                          <span className="sr-only">Usuarios</span>
                        </Button>
                        {manageable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Editar"
                            aria-label="Editar"
                            onClick={() => setEditing(b)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Editar</span>
                          </Button>
                        )}
                        {manageable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Tema"
                            aria-label="Tema"
                            onClick={() => setEditingTheme(b)}
                          >
                            <Palette className="h-3.5 w-3.5" />
                            <span className="sr-only">Tema</span>
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      {b.phone && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span className="truncate">{b.phone}</span>
                        </div>
                      )}
                      {b.email && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{b.email}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setViewingUsers(b)}
                        className="col-span-2 flex flex-wrap items-center gap-1 text-left"
                      >
                        <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
                        {roleEntries.length > 0 ? (
                          roleEntries.map(([code, count]) => (
                            <span
                              key={code}
                              className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground"
                            >
                              <span className="font-semibold tabular-nums">{count}</span>{" "}
                              {getRoleLabel(code)}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{b.users_count ?? 0}</span>{" "}
                            usuarios
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
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
                  <span className="sm:hidden">Ant.</span>
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ next: data?.next })}
                  disabled={!data?.next}
                >
                  <span className="sm:hidden">Sig.</span>
                  <span className="hidden sm:inline">Siguiente</span>
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
