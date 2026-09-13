"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Building2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import type { OrganizationDetail } from "@/lib/api/organizations";
import { cn } from "@/lib/utils";

interface OrganizationPickerProps {
  open: boolean;
  onClose: () => void;
  organizations: OrganizationDetail[];
  currentOrgId?: number | string | null;
  isLoading?: boolean;
}

export function OrganizationPicker({
  open,
  onClose,
  organizations,
  currentOrgId,
  isLoading,
}: OrganizationPickerProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return organizations;
    const q = search.toLowerCase();
    return organizations.filter(
      (org) =>
        org.name.toLowerCase().includes(q) ||
        org.business_name?.toLowerCase().includes(q) ||
        org.dni?.toLowerCase().includes(q),
    );
  }, [organizations, search]);

  const selectOrg = (org: OrganizationDetail) => {
    router.push(`/organization?org=${org.id}`);
    onClose();
    setSearch("");
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <ModalBody className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Seleccionar organización</h2>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, razón social o RUT..."
            className="pl-9"
            autoFocus
          />
        </div>

        {/* Lista */}
        <div className="flex max-h-[400px] flex-col gap-1 overflow-y-auto">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {search ? "No se encontraron organizaciones" : "No hay organizaciones disponibles"}
            </div>
          ) : (
            filtered.map((org) => {
              const isCurrent = currentOrgId && String(org.id) === String(currentOrgId);
              return (
                <button
                  key={org.id}
                  onClick={() => selectOrg(org)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                    isCurrent
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40 hover:bg-muted/50",
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{org.name}</span>
                      {isCurrent && (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {org.business_name && <span>{org.business_name}</span>}
                      {org.dni && (
                        <>
                          {org.business_name && <span>•</span>}
                          <span className="tabular-nums">{org.dni}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{org.stores_count ?? 0} sucursales</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ModalBody>
    </Modal>
  );
}
