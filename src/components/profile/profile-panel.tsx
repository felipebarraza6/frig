"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { User as UserIcon, KeyRound, Store, Check, AlertCircle, Building2, CalendarDays, Clock, RefreshCw, Smartphone, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionStore } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import { APP_BUILD, checkForAppUpdate, isStandalonePwa } from "@/lib/pwa";
import { getRoleLabel } from "@/lib/roles";
import { fetchMyProfile, updateMyProfile, changePassword } from "@/lib/api/profile";
import { fetchBranches } from "@/lib/api/branches";
import type { BranchAssignment } from "@/lib/types";
import { cn } from "@/lib/utils";

function assignmentStatus(a: BranchAssignment): string {
  if (a.is_default) return "Por defecto";
  return a.is_active ? "Activa" : "Inactiva";
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

type SectionId = "personal" | "sucursales" | "seguridad" | "app";

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon; title: string; description: string }[] = [
  { id: "personal", label: "Datos", icon: UserIcon, title: "Información personal", description: "Cómo te ven en el negocio" },
  { id: "sucursales", label: "Sucursales", icon: Store, title: "Mis sucursales", description: "Dónde operas y con qué rol" },
  { id: "seguridad", label: "Seguridad", icon: KeyRound, title: "Seguridad", description: "Mantén tu acceso protegido" },
  { id: "app", label: "App", icon: Smartphone, title: "Aplicación", description: "Versión instalada y actualizaciones" },
];

type ProfileForm = {
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  dni: string;
};

function Feedback({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn(
        "flex items-center gap-2 text-xs font-medium",
        tone === "error" ? "text-danger" : "text-success",
      )}
    >
      {tone === "error" ? <AlertCircle className="h-3.5 w-3.5 shrink-0" /> : <Check className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </motion.p>
  );
}

