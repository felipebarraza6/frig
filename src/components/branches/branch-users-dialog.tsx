"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X, Users, UserPlus, ShieldCheck, Power, Trash2, LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { useToast } from "@/lib/store/toast";
import { useSessionStore } from "@/lib/store/session";
import { getRoleLabel, frigRoleOptions } from "@/lib/roles";
import {
  fetchBranchUsers, fetchBranchRoles, fetchBranchAvailableUsers,
  inviteBranchUser, assignBranchUser, removeBranchUser,
  toggleBranchUserStatus, updateBranchUserRole, transferBranchOwnership,
} from "@/lib/api/branches";
import { branchName, type Branch, type BranchUser } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BranchUsersDialogProps {
  branch: Branch;
  /** Módulos activos de la sucursal: habilitan roles operativos (cajero, mesero, repartidor). */
  enabledModules?: string[];
  onClose: () => void;
}

/**
 * `user` en BranchUser puede llegar como id o como objeto anidado con los
 * datos del usuario. Normaliza ambos formatos en un solo lugar.
 */
function nestedUserOf(u: BranchUser): Record<string, unknown> | null {
  return u.user != null && typeof u.user === "object"
    ? (u.user as Record<string, unknown>)
    : null;
}

function userIdOf(u: BranchUser): number | string {
  const nested = nestedUserOf(u);
  if (nested?.id != null) return nested.id as number | string;
  if (u.user != null && typeof u.user !== "object") return u.user;
  return u.id;
}

function stringField(source: Record<string, unknown> | null, key: string): string {
  const value = source?.[key];
  return typeof value === "string" ? value : "";
}

function displayName(u: BranchUser): string {
  const nested = nestedUserOf(u);
  const name =
    (typeof u.full_name === "string" && u.full_name) ||
    stringField(nested, "full_name") ||
    [u.first_name, u.last_name].filter((v) => typeof v === "string").join(" ") ||
    [stringField(nested, "first_name"), stringField(nested, "last_name")].filter(Boolean).join(" ") ||
    (typeof u.user_name === "string" && u.user_name) ||
    stringField(nested, "username") ||
    (typeof u.username === "string" && u.username) ||
    emailOf(u) ||
    `Usuario ${userIdOf(u)}`;
  return name;
}

function emailOf(u: BranchUser): string {
  const nested = nestedUserOf(u);
  return (
    (typeof u.email === "string" && u.email) ||
    (typeof u.user_email === "string" && u.user_email) ||
    stringField(nested, "email")
  );
}

