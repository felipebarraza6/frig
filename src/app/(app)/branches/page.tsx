"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, Pencil, Power, Store, Users, Palette, Building2,
  Phone, Mail, CreditCard, FileText, MapPin, Globe,
  BadgeCheck, IdCard, ChevronRight, AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import {
  useSessionStore,
  useCanViewBranches,
} from "@/lib/store/session";
import { branchName } from "@/lib/types";
import { fetchBranches, updateBranch } from "@/lib/api/branches";
import { fetchBranchModules } from "@/lib/api/branch-modules";
import { getRoleLabel } from "@/lib/roles";
import { BranchForm } from "@/components/branches/branch-form";
import { BranchUsersDialog } from "@/components/branches/branch-users-dialog";
import { BranchThemeDialog } from "@/components/branches/branch-theme-dialog";
import { BranchSiiDialog } from "@/components/branches/branch-sii-dialog";
import { ApplyPlanDialog } from "@/components/branches/apply-plan-dialog";
import type { Branch } from "@/lib/types";
import type { BranchesFilter } from "@/lib/api/branches";
import type { BranchModuleConfiguration } from "@/lib/api/branch-modules";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";

type StatusFilter = "all" | "active" | "inactive";

/** Etiqueta corta en español para cada módulo (los chips nunca muestran el slug). */
const MODULE_SHORT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  config: "Configuración",
  sales: "Ventas",
  finance: "Finanzas",
  customers: "Clientes",
  clients: "Clientes",
  suppliers: "Proveedores",
  inventory: "Inventario",
  employees: "Empleados",
  logistics: "Logística",
  services: "Servicios",
  equipment: "Equipamiento",
  promotions: "Promos",
  tables: "Mesas",
  scheduling: "Agendamiento",
  ai_agents: "IA",
  support: "Soporte",
  workflows: "Flujos",
  analytics: "Analítica",
  public_catalog: "Menú QR",
  audit: "Auditoría",
  production: "Cocina",
  iot_telemetry: "IoT",
  water_management: "Aguas",
  nutrition: "Nutricional",
  waste_management: "Residuos",
  pos: "POS",
  invoices: "SII",
  products: "Productos",
  cash_register: "Caja",
  payment_methods: "Medios de pago",
  bank_accounts: "Ctas. bancarias",
  departments: "Departamentos",
  positions: "Cargos",
  payroll: "Nómina",
  warehouse_management: "Bodegas",
  stock_control: "Stock",
  product_catalog: "Catálogo",
  product_gallery: "Galería",
  raw_materials: "M. primas",
  certificates: "Certificados",
  tariffs: "Tarifas",
  measurements: "Mediciones",
  measurement_points: "P. medición",
  deliveries: "Retiro/Delivery",
  memberships: "Membresías",
  subscriptions: "Suscripciones",
  agreements: "Convenios",
  waste_collection_points: "P. recolección",
  waste_tariffs: "T. residuos",
  waste_certificates: "C. residuos",
  waste_agreements: "V. residuos",
  recipes: "Recetas",
  ingredients: "Ingredientes",
};

/** Roles FRIG por código, con el módulo que los habilita (null = siempre). */
export const FRIG_ROLE_CATALOG: { code: string; label: string; module: string | null }[] = [
  { code: "OWNER", label: "Propietario", module: null },
  { code: "ADMIN_LOCAL", label: "Administrador local", module: null },
  { code: "EMPLOYEE", label: "Empleado", module: null },
  { code: "CAJERO", label: "Cajero", module: "pos" },
  { code: "WAITER", label: "Mesero", module: "tables" },
  { code: "REPARTIDOR", label: "Repartidor", module: "deliveries" },
];

/** Cantidad de usuarios por rol de la sucursal, ordenada de mayor a menor. */
function roleEntriesOf(branch: Branch): [string, number][] {
  const raw = branch.users_by_role;
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw)
    .map(([code, count]) => [code, Number(count) || 0] as [string, number])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
}

/** Vencimiento del plan normalizado: marca vencido y próximo a vencer (≤ 7 días). */
function formatPlanExpiry(iso?: string | null): {
  label: string;
  expired: boolean;
  expiringSoon: boolean;
} | null {
  if (!iso) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}/.exec(iso)?.[0];
  let label: string;
  let dueTs: number;
  if (dateOnly) {
    const [y, m, d] = dateOnly.split("-").map(Number);
    dueTs = Date.UTC(y, m - 1, d);
    label = new Date(dueTs).toLocaleDateString("es-CL", { timeZone: "UTC" });
  } else {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    dueTs = d.getTime();
    label = d.toLocaleDateString("es-CL");
  }
  const days = Math.round((dueTs - Date.now()) / 86_400_000);
  return { label, expired: days < 0, expiringSoon: days >= 0 && days <= 7 };
}

