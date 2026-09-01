"use client";

import { useMemo, useState, Fragment } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Boxes,
  X,
  Power,
  AlertTriangle,
  FolderOpen,
  ListChecks,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeleton";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { Switch } from "@/components/ui/switch";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { formatCLP, cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import {
  fetchModifierGroups,
  fetchModifierGroup,
  createModifierGroup,
  updateModifierGroup,
  deleteModifierGroup,
  fetchModifierOptions,
  createModifierOption,
  updateModifierOption,
  deleteModifierOption,
  type ModifierGroup,
  type ModifierGroupList,
  type ModifierOption,
  type ModifierGroupWriteRequest,
  type ModifierOptionWriteRequest,
} from "@/lib/api/modifier-groups";

interface GroupFormState {
  name: string;
  description: string;
  min_selections: string;
  max_selections: string;
  is_required: boolean;
  order: string;
  is_active: boolean;
}

interface OptionDraft {
  id: number | null;
  name: string;
  surcharge: string;
  is_default: boolean;
  order: string;
  is_active: boolean;
}

function emptyGroupForm(): GroupFormState {
  return {
    name: "",
    description: "",
    min_selections: "0",
    max_selections: "0",
    is_required: false,
    order: "0",
    is_active: true,
  };
}

function groupListToForm(group: ModifierGroupList): GroupFormState {
  return {
    name: group.name,
    description: group.description ?? "",
    min_selections: String(group.min_selections ?? 0),
    max_selections: String(group.max_selections ?? 0),
    is_required: group.is_required ?? false,
    order: String(group.order ?? 0),
    is_active: group.is_active ?? true,
  };
}

function groupToForm(group: ModifierGroup): GroupFormState {
  return {
    name: group.name,
    description: group.description ?? "",
    min_selections: String(group.min_selections ?? 0),
    max_selections: String(group.max_selections ?? 0),
    is_required: group.is_required ?? false,
    order: String(group.order ?? 0),
    is_active: group.is_active ?? true,
  };
}

function emptyOptionDraft(): OptionDraft {
  return {
    id: null,
    name: "",
    surcharge: "",
    is_default: false,
    order: "0",
    is_active: true,
  };
}

function optionToDraft(option: ModifierOption): OptionDraft {
  return {
    id: option.id,
    name: option.name,
    surcharge: option.surcharge ?? "",
    is_default: option.is_default ?? false,
    order: String(option.order ?? 0),
    is_active: option.is_active ?? true,
  };
}

function selectionsLabel(min?: number, max?: number): string {
  const minVal = min ?? 0;
  const maxVal = max ?? 0;
  if (minVal === 0 && maxVal === 0) return "Opcional / ilimitado";
  if (minVal === maxVal) return `${minVal} obligatorio${minVal === 1 ? "" : "s"}`;
  if (maxVal === 0) return `Mín. ${minVal}, sin máximo`;
  return `${minVal} – ${maxVal}`;
}

function groupStatus(group: ModifierGroupList): {
  label: string;
  badgeBg: string;
  badgeText: string;
} {
  if (!group.is_active) {
    return {
      label: "Inactivo",
      badgeBg: "bg-danger/10",
      badgeText: "text-danger",
    };
  }
  return {
    label: "Activo",
    badgeBg: "bg-emerald-500/10",
    badgeText: "text-emerald-700",
  };
}

