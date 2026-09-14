"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import {
  createOrganization,
  updateOrganization,
  deleteOrganization,
  type OrganizationDetail,
  type OrganizationPayload,
} from "@/lib/api/organizations";
import { useToast } from "@/lib/store/toast";

interface OrganizationFormProps {
  open: boolean;
  onClose: () => void;
  organization?: OrganizationDetail | null;
}

export function OrganizationForm({ open, onClose, organization }: OrganizationFormProps) {
  // El modal vive montado en el padre; renderizando el formulario solo al
  // abrir (y keyed por organización) el estado arranca limpio en cada apertura
  // sin necesidad de sincronizarlo con un effect.
  if (!open) return null;
  return (
    <OrganizationFormInner
      key={organization?.id ?? "new"}
      onClose={onClose}
      organization={organization ?? null}
    />
  );
}

function OrganizationFormInner({
  onClose,
  organization,
}: {
  onClose: () => void;
  organization: OrganizationDetail | null;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!organization;

  const [form, setForm] = useState<OrganizationPayload>(() =>
    organization
      ? {
          name: organization.name ?? "",
          business_name: organization.business_name ?? "",
          dni: organization.dni ?? "",
          max_branches: organization.max_branches ?? null,
          is_active: organization.is_active !== false,
        }
      : { name: "", business_name: "", dni: "", max_branches: null, is_active: true },
  );

  const patch = (patch: Partial<OrganizationPayload>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["organizations"] });

  const saveMutation = useMutation({
    mutationFn: () =>
      isEditing
        ? updateOrganization(organization!.id, form)
        : createOrganization(form),
    onSuccess: () => {
      toast.success(isEditing ? "Organización actualizada" : "Organización creada");
      invalidate();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    saveMutation.mutate();
  };

  return (
    <Modal open onClose={onClose} size="md">
      <form onSubmit={handleSubmit}>
        <ModalBody className="flex flex-col gap-4">
          <Field label="Nombre" required>
            <Input
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Mi Empresa"
              required
            />
          </Field>
          <Field label="Razón social">
            <Input
              value={form.business_name ?? ""}
              onChange={(e) => patch({ business_name: e.target.value })}
              placeholder="SpA, Ltda, etc."
            />
          </Field>
          <Field label="RUT">
            <Input
              value={form.dni ?? ""}
              onChange={(e) => patch({ dni: e.target.value })}
              placeholder="12.345.678-9"
            />
          </Field>
          <Field label="Máx. sucursales" hint="Dejar vacío para sin límite.">
            <Input
              type="number"
              value={form.max_branches ?? ""}
              onChange={(e) =>
                patch({ max_branches: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="Ilimitado"
              className="w-32"
            />
          </Field>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.is_active !== false}
              onCheckedChange={(v) => patch({ is_active: v })}
              label="Organización activa"
            />
            <span className="text-sm text-muted-foreground">Activa</span>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saveMutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={saveMutation.isPending} disabled={!form.name.trim()}>
            {isEditing ? "Guardar cambios" : "Crear organización"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

interface OrganizationDeleteConfirmProps {
  open: boolean;
  onClose: () => void;
  organization: OrganizationDetail;
}

export function OrganizationDeleteConfirm({
  open,
  onClose,
  organization,
}: OrganizationDeleteConfirmProps) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => deleteOrganization(organization.id),
    onSuccess: () => {
      toast.success("Organización eliminada");
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <ModalBody>
        <p className="text-sm">
          ¿Eliminar la organización <strong>{organization.name}</strong>?
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Esta acción no se puede deshacer. Las sucursales de la organización quedarán sin grupo.
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={deleteMutation.isPending}>
          Cancelar
        </Button>
        <Button
          isLoading={deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
          className="border-danger/40 bg-danger text-danger-foreground hover:bg-danger/90"
        >
          Eliminar
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/** Botón para abrir el formulario de crear organización. */
export function CreateOrganizationButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Nueva organización
      </Button>
      <OrganizationForm open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Botón para abrir el formulario de editar una organización. */
export function EditOrganizationButton({ organization }: { organization: OrganizationDetail }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" />
        Editar
      </Button>
      <OrganizationForm open={open} onClose={() => setOpen(false)} organization={organization} />
    </>
  );
}

/** Botón para confirmar eliminación de organización. */
export function DeleteOrganizationButton({ organization }: { organization: OrganizationDetail }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="border-danger/40 text-danger hover:bg-danger/10"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        Eliminar
      </Button>
      <OrganizationDeleteConfirm open={open} onClose={() => setOpen(false)} organization={organization} />
    </>
  );
}
