"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, KeyRound, Power, Users, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useSessionStore, useCurrentBranch, useCanManageUsers } from "@/lib/store/session";
import { branchName } from "@/lib/types";
import { getRoleLabel } from "@/lib/roles";
import {
  fetchUsers,
  toggleBranchAssignmentStatus,
  generatePassword,
  type UsersFilter,
} from "@/lib/api/users";
import { UserForm } from "@/components/users/user-form";
import type { UserResponse } from "@/lib/types";

function userDisplayName(u: UserResponse): string {
  if (u.first_name || u.last_name) {
    return `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  }
  return u.email;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const user = useSessionStore((s) => s.user);
  const currentBranch = useCurrentBranch();
  const canManage = useCanManageUsers();
  const isSuperAdmin = Boolean(user?.is_superuser || user?.type_user === "ADM");

  const [search, setSearch] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<UserResponse | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<{
    username: string;
    password: string;
  } | null>(null);

  const filter = useMemo<UsersFilter>(() => {
    const base: UsersFilter = {};
    if (search) base.search = search;
    if (!isSuperAdmin && currentBranch) {
      base.branch_ids = String(currentBranch.branch_id);
    }
    return { ...base, ...pageUrl };
  }, [search, isSuperAdmin, currentBranch, pageUrl]);

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["users", "manage", filter],
    queryFn: () => fetchUsers(filter),
    enabled: canManage,
  });

  const totalUsers = page?.count ?? 0;

  const users = page?.results ?? [];

  const toggleAssignment = useMutation({
    mutationFn: (assignmentId: number) => toggleBranchAssignmentStatus(assignmentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const generatePass = useMutation({
    mutationFn: (userId: number) => generatePassword(userId),
    onSuccess: (data) => {
      setRevealedPassword({ username: data.username, password: data.new_password });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  if (!canManage) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-6 text-center">
        <Users className="h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-semibold">Sin acceso</h1>
        <p className="text-sm text-muted-foreground">
          No tienes permisos para gestionar usuarios en esta sucursal.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Usuarios</h1>
          <p className="text-xs text-muted-foreground">
            {isSuperAdmin
              ? "Gestiona todos los usuarios del sistema"
              : `Gestiona usuarios de ${currentBranch ? branchName(currentBranch) : "la sucursal"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            onClick={() => setCreating(true)}
            className="sm:hidden"
            title="Nuevo usuario"
            aria-label="Nuevo usuario"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button onClick={() => setCreating(true)} className="hidden sm:flex">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo usuario
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {revealedPassword && (
          <div className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm">
            <p className="text-sm font-medium">Contraseña generada</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Usuario: <span className="font-mono text-foreground">{revealedPassword.username}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Contraseña: <span className="font-mono text-foreground">{revealedPassword.password}</span>
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setRevealedPassword(null)}
            >
              Cerrar
            </Button>
          </div>
        )}

        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageUrl({});
            }}
            placeholder="Buscar por nombre o email…"
            className="pl-9"
            aria-label="Buscar usuario"
          />
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudo cargar los usuarios.</p>
        ) : isLoading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : users.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <Users className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No se encontraron usuarios</p>
              <p className="text-xs text-muted-foreground">
                Prueba con otros términos o agrega un nuevo usuario.
              </p>
              <Button className="mt-4" size="sm" onClick={() => setCreating(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Nuevo usuario
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Vista desktop */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Sucursal</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3 text-center">Activo</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const access = u.branch_access;
                    return (
                      <tr key={String(u.id)} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{userDisplayName(u)}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {access?.branch_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {getRoleLabel(access?.role_code) ?? access?.role_name ?? access?.role_code ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => {
                              if (access?.id) toggleAssignment.mutate(Number(access.id));
                            }}
                            disabled={!access?.id || toggleAssignment.isPending}
                            aria-label={`${access?.is_active ? "Desactivar" : "Activar"} ${userDisplayName(u)}`}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              access?.is_active
                                ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                                : "bg-danger/10 text-danger hover:bg-danger/20"
                            }`}
                          >
                            <Power className="h-3 w-3" />
                            {access?.is_active ? "Activo" : "Inactivo"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditing(u)}
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => generatePass.mutate(Number(u.id))}
                              disabled={generatePass.isPending}
                            >
                              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                              Generar clave
                            </Button>
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
              {users.map((u) => {
                const access = u.branch_access;
                return (
                  <div
                    key={String(u.id)}
                    className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{userDisplayName(u)}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                        <span
                          className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            access?.is_active
                              ? "bg-emerald-500/10 text-emerald-700"
                              : "bg-danger/10 text-danger"
                          }`}
                        >
                          <Power className="h-3 w-3" />
                          {access?.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Editar"
                          aria-label="Editar"
                          onClick={() => setEditing(u)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Generar clave"
                          aria-label="Generar clave"
                          onClick={() => generatePass.mutate(Number(u.id))}
                          disabled={generatePass.isPending}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          <span className="sr-only">Generar clave</span>
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="text-[10px] uppercase tracking-wide">Sucursal</span>
                        <span className="truncate font-medium text-foreground">
                          {access?.branch_name ?? "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="text-[10px] uppercase tracking-wide">Rol</span>
                        <span className="truncate font-medium text-foreground">
                          {getRoleLabel(access?.role_code) ?? access?.role_name ?? access?.role_code ?? "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
              <p className="text-muted-foreground">
                {totalUsers} usuario{totalUsers === 1 ? "" : "s"} en total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ previous: page?.previous })}
                  disabled={!page?.previous}
                >
                  <span className="sm:hidden">Ant.</span>
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ next: page?.next })}
                  disabled={!page?.next}
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
        <UserForm
          user={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSuccess={() => {
            setCreating(false);
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: ["users"] });
          }}
        />
      )}
    </div>
  );
}
