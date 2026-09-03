"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { useSessionStore, useCurrentBranch } from "@/lib/store/session";
import { branchName } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/roles";
import { createAndAssignUser, updateUser, changeAssignmentRole } from "@/lib/api/users";
import type { Branch, UserResponse } from "@/lib/types";

interface UserFormProps {
  user?: UserResponse;
  onClose: () => void;
  onSuccess: () => void;
}

const ALL_ROLES = [
  { code: "OWNER", label: ROLE_LABELS.OWNER },
  { code: "ADMIN_LOCAL", label: ROLE_LABELS.ADMIN_LOCAL },
  { code: "MANAGER", label: ROLE_LABELS.MANAGER },
  { code: "EMPLOYEE", label: ROLE_LABELS.EMPLOYEE },
  { code: "CAJERO", label: ROLE_LABELS.CAJERO },
  { code: "WAITER", label: ROLE_LABELS.WAITER },
];

export function UserForm({ user, onClose, onSuccess }: UserFormProps) {
  const currentUser = useSessionStore((s) => s.user);
  const branches = useSessionStore((s) => s.branches);
  const currentBranch = useCurrentBranch();
  const isSuperAdmin = Boolean(currentUser?.is_superuser || currentUser?.type_user === "ADM");
  const isEditing = Boolean(user);

  const manageableBranches = useMemo<Branch[]>(() => {
    if (isSuperAdmin) return branches;
    return branches.filter((b) => {
      const assignment = currentUser?.branch_assignments?.find(
        (a) => String(a.branch_id) === String(b.branch_id),
      );
      const code = assignment?.role_code;
      return code === "OWNER" || code === "ADMIN_LOCAL" || code === "MANAGER";
    });
  }, [branches, currentUser, isSuperAdmin]);

  const availableRoles = useMemo(() => {
    if (isSuperAdmin) return ALL_ROLES;
    return ALL_ROLES.filter((r) => r.code !== "OWNER");
  }, [isSuperAdmin]);

  const currentAssignment = user?.branch_access;
  const initialRole = currentAssignment?.role_code ?? availableRoles[0]?.code ?? "EMPLOYEE";

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [dni, setDni] = useState(user?.dni ?? "");
  const [password, setPassword] = useState("");
  const [branchId, setBranchId] = useState<string>(
    currentAssignment?.branch_id ? String(currentAssignment.branch_id) : currentBranch ? String(currentBranch.branch_id) : "",
  );
  const [role, setRole] = useState<string>(initialRole);
  const [isMultiBranch, setIsMultiBranch] = useState(user?.is_multi_branch ?? false);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: createAndAssignUser,
    onSuccess: () => onSuccess(),
    onError: (err: Error) => setError(err.message || "No se pudo crear el usuario."),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No hay usuario para editar");
      const payload: {
        first_name?: string;
        last_name?: string;
        email?: string;
        dni?: string;
        password?: string;
      } = {
        first_name: firstName,
        last_name: lastName,
        email,
        dni,
      };
      if (password) payload.password = password;
      await updateUser(Number(user.id), payload);

      if (currentAssignment?.id && role !== currentAssignment.role_code) {
        await changeAssignmentRole(Number(currentAssignment.id), role);
      }
    },
    onSuccess: () => onSuccess(),
    onError: (err: Error) => setError(err.message || "No se pudo actualizar el usuario."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isEditing) {
      update.mutate();
      return;
    }

    if (!branchId) {
      setError("Selecciona una sucursal.");
      return;
    }
    create.mutate({
      user_data: {
        email,
        first_name: firstName,
        last_name: lastName,
        dni,
        password,
        is_multi_branch: isMultiBranch,
      },
      branch_assignment: {
        branch_id: branchId,
        role,
        is_active: true,
      },
    });
  };

  const isPending = create.isPending || update.isPending;

  return (
    <AnimatedOverlay
      open={true}
      onClose={onClose}
      panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
    >
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-xl md:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">
            {isEditing ? "Editar usuario" : "Nuevo usuario"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          id="user-form"
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="first_name" className="text-sm font-medium">
                  Nombre
                </label>
                <Input
                  id="first_name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="last_name" className="text-sm font-medium">
                  Apellido
                </label>
                <Input
                  id="last_name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Correo
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="dni" className="text-sm font-medium">
                  RUT
                </label>
                <Input
                  id="dni"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  placeholder="12.345.678-9"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Contraseña {isEditing && "(solo si cambia)"}
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={!isEditing}
                  minLength={8}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="branch" className="text-sm font-medium">
                  Sucursal
                </label>
                {isEditing ? (
                  <Input
                    id="branch"
                    value={
                      manageableBranches.find((b) => String(b.branch_id) === branchId)
                        ? branchName(manageableBranches.find((b) => String(b.branch_id) === branchId)!)
                        : branchId
                    }
                    disabled
                  />
                ) : (
                  <Select
                    id="branch"
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    required
                  >
                    <option value="">Seleccionar sucursal</option>
                    {manageableBranches.map((b) => (
                      <option key={String(b.branch_id)} value={String(b.branch_id)}>
                        {branchName(b)}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="role" className="text-sm font-medium">
                  Rol
                </label>
                <Select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                >
                  {availableRoles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </div>

              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={isMultiBranch}
                  onChange={(e) => setIsMultiBranch(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Usuario multi-sucursal
              </label>

              {error && (
                <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger sm:col-span-2">
                  {error}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isPending}>
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </AnimatedOverlay>
  );
}
