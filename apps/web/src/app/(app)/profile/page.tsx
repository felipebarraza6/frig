"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User as UserIcon, KeyRound, Store, Check, Loader2, AlertCircle, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/store/session";
import { fetchMyProfile, updateMyProfile, changePassword } from "@/lib/api/profile";
import type { BranchAssignment } from "@/lib/types";

function assignmentStatus(a: BranchAssignment): string {
  if (a.is_default) return "Por defecto";
  return a.is_active ? "Activa" : "Inactiva";
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);
  const assignments = user?.branch_assignments ?? [];

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: fetchMyProfile,
  });

  type ProfileForm = {
    first_name: string;
    last_name: string;
    email: string;
    username: string;
    dni: string;
  };

  const [draft, setDraft] = useState<Partial<ProfileForm>>({});

  const values: ProfileForm = useMemo(
    () => ({
      first_name: draft.first_name ?? profile?.first_name ?? "",
      last_name: draft.last_name ?? profile?.last_name ?? "",
      email: draft.email ?? profile?.email ?? "",
      username: draft.username ?? profile?.username ?? "",
      dni: draft.dni ?? profile?.dni ?? "",
    }),
    [draft, profile],
  );

  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const updateProfile = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (data) => {
      setProfileSuccess(true);
      setProfileError(null);
      setTimeout(() => setProfileSuccess(false), 3000);
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      if (user) {
        setUser({
          ...user,
          first_name: data.first_name ?? user.first_name,
          last_name: data.last_name ?? user.last_name,
          email: data.email ?? user.email,
          username: data.username ?? user.username,
          dni: data.dni ?? user.dni,
        });
      }
    },
    onError: (err: Error) => {
      setProfileError(err.message || "No se pudo actualizar el perfil.");
    },
  });

  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const changePass = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError(null);
      setPasswords({ current_password: "", new_password: "", confirm_password: "" });
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (err: Error) => {
      setPasswordError(err.message || "No se pudo cambiar la contraseña.");
    },
  });

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileSuccess(false);
    setProfileError(null);
    updateProfile.mutate(values);
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordSuccess(false);
    setPasswordError(null);
    if (passwords.new_password !== passwords.confirm_password) {
      setPasswordError("Las contraseñas nuevas no coinciden.");
      return;
    }
    changePass.mutate(passwords);
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-2 border-b border-border px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Mi perfil</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona tus datos, tus sucursales y tu contraseña.
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Información personal */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Información personal</h2>
          </div>

          {loadingProfile ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="first_name" className="text-xs font-medium text-muted-foreground">
                    Nombre
                  </label>
                  <Input
                    id="first_name"
                    value={values.first_name}
                    onChange={(e) => setDraft({ ...draft, first_name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="last_name" className="text-xs font-medium text-muted-foreground">
                    Apellidos
                  </label>
                  <Input
                    id="last_name"
                    value={values.last_name}
                    onChange={(e) => setDraft({ ...draft, last_name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                    Correo electrónico
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={values.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="username" className="text-xs font-medium text-muted-foreground">
                    Nombre de usuario
                  </label>
                  <Input
                    id="username"
                    value={values.username}
                    onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="dni" className="text-xs font-medium text-muted-foreground">
                    RUT
                  </label>
                  <Input
                    id="dni"
                    value={values.dni}
                    onChange={(e) => setDraft({ ...draft, dni: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Tipo de usuario</span>
                  <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {user?.type_user ?? "—"}
                  </p>
                </div>
              </div>

              {profileError && (
                <div className="flex items-center gap-2 text-sm text-danger">
                  <AlertCircle className="h-4 w-4" />
                  {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <Check className="h-4 w-4" />
                  Perfil actualizado correctamente.
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar cambios
                </Button>
              </div>
            </form>
          )}
        </section>

        {/* Mis sucursales */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Mis sucursales</h2>
          </div>

          {assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Sin sucursales asignadas</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Cuando un administrador te asigne a una sucursal, aparecerá aquí.
              </p>
            </div>
          ) : (
            <>
              {/* Vista cards en móvil */}
              <div className="flex flex-col gap-3 sm:hidden">
                {assignments.map((a, idx) => (
                  <div
                    key={String(a.id ?? `${a.branch_id}-${idx}`)}
                    className="flex items-center justify-between rounded-xl border border-border bg-background p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {a.branch_name ?? `Sucursal ${a.branch_id}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.role_name ?? a.role_code ?? "—"}
                      </p>
                    </div>
                    <span
                      className={
                        a.is_active
                          ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                          : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                      }
                    >
                      {assignmentStatus(a)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Vista tabla en desktop */}
              <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">Sucursal</th>
                      <th className="px-4 py-3">Rol</th>
                      <th className="px-4 py-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a, idx) => (
                      <tr key={String(a.id ?? `${a.branch_id}-${idx}`)} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">{a.branch_name ?? `Sucursal ${a.branch_id}`}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {a.role_name ?? a.role_code ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={
                              a.is_active
                                ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                                : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                            }
                          >
                            {assignmentStatus(a)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* Cambiar contraseña */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Seguridad</h2>
          </div>

          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="current_password" className="text-xs font-medium text-muted-foreground">
                  Contraseña actual
                </label>
                <Input
                  id="current_password"
                  type="password"
                  value={passwords.current_password}
                  onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
                />
              </div>
              <div />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="new_password" className="text-xs font-medium text-muted-foreground">
                  Nueva contraseña
                </label>
                <Input
                  id="new_password"
                  type="password"
                  value={passwords.new_password}
                  onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm_password" className="text-xs font-medium text-muted-foreground">
                  Confirmar nueva contraseña
                </label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={passwords.confirm_password}
                  onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })}
                />
              </div>
            </div>

            {passwordError && (
              <div className="flex items-center gap-2 text-sm text-danger">
                <AlertCircle className="h-4 w-4" />
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <Check className="h-4 w-4" />
                Contraseña actualizada correctamente.
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={changePass.isPending}>
                {changePass.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cambiar contraseña
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