export function ProfilePanel() {
  const queryClient = useQueryClient();
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);
  const assignments = user?.branch_assignments ?? [];

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: fetchMyProfile,
  });

  // Plan por sucursal: la lista /branches/ ya trae plan_name y
  // plan_expiration_date por cada sucursal a la que el usuario tiene acceso.
  const { data: branchesData } = useQuery({
    queryKey: ["branches", "accessible"],
    queryFn: () => fetchBranches(),
    staleTime: 5 * 60 * 1000,
  });

  const planByBranchId = useMemo(() => {
    const map = new Map<string, { name?: string | null; expires?: string | null }>();
    for (const b of branchesData?.results ?? []) {
      map.set(String(b.branch_id ?? b.id), {
        name: b.plan_name,
        expires: b.plan_expiration_date,
      });
    }
    return map;
  }, [branchesData]);

  const [draft, setDraft] = useState<Partial<ProfileForm>>({});
  const [activeSection, setActiveSection] = useState<SectionId>("personal");
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const toast = useToast();

  async function handleCheckUpdate() {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      const result = await checkForAppUpdate();
      if (result === "updated") {
        // El SW nuevo toma control y dispara el toast persistente con Recargar.
        toast.info("Nueva versión encontrada. Confirma con Recargar.");
      } else if (result === "latest") {
        toast.success("Ya tienes la última versión");
      } else {
        toast.error("Actualización no disponible en este navegador");
      }
    } finally {
      setCheckingUpdate(false);
    }
  }

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

  const isDirty =
    (draft.first_name !== undefined && draft.first_name !== (profile?.first_name ?? "")) ||
    (draft.last_name !== undefined && draft.last_name !== (profile?.last_name ?? "")) ||
    (draft.email !== undefined && draft.email !== (profile?.email ?? "")) ||
    (draft.username !== undefined && draft.username !== (profile?.username ?? "")) ||
    (draft.dni !== undefined && draft.dni !== (profile?.dni ?? ""));

  const displayName = [values.first_name, values.last_name].filter(Boolean).join(" ") || values.username || "Usuario";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const pills = (
    assignments.length === 1
      ? [getRoleLabel(assignments[0]?.role_code) ?? ""]
      : assignments.length > 1
        ? [`${assignments.length} sucursales`]
        : []
  ).filter(Boolean);

  const updateProfile = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (data) => {
      setProfileSuccess(true);
      setProfileError(null);
      setDraft({});
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

  const passwordStrength =
    passwords.new_password.length === 0 ? 0 : passwords.new_password.length < 6 ? 1 : passwords.new_password.length < 10 ? 2 : 3;

  const passwordsMatch =
    passwords.confirm_password.length > 0 && passwords.new_password === passwords.confirm_password;

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

  const active = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-6 p-4 sm:p-6">
      {/* Encabezado: identidad compacta */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex items-center gap-4"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground shadow-sm">
          {loadingProfile ? "…" : initials}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold">{loadingProfile ? "Cargando…" : displayName}</h1>
          <p className="truncate text-xs text-muted-foreground">{values.email || user?.username || "Tu cuenta"}</p>
          {pills.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {pills.map((pill) => (
                <span
                  key={pill}
                  className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                >
                  {pill}
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.header>

      {/* Tabs segmentadas: mismo control en móvil y escritorio */}
      <div role="tablist" aria-label="Secciones del perfil" className="flex gap-1 rounded-lg bg-muted p-1">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={activeSection === s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                activeSection === s.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenido de la pestaña activa */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeSection}
          role="tabpanel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="px-1 pt-2"
        >
          <div className="mb-6">
            <h2 className="text-sm font-semibold">{active.title}</h2>
            <p className="text-xs text-muted-foreground">{active.description}</p>
          </div>

          {activeSection === "personal" &&
            (loadingProfile ? (
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-1.5">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-10 w-32 self-end" />
              </div>
            ) : (
              <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nombre" htmlFor="first_name">
                    <Input
                      id="first_name"
                      value={values.first_name}
                      onChange={(e) => setDraft({ ...draft, first_name: e.target.value })}
                      autoComplete="given-name"
                    />
                  </Field>
                  <Field label="Apellidos" htmlFor="last_name">
                    <Input
                      id="last_name"
                      value={values.last_name}
                      onChange={(e) => setDraft({ ...draft, last_name: e.target.value })}
                      autoComplete="family-name"
                    />
                  </Field>
                  <Field label="Correo electrónico" htmlFor="email">
                    <Input
                      id="email"
                      type="email"
                      value={values.email}
                      onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                      autoComplete="email"
                    />
                  </Field>
                  <Field label="Nombre de usuario" htmlFor="username">
                    <Input
                      id="username"
                      value={values.username}
                      onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                      autoComplete="username"
                    />
                  </Field>
                  <Field label="RUT" htmlFor="dni" hint="Formato chileno con dígito verificador">
                    <Input
                      id="dni"
                      value={values.dni}
                      onChange={(e) => setDraft({ ...draft, dni: e.target.value })}
                    />
                  </Field>
                </div>

                <AnimatePresence>
                  {profileError && <Feedback tone="error">{profileError}</Feedback>}
                  {profileSuccess && <Feedback tone="success">Perfil actualizado correctamente.</Feedback>}
                </AnimatePresence>

                <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
                  {!isDirty && !updateProfile.isPending && (
                    <span className="text-xs text-muted-foreground">Sin cambios</span>
                  )}
                  <Button type="submit" isLoading={updateProfile.isPending} disabled={!isDirty || updateProfile.isPending}>
                    Guardar cambios
                  </Button>
                </div>
              </form>
            ))}

          {activeSection === "sucursales" && (
            <>
              {assignments.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Sin sucursales asignadas</p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    Cuando un administrador te asigne a una sucursal, aparecerá aquí.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {assignments.map((a, idx) => {
                    const plan = a.branch_id != null ? planByBranchId.get(String(a.branch_id)) : undefined;
                    return (
                    <li
                      key={String(a.id ?? `${a.branch_id}-${idx}`)}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.branch_name ?? `Sucursal ${a.branch_id}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {getRoleLabel(a.role_code) ?? a.role_name ?? a.role_code ?? "—"}
                        </p>
                        {branchesData && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Store className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {plan?.name ?? "Sin plan"}
                              {plan?.expires ? ` · vence ${formatDate(plan.expires)}` : ""}
                            </span>
                          </p>
                        )}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                          a.is_active
                            ? a.is_default
                              ? "bg-primary/10 text-primary"
                              : "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {assignmentStatus(a)}
                      </span>
                    </li>
                    );
                  })}
                </ul>
              )}

              {!loadingProfile && (
                <div className="mt-6 border-t border-border pt-6">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold">Cuenta</h3>
                    <p className="text-xs text-muted-foreground">Estado y actividad de tu acceso</p>
                  </div>
                  <dl className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                    <div className="flex items-start gap-2.5">
                      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <dt className="text-xs text-muted-foreground">Miembro desde</dt>
                        <dd className="mt-0.5 text-sm font-medium">{formatDate(profile?.created)}</dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <dt className="text-xs text-muted-foreground">Último acceso</dt>
                        <dd className="mt-0.5 text-sm font-medium">{formatDateTime(profile?.last_login)}</dd>
                      </div>
                    </div>
                  </dl>
                </div>
              )}
            </>
          )}

          {activeSection === "seguridad" && (
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Contraseña actual" htmlFor="current_password" className="sm:col-span-2 sm:max-w-xs">
                  <Input
                    id="current_password"
                    type="password"
                    value={passwords.current_password}
                    onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
                    autoComplete="current-password"
                  />
                </Field>
                <Field
                  label="Nueva contraseña"
                  htmlFor="new_password"
                  hint={passwords.new_password.length > 0 ? ["Débil", "Media", "Fuerte"][passwordStrength - 1] : undefined}
                >
                  <Input
                    id="new_password"
                    type="password"
                    value={passwords.new_password}
                    onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
                    autoComplete="new-password"
                  />
                  {passwords.new_password.length > 0 && (
                    <div className="flex gap-1" aria-hidden>
                      {[1, 2, 3].map((level) => (
                        <span
                          key={level}
                          className={cn(
                            "h-1 flex-1 rounded-full transition-colors",
                            passwordStrength >= level
                              ? passwordStrength >= 3
                                ? "bg-success"
                                : passwordStrength === 2
                                  ? "bg-warning"
                                  : "bg-danger"
                              : "bg-muted",
                          )}
                        />
                      ))}
                    </div>
                  )}
                </Field>
                <Field
                  label="Confirmar nueva contraseña"
                  htmlFor="confirm_password"
                  error={passwords.confirm_password.length > 0 && !passwordsMatch ? "No coinciden" : null}
                >
                  <Input
                    id="confirm_password"
                    type="password"
                    value={passwords.confirm_password}
                    onChange={(e) => setPasswords({ ...passwords, confirm_password: e.target.value })}
                    autoComplete="new-password"
                    aria-invalid={passwords.confirm_password.length > 0 && !passwordsMatch}
                  />
                </Field>
              </div>

              <AnimatePresence>
                {passwordError && <Feedback tone="error">{passwordError}</Feedback>}
                {passwordSuccess && <Feedback tone="success">Contraseña actualizada correctamente.</Feedback>}
              </AnimatePresence>

              <div className="flex justify-end border-t border-border pt-4">
                <Button
                  type="submit"
                  isLoading={changePass.isPending}
                  disabled={
                    changePass.isPending ||
                    !passwords.current_password ||
                    !passwords.new_password ||
                    !passwordsMatch
                  }
                >
                  Cambiar contraseña
                </Button>
              </div>
            </form>
          )}

          {activeSection === "app" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                <dl className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Versión</dt>
                    <dd className="font-mono text-xs font-semibold tabular-nums">v{APP_BUILD}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Modo</dt>
                    <dd className="text-xs font-semibold">
                      {isStandalonePwa() ? "App instalada (PWA)" : "Navegador web"}
                    </dd>
                  </div>
                </dl>
              </div>
              <p className="text-xs text-muted-foreground">
                Si hay una versión nueva, se descarga al tocar el botón y podrás aplicarla
                con Recargar. La app también avisa sola cuando detecta un deploy nuevo.
              </p>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCheckUpdate}
                  disabled={checkingUpdate}
                  isLoading={checkingUpdate}
                >
                  {!checkingUpdate && <RefreshCw className="mr-2 h-4 w-4" />}
                  Buscar actualizaciones
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
