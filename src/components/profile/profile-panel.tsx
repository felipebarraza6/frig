"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  User as UserIcon,
  KeyRound,
  Store,
  LogOut,
  Check,
  AlertCircle,
  Building2,
  CalendarDays,
  Clock,
  RefreshCw,
  Smartphone,
  CreditCard,
  Camera,
  ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSessionStore,
  useCurrentBranch,
  useCurrentBranchRole,
  useIsSuperAdmin,
} from "@/lib/store/session";
import { logout } from "@/lib/api/auth";
import { logoutLocal } from "@/lib/logout-local";
import { useToast } from "@/lib/store/toast";
import { APP_BUILD, checkForAppUpdate, isStandalonePwa } from "@/lib/pwa";
import { getRoleLabel } from "@/lib/roles";
import { fetchMyProfile, updateMyProfile, changePassword } from "@/lib/api/profile";
import { fetchBranches } from "@/lib/api/branches";
import type { BranchAssignment } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  coverBackground,
  defaultAppearance,
  loadProfileAppearance,
  resolveTextColor,
  saveProfileAppearance,
  TEXT_COLOR_PRESETS,
  type ProfileAppearance,
} from "@/lib/profile-appearance";
import { ProfileSubscriptionTab } from "./profile-subscription-tab";
import {
  AvatarPreview,
  ProfileAppearancePicker,
} from "./profile-appearance-picker";
import { useSubscriptionLock } from "@/lib/hooks/useSubscriptionLock";
import { subscriptionLockTitle } from "@/lib/subscription";

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

function formatDateShort(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

type SectionId = "personal" | "sucursales" | "suscripcion" | "seguridad" | "app";

const SECTIONS: {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    id: "personal",
    label: "Datos",
    icon: UserIcon,
    title: "Información personal",
    description: "Cómo te ven en el negocio",
  },
  {
    id: "sucursales",
    label: "Sucursales",
    icon: Store,
    title: "Mis sucursales",
    description: "Dónde operas y con qué rol",
  },
  {
    id: "suscripcion",
    label: "Suscripción",
    icon: CreditCard,
    title: "Suscripción",
    description: "Estado del plan, renovación e historial",
  },
  {
    id: "seguridad",
    label: "Seguridad",
    icon: KeyRound,
    title: "Seguridad",
    description: "Mantén tu acceso protegido",
  },
  {
    id: "app",
    label: "App",
    icon: Smartphone,
    title: "Aplicación",
    description: "Versión instalada y actualizaciones",
  },
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
      {tone === "error" ? (
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Check className="h-3.5 w-3.5 shrink-0" />
      )}
      {children}
    </motion.p>
  );
}

