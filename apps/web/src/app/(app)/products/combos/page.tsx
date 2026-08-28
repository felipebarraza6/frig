"use client";

import { useMemo, useState } from "react";
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
  Calendar,
  Copy,
  Power,
  AlertTriangle,
  FolderOpen,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { formatCLP, cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import {
  useCreateComboMutation,
  useUpdateComboMutation,
  useDeleteComboMutation,
  type ComboList,
  type ComboWriteRequest,
} from "@/lib/hooks/useCatalog";
import { useProducts } from "@/lib/hooks/useCatalog";
import { fetchCombo, fetchCombosPage } from "@/lib/api/combos";
import type { Combo } from "@/lib/api/combos";

interface ComboFormItem {
  product: number;
  quantity: number;
  product_name?: string;
}

interface ComboFormState {
  name: string;
  description: string;
  combo_price: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
  notes: string;
  items: ComboFormItem[];
}

function emptyForm(): ComboFormState {
  return {
    name: "",
    description: "",
    combo_price: "",
    is_active: true,
    start_date: "",
    end_date: "",
    notes: "",
    items: [],
  };
}

function comboToForm(combo: Combo): ComboFormState {
  return {
    name: combo.name,
    description: combo.description ?? "",
    combo_price: combo.combo_price ?? "",
    is_active: combo.is_active ?? true,
    start_date: combo.start_date ?? "",
    end_date: combo.end_date ?? "",
    notes: combo.notes ?? "",
    items:
      combo.items?.map((it) => ({
        product: it.product,
        quantity: it.quantity ?? 1,
        product_name: (it as { product_name?: string }).product_name,
      })) ?? [],
  };
}

function comboToPayload(combo: Combo): ComboWriteRequest {
  return {
    name: combo.name,
    description: combo.description ?? null,
    combo_price: combo.combo_price ?? "0",
    is_active: combo.is_active ?? true,
    start_date: combo.start_date ?? null,
    end_date: combo.end_date ?? null,
    notes: combo.notes ?? null,
    items:
      combo.items?.map((it) => ({
        product: it.product,
        quantity: it.quantity ?? 1,
      })) ?? [],
  };
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
}

function isExpired(endDate?: string | null): boolean {
  if (!endDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(endDate) < today;
}

function isExpiringSoon(endDate?: string | null): boolean {
  if (!endDate) return false;
  const end = new Date(endDate).getTime();
  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return end >= now && end - now <= oneWeek;
}

type ComboStatus = {
  label: string;
  badgeBg: string;
  badgeText: string;
};

function comboStatus(combo: ComboList): ComboStatus {
  if (!combo.is_active) {
    return {
      label: "Inactivo",
      badgeBg: "bg-danger/10",
      badgeText: "text-danger",
    };
  }
  if (isExpired(combo.end_date)) {
    return {
      label: "Vencido",
      badgeBg: "bg-danger/10",
      badgeText: "text-danger",
    };
  }
  if (isExpiringSoon(combo.end_date)) {
    return {
      label: "Por vencer",
      badgeBg: "bg-amber-500/10",
      badgeText: "text-amber-700",
    };
  }
  return {
    label: "Activo",
    badgeBg: "bg-emerald-500/10",
    badgeText: "text-emerald-700",
  };
}

export default function CombosPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ComboList | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ComboList | null>(null);
  const [form, setForm] = useState<ComboFormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingCombo, setLoadingCombo] = useState(false);
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["combos", "page", search, pageUrl],
    queryFn: () => fetchCombosPage(search || undefined, pageUrl.next || pageUrl.previous || undefined),
  });
  const combos = useMemo(() => (page?.results ?? []) as ComboList[], [page]);
  const totalCombos = page?.count ?? 0;

  const stats = useMemo(() => {
    const active = combos.filter((c) => c.is_active).length;
    const inactive = combos.length - active;
    const expired = combos.filter((c) => c.is_active && isExpired(c.end_date)).length;
    const soon = combos.filter((c) => c.is_active && !isExpired(c.end_date) && isExpiringSoon(c.end_date)).length;
    return { active, inactive, expired, soon };
  }, [combos]);

  const { data: products = [] } = useProducts();
  const productOptions = useMemo(() => {
    const map = new Map(products.map((p) => [p.id, p]));
    form.items.forEach((it) => {
      if (!map.has(it.product) && it.product_name) {
        map.set(it.product, {
          id: it.product,
          name: `${it.product_name} (no disponible)`,
        } as (typeof products)[number]);
      }
    });
    return Array.from(map.values());
  }, [products, form.items]);

  const createMutation = useCreateComboMutation();
  const updateMutation = useUpdateComboMutation();
  const deleteMutation = useDeleteComboMutation();

  function openModal(combo?: ComboList) {
    setEditing(combo ?? null);
    setFormError(null);
    if (combo) {
      setLoadingCombo(true);
      setModalOpen(true);
      fetchCombo(combo.id)
        .then((full) => setForm(comboToForm(full)))
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "No se pudo cargar el combo.");
          closeModal();
        })
        .finally(() => setLoadingCombo(false));
    } else {
      setForm(emptyForm());
      setLoadingCombo(false);
      setModalOpen(true);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
  }

  function addItem() {
    const firstProduct = products[0];
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { product: firstProduct?.id ?? 0, quantity: 1 }],
    }));
  }

  function updateItem(index: number, patch: Partial<ComboFormItem>) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    }));
  }

  function removeItem(index: number) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError("El nombre es obligatorio.");
      return;
    }
    const price = parseFloat(form.combo_price || "0");
    if (price < 0 || Number.isNaN(price)) {
      setFormError("El precio del combo debe ser un número positivo.");
      return;
    }
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setFormError("La fecha de fin no puede ser anterior a la fecha de inicio.");
      return;
    }
    const items = form.items
      .filter((it) => it.product && it.quantity > 0)
      .map((it) => ({ product: it.product, quantity: it.quantity }));
    if (items.length === 0) {
      setFormError("Agrega al menos un producto al combo.");
      return;
    }

    const payload: ComboWriteRequest = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      combo_price: price.toFixed(2),
      is_active: form.is_active,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      notes: form.notes.trim() || null,
      items,
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, payload });
        toast.success("Combo actualizado");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Combo creado");
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el combo.");
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteMutation.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
      toast.success("Combo eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el combo");
    }
  }

  async function handleDuplicate(combo: ComboList) {
    try {
      const full = await fetchCombo(combo.id);
      const payload: ComboWriteRequest = {
        name: `${full.name} (copia)`,
        description: full.description ?? null,
        combo_price: full.combo_price ?? "0",
        is_active: full.is_active ?? true,
        start_date: full.start_date ?? null,
        end_date: full.end_date ?? null,
        notes: full.notes ?? null,
        items: full.items?.map((it) => ({ product: it.product, quantity: it.quantity ?? 1 })) ?? [],
      };
      await createMutation.mutateAsync(payload);
      toast.success("Combo duplicado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo duplicar el combo.");
    }
  }

  const toggleActive = useMutation({
    mutationFn: async (combo: ComboList) => {
      const full = await fetchCombo(combo.id);
      await updateMutation.mutateAsync({
        id: combo.id,
        payload: { ...comboToPayload(full), is_active: !combo.is_active },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["combos"] });
      toast.success("Estado actualizado");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado.");
    },
  });

  function comboActions(combo: ComboList) {
    return [
      { label: "Editar", icon: Pencil, onClick: () => openModal(combo) },
      { label: "Duplicar", icon: Copy, onClick: () => handleDuplicate(combo) },
      { label: "Eliminar", icon: Trash2, danger: true, onClick: () => setConfirmDelete(combo) },
    ];
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const hasData = combos.length > 0;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Combos</h1>
          <p className="text-xs text-muted-foreground">
            Promociones y packs de productos
          </p>
        </div>
        <Button
          size="icon"
          onClick={() => openModal()}
          className="sm:hidden"
          title="Nuevo combo"
          aria-label="Nuevo combo"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          onClick={() => openModal()}
          className="hidden sm:flex"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo combo
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageUrl({});
            }}
            placeholder="Buscar combo…"
            className="pl-9"
            aria-label="Buscar combo"
          />
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudieron cargar los combos.</p>
        ) : isLoading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : !hasData ? (
          <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border bg-muted/20 p-8">
            <div className="flex max-w-xs flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <FolderOpen className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{search ? "Sin resultados" : "Aún no hay combos"}</p>
                <p className="text-sm text-muted-foreground">
                  {search
                    ? "Prueba con otro término de búsqueda."
                    : "Crea tu primera promoción para vender productos agrupados."}
                </p>
              </div>
              {!search && (
                <Button onClick={() => openModal()}>
                  <Plus className="mr-1 h-4 w-4" />
                  Crear combo
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Resumen */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Boxes className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Total combos</p>
                  <p className="text-lg font-semibold leading-none">{totalCombos}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Zap className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Activos</p>
                  <p className="text-lg font-semibold leading-none">{stats.active}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Inactivos</p>
                  <p className="text-lg font-semibold leading-none">{stats.inactive}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Por vencer / vencidos</p>
                  <p className="text-lg font-semibold leading-none">{stats.soon + stats.expired}</p>
                </div>
              </div>
            </div>

            {/* Vista tabla para desktop */}
            <div className="hidden overflow-x-auto rounded-xl border border-border shadow-sm sm:block">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Combo</th>
                    <th className="px-4 py-3 text-right">Precio</th>
                    <th className="px-4 py-3 text-center">Productos</th>
                    <th className="px-4 py-3">Vigencia</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {combos.map((combo) => {
                    const status = comboStatus(combo);
                    return (
                      <tr
                        key={combo.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                              <Boxes className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{combo.name}</p>
                              {combo.description && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {combo.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold tabular-nums">
                            {formatCLP(parseFloat(combo.combo_price || "0"))}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                            {combo.items_count ?? 0} producto{(combo.items_count ?? 0) === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {combo.start_date || combo.end_date ? (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3 shrink-0" />
                              {combo.start_date ? formatDate(combo.start_date) : "—"}
                              {" → "}
                              {combo.end_date ? formatDate(combo.end_date) : "—"}
                            </span>
                          ) : (
                            "Sin vigencia"
                          )}
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
                              onClick={() => toggleActive.mutate(combo)}
                              aria-label={`${combo.is_active ? "Desactivar" : "Activar"} ${combo.name}`}
                              className={cn(
                                "rounded-full p-2 transition-colors",
                                combo.is_active
                                  ? "text-emerald-600 hover:bg-emerald-500/10"
                                  : "text-muted-foreground hover:bg-muted hover:text-danger",
                              )}
                            >
                              <Power className="h-4 w-4" />
                            </button>
                            <ActionsMenu
                              ariaLabel={`Acciones de ${combo.name}`}
                              items={comboActions(combo)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Vista de cards — solo móvil */}
            <div className="grid grid-cols-1 gap-4 sm:hidden">
              {combos.map((combo) => {
                const status = comboStatus(combo);
                const expired = isExpired(combo.end_date);
                const soon = !expired && isExpiringSoon(combo.end_date);
                return (
                  <div
                    key={combo.id}
                    className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                          <Boxes className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{combo.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {combo.description || status.label}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleActive.mutate(combo)}
                        aria-label={`${combo.is_active ? "Desactivar" : "Activar"} ${combo.name}`}
                        className={cn(
                          "shrink-0 rounded-full p-2 transition-colors",
                          combo.is_active
                            ? "text-emerald-600 hover:bg-emerald-500/10"
                            : "text-muted-foreground hover:bg-muted hover:text-danger",
                        )}
                      >
                        <Power className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Precio combo</p>
                        <p className="text-lg font-semibold tabular-nums">
                          {formatCLP(parseFloat(combo.combo_price || "0"))}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Productos</p>
                        <p className="truncate font-medium">
                          {combo.items_count ?? 0} incluido{(combo.items_count ?? 0) === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <p className="text-xs text-muted-foreground">Vigencia</p>
                        <p className="flex flex-wrap items-center gap-1 text-xs">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {combo.start_date ? formatDate(combo.start_date) : "Sin inicio"}
                            {" → "}
                            {combo.end_date ? formatDate(combo.end_date) : "Sin fin"}
                          </span>
                          {expired && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                              <AlertTriangle className="h-3 w-3" />
                              Vencido
                            </span>
                          )}
                          {soon && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              <AlertTriangle className="h-3 w-3" />
                              Pronto
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                          status.badgeBg,
                          status.badgeText,
                        )}
                      >
                        {status.label}
                      </span>
                      <ActionsMenu
                        ariaLabel={`Acciones de ${combo.name}`}
                        items={comboActions(combo)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground">
                {totalCombos} combo{totalCombos === 1 ? "" : "s"} en total
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 flex-1 sm:h-9 sm:flex-none"
                  onClick={() => setPageUrl({ previous: page?.previous })}
                  disabled={!page?.previous}
                >
                  <span className="sm:hidden">Ant.</span>
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 flex-1 sm:h-9 sm:flex-none"
                  onClick={() => setPageUrl({ next: page?.next })}
                  disabled={!page?.next}
                >
                  <span className="sm:hidden">Sig.</span>
                  <span className="hidden sm:inline">Siguiente</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatedOverlay
        open={modalOpen}
        onClose={closeModal}
        panelClassName="flex items-end justify-center overflow-hidden p-0 sm:items-center sm:p-4"
      >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-xl sm:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-4 sm:px-6">
              <h2 className="text-base font-semibold">
                {editing ? "Editar combo" : "Nuevo combo"}
              </h2>
              <button
                onClick={closeModal}
                aria-label="Cerrar"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="relative flex-1 overflow-y-auto p-4 sm:p-6">
                {loadingCombo && (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-card/80">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label htmlFor="combo-name" className="text-sm font-medium">
                      Nombre
                    </label>
                    <Input
                      id="combo-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      placeholder="Ej: Combo Familiar"
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label htmlFor="combo-description" className="text-sm font-medium">
                      Descripción
                    </label>
                    <Input
                      id="combo-description"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="combo-price" className="text-sm font-medium">
                      Precio del combo
                    </label>
                    <Input
                      id="combo-price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.combo_price}
                      onChange={(e) => setForm({ ...form, combo_price: e.target.value })}
                      required
                      placeholder="0"
                      className="tabular-nums"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="combo-status" className="text-sm font-medium">
                      Estado
                    </label>
                    <Select
                      id="combo-status"
                      value={form.is_active ? "true" : "false"}
                      onChange={(e) =>
                        setForm({ ...form, is_active: e.target.value === "true" })
                      }
                    >
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="combo-start" className="text-sm font-medium">
                      Fecha inicio
                    </label>
                    <Input
                      id="combo-start"
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="combo-end" className="text-sm font-medium">
                      Fecha fin
                    </label>
                    <Input
                      id="combo-end"
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label htmlFor="combo-notes" className="text-sm font-medium">
                      Notas
                    </label>
                    <Input
                      id="combo-notes"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Productos incluidos</label>
                      <Button type="button" variant="outline" size="sm" onClick={addItem}>
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Agregar producto
                      </Button>
                    </div>

                    {form.items.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                        Agrega al menos un producto al combo.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {form.items.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-end gap-2 rounded-lg border border-border p-3"
                          >
                            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                              <label className="text-xs text-muted-foreground">Producto</label>
                              <SearchableSelect
                                value={String(item.product)}
                                onChange={(value) => updateItem(index, { product: Number(value) })}
                                options={productOptions.map((p) => ({ value: String(p.id), label: p.name }))}
                                placeholder="Selecciona un producto…"
                                searchPlaceholder="Buscar producto…"
                                emptyMessage="No se encontraron productos"
                              />
                            </div>
                            <div className="flex w-28 flex-col gap-1.5">
                              <label className="text-xs text-muted-foreground">Cantidad</label>
                              <Input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItem(index, { quantity: Number(e.target.value) })
                                }
                                className="tabular-nums"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(index)}
                              aria-label="Quitar producto"
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {formError && (
                  <p className="mt-4 text-sm text-danger">{formError}</p>
                )}
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-4 sm:px-6">
                <Button type="button" variant="outline" onClick={closeModal} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={isSaving}>
                  Guardar
                </Button>
              </div>
            </form>
          </div>
      </AnimatedOverlay>

      <AnimatedOverlay
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <h2 className="text-base font-semibold">¿Eliminar combo?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se desactivará{" "}
              <span className="font-medium text-foreground">{confirmDelete!.name}</span>. Esta
              acción no se puede deshacer.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(null)}
                disabled={deleteMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                isLoading={deleteMutation.isPending}
              >
                Eliminar
              </Button>
            </div>
          </div>
      </AnimatedOverlay>
    </div>
  );
}
