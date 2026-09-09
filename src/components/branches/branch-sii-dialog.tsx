"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { updateBranchSiiConfig } from "@/lib/api/branches";
import { useToast } from "@/lib/store/toast";
import { branchName, type Branch } from "@/lib/types";

interface BranchSiiDialogProps {
  branch: Branch;
  onClose: () => void;
}

/**
 * Configuración SII (facturación electrónica) de una sucursal: resolución,
 * certificado digital y su contraseña. Solo disponible cuando el módulo de
 * documentos tributarios (invoices) está activo; la pantalla que decide
 * mostrarlo es la lista de sucursales.
 */
export function BranchSiiDialog({ branch, onClose }: BranchSiiDialogProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const sii = branch.sii_config;

  const [enabled, setEnabled] = useState(sii?.sii_enabled ?? false);
  const [resolutionNumber, setResolutionNumber] = useState(
    sii?.sii_resolution_number ?? "",
  );
  const [resolutionDate, setResolutionDate] = useState(sii?.sii_resolution_date ?? "");
  const [certificate, setCertificate] = useState<File | null>(null);
  const [password, setPassword] = useState("");

  const save = useMutation({
    mutationFn: () =>
      updateBranchSiiConfig(branch.branch_id, {
        sii_enabled: enabled,
        sii_resolution_number: resolutionNumber.trim(),
        sii_resolution_date: resolutionDate,
        digital_certificate: certificate,
        certificate_password: password,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AnimatedOverlay
      open={true}
      onClose={onClose}
      panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
    >
      <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:max-h-[90vh] md:max-w-lg md:rounded-xl md:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Configuración SII — {branchName(branch)}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Facturación SII habilitada</p>
                <p className="text-xs text-muted-foreground">
                  Activa la emisión de documentos tributarios electrónicos de esta sucursal.
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                label="Facturación SII habilitada"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="N° de resolución"
                hint="Resolución SII que autoriza la emisión."
              >
                <Input
                  value={resolutionNumber}
                  onChange={(e) => setResolutionNumber(e.target.value)}
                  placeholder="Ej: 1234"
                  className="h-9"
                />
              </Field>
              <Field label="Fecha de resolución">
                <Input
                  type="date"
                  value={resolutionDate}
                  onChange={(e) => setResolutionDate(e.target.value)}
                  className="h-9"
                />
              </Field>
            </div>

            <Field
              label="Certificado digital"
              hint={
                certificate
                  ? `Nuevo certificado: ${certificate.name}`
                  : sii?.digital_certificate
                    ? "Ya hay un certificado cargado; súbelo de nuevo solo para reemplazarlo."
                    : "Archivo .p12 / .pfx entregado por el SII."
              }
            >
              <Input
                type="file"
                accept=".p12,.pfx,.pem"
                onChange={(e) => setCertificate(e.target.files?.[0] ?? null)}
                className="h-9 cursor-pointer pt-1.5 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary"
              />
            </Field>

            <Field
              label="Contraseña del certificado"
              hint="Solo si cargas un certificado nuevo o necesitas actualizarla."
            >
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="h-9"
              />
            </Field>
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