function FilterChip({
  label, count, active, onClick, tone,
}: {
  label: string;
  count: number;
  active?: boolean;
  onClick?: () => void;
  tone?: "success" | "danger" | "warning";
}) {
  const interactive = Boolean(onClick);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      aria-pressed={interactive ? active : undefined}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        interactive ? "cursor-pointer" : "cursor-default",
        active
          ? "border-primary bg-primary/10 text-primary"
          : tone === "success"
            ? "border-success/30 bg-success/10 text-success"
            : tone === "danger"
              ? "border-danger/30 bg-danger/10 text-danger"
              : tone === "warning"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-border bg-background text-foreground",
        interactive && !active && "hover:border-primary/50",
      )}
    >
      {label}
      <span className={cn(
        "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
        active ? "bg-primary/15" : "bg-muted",
      )}>
        {count}
      </span>
    </button>
  );
}

export default function BranchesPage() {
  const queryClient = useQueryClient();
  const user = useSessionStore((s) => s.user);
  const canView = useCanViewBranches();
  const isSuperAdmin = Boolean(user?.is_superuser || user?.type_user === "ADM");
  const canCreateBranch = isSuperAdmin || user?.is_multi_branch;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [viewingUsers, setViewingUsers] = useState<Branch | null>(null);
  const [editingTheme, setEditingTheme] = useState<Branch | null>(null);
  const [editingPlan, setEditingPlan] = useState<Branch | null>(null);
  const [editingSii, setEditingSii] = useState<Branch | null>(null);
  // Desactivar es una acción sensible: se confirma con un modal antes de
  // aplicar. Reactivar es seguro y se hace directo.
  const [confirmDeactivate, setConfirmDeactivate] = useState<Branch | null>(null);
  const patchBranch = useSessionStore((s) => s.patchBranch);

  // Siempre pedimos la lista completa: el backend oculta las inactivas por
  // defecto en el listado (show_inactive=true las incluye) y no tiene filtro
  // server-side de is_active, así que el estado se filtra en local.
  const filter = useMemo<BranchesFilter>(() => {
    const base: BranchesFilter = { show_inactive: true };
    if (search) base.search = search;
    return { ...base, ...pageUrl };
  }, [search, pageUrl]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["branches", "manage", filter],
    queryFn: () => fetchBranches(filter),
    enabled: canView,
  });

  const loadedBranches = data?.results ?? [];
  const totalBranches = data?.count ?? 0;
  // Filtro de estado en local sobre la lista completa; los indicadores de la
  // barra siguen mostrando los totales globales aunque haya un filtro activo.
  const branches = statusFilter === "all"
    ? loadedBranches
    : loadedBranches.filter((b) =>
      statusFilter === "active" ? b.is_active !== false : b.is_active === false,
    );

  // Módulos POR sucursal: alimenta los chips de la tarjeta y define si el
  // acceso a la configuración SII (módulo invoices) está disponible. El
  // backend expone los módulos de a una sucursal (by_branch?branch_id=), así
  // que hay un fetch por tarjeta; para las que fallan (sin permiso) no hay
  // chips ni botón SII.
  const moduleQueries = useQueries({
    queries: loadedBranches.map((b) => ({
      queryKey: ["branch-modules", b.branch_id],
      queryFn: () => fetchBranchModules(Number(b.branch_id)),
      enabled: canView,
      staleTime: 60_000,
    })),
  });
  // Cálculo directo (barato: una pasada por sucursal), sin memo para no
  // pelear con la regla de dependencias de los hooks del compiler.
  const enabledModulesByBranch = new Map<string, BranchModuleConfiguration[]>();
  loadedBranches.forEach((b, i) => {
    const configs = moduleQueries[i]?.data;
    if (configs) {
      enabledModulesByBranch.set(
        String(b.branch_id),
        configs.filter((m) => m.is_enabled),
      );
    }
  });

  // Cálculo directo (barato) para no pelear con la regla de memoización del
  // compiler, igual que en el armado de tarjetas. Sobre la lista COMPLETA:
  // los indicadores son globales aunque haya filtro de estado activo.
  let totalUsers = 0;
  let planAlerts = 0;
  for (const b of loadedBranches) {
    totalUsers += b.users_count ?? 0;
    const expiry = formatPlanExpiry(b.plan_expiration_date);
    if (expiry && (expiry.expired || expiry.expiringSoon)) planAlerts += 1;
  }
  const stats = {
    total: totalBranches,
    active: loadedBranches.filter((b) => b.is_active !== false).length,
    inactive: loadedBranches.filter((b) => b.is_active === false).length,
    users: totalUsers,
    planAlerts,
  };

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      updateBranch(id, { is_active: isActive }),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      patchBranch(String(vars.id), { is_active: vars.isActive });
    },
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
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nueva sucursal
          </Button>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {/* Fila única de filtros e indicadores + buscador, centrados */}
        {!isLoading && !error && (
          <>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <FilterChip
                label="Sucursales"
                count={stats.total}
                active={statusFilter === "all"}
                onClick={() => { setStatusFilter("all"); setPageUrl({}); }}
              />
              <FilterChip
                label="Activas"
                count={stats.active}
                tone="success"
                active={statusFilter === "active"}
                onClick={() => { setStatusFilter(statusFilter === "active" ? "all" : "active"); setPageUrl({}); }}
              />
              <FilterChip
                label="Inactivas"
                count={stats.inactive}
                tone="danger"
                active={statusFilter === "inactive"}
                onClick={() => { setStatusFilter(statusFilter === "inactive" ? "all" : "inactive"); setPageUrl({}); }}
              />
              <FilterChip label="Usuarios" count={stats.users} />
              {stats.planAlerts > 0 && (
                <FilterChip label="Planes por vencer" count={stats.planAlerts} tone="warning" />
              )}
            </div>
            <div className="relative mx-auto w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPageUrl({}); }}
                placeholder="Buscar por nombre, RUT o email…"
                className="pl-9"
                aria-label="Buscar sucursal"
              />
            </div>
          </>
        )}

        {error ? (
          <p className="text-sm text-danger">No se pudieron cargar las sucursales.</p>
        ) : isLoading ? (
          <div className="flex flex-wrap justify-center gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 w-full max-w-sm animate-pulse rounded-2xl border border-border bg-background" />
            ))}
          </div>
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
            {/* Cards centradas */}
            <div className="flex flex-wrap justify-center gap-4">
              {branches.map((b) => {
                const manageable = isSuperAdmin || b.can_manage;
                // Configuración de la sucursal (plan, marca, SII, edición,
                // activación): propietario o super admin. Un administrador
                // local solo gestiona usuarios.
                const canConfigure = manageable
                  && (isSuperAdmin || !b.role_code || b.role_code.toUpperCase() === "OWNER");
                const roleEntries = roleEntriesOf(b);
                const expiry = formatPlanExpiry(b.plan_expiration_date);
                const branchLogo = b.logo ?? b.theme_config?.logo ?? null;
                const brandColor = b.theme_config?.primary_color ?? undefined;
                const enabledModules = enabledModulesByBranch.get(String(b.branch_id)) ?? [];
                const visibleModules = enabledModules.slice(0, 4);
                const extraModules = enabledModules.length - visibleModules.length;
                const invoicesOn = enabledModules.some((m) => m.module_name === "invoices");

                return (
                  <article
                    key={b.branch_id}
                    className={cn(
                      "group relative flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-background transition-all hover:border-primary/40 hover:shadow-md",
                      !b.is_active && "opacity-60",
                    )}
                  >
                    {/* Portada */}
                    <div className="relative flex flex-col items-center gap-3 border-b border-border px-4 pb-4 pt-8">
                      {isSuperAdmin && b.organization_name && (
                        <span className="absolute left-3 top-3 inline-flex max-w-[55%] items-center gap-1 truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          <Building2 className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{b.organization_name}</span>
                        </span>
                      )}
                      {canConfigure ? (
                        <button
                          onClick={() =>
                            b.is_active
                              ? setConfirmDeactivate(b)
                              : toggleActive.mutate({ id: Number(b.branch_id), isActive: true })
                          }
                          disabled={toggleActive.isPending}
                          title={b.is_active ? "Desactivar sucursal" : "Activar sucursal"}
                          className={cn(
                            "absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors",
                            b.is_active
                              ? "bg-success/15 text-success hover:bg-success/25"
                              : "bg-danger/15 text-danger hover:bg-danger/25",
                          )}
                        >
                          <Power className="h-2.5 w-2.5" />
                          {b.is_active ? "Activa" : "Inactiva"}
                        </button>
                      ) : (
                        <span
                          className={cn(
                            "absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            b.is_active
                              ? "bg-success/15 text-success"
                              : "bg-danger/15 text-danger",
                          )}
                        >
                          <Power className="h-2.5 w-2.5" />
                          {b.is_active ? "Activa" : "Inactiva"}
                        </span>
                      )}
                      <BrandLogo
                        src={branchLogo}
                        alt={branchName(b)}
                        name={branchName(b)}
                        fallbackColor={brandColor}
                        containerClassName="h-16 w-16 rounded-2xl shadow-md text-xl ring-2 ring-background"
                      />
                      <div className="text-center">
                        <h3 className="text-sm font-semibold">{branchName(b)}</h3>
                        {(b.fantasy_name || b.commercial_business) && (
                          <p className="text-xs text-muted-foreground">
                            {b.fantasy_name || b.commercial_business}
                          </p>
                        )}
                        {(b.commune || b.region) && (
                          <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {b.commune}{b.region ? `, ${b.region}` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Configuración: acceso directo a cada área */}
                    <div className="grid grid-cols-2 gap-2 p-3">
                      <button
                        type="button"
                        disabled={!canConfigure}
                        title={canConfigure ? undefined : "Solo el propietario puede gestionar el plan"}
                        onClick={() => canConfigure && setEditingPlan(b)}
                        className={cn(
                          "flex flex-col items-start gap-0.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
                          canConfigure ? "border-border hover:border-primary/50 hover:bg-muted/40" : "border-border/60 opacity-70",
                        )}
                      >
                        <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          <CreditCard className="h-3 w-3" /> Plan
                        </span>
                        <span className="w-full truncate text-xs font-semibold">
                          {b.plan_name ?? "Sin plan"}
                        </span>
                        {expiry ? (
                          <span className={cn(
                            "flex items-center gap-1 text-[10px] tabular-nums",
                            expiry.expired ? "text-danger" : expiry.expiringSoon ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                          )}>
                            {expiry.expired && <AlertTriangle className="h-2.5 w-2.5 shrink-0" />}
                            {expiry.expired ? `venció ${expiry.label}` : `vence ${expiry.label}`}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">sin vencimiento</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setViewingUsers(b)}
                        className="flex flex-col items-start gap-0.5 rounded-xl border border-border px-2.5 py-2 text-left transition-colors hover:border-primary/50 hover:bg-muted/40"
                      >
                        <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          <Users className="h-3 w-3" /> Usuarios
                          {!manageable && <span className="normal-case">(solo ver)</span>}
                        </span>
                        <span className="text-xs font-semibold tabular-nums">
                          {b.users_count ?? 0}
                        </span>
                        {roleEntries.length > 0 ? (
                          <span className="w-full truncate text-[10px] text-muted-foreground">
                            {roleEntries
                              .slice(0, 2)
                              .map(([code, count]) => `${count} ${getRoleLabel(code)}`)
                              .join(" · ")}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">sin asignar</span>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={!canConfigure}
                        title={canConfigure ? undefined : "Solo el propietario puede editar la marca"}
                        onClick={() => canConfigure && setEditingTheme(b)}
                        className={cn(
                          "flex flex-col items-start gap-0.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
                          canConfigure ? "border-border hover:border-primary/50 hover:bg-muted/40" : "border-border/60 opacity-70",
                        )}
                      >
                        <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          <Palette className="h-3 w-3" /> Marca
                        </span>
                        <span className="flex w-full items-center gap-1.5 truncate text-xs font-semibold">
                          {brandColor && (
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-border"
                              style={{ background: brandColor }}
                            />
                          )}
                          <span className="truncate">
                            {b.theme_config?.app_name ?? "Personalizar"}
                          </span>
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          {b.logo || branchLogo ? <BadgeCheck className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                          {branchLogo ? "logo propio" : "usar logo"}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={!canConfigure || !invoicesOn}
                        title={invoicesOn
                          ? (canConfigure ? "Configuración SII" : "Solo el propietario puede configurar el SII")
                          : "Requiere el módulo SII activo"}
                        onClick={() => canConfigure && invoicesOn && setEditingSii(b)}
                        className={cn(
                          "flex flex-col items-start gap-0.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
                          canConfigure && invoicesOn
                            ? "border-border hover:border-primary/50 hover:bg-muted/40"
                            : "border-border/60 opacity-70",
                        )}
                      >
                        <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          <FileText className="h-3 w-3" /> Facturación
                        </span>
                        <span className="text-xs font-semibold">
                          {invoicesOn
                            ? b.sii_config?.sii_enabled ? "SII activo" : "sin configurar"
                            : "módulo SII off"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {invoicesOn
                            ? b.sii_config?.sii_resolution_number
                              ? `res. ${b.sii_config.sii_resolution_number}`
                              : "configurar"
                            : "activa el módulo"}
                        </span>
                      </button>
                    </div>

                    {/* Módulos activos */}
                    {visibleModules.length > 0 && (
                      <div className="flex flex-wrap gap-1 px-3 pb-3">
                        {visibleModules.map((m) => (
                          <span
                            key={m.module_name}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                          >
                            {MODULE_SHORT_LABELS[m.module_name] ?? m.module_name}
                          </span>
                        ))}
                        {extraModules > 0 && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            +{extraModules}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Contacto */}
                    {(b.phone || b.email || b.dni || b.custom_domain) && (
                      <div className="flex flex-col gap-1 border-t border-border px-3 py-2 text-xs text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          {b.phone && (
                            <span className="flex items-center gap-1 tabular-nums">
                              <Phone className="h-3 w-3 shrink-0" />
                              {b.phone}
                            </span>
                          )}
                          {b.email && (
                            <span className="flex min-w-0 items-center gap-1">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate">{b.email}</span>
                            </span>
                          )}
                          {b.dni && (
                            <span className="flex items-center gap-1">
                              <IdCard className="h-3 w-3 shrink-0" />
                              {b.dni}
                            </span>
                          )}
                        </div>
                        {(b.custom_domain || b.from_email) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                            {b.custom_domain && (
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3 shrink-0" />
                                {b.custom_domain}
                              </span>
                            )}
                            {b.from_email && (
                              <span className="flex min-w-0 items-center gap-1">
                                <Mail className="h-3 w-3 shrink-0" />
                                <span className="truncate">desde {b.from_email}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Acciones */}
                    <div className="flex items-center justify-end border-t border-border px-3 py-2">
                      {canConfigure ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => setEditing(b)}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          Editar
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          {manageable ? "configuración solo para el propietario" : "solo lectura"}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Paginación */}
            <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
              <p className="text-xs text-muted-foreground">
                Mostrando {branches.length} de {totalBranches} sucursales
              </p>
              <div className="flex items-center gap-2">
                {pageUrl.previous && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageUrl((prev) => ({ ...prev, previous: pageUrl.previous }))}
                  >
                    ← Anterior
                  </Button>
                )}
                {pageUrl.next && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPageUrl((prev) => ({ ...prev, next: pageUrl.next }))}
                  >
                    Siguiente →
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modales */}
      {creating && (
        <BranchForm onClose={() => setCreating(false)} onSuccess={() => { setCreating(false); queryClient.invalidateQueries({ queryKey: ["branches"] }); }} />
      )}
      {editing && (
        <BranchForm branch={editing} onClose={() => setEditing(null)} onSuccess={() => { setEditing(null); queryClient.invalidateQueries({ queryKey: ["branches"] }); }} />
      )}
      {viewingUsers && (
        <BranchUsersDialog
          branch={viewingUsers}
          enabledModules={(enabledModulesByBranch.get(String(viewingUsers.branch_id)) ?? []).map((m) => m.module_name)}
          onClose={() => setViewingUsers(null)}
        />
      )}
      {editingTheme && (
        <BranchThemeDialog branch={editingTheme} onClose={() => setEditingTheme(null)} />
      )}
      {editingPlan && (
        <ApplyPlanDialog branch={editingPlan} onClose={() => setEditingPlan(null)} onApplied={() => {
          queryClient.invalidateQueries({ queryKey: ["branches"] });
          setEditingPlan(null);
        }} />
      )}
      {editingSii && (
        <BranchSiiDialog branch={editingSii} onClose={() => setEditingSii(null)} />
      )}
      {confirmDeactivate && (
        <AnimatedOverlay
          open={true}
          onClose={() => setConfirmDeactivate(null)}
          className="bg-black/50"
          panelClassName="flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold">Desactivar sucursal</h2>
                <p className="mt-1 text-sm">
                  ¿Realmente quieres desactivar{" "}
                  <strong>{branchName(confirmDeactivate)}</strong>?
                </p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li>· La sucursal dejará de operar: sin POS, ventas ni pedidos.</li>
                  <li>· Dejará de aparecer para tus usuarios al iniciar sesión.</li>
                  <li>· Puedes reactivarla cuando quieras desde esta misma pantalla.</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDeactivate(null)}
                disabled={toggleActive.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                isLoading={toggleActive.isPending}
                onClick={() => {
                  toggleActive.mutate(
                    { id: Number(confirmDeactivate.branch_id), isActive: false },
                    { onSettled: () => setConfirmDeactivate(null) },
                  );
                }}
              >
                Sí, desactivar
              </Button>
            </div>
          </div>
        </AnimatedOverlay>
      )}
    </div>
  );
}
