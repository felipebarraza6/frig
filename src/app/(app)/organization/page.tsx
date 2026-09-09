"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, Store } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionStore, useCanViewOrganization } from "@/lib/store/session";
import { fetchOrganizations } from "@/lib/api/organizations";
import { PlanCatalogEditor } from "@/components/branches/plan-catalog-editor";
import { cn } from "@/lib/utils";

export default function OrganizationPage() {
  const canView = useCanViewOrganization();
  const branches = useSessionStore((s) => s.branches);
  const ownedOrganizations = useSessionStore((s) => s.ownedOrganizations);
  const isSuperAdmin = useSessionStore((s) => s.user?.is_superuser || s.user?.type_user === "ADM");

  const { data: orgs, isLoading: orgsLoading, error: orgsError } = useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
    enabled: canView,
  });
  // El dueño de la org solo ve sus organizaciones; el superadmin ve todas las
  // visibles (gestiona cualquier org).
  const visibleOrgs = useMemo(() => {
    if (!orgs) return null;
    if (isSuperAdmin || ownedOrganizations.length === 0) return orgs;
    const ownedIds = new Set(ownedOrganizations.map((o) => String(o.id)));
    return orgs.filter((o) => ownedIds.has(String(o.id)));
  }, [orgs, ownedOrganizations, isSuperAdmin]);
  const org = visibleOrgs?.[0] ?? null;

  if (!canView) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-6 text-center">
        <Building2 className="h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-semibold">Sin acceso</h1>
        <p className="text-sm text-muted-foreground">
          No tienes permisos para ver la organización.
        </p>
      </div>
    );
  }

  const orgName = org?.name ?? branches[0]?.organization_name ?? "Mi organización";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Organización</h1>
          <p className="text-xs text-muted-foreground">
            {orgName} — datos y planes de tu organización
          </p>
        </div>
        <Link
          href="/branches"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Store className="mr-1.5 h-3.5 w-3.5" />
          Gestionar sucursales
        </Link>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        {/* Datos de la organización */}
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Datos de la organización</h2>
          </div>
          {orgsLoading ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : orgsError ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No se pudieron cargar los datos de la organización.
            </p>
          ) : org ? (
            <>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Nombre</dt>
                  <dd className="font-medium">{org.name}</dd>
                </div>
                {org.business_name && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Razón social</dt>
                    <dd>{org.business_name}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">RUT</dt>
                  <dd>{org.dni}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Sucursales creadas</dt>
                  <dd className="font-medium tabular-nums">{org.stores_count}</dd>
                </div>
                {org.max_branches != null && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Máx. sucursales</dt>
                    <dd className="tabular-nums">{org.max_branches}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">Activa</dt>
                  <dd>{org.is_active === false ? "No" : "Sí"}</dd>
                </div>
              </dl>
              {(visibleOrgs?.length ?? 0) > 1 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Mostrando 1 de {visibleOrgs?.length} organizaciones visibles.
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No hay datos de organización disponibles para tu usuario.
            </p>
          )}
        </section>

        {/* Catálogo de planes: edición inline */}
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Planes</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Edita los planes base de tu organización (Emprendimiento, Local, En crecimiento…).
            Es el mismo catálogo de contratación de la landing.
          </p>
          <PlanCatalogEditor />
        </section>
      </div>
    </div>
  );
}