function OptionsEditor({ groupId }: { groupId: number }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<OptionDraft | null>(null);

  const {
    data: options = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["modifier-options", groupId],
    queryFn: () => fetchModifierOptions(groupId),
  });

  const createOptionMutation = useMutation({
    mutationFn: (payload: ModifierOptionWriteRequest) => createModifierOption(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modifier-options", groupId] });
      queryClient.invalidateQueries({ queryKey: ["modifier-groups"] });
      toast.success("Opción creada");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al crear la opción");
    },
  });

  const updateOptionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ModifierOptionWriteRequest> }) =>
      updateModifierOption(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modifier-options", groupId] });
      queryClient.invalidateQueries({ queryKey: ["modifier-groups"] });
      toast.success("Opción actualizada");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al actualizar la opción");
    },
  });

  const deleteOptionMutation = useMutation({
    mutationFn: (id: number) => deleteModifierOption(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modifier-options", groupId] });
      queryClient.invalidateQueries({ queryKey: ["modifier-groups"] });
      toast.success("Opción eliminada");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al eliminar la opción");
    },
  });

  const isMutating =
    createOptionMutation.isPending ||
    updateOptionMutation.isPending ||
    deleteOptionMutation.isPending;

  function startNew() {
    setEditingId("new");
    setDraft(emptyOptionDraft());
  }

  function startEdit(option: ModifierOption) {
    setEditingId(option.id);
    setDraft(optionToDraft(option));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function handleSave() {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      toast.error("El nombre de la opción es obligatorio");
      return;
    }
    const surchargeValue = draft.surcharge.trim();
    const payload: ModifierOptionWriteRequest = {
      group: groupId,
      name,
      surcharge: surchargeValue || "0",
      is_default: draft.is_default,
      order: Number(draft.order) || 0,
      is_active: draft.is_active,
    };

    if (editingId === "new") {
      createOptionMutation.mutate(payload, { onSuccess: cancelEdit });
    } else if (typeof editingId === "number") {
      updateOptionMutation.mutate({ id: editingId, payload }, { onSuccess: cancelEdit });
    }
  }

  function handleDelete(id: number) {
    if (confirm("¿Eliminar esta opción? Esta acción no se puede deshacer.")) {
      deleteOptionMutation.mutate(id);
    }
  }

  if (isLoading) {
    return (
      <div className="py-4">
        <TableSkeleton rows={3} columns={5} />
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-4 text-sm text-danger">
        No se pudieron cargar las opciones del grupo.
      </p>
    );
  }

  return (
    <div className="py-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold">Opciones del grupo</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={startNew}
          disabled={editingId === "new" || isMutating}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Agregar opción
        </Button>
      </div>

      {options.length === 0 && editingId !== "new" ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          Este grupo aún no tiene opciones.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2 text-right">Cargo adicional</th>
                <th className="px-3 py-2 text-center">Por defecto</th>
                <th className="px-3 py-2 text-center">Orden</th>
                <th className="px-3 py-2 text-center">Activo</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {editingId === "new" && draft && (
                <OptionEditRow
                  draft={draft}
                  onChange={setDraft}
                  onSave={handleSave}
                  onCancel={cancelEdit}
                  isSaving={createOptionMutation.isPending}
                />
              )}
              {options.map((option) => {
                const isEditing = editingId === option.id;
                return isEditing && draft ? (
                  <OptionEditRow
                    key={option.id}
                    draft={draft}
                    onChange={setDraft}
                    onSave={handleSave}
                    onCancel={cancelEdit}
                    isSaving={updateOptionMutation.isPending}
                  />
                ) : (
                  <tr key={option.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{option.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCLP(parseFloat(option.surcharge || "0"))}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          option.is_default
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {option.is_default ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-muted-foreground">
                      {option.order ?? 0}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          option.is_active
                            ? "bg-emerald-500/10 text-emerald-700"
                            : "bg-danger/10 text-danger",
                        )}
                      >
                        {option.is_active ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => startEdit(option)}
                          disabled={editingId !== null || isMutating}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-danger hover:text-danger"
                          onClick={() => handleDelete(option.id)}
                          disabled={isMutating}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface OptionEditRowProps {
  draft: OptionDraft;
  onChange: (draft: OptionDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

function OptionEditRow({ draft, onChange, onSave, onCancel, isSaving }: OptionEditRowProps) {
  return (
    <tr className="bg-muted/20">
      <td className="px-3 py-2">
        <Input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="Nombre de la opción"
          className="h-8 text-sm"
          disabled={isSaving}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={draft.surcharge}
          onChange={(e) => onChange({ ...draft, surcharge: e.target.value })}
          placeholder="0"
          className="h-8 text-sm tabular-nums"
          disabled={isSaving}
        />
      </td>
      <td className="px-3 py-2 text-center">
        <Switch
          checked={draft.is_default}
          onCheckedChange={(v) => onChange({ ...draft, is_default: v })}
          disabled={isSaving}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          min={0}
          value={draft.order}
          onChange={(e) => onChange({ ...draft, order: e.target.value })}
          className="h-8 text-sm tabular-nums"
          disabled={isSaving}
        />
      </td>
      <td className="px-3 py-2 text-center">
        <Switch
          checked={draft.is_active}
          onCheckedChange={(v) => onChange({ ...draft, is_active: v })}
          disabled={isSaving}
        />
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-emerald-600 hover:bg-emerald-500/10"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="text-xs font-semibold">Guardar</span>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onCancel}
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function ModifiersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroupList | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ModifierGroupList | null>(null);
  const [form, setForm] = useState<GroupFormState>(emptyGroupForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);

  const { data: groups = [], isLoading, error } = useQuery({
    queryKey: ["modifier-groups"],
    queryFn: fetchModifierGroups,
  });

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(term));
  }, [groups, search]);

  const createGroupMutation = useMutation({
    mutationFn: (payload: ModifierGroupWriteRequest) => createModifierGroup(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modifier-groups"] });
      toast.success("Grupo creado");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al crear el grupo");
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ModifierGroupWriteRequest> }) =>
      updateModifierGroup(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modifier-groups"] });
      toast.success("Grupo actualizado");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al actualizar el grupo");
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: number) => deleteModifierGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["modifier-groups"] });
      toast.success("Grupo eliminado");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el grupo");
    },
  });

  async function openModal(group?: ModifierGroupList) {
    setEditingGroup(group ?? null);
    setFormError(null);
    if (group) {
      setLoadingDetails(true);
      setForm(groupListToForm(group));
      setModalOpen(true);
      try {
        const full = await fetchModifierGroup(group.id);
        setForm(groupToForm(full));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo cargar el grupo.");
        closeModal();
      } finally {
        setLoadingDetails(false);
      }
    } else {
      setForm(emptyGroupForm());
      setModalOpen(true);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setEditingGroup(null);
    setForm(emptyGroupForm());
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const name = form.name.trim();
    if (!name) {
      setFormError("El nombre es obligatorio.");
      return;
    }

    const min = Number(form.min_selections);
    const max = Number(form.max_selections);
    if (Number.isNaN(min) || min < 0) {
      setFormError("Las selecciones mínimas deben ser un número mayor o igual a 0.");
      return;
    }
    if (Number.isNaN(max) || max < 0) {
      setFormError("Las selecciones máximas deben ser un número mayor o igual a 0.");
      return;
    }
    if (max > 0 && min > max) {
      setFormError("Las selecciones mínimas no pueden ser mayores que las máximas.");
      return;
    }

    const payload: ModifierGroupWriteRequest = {
      name,
      description: form.description.trim() || null,
      min_selections: min,
      max_selections: max,
      is_required: form.is_required,
      order: Number(form.order) || 0,
      is_active: form.is_active,
    };

    try {
      if (editingGroup) {
        await updateGroupMutation.mutateAsync({ id: editingGroup.id, payload });
      } else {
        await createGroupMutation.mutateAsync(payload);
      }
      closeModal();
    } catch {
      // El error ya se muestra mediante toast en la mutación.
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteGroupMutation.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
    } catch {
      // Error manejado por toast.
    }
  }

  function toggleExpand(groupId: number) {
    setExpandedGroupId((prev) => (prev === groupId ? null : groupId));
  }

  function toggleActive(group: ModifierGroupList) {
    updateGroupMutation.mutate({
      id: group.id,
      payload: { is_active: !group.is_active },
    });
  }

  function groupActions(group: ModifierGroupList) {
    return [
      { label: "Editar", icon: Pencil, onClick: () => openModal(group) },
      {
        label: group.is_active ? "Desactivar" : "Activar",
        icon: Power,
        onClick: () => toggleActive(group),
      },
      { label: "Eliminar", icon: Trash2, danger: true, onClick: () => setConfirmDelete(group) },
    ];
  }

  const isSaving = createGroupMutation.isPending || updateGroupMutation.isPending;
  const hasData = filteredGroups.length > 0;

  const stats = useMemo(() => {
    const active = groups.filter((g) => g.is_active).length;
    const required = groups.filter((g) => g.is_required).length;
    return { total: groups.length, active, required };
  }, [groups]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Modificadores</h1>
          <p className="text-xs text-muted-foreground">
            Grupos y opciones de modificadores de productos
          </p>
        </div>
        <Button
          size="icon"
          onClick={() => openModal()}
          className="sm:hidden"
          title="Nuevo grupo"
          aria-label="Nuevo grupo"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button size="sm" onClick={() => openModal()} className="hidden sm:flex">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo grupo
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar grupo…"
            className="pl-9"
            aria-label="Buscar grupo"
          />
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudieron cargar los grupos de modificadores.</p>
        ) : isLoading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : !hasData ? (
          <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-8">
            <div className="flex max-w-xs flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <FolderOpen className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{search ? "Sin resultados" : "Aún no hay grupos"}</p>
                <p className="text-sm text-muted-foreground">
                  {search
                    ? "Prueba con otro término de búsqueda."
                    : "Crea tu primer grupo de modificadores para personalizar productos."}
                </p>
              </div>
              {!search && (
                <Button onClick={() => openModal()}>
                  <Plus className="mr-1 h-4 w-4" />
                  Crear grupo
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Boxes className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Total grupos</p>
                  <p className="text-lg font-semibold leading-none">{stats.total}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Power className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Activos</p>
                  <p className="text-lg font-semibold leading-none">{stats.active}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Requeridos</p>
                  <p className="text-lg font-semibold leading-none">{stats.required}</p>
                </div>
              </div>
            </div>

            {/* Vista tabla desktop */}
            <div className="hidden overflow-x-auto rounded-xl border border-border shadow-sm sm:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Grupo</th>
                    <th className="px-4 py-3 text-center">Selecciones</th>
                    <th className="px-4 py-3 text-center">Requerido</th>
                    <th className="px-4 py-3 text-center">Opciones</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredGroups.map((group) => {
                    const status = groupStatus(group);
                    const isExpanded = expandedGroupId === group.id;
                    return (
                      <Fragment key={group.id}>
                        <tr className="transition-colors hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                                <Boxes className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium">{group.name}</p>
                                {group.description && (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {group.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-muted-foreground">
                            {selectionsLabel(group.min_selections, group.max_selections)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                                group.is_required
                                  ? "bg-amber-500/10 text-amber-700"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {group.is_required ? "Sí" : "No"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                              <ListChecks className="h-3 w-3" />
                              {Number(group.options_count)} opción
                              {Number(group.options_count) === 1 ? "" : "es"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                                status.badgeBg,
                                status.badgeText,
                              )}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => toggleExpand(group.id)}
                                aria-label={isExpanded ? "Contraer" : "Expandir"}
                                className={cn(
                                  "rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                                  isExpanded && "bg-muted text-foreground",
                                )}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => toggleActive(group)}
                                aria-label={`${group.is_active ? "Desactivar" : "Activar"} ${group.name}`}
                                className={cn(
                                  "rounded-full p-2 transition-colors",
                                  group.is_active
                                    ? "text-emerald-600 hover:bg-emerald-500/10"
                                    : "text-muted-foreground hover:bg-muted hover:text-danger",
                                )}
                              >
                                <Power className="h-4 w-4" />
                              </button>
                              <ActionsMenu
                                ariaLabel={`Acciones de ${group.name}`}
                                items={groupActions(group)}
                              />
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${group.id}-expanded`}>
                            <td colSpan={6} className="bg-muted/20 px-4 py-0">
                              <OptionsEditor groupId={group.id} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Vista cards móvil */}
            <div className="grid grid-cols-1 gap-4 sm:hidden">
              {filteredGroups.map((group) => {
                const status = groupStatus(group);
                const isExpanded = expandedGroupId === group.id;
                return (
                  <div
                    key={group.id}
                    className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                          <Boxes className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{group.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {group.description || status.label}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => toggleActive(group)}
                          aria-label={`${group.is_active ? "Desactivar" : "Activar"} ${group.name}`}
                          className={cn(
                            "rounded-full p-2 transition-colors",
                            group.is_active
                              ? "text-emerald-600 hover:bg-emerald-500/10"
                              : "text-muted-foreground hover:bg-muted hover:text-danger",
                          )}
                        >
                          <Power className="h-5 w-5" />
                        </button>
                        <ActionsMenu
                          ariaLabel={`Acciones de ${group.name}`}
                          items={groupActions(group)}
                        />
                      </div>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Selecciones</p>
                        <p className="truncate font-medium">
                          {selectionsLabel(group.min_selections, group.max_selections)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Requerido</p>
                        <p className="truncate font-medium">{group.is_required ? "Sí" : "No"}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Opciones</p>
                        <p className="truncate font-medium">
                          {Number(group.options_count)} opción
                          {Number(group.options_count) === 1 ? "" : "es"}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Estado</p>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            status.badgeBg,
                            status.badgeText,
                          )}
                        >
                          {status.label}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleExpand(group.id)}
                      className="mb-3 flex items-center justify-center gap-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" />
                          Ocultar opciones
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          Ver opciones
                        </>
                      )}
                    </button>

                    {isExpanded && <OptionsEditor groupId={group.id} />}
                  </div>
                );
              })}
            </div>

            <p className="text-sm text-muted-foreground">
              {filteredGroups.length} grupo{filteredGroups.length === 1 ? "" : "s"}
              {search ? " encontrado" : ""}
              {filteredGroups.length === 1 ? "" : "s"}
            </p>
          </>
        )}
      </div>

      {/* Modal de grupo */}
      <Modal open={modalOpen} onClose={closeModal} title={editingGroup ? "Editar grupo" : "Nuevo grupo"} size="lg">
        <form onSubmit={handleSubmit}>
          <ModalBody>
            {loadingDetails && (
              <div className="mb-4 grid place-items-center rounded-lg border border-border bg-muted/20 py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label htmlFor="group-name" className="text-sm font-medium">
                  Nombre
                </label>
                <Input
                  id="group-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Tamaño de bebida"
                  required
                />
              </div>

              <div className="flex flex-col gap-2 sm:col-span-2">
                <label htmlFor="group-description" className="text-sm font-medium">
                  Descripción
                </label>
                <Input
                  id="group-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Opcional"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="group-min" className="text-sm font-medium">
                  Selecciones mínimas
                </label>
                <Input
                  id="group-min"
                  type="number"
                  min={0}
                  value={form.min_selections}
                  onChange={(e) => setForm({ ...form, min_selections: e.target.value })}
                  className="tabular-nums"
                />
                <p className="text-xs text-muted-foreground">0 = opcional</p>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="group-max" className="text-sm font-medium">
                  Selecciones máximas
                </label>
                <Input
                  id="group-max"
                  type="number"
                  min={0}
                  value={form.max_selections}
                  onChange={(e) => setForm({ ...form, max_selections: e.target.value })}
                  className="tabular-nums"
                />
                <p className="text-xs text-muted-foreground">0 = ilimitado</p>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="group-order" className="text-sm font-medium">
                  Orden
                </label>
                <Input
                  id="group-order"
                  type="number"
                  min={0}
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: e.target.value })}
                  className="tabular-nums"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Estado</label>
                <div className="flex h-10 items-center gap-3">
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.is_active ? "Activo" : "Inactivo"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:col-span-2">
                <label className="text-sm font-medium">Requerido</label>
                <div className="flex h-10 items-center gap-3">
                  <Switch
                    checked={form.is_required}
                    onCheckedChange={(v) => setForm({ ...form, is_required: v })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.is_required
                      ? "El cliente debe seleccionar al menos una opción"
                      : "El cliente puede omitir este grupo"}
                  </span>
                </div>
              </div>
            </div>

            {formError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-danger/10 p-3 text-sm text-danger">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}

            {editingGroup && (
              <div className="mt-6 border-t border-border pt-4">
                <OptionsEditor groupId={editingGroup.id} />
              </div>
            )}
          </ModalBody>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={closeModal} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Guardar
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Confirmación eliminar */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="¿Eliminar grupo?" size="sm">
        <ModalBody>
          <p className="text-sm text-muted-foreground">
            Se eliminará{" "}
            <span className="font-medium text-foreground">{confirmDelete?.name}</span>. Esta
            acción no se puede deshacer.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleteGroupMutation.isPending}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDelete} isLoading={deleteGroupMutation.isPending}>
            Eliminar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
