"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Search, Pencil, Power, Store, Users, Palette,
  Phone, Mail, CreditCard, CalendarDays, FileText, MapPin,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  useSessionStore,
  useCanViewBranches,
  useIsModuleEnabledFromConfig,
} from "@/lib/store/session";
import { branchName } from "@/lib/types";
import { fetchBranches, updateBranch } from "@/lib/api/branches";
import { getRoleLabel } from "@/lib/roles";
import { BranchForm } from "@/components/branches/branch-form";
import { BranchUsersDialog } from "@/components/branches/branch-users-dialog";
import { BranchThemeDialog } from "@/components/branches/branch-theme-dialog";
import { BranchSiiDialog } from "@/components/branches/branch-sii-dialog";
import { ApplyPlanDialog } from "@/components/branches/apply-plan-dialog";
import type { Branch } from "@/lib/types";
import type { BranchesFilter } from "@/lib/api/branches";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";

/** Cantidad de usuarios por rol de la sucursal, ordenada de mayor a menor. */
function roleEntriesOf(branch: Branch): [string, number][] {
  const raw = branch.users_by_role;
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw)
    .map(([code, count]) => [code, Number(count) || 0] as [string, number])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
}

function formatPlanExpiry(iso?: string | null): { label: string; expired: boolean } | null {
  if (!iso) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}/.exec(iso)?.[0];
  if (dateOnly) {
    const [y, m, d] = dateOnly.split("-").map(Number);
    const utc = Date.UTC(y, m - 1, d);
    const label = new Date(utc).toLocaleDateString("es-CL", { timeZone: "UTC" });
    const today = new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    return { label, expired: utc < todayUtc };
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    label: d.toLocaleDateString("es-CL"),
    expired: d.getTime() < Date.now(),
  };
}

export default function BranchesPage() {
  const queryClient = useQueryClient();
  const user = useSessionStore((s) => s.user);
  const canView = useCanViewBranches();
  const isSuperAdmin = Boolean(user?.is_superuser || user?.type_user === "ADM");
  const canCreateBranch = isSuperAdmin || user?.is_multi_branch;

  const [search, setSearch] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [viewingUsers, setViewingUsers] = useState<Branch | null>(null);
  const [editingTheme, setEditingTheme] = useState<Branch | null>(null);
  const [editingPlan, setEditingPlan] = useState<Branch | null>(null);
  const [editingSii, setEditingSii] = useState<Branch | null>(null);
  const patchBranch = useSessionStore((s) => s.patchBranch);
  const siiModuleEnabled = useIsModuleEnabledFromConfig("invoices");

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
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nueva sucursal
          </Button>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {/* Buscador */}
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPageUrl({}); }}
            placeholder="Buscar por nombre, RUT o email…"
            className="pl-9"
            aria-label="Buscar sucursal"
          />
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudieron cargar las sucursales.</p>
        ) : isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-52 animate-pulse rounded-2xl border border-border bg-muted/30" />
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
            {/* Cards centradas en la página */}
            <div className="flex flex-wrap justify-center gap-4">
              {branches.map((b) => {
                const manageable = isSuperAdmin || b.can_manage;
                const roleEntries = roleEntriesOf(b);
                const expiry = formatPlanExpiry(b.plan_expiration_date);
                const branchLogo = b.logo ?? b.theme_config?.logo ?? null;

                return (
                  <article
                    key={b.branch_id}
                    className={cn(
                      "group relative flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-md",
                      !b.is_active && "opacity-60",
                    )}
                  >
                    {/* Header con avatar centrado */}
                    <div className="relative flex flex-col items-center gap-3 border-b border-border bg-muted/30 px-4 pb-4 pt-5">
                      <BrandLogo
                        src={branchLogo}
                        alt={branchName(b)}
                        name={branchName(b)}
                        fallbackColor={b.theme_config?.primary_color}
                        containerClassName="h-16 w-16 rounded-2xl shadow-md text-xl"
                      />
                      {/* Badge de estado */}
                      {manageable ? (
                        <button
                          onClick={() =>
                            toggleActive.mutate({ id: Number(b.branch_id), isActive: !b.is_active })
                          }
                          disabled={toggleActive.isPending}
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
                      {/* Nombre */}
                      <div className="text-center">
                        <h3 className="text-sm font-semibold">{branchName(b)}</h3>
                        {b.commercial_business && (
                          <p className="text-xs text-muted-foreground">{b.commercial_business}</p>
                        )}
                        {b.commune && (
                          <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {b.commune}{b.region ? `, ${b.region}` : ""}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Contenido */}
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      {/* Plan */}
                      <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
                        <div className="flex items-center gap-1.5 font-medium">
                          <CreditCard className="h-3 w-3 shrink-0 text-muted-foreground" />
                          {b.plan_name ?? "Sin plan"}
                        </div>
                        {expiry && (
                          <p className={cn(
                            "mt-0.5 flex items-center gap-1 tabular-nums",
                            expiry.expired ? "text-danger" : "text-muted-foreground",
                          )}>
                            <CalendarDays className="h-3 w-3 shrink-0" />
                            vence {expiry.label}{expiry.expired ? " (vencido)" : ""}
                          </p>
                        )}
                      </div>

                      {/* Contact + Users */}
                      <div className="flex flex-col gap-1.5 text-xs">
                        {b.phone && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span className="tabular-nums">{b.phone}</span>
                          </div>
                        )}
                        {b.email && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{b.email}</span>
                          </div>
                        )}
                        {/* Roles */}
                        <button
                          type="button"
                          onClick={() => setViewingUsers(b)}
                          className="flex flex-wrap items-center gap-1 pt-1 text-left"
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
                            <span className="text-muted-foreground">
                              <span className="font-medium text-foreground">{b.users_count ?? 0}</span>{" "}
                              usuarios
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center justify-end gap-1 border-t border-border px-2 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Usuarios"
                        onClick={() => setViewingUsers(b)}
                      >
                        <Users className="h-3.5 w-3.5" />
                      </Button>
                      {manageable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Plan"
                          onClick={() => setEditingPlan(b)}
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {manageable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Editar"
                          onClick={() => setEditing(b)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {manageable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Tema"
                          onClick={() => setEditingTheme(b)}
                        >
                          <Palette className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {manageable && siiModuleEnabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Configuración SII"
                          onClick={() => setEditingSii(b)}
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
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
        <BranchUsersDialog branch={viewingUsers} onClose={() => setViewingUsers(null)} />
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
    </div>
  );
}
