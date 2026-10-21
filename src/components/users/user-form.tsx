"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRUT, isValidRUT } from "@/lib/validation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { useSessionStore, useCurrentBranch, useIsModuleEnabledFromConfig } from "@/lib/store/session";
import { branchName } from "@/lib/types";
import { ROLE_LABELS, formDriverRoleCode, isDriverRole } from "@/lib/roles";
import { createAndAssignUser, updateUser, changeAssignmentRole } from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";
import { useToast } from "@/lib/store/toast";
import type { Branch, UserPayload, UserResponse } from "@/lib/types";

interface UserFormProps {
  user?: UserResponse;
  onClose: () => void;
  onSuccess: () => void;
}

// Catálogo FRIG con el módulo que habilita cada rol operativo (null = siempre
// disponible). MANAGER se mantiene por compatibilidad con asignaciones ya
// existentes, aunque no forme parte del catálogo público FRIG.
const ALL_ROLES: { code: string; label: string; module: string | null }[] = [
  { code: "OWNER", label: ROLE_LABELS.OWNER, module: null },
  { code: "ADMIN_LOCAL", label: ROLE_LABELS.ADMIN_LOCAL, module: null },
  { code: "MANAGER", label: ROLE_LABELS.MANAGER, module: null },
  { code: "EMPLOYEE", label: ROLE_LABELS.EMPLOYEE, module: null },
  { code: "CAJERO", label: ROLE_LABELS.CAJERO, module: "pos" },
  { code: "WAITER", label: ROLE_LABELS.WAITER, module: "tables" },
  { code: "COCINERO", label: ROLE_LABELS.COCINERO, module: "production" },
  { code: "REPARTIDOR", label: ROLE_LABELS.REPARTIDOR, module: "deliveries" },
];

