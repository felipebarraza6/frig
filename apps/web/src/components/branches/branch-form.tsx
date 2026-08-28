"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { useSessionStore } from "@/lib/store/session";
import { createBranch, updateBranch } from "@/lib/api/branches";
import { fetchModulePlans, applyBranchPlan } from "@/lib/api/module-plans";
import { FRIG_PLAN_NAME } from "@/lib/modules";
import { branchName } from "@/lib/types";
import type { Branch, BranchPayload } from "@/lib/types";

interface BranchFormProps {
  branch?: Branch;
  onClose: () => void;
  onSuccess: () => void;
}

export function BranchForm({ branch, onClose, onSuccess }: BranchFormProps) {
  const user = useSessionStore((s) => s.user);
  const isSuperAdmin = Boolean(user?.is_superuser || user?.type_user === "ADM");
  const isEditing = Boolean(branch);

  const [businessName, setBusinessName] = useState(branch?.business_name ?? "");
  const [fantasyName, setFantasyName] = useState(branch?.fantasy_name ?? "");
  const [commercialBusiness, setCommercialBusiness] = useState(branch?.commercial_business ?? "");
  const [phone, setPhone] = useState(branch?.phone ?? "");
  const [email, setEmail] = useState(branch?.email ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");
  const [region, setRegion] = useState(branch?.region ?? "");
  const [province, setProvince] = useState(branch?.province ?? "");
  const [commune, setCommune] = useState(branch?.commune ?? "");
  const [dni, setDni] = useState(branch?.dni ?? "");
  const [isActive, setIsActive] = useState(branch?.is_active ?? true);
  const [ownerId, setOwnerId] = useState<string>(branch?.owner_id ? String(branch.owner_id) : "");
  const [error, setError] = useState<string | null>(null);

  const { data: plans = [] } = useQuery({
    queryKey: ["module-plans"],
    queryFn: fetchModulePlans,
    enabled: !isEditing,
  });

  const frigPlan = plans.find(
    (p) => p.name.toLowerCase().includes(FRIG_PLAN_NAME.toLowerCase()) ||
      p.name.toLowerCase().includes("frig"),
  );

  const save = useMutation({
    mutationFn: async () => {
      const payload: BranchPayload = {
        business_name: businessName,
        fantasy_name: fantasyName || undefined,
        commercial_business: commercialBusiness || undefined,
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        region: region || undefined,
        province: province || undefined,
        commune: commune || undefined,
        dni: dni || undefined,
        is_active: isActive,
      };
      if (isSuperAdmin && ownerId) {
        payload.owner_id = Number(ownerId);
      }

      if (isEditing && branch) {
        return updateBranch(branch.branch_id, payload);
      }

      const created = await createBranch(payload);
      // FRIG usa un plan fijo de gestión gastronómica/comercial; se aplica
      // automáticamente al crear la sucursal.
      if (frigPlan) {
        await applyBranchPlan(Number(created.branch_id), Number(frigPlan.id));
      }
      return created;
    },
    onSuccess: () => onSuccess(),
    onError: (err: Error) => setError(err.message || "No se pudo guardar la sucursal."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!businessName.trim()) {
      setError("El nombre de la sucursal es obligatorio.");
      return;
    }
    save.mutate();
  };

  return (
    <AnimatedOverlay
      open={true}
      onClose={onClose}
      panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
    >
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-xl md:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">
            {isEditing ? `Editar ${branchName(branch!)}` : "Nueva sucursal"}
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
          id="branch-form"
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="business_name" className="text-sm font-medium">
                  Nombre de la sucursal
                </label>
                <Input
                  id="business_name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="fantasy_name" className="text-sm font-medium">
                  Nombre de fantasía
                </label>
                <Input
                  id="fantasy_name"
                  value={fantasyName}
                  onChange={(e) => setFantasyName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="commercial_business" className="text-sm font-medium">
                  Giro comercial
                </label>
                <Input
                  id="commercial_business"
                  value={commercialBusiness}
                  onChange={(e) => setCommercialBusiness(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="phone" className="text-sm font-medium">
                  Teléfono
                </label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="address" className="text-sm font-medium">
                  Dirección
                </label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="region" className="text-sm font-medium">
                  Región
                </label>
                <Input
                  id="region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="province" className="text-sm font-medium">
                  Provincia
                </label>
                <Input
                  id="province"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="commune" className="text-sm font-medium">
                  Comuna
                </label>
                <Input
                  id="commune"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="dni" className="text-sm font-medium">
                  RUT
                </label>
                <Input
                  id="dni"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  placeholder="12.345.678-9"
                />
              </div>
              {isSuperAdmin && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="owner_id" className="text-sm font-medium">
                    ID propietario
                  </label>
                  <Input
                    id="owner_id"
                    type="number"
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Sucursal activa
              </label>

              {error && (
                <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger sm:col-span-2">
                  {error}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={save.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </AnimatedOverlay>
  );
}
