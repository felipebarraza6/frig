"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useCanManageBranches } from "@/lib/store/session";
import { fetchBranchUsers, inviteBranchUser, fetchBranchRoles } from "@/lib/api/branches";
import type { RoleDefinition } from "@/lib/types";
import { branchName } from "@/lib/types";
import type { Branch } from "@/lib/types";

interface BranchUsersDialogProps {
  branch: Branch;
  onClose: () => void;
}

export function BranchUsersDialog({ branch, onClose }: BranchUsersDialogProps) {
  const queryClient = useQueryClient();
  const canManage = useCanManageBranches();

  const [email, setEmail] = useState("");
  const [roleDefinition, setRoleDefinition] = useState<string>("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["branches", branch.branch_id, "users"],
    queryFn: () => fetchBranchUsers(branch.branch_id),
  });

  const { data: roles } = useQuery({
    queryKey: ["branches", branch.branch_id, "roles"],
    queryFn: () => fetchBranchRoles(String(branch.branch_id)),
  });

  const invite = useMutation({
    mutationFn: () => inviteBranchUser(branch.branch_id, email, Number(roleDefinition)),
    onSuccess: () => {
      setEmail("");
      setRoleDefinition("");
      queryClient.invalidateQueries({ queryKey: ["branches", branch.branch_id, "users"] });
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !roleDefinition) return;
    invite.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-lg max-h-[90vh] flex-col rounded-xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Usuarios de {branchName(branch)}</h2>
            <p className="text-xs text-muted-foreground">
              {users?.length ?? 0} usuario(s) asignado(s)
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {canManage && (
            <form onSubmit={handleInvite} className="flex flex-col gap-3 rounded-xl border border-border bg-muted p-4">
              <p className="text-sm font-medium">Invitar usuario</p>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="invite_email" className="text-xs font-medium">
                  Correo
                </label>
                <Input
                  id="invite_email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@negocio.cl"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="invite_role" className="text-xs font-medium">
                  Rol
                </label>
                <Select
                  id="invite_role"
                  value={roleDefinition}
                  onChange={(e) => setRoleDefinition(e.target.value)}
                  required
                >
                  <option value="">Seleccionar rol</option>
                  {roles?.map((r: RoleDefinition) => (
                    <option key={String(r.id)} value={String(r.id)}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={invite.isPending}>
                  {invite.isPending ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="mr-1 h-3.5 w-3.5" />
                  )}
                  Invitar
                </Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2">Usuario</th>
                    <th className="px-4 py-2">Rol</th>
                    <th className="px-4 py-2 text-center">Activo</th>
                  </tr>
                </thead>
                <tbody>
                  {(users ?? []).map((u) => (
                    <tr key={String(u.id)} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">
                        <p className="font-medium">
                          {u.first_name || u.last_name
                            ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()
                            : u.email}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {u.branch_access?.role_name ?? u.branch_access?.role_code ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span
                          className={
                            u.branch_access?.is_active
                              ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                              : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                          }
                        >
                          {u.branch_access?.is_active ? "Sí" : "No"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