export function UserForm({ user, onClose, onSuccess }: UserFormProps) {
  const currentUser = useSessionStore((s) => s.user);
  const branches = useSessionStore((s) => s.branches);
  const currentBranch = useCurrentBranch();
  const isSuperAdmin = Boolean(currentUser?.is_superuser || currentUser?.type_user === "ADM");
  const isEditing = Boolean(user);
  const isPosModuleEnabled = useIsModuleEnabledFromConfig("pos");
  const isTablesModuleEnabled = useIsModuleEnabledFromConfig("tables");
  const isProductionModuleEnabled = useIsModuleEnabledFromConfig("production");
  const isDeliveriesModuleEnabled = useIsModuleEnabledFromConfig("deliveries");

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

  const currentAssignment = user?.branch_access;

  const availableRoles = useMemo(() => {
    const moduleEnabledMap: Record<string, boolean> = {
      pos: isPosModuleEnabled,
      tables: isTablesModuleEnabled,
      production: isProductionModuleEnabled,
      deliveries: isDeliveriesModuleEnabled,
    };
    let roles = ALL_ROLES.filter((r) => !r.module || moduleEnabledMap[r.module]);
    if (!isSuperAdmin) {
      roles = roles.filter((r) => r.code !== "OWNER");
    }
    // Al editar, el rol actual se mantiene aunque su módulo esté apagado: si
    // no, el select caería a otro rol y se cambiaría silenciosamente al guardar.
    if (isEditing && currentAssignment?.role_code) {
      const code = currentAssignment.role_code;
      const already = roles.some(
        (r) => r.code === code || (isDriverRole(code) && r.code === "REPARTIDOR"),
      );
      if (!already) {
        const formCode = formDriverRoleCode(code) ?? code;
        roles = [...roles, { code: formCode, label: ROLE_LABELS[formCode] ?? ROLE_LABELS[code] ?? code, module: null }];
      }
    }
    return roles;
  }, [
    isSuperAdmin,
    isEditing,
    currentAssignment,
    isPosModuleEnabled,
    isTablesModuleEnabled,
    isProductionModuleEnabled,
    isDeliveriesModuleEnabled,
  ]);

  // Solo un owner multi-sucursal (o superadmin) puede crear/editar usuarios
  // multi-sucursal; el check no se muestra a otros roles.
  const canGrantMultiBranch =
    isSuperAdmin ||
    (Boolean(currentUser?.is_multi_branch) &&
      Boolean(
        currentUser?.branch_assignments?.some((a) => a.role_code === "OWNER"),
      ));

  const initialRole =
    formDriverRoleCode(currentAssignment?.role_code) ??
    availableRoles[0]?.code ??
    "EMPLOYEE";

  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [dni, setDni] = useState(user?.dni ?? "");
  const [password, setPassword] = useState("");
  const [setPasswordNow, setSetPasswordNow] = useState(false);
  const [assignExisting, setAssignExisting] = useState(false);
  const [queuedInvite, setQueuedInvite] = useState(false);
  const toast = useToast();
  const [branchId, setBranchId] = useState<string>(
    currentAssignment?.branch_id ? String(currentAssignment.branch_id) : currentBranch ? String(currentBranch.branch_id) : "",
  );
  const [role, setRole] = useState<string>(initialRole);
  const [isMultiBranch, setIsMultiBranch] = useState(user?.is_multi_branch ?? false);

  const effectiveRole = (availableRoles.length > 0 && !availableRoles.some((r) => r.code === role))
    ? availableRoles[0].code
    : role;

  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: createAndAssignUser,
    onSuccess: (data) => {
      if (data.invitation_queued) {
        setQueuedInvite(true);
        toast.success(
          data.needs_password_setup
            ? "Invitación encolada. El usuario definirá su clave desde el correo."
            : "Correo de acceso encolado.",
        );
      } else if (data.assigned_existing) {
        toast.success("Usuario existente asignado a esta sucursal.");
      }
      onSuccess();
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && err.status === 409) {
        const detail = err.detail as { code?: string; already_in_branch?: boolean } | undefined;
        if (detail?.code === "email_already_registered") {
          setAssignExisting(true);
          setError(
            err.message ||
              "Este correo ya está registrado. Confirma para asignarlo a esta sucursal.",
          );
          return;
        }
        if (detail?.code === "already_in_branch") {
          setError("Este usuario ya pertenece a esta sucursal.");
          return;
        }
      }
      setError(err.message || "No se pudo crear el usuario.");
    },
  });

  const update = useMutation({
    mutationFn: async (normalizedDni: string) => {
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
        dni: normalizedDni,
      };
      if (password) payload.password = password;
      await updateUser(Number(user.id), payload);

      if (
        currentAssignment?.id &&
        formDriverRoleCode(effectiveRole) !== formDriverRoleCode(currentAssignment.role_code)
      ) {
        await changeAssignmentRole(Number(currentAssignment.id), effectiveRole);
      }
    },
    onSuccess: () => onSuccess(),
    onError: (err: Error) => setError(err.message || "No se pudo actualizar el usuario."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalizedDni = dni.trim() ? formatRUT(dni.trim()) : dni;
    if (normalizedDni !== dni) setDni(normalizedDni);

    if (normalizedDni && !isValidRUT(normalizedDni)) {
      setError("El RUT ingresado no es válido.");
      return;
    }

    if (isEditing) {
      update.mutate(normalizedDni);
      return;
    }

    if (!branchId) {
      setError("Selecciona una sucursal.");
      return;
    }
    if (setPasswordNow && password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    const payload: UserPayload = {
      user_data: {
        email,
        first_name: firstName,
        last_name: lastName,
        dni: normalizedDni,
        is_multi_branch: canGrantMultiBranch ? isMultiBranch : false,
      },
      branch_assignment: {
        branch_id: branchId,
        role: effectiveRole,
        is_active: true,
      },
    };
    if (setPasswordNow && password) {
      payload.user_data.password = password;
    }
    if (assignExisting) {
      payload.assign_existing = true;
    }
    create.mutate(payload);
  };

  const isPending = create.isPending || update.isPending;

  return (
    <AnimatedOverlay
      open={true}
      onClose={onClose}
      panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
    >
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-background shadow-lg md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-xl md:border">
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
                  onBlur={() => {
                    if (dni.trim()) setDni(formatRUT(dni.trim()));
                  }}
                  placeholder="12.345.678-5"
                  required
                />
              </div>

              {isEditing ? (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    Contraseña (solo si cambia)
                  </label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={setPasswordNow}
                      onChange={(e) => setSetPasswordNow(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    Crear con clave ahora (si no, se invita por correo)
                  </label>
                  {setPasswordNow && (
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                      required
                      placeholder="Mínimo 8 caracteres"
                    />
                  )}
                </div>
              )}

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
                  value={effectiveRole}
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

              {canGrantMultiBranch && (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={isMultiBranch}
                    onChange={(e) => setIsMultiBranch(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  Usuario multi-sucursal
                </label>
              )}

              {error && (
                <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger sm:col-span-2">
                  {error}
                </p>
              )}
              {assignExisting && !isEditing && (
                <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm sm:col-span-2">
                  Este correo ya existe. Pulsa «Asignar a esta sucursal» para darle acceso aquí.
                </p>
              )}
              {queuedInvite && (
                <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success sm:col-span-2">
                  Invitación encolada. Si el correo no llega, reenvíala desde el listado.
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isPending}>
              {isEditing
                ? "Guardar"
                : assignExisting
                  ? "Asignar a esta sucursal"
                  : setPasswordNow
                    ? "Crear usuario"
                    : "Invitar por correo"}
            </Button>
          </div>
        </form>
      </div>
    </AnimatedOverlay>
  );
}