function ProfileStat({
  label,
  value,
  onClick,
  active,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const className = cn(
    "min-w-0 flex-1 px-1 py-1 text-left transition-colors",
    onClick && "cursor-pointer rounded-lg hover:bg-muted/50",
    active && "rounded-lg bg-muted/40",
  );
  const body = (
    <>
      <p className="truncate text-lg font-semibold tabular-nums tracking-tight text-foreground sm:text-xl">
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{label}</p>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

export function ProfilePanel() {
  const queryClient = useQueryClient();
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);
  const currentBranch = useCurrentBranch();
  const currentRole = useCurrentBranchRole();
  const isSuperAdmin = useIsSuperAdmin();

  const assignments = user?.branch_assignments ?? [];
  const {
    locked: subscriptionLocked,
    reason: lockReason,
    canManageSubscription,
    branch: lockBranch,
  } = useSubscriptionLock();

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: fetchMyProfile,
  });

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
  const [activeSection, setActiveSection] = useState<SectionId>(
    subscriptionLocked ? "suscripcion" : "personal",
  );
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [appearance, setAppearance] = useState<ProfileAppearance>(defaultAppearance);
  const [pickerTarget, setPickerTarget] = useState<"avatar" | "cover" | null>(null);
  const toast = useToast();

  if (subscriptionLocked && activeSection !== "suscripcion") {
    setActiveSection("suscripcion");
  }

  // Apariencia persistida por usuario (ajuste durante render, sin effect).
  const [appearanceUser, setAppearanceUser] = useState<string | number | null>(null);
  if (user?.id != null && appearanceUser !== user.id) {
    setAppearanceUser(user.id);
    setAppearance(loadProfileAppearance(user.id));
  }

  function handleAppearanceSave(next: ProfileAppearance) {
    const kind = pickerTarget;
    setAppearance(next);
    if (user?.id != null) saveProfileAppearance(user.id, next);
    toast.success(
      kind === "cover" ? "Fondo actualizado" : "Foto de perfil actualizada",
    );
  }

  function setTextColor(id: string) {
    const next = { ...appearance, textColorId: id };
    setAppearance(next);
    if (user?.id != null) saveProfileAppearance(user.id, next);
  }

  const visibleSections = subscriptionLocked
    ? SECTIONS.filter((s) => s.id === "suscripcion")
    : SECTIONS;

  async function handleCheckUpdate() {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      const result = await checkForAppUpdate();
      if (result === "updated") {
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

  const displayName =
    [values.first_name, values.last_name].filter(Boolean).join(" ") ||
    values.username ||
    "Usuario";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const roleLabel = isSuperAdmin
    ? "Superadmin"
    : getRoleLabel(currentRole) ?? currentRole ?? null;
  const branchLabel =
    currentBranch?.fantasy_name ||
    currentBranch?.branch_name ||
    currentBranch?.business_name ||
    null;
  const planLabel =
    lockBranch?.commercial_plan?.display_name ||
    lockBranch?.plan_name ||
    (currentBranch?.branch_id != null
      ? planByBranchId.get(String(currentBranch.branch_id))?.name
      : null) ||
    "Sin plan";
  const memberSince = formatDateShort(profile?.created);

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
    passwords.new_password.length === 0
      ? 0
      : passwords.new_password.length < 6
        ? 1
        : passwords.new_password.length < 10
          ? 2
          : 3;

  const passwordsMatch =
    passwords.confirm_password.length > 0 &&
    passwords.new_password === passwords.confirm_password;

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
  const coverStyle = { background: coverBackground(appearance.cover) };
  const textTone = resolveTextColor(appearance.textColorId);

  return (
    <div className="mx-auto flex min-h-full w-full min-w-0 max-w-6xl flex-col gap-5 p-4 sm:gap-6 sm:p-6 lg:p-8">
      {/* Hero plano: cover + identidad encima, sin glass anidado */}
      <header>
        <div
          className="relative overflow-hidden rounded-3xl border border-border/40"
          style={coverStyle}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/15" />
          <div className="absolute right-3 top-3 z-10 flex items-center gap-2 sm:right-4 sm:top-4">
            <button
              type="button"
              onClick={() => setPickerTarget("cover")}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/25 bg-black/35 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-black/50"
              title="Cambiar fondo"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Fondo</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await logout();
                } catch {
                  /* ignora errores de red */
                }
                await logoutLocal(queryClient);
                window.location.assign("/login");
              }}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/25 bg-black/35 px-2.5 py-1.5 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-black/50"
              title="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>

          <div className="relative flex min-h-[11.5rem] flex-col justify-end gap-4 px-4 pb-4 pt-16 sm:min-h-[13.5rem] sm:flex-row sm:items-end sm:gap-5 sm:px-6 sm:pb-5 sm:pt-20 lg:min-h-[15rem] lg:px-8">
            <button
              type="button"
              onClick={() => setPickerTarget("avatar")}
              className="group relative w-fit shrink-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              title="Cambiar foto de perfil"
            >
              {loadingProfile ? (
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/90 bg-muted text-2xl font-bold text-muted-foreground shadow-md sm:h-28 sm:w-28 lg:h-32 lg:w-32">
                  …
                </div>
              ) : (
                <AvatarPreview
                  refStyle={appearance.avatar}
                  initials={initials}
                  size="xl"
                  className="border-white/90"
                />
              )}
              <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-transform group-hover:scale-105">
                <Camera className="h-3.5 w-3.5" />
              </span>
            </button>

            <div className="min-w-0 flex-1 sm:pb-1">
              <h1
                className="truncate font-display text-2xl font-semibold tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] sm:text-3xl"
                style={{ color: textTone.color }}
              >
                {loadingProfile ? "Cargando…" : displayName}
              </h1>
              <p
                className="mt-1 truncate text-sm drop-shadow-sm sm:text-base"
                style={{ color: textTone.muted }}
              >
                @{values.username || user?.username || "usuario"}
                {values.email ? ` · ${values.email}` : ""}
              </p>

              <div
                className="mt-3 flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label="Color del nombre"
              >
                <span
                  className="mr-1 text-[10px] font-medium uppercase tracking-wide"
                  style={{ color: textTone.muted }}
                >
                  Texto
                </span>
                {TEXT_COLOR_PRESETS.map((tone) => {
                  const selected = appearance.textColorId === tone.id;
                  return (
                    <button
                      key={tone.id}
                      type="button"
                      title={tone.label}
                      aria-label={`Color ${tone.label}`}
                      aria-pressed={selected}
                      onClick={() => setTextColor(tone.id)}
                      className={cn(
                        "h-5 w-5 rounded-full border border-white/40 shadow-sm transition-transform hover:scale-110",
                        selected && "ring-2 ring-white ring-offset-1 ring-offset-black/40",
                      )}
                      style={{ background: tone.swatch }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex flex-wrap items-center gap-1.5">
            {roleLabel && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                {roleLabel}
              </span>
            )}
            {branchLabel && (
              <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                <Store className="h-3 w-3 shrink-0" />
                <span className="truncate">{branchLabel}</span>
              </span>
            )}
            {subscriptionLocked && (
              <span className="rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger">
                Plan bloqueado
              </span>
            )}
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-3 gap-3 sm:max-w-md sm:gap-4">
            <ProfileStat
              label="Sucursales"
              value={String(assignments.length)}
              onClick={
                subscriptionLocked ? undefined : () => setActiveSection("sucursales")
              }
              active={activeSection === "sucursales"}
            />
            <ProfileStat
              label="Plan"
              value={planLabel}
              onClick={() => setActiveSection("suscripcion")}
              active={activeSection === "suscripcion"}
            />
            <ProfileStat label="Desde" value={loadingProfile ? "…" : memberSince} />
          </div>
        </div>
      </header>

      {subscriptionLocked && lockReason && (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <p className="font-semibold">{subscriptionLockTitle(lockReason)}</p>
          <p className="mt-1 text-xs text-danger/90">
            {canManageSubscription
              ? "Contrata un plan abajo: se activa solo cuando el pago se confirma."
              : "Contacta al administrador o propietario de la sucursal. Solo el propietario puede contratar el plan."}
          </p>
          <a
            href="/support"
            className="mt-2 inline-flex text-xs font-semibold underline underline-offset-2"
          >
            Pedir soporte
          </a>
        </div>
      )}

      {/* Tabs estilo timeline / perfil */}
      <div
        role="tablist"
        aria-label="Secciones del perfil"
        className="flex gap-0 overflow-x-auto border-b border-border"
      >
        {visibleSections.map((s) => {
          const Icon = s.icon;
          const selected = activeSection === s.id;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors sm:px-4",
                selected
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{s.label}</span>
              {selected && (
                <motion.span
                  layoutId="profile-tab-underline"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeSection}
          role="tabpanel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="min-w-0"
        >
          {activeSection !== "suscripcion" && (
            <div className="mb-4">
              <h2 className="text-sm font-semibold">{active.title}</h2>
              <p className="text-xs text-muted-foreground">{active.description}</p>
            </div>
          )}

          {activeSection === "personal" &&
            (loadingProfile ? (
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  {profileSuccess && (
                    <Feedback tone="success">Perfil actualizado correctamente.</Feedback>
                  )}
                </AnimatePresence>

                <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
                  {!isDirty && !updateProfile.isPending && (
                    <span className="text-xs text-muted-foreground">Sin cambios</span>
                  )}
                  <Button
                    type="submit"
                    isLoading={updateProfile.isPending}
                    disabled={!isDirty || updateProfile.isPending}
                  >
                    Guardar cambios
                  </Button>
                </div>
              </form>
            ))}

          {activeSection === "suscripcion" && <ProfileSubscriptionTab />}

          {activeSection === "sucursales" && (
            <div>
              {assignments.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
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
                    const plan =
                      a.branch_id != null
                        ? planByBranchId.get(String(a.branch_id))
                        : undefined;
                    return (
                      <li
                        key={String(a.id ?? `${a.branch_id}-${idx}`)}
                        className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {a.branch_name ?? `Sucursal ${a.branch_id}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getRoleLabel(a.role_code) ??
                              a.role_name ??
                              a.role_code ??
                              "—"}
                          </p>
                          {branchesData && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <CreditCard className="h-3 w-3 shrink-0" />
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
                    <p className="text-xs text-muted-foreground">
                      Estado y actividad de tu acceso
                    </p>
                  </div>
                  <dl className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                    <div className="flex items-start gap-2.5">
                      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <dt className="text-xs text-muted-foreground">Miembro desde</dt>
                        <dd className="mt-0.5 text-sm font-medium">
                          {formatDate(profile?.created)}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <dt className="text-xs text-muted-foreground">Último acceso</dt>
                        <dd className="mt-0.5 text-sm font-medium">
                          {formatDateTime(profile?.last_login)}
                        </dd>
                      </div>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          )}

          {activeSection === "seguridad" && (
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Contraseña actual"
                  htmlFor="current_password"
                  className="sm:col-span-2 sm:max-w-xs"
                >
                  <Input
                    id="current_password"
                    type="password"
                    value={passwords.current_password}
                    onChange={(e) =>
                      setPasswords({ ...passwords, current_password: e.target.value })
                    }
                    autoComplete="current-password"
                  />
                </Field>
                <Field
                  label="Nueva contraseña"
                  htmlFor="new_password"
                  hint={
                    passwords.new_password.length > 0
                      ? ["Débil", "Media", "Fuerte"][passwordStrength - 1]
                      : undefined
                  }
                >
                  <Input
                    id="new_password"
                    type="password"
                    value={passwords.new_password}
                    onChange={(e) =>
                      setPasswords({ ...passwords, new_password: e.target.value })
                    }
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
                  error={
                    passwords.confirm_password.length > 0 && !passwordsMatch
                      ? "No coinciden"
                      : null
                  }
                >
                  <Input
                    id="confirm_password"
                    type="password"
                    value={passwords.confirm_password}
                    onChange={(e) =>
                      setPasswords({ ...passwords, confirm_password: e.target.value })
                    }
                    autoComplete="new-password"
                    aria-invalid={
                      passwords.confirm_password.length > 0 && !passwordsMatch
                    }
                  />
                </Field>
              </div>

              <AnimatePresence>
                {passwordError && <Feedback tone="error">{passwordError}</Feedback>}
                {passwordSuccess && (
                  <Feedback tone="success">Contraseña actualizada correctamente.</Feedback>
                )}
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
              <div className="rounded-xl border border-border/70 px-4 py-3 text-sm">
                <dl className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Versión</dt>
                    <dd className="font-mono text-xs font-semibold tabular-nums">
                      v{APP_BUILD}
                    </dd>
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

      {pickerTarget && (
        <ProfileAppearancePicker
          open
          target={pickerTarget}
          appearance={appearance}
          initials={initials}
          onClose={() => setPickerTarget(null)}
          onSave={handleAppearanceSave}
        />
      )}
    </div>
  );
}