function initialsOf(u: BranchUser): string {
  const name = displayName(u);
  const parts = name.trim().split(/[\s.@]+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  return initials || "?";
}

export function BranchUsersDialog({ branch, enabledModules = [], onClose }: BranchUsersDialogProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useSessionStore((s) => s.user);
  const isSuperAdmin = Boolean(user?.is_superuser || user?.type_user === "ADM");
  // Gestión de usuarios: propietario/admin local (can_manage) o super admin.
  const canManage = isSuperAdmin || Boolean(branch.can_manage);

  const usersKey = ["branches", branch.branch_id, "users"];
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: usersKey });
    // users_by_role de la tarjeta vive en la lista de sucursales.
    queryClient.invalidateQueries({ queryKey: ["branches", "manage"] });
  };

  const [newEmail, setNewEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [removing, setRemoving] = useState<BranchUser | null>(null);
  const [transferring, setTransferring] = useState<BranchUser | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: usersKey,
    queryFn: () => fetchBranchUsers(branch.branch_id),
  });

  const { data: branchRoles = [] } = useQuery({
    queryKey: ["branches", branch.branch_id, "roles"],
    queryFn: () => fetchBranchRoles(branch.branch_id),
  });

  // Solo roles FRIG, y los operativos únicamente si su módulo está activo.
  const roleOptions = useMemo(
    () => frigRoleOptions(branchRoles, enabledModules),
    [branchRoles, enabledModules],
  );

  const { data: available = [] } = useQuery({
    queryKey: ["branches", branch.branch_id, "available-users"],
    queryFn: () => fetchBranchAvailableUsers(branch.branch_id),
    enabled: isSuperAdmin,
  });

  const roleCounts = useMemo(() => {
    const map = new Map<string, { code: string; label: string; count: number }>();
    for (const u of users ?? []) {
      const code = u.role_code || "—";
      const label = getRoleLabel(code) ?? u.role_name ?? code;
      const existing = map.get(code);
      if (existing) existing.count += 1;
      else map.set(code, { code, label, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [users]);

  const onError = (err: Error) => toast.error(err.message || "No se pudo completar la acción.");

  const invite = useMutation({
    mutationFn: () =>
      inviteBranchUser(branch.branch_id, newEmail.trim(), Number(inviteRoleId)),
    onSuccess: () => {
      toast.success(`Invitación enviada a ${newEmail.trim()}.`);
      setNewEmail("");
      invalidate();
    },
    onError,
  });

  const assign = useMutation({
    mutationFn: (u: BranchUser) =>
      assignBranchUser(branch.branch_id, userIdOf(u), Number(inviteRoleId)),
    onSuccess: () => {
      toast.success("Usuario asignado a la sucursal.");
      invalidate();
    },
    onError,
  });

  const changeRole = useMutation({
    mutationFn: ({ u, roleId }: { u: BranchUser; roleId: number | string }) =>
      updateBranchUserRole(branch.branch_id, userIdOf(u), roleId),
    onSuccess: () => {
      toast.success("Rol actualizado.");
      invalidate();
    },
    onError,
  });

  const toggleStatus = useMutation({
    mutationFn: ({ u, isActive }: { u: BranchUser; isActive: boolean }) =>
      toggleBranchUserStatus(branch.branch_id, userIdOf(u), isActive),
    onSuccess: () => {
      toast.success("Estado del usuario actualizado.");
      invalidate();
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: (u: BranchUser) => removeBranchUser(branch.branch_id, userIdOf(u)),
    onSuccess: () => {
      toast.success("Usuario removido de la sucursal.");
      setRemoving(null);
      invalidate();
    },
    onError,
  });

  const transfer = useMutation({
    mutationFn: (u: BranchUser) => transferBranchOwnership(branch.branch_id, userIdOf(u)),
    onSuccess: (_res, u) => {
      toast.success(`${displayName(u)} es ahora propietario de la sucursal.`);
      setTransferring(null);
      invalidate();
    },
    onError,
  });

  const busy = invite.isPending || assign.isPending || changeRole.isPending
    || toggleStatus.isPending || remove.isPending || transfer.isPending;

  const activeCount = (users ?? []).filter((u) => u.is_active).length;
  const selectedRoleLabel = roleOptions.find((r) => String(r.id) === inviteRoleId)?.label;

  return (
    <AnimatedOverlay
      open={true}
      onClose={onClose}
      panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
    >
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-background shadow-lg md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-xl md:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Usuarios de {branchName(branch)}</h2>
            <p className="text-xs text-muted-foreground">
              {users?.length ?? 0} asignado(s) · {activeCount} activo(s)
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
          {/* Distribución por rol */}
          {isLoading ? (
            <Skeleton className="h-10 rounded-lg" />
          ) : roleCounts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {roleCounts.map(({ code, label, count }) => (
                <span
                  key={code}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                    code === "OWNER"
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-muted text-foreground",
                  )}
                >
                  <span className="font-semibold tabular-nums">{count}</span>
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Invitar / asignar */}
          {canManage && (
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <UserPlus className="h-3.5 w-3.5" />
                Agregar usuario
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@persona.cl"
                  className="h-9 flex-1"
                  aria-label="Email a invitar"
                />
                <select
                  value={inviteRoleId}
                  onChange={(e) => setInviteRoleId(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:w-48"
                  aria-label="Rol del usuario"
                >
                  <option value="">Rol…</option>
                  {roleOptions.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  className="h-9"
                  disabled={!newEmail.trim() || !inviteRoleId}
                  isLoading={invite.isPending}
                  onClick={() => invite.mutate()}
                >
                  Invitar
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Envía una invitación por correo
                {selectedRoleLabel ? ` con rol ${selectedRoleLabel}` : ""}.
                {" "}Los roles operativos aparecen según los módulos activos de la sucursal.
              </p>

              {isSuperAdmin && available.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <LinkIcon className="h-3.5 w-3.5" />
                    Asignar usuario existente
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {available.slice(0, 8).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        disabled={busy || !inviteRoleId}
                        title={inviteRoleId
                          ? `Asignar a ${displayName(u)} como ${selectedRoleLabel ?? ""}`
                          : "Elige un rol primero"}
                        onClick={() => assign.mutate(u)}
                        className="rounded-full border border-border bg-background px-2.5 py-1 text-xs transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
                      >
                        + {displayName(u)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Lista de usuarios */}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : (users ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
              <Users className="h-8 w-8" />
              <p className="text-sm font-medium">No hay usuarios asignados</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {(users ?? []).map((u) => {
                const isOwnerRow = (u.role_code ?? "").toUpperCase() === "OWNER";
                const currentRoleId = String(u.role_definition ?? "");
                // Si el usuario tiene un rol fuera del catálogo FRIG (p. ej.
                // asignado desde otra app), se muestra como opción solo en su
                // propia fila para no perderlo al guardar.
                const currentOutside = currentRoleId
                  && !roleOptions.some((r) => String(r.id) === currentRoleId);
                return (
                  <li
                    key={u.id}
                    className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5"
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        isOwnerRow ? "bg-primary/15 text-primary" : "bg-muted text-foreground",
                      )}
                    >
                      {initialsOf(u)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {displayName(u)}
                        {isOwnerRow && (
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Propietario" />
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{emailOf(u)}</p>
                    </div>

                    {canManage ? (
                      <select
                        value={currentRoleId}
                        disabled={busy}
                        onChange={(e) => changeRole.mutate({ u, roleId: Number(e.target.value) })}
                        className="h-8 w-32 shrink-0 rounded-lg border border-border bg-background px-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:w-36"
                        aria-label={`Rol de ${displayName(u)}`}
                      >
                        {currentOutside && (
                          <option value={currentRoleId}>
                            {getRoleLabel(u.role_code ?? "") ?? u.role_name ?? "Rol actual"}
                          </option>
                        )}
                        {roleOptions.map((r) => (
                          <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                        {getRoleLabel(u.role_code ?? "") ?? u.role_name ?? "—"}
                      </span>
                    )}

                    {canManage && (
                      <button
                        type="button"
                        disabled={busy}
                        title={u.is_active ? "Desactivar acceso" : "Activar acceso"}
                        onClick={() => toggleStatus.mutate({ u, isActive: !u.is_active })}
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors",
                          u.is_active
                            ? "bg-success/15 text-success hover:bg-success/25"
                            : "bg-danger/15 text-danger hover:bg-danger/25",
                        )}
                      >
                        <Power className="mr-0.5 inline h-2.5 w-2.5" />
                        {u.is_active ? "Activo" : "Inactivo"}
                      </button>
                    )}

                    {/* Acciones directas (un menú desplegable se cortaba con
                        el scroll del listado) */}
                    {canManage && !isOwnerRow && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        {isSuperAdmin && (
                          <button
                            type="button"
                            disabled={busy}
                            title="Transferir propiedad a este usuario"
                            onClick={() => setTransferring(u)}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          title="Remover de la sucursal"
                          onClick={() => setRemoving(u)}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Confirmaciones inline */}
          {removing && (
            <ConfirmBar
              message={`¿Remover a ${displayName(removing)} de la sucursal?`}
              confirmLabel="Remover"
              busy={remove.isPending}
              onConfirm={() => remove.mutate(removing)}
              onCancel={() => setRemoving(null)}
            />
          )}
          {transferring && (
            <ConfirmBar
              message={`¿Transferir la propiedad a ${displayName(transferring)}? Dejarás de ser propietario.`}
              confirmLabel="Transferir"
              busy={transfer.isPending}
              onConfirm={() => transfer.mutate(transferring)}
              onCancel={() => setTransferring(null)}
            />
          )}
        </div>
      </div>
    </AnimatedOverlay>
  );
}

function ConfirmBar({
  message, confirmLabel, busy, onConfirm, onCancel,
}: {
  message: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5">
      <p className="text-sm">{message}</p>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button variant="danger" size="sm" onClick={onConfirm} isLoading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
