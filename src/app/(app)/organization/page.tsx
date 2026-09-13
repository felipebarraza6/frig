"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, Store, ChevronDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionStore, useCanViewOrganization } from "@/lib/store/session";
import { fetchOrganizations, type OrganizationDetail } from "@/lib/api/organizations";
import { OrgPlansEditor } from "@/components/organizations/org-plans-editor";
import { OrganizationPicker } from "@/components/organizations/organization-picker";
import {
  CreateOrganizationButton,
  EditOrganizationButton,
  DeleteOrganizationButton,
} from "@/components/organizations/organization-form";
import { cn } from "@/lib/utils";

export default function OrganizationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canView = useCanViewOrganization();
  const ownedOrganizations = useSessionStore((s) => s.ownedOrganizations);
  const isSuperAdmin = useSessionStore(
    (s) => s.user?.is_superuser || s.user?.type_user === "ADM",
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const {
    data: orgs,
    isLoading: orgsLoading,
    error: orgsError,
  } = useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
    enabled: canView,
  });

  const visibleOrgs = useMemo(() => {
    if (!orgs) return null;
    if (isSuperAdmin || ownedOrganizations.length === 0) return orgs;
    const ownedIds = new Set(ownedOrganizations.map((o) => String(o.id)));
    return orgs.filter((o) => ownedIds.has(String(o.id)));
  }, [orgs, ownedOrganizations, isSuperAdmin]);

  // Leer org ID desde URL, fallback a la primera org disponible
  const orgIdFromUrl = searchParams.get("org");
  const org = useMemo(() => {
    if (!visibleOrgs || visibleOrgs.length === 0) return null;
    if (orgIdFromUrl) {
      const found = visibleOrgs.find((o) => String(o.id) === orgIdFromUrl);
      if (found) return found;
    }
    return visibleOrgs[0];
  }, [visibleOrgs, orgIdFromUrl]);

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

  const totalOrgs = visibleOrgs?.length ?? 0;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Organizaciones</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona las organizaciones y sus planes de módulos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/branches"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Store className="mr-1.5 h-3.5 w-3.5" />
            Sucursales
          </Link>
          {isSuperAdmin && <CreateOrganizationButton />}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        {/* Selector de organización */}
        {totalOrgs > 0 && (
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-3 self-start rounded-lg border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:bg-muted/50"
          >
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{org?.name ?? "Seleccionar organización"}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
            {totalOrgs > 1 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {totalOrgs}
              </span>
            )}
          </button>
        )}

        {/* Datos de la organización */}
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Datos de la organización</h2>
            </div>
            {org && isSuperAdmin && (
              <div className="flex items-center gap-2">
                <EditOrganizationButton organization={org} />
                <DeleteOrganizationButton organization={org} />
              </div>
            )}
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
            <OrgDataGrid org={org} />
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No hay datos de organización disponibles para tu usuario.
            </p>
          )}
        </section>

        {/* Planes de módulos de la organización */}
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Planes de módulos</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Configura los planes de módulos que {org?.name ?? "esta organización"} ofrece a sus sucursales.
            Cada plan define qué módulos y límites tiene la sucursal.
          </p>
          {org && <OrgPlansEditor organizationId={org.id} organizationName={org.name} />}
        </section>
      </div>

      {/* Modal picker de organizaciones */}
      <OrganizationPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        organizations={visibleOrgs ?? []}
        currentOrgId={org?.id}
        isLoading={orgsLoading}
      />
    </div>
  );
}

function OrgDataGrid({ org }: { org: OrganizationDetail }) {
  return (
    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <DataCell label="Nombre" value={org.name} />
      {org.business_name && <DataCell label="Razón social" value={org.business_name} />}
      {org.dni && <DataCell label="RUT" value={org.dni} />}
      <DataCell label="Sucursales" value={String(org.stores_count ?? 0)} mono />
      {org.max_branches != null && (
        <DataCell label="Máx. sucursales" value={String(org.max_branches)} mono />
      )}
      <DataCell
        label="Estado"
        value={org.is_active === false ? "Inactiva" : "Activa"}
        badge={org.is_active !== false}
      />
    </dl>
  );
}

function DataCell({
  label,
  value,
  mono,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-medium",
          mono && "tabular-nums",
          badge && value === "Activa" && "text-success",
          badge && value === "Inactiva" && "text-danger",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
