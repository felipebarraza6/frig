"use client";

import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageBody, PageShell } from "@/components/page-shell";

export function CrmDenied({
  title,
  icon,
}: {
  title: string;
  icon: ReactNode;
}) {
  return (
    <PageShell>
      <PageHeader title={title} icon={icon} />
      <PageBody className="gap-4">
        <div className="grid place-items-center rounded-2xl border border-dashed border-border px-4 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-medium">Sin permisos para CRM</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Pedile al administrador de la sucursal acceso a clientes y CRM.
          </p>
        </div>
      </PageBody>
    </PageShell>
  );
}
