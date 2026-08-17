"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Boxes,
  X,
  Calendar,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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
import { useCurrentBranch } from "@/lib/store/session";
import { useQuery } from "@tanstack/react-query";

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

function formatDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
}

export default function CombosPage() {
  const branch = useCurrentBranch();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ComboList | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ComboList | null>(null);
  const [form, setForm] = useState<ComboFormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingCombo, setLoadingCombo] = useState(false);
  const toast = useToast();
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["combos", "page", search, pageUrl],
    queryFn: () => fetchCombosPage(search || undefined, pageUrl.next || pageUrl.previous || undefined),
  });
  const combos = (page?.results ?? []) as ComboList[];
  const totalCombos = page?.count ?? 0;
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
      items: [
        ...prev.items,
        { product: firstProduct?.id ?? 0, quantity: 1 },
      ],
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
    const items = form.items
      .filter((it) => it.product && it.quantity > 0)
      .map((it) => ({ product: it.product, quantity: it.quantity }));

    const payload: ComboWriteRequest = {
      branch: Number(branch?.branch_id ?? 0),
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

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Combos</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona combos y promociones de productos
          </p>
        </div>
        <Button onClick={() => openModal()}>
          <Plus className="h-4 w-4" />
          Nuevo combo
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-6">
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
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : combos.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              {search ? "No se encontraron combos." : "Aún no hay combos creados."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Combo</th>
                    <th className="px-4 py-3">Precio</th>
                    <th className="px-4 py-3 text-center">Productos</th>
                    <th className="px-4 py-3">Vigencia</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {combos.map((combo) => (
                    <tr key={combo.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
                            <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium">{combo.name}</p>
                            {combo.description && (
                              <p className="truncate text-xs text-muted-foreground">
                                {combo.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatCLP(parseFloat(combo.combo_price || "0"))}
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {combo.items_count ?? 0}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {combo.start_date || combo.end_date ? (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {combo.start_date ? formatDate(combo.start_date) : "—"}
                            {" "}→{" "}
                            {combo.end_date ? formatDate(combo.end_date) : "—"}
                          </span>
                        ) : (
                          "Sin vigencia"
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            "inline-flex rounded px-2 py-0.5 text-xs font-medium",
                            combo.is_active
                              ? "bg-emerald-500/10 text-emerald-700"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {combo.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openModal(combo)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:text-danger"
                            onClick={() => setConfirmDelete(combo)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                {totalCombos} combo{totalCombos === 1 ? "" : "s"} en total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ previous: page?.previous })}
                  disabled={!page?.previous}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ next: page?.next })}
                  disabled={!page?.next}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-lg">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
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
              <div className="relative flex-1 overflow-y-auto p-6">
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
                              <Select
                                value={String(item.product)}
                                onChange={(e) =>
                                  updateItem(index, { product: Number(e.target.value) })
                                }
                              >
                                {productOptions.map((p) => (
                                  <option key={p.id} value={String(p.id)}>
                                    {p.name}
                                  </option>
                                ))}
                              </Select>
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

              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">
                <Button type="button" variant="outline" onClick={closeModal} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h2 className="text-base font-semibold">¿Eliminar combo?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se desactivará{" "}
              <span className="font-medium text-foreground">{confirmDelete.name}</span>. Esta
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
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
